import unittest
from datetime import timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine
from unittest.mock import patch

from app.api.auth import router as auth_router
from app.deps import get_session
from app.models import User
from app.utils import auth as auth_utils


class AuthPasswordLimitTests(unittest.TestCase):
    def test_hash_password_rejects_more_than_72_utf8_bytes(self):
        for label, password in (("ascii", "a" * 73), ("utf8", "密" * 25)):
            with self.subTest(case=label), self.assertRaisesRegex(ValueError, "72 UTF-8 bytes"):
                auth_utils.hash_password(password)

    def test_verify_password_returns_false_for_more_than_72_utf8_bytes(self):
        stored_hash = auth_utils.hash_password("valid-test-password")
        for label, password in (("ascii", "a" * 73), ("utf8", "密" * 25)):
            with self.subTest(case=label):
                self.assertFalse(auth_utils.verify_password(password, stored_hash))

    def test_created_token_keeps_hs256_jwt_format_and_uses_aware_utc_expiry(self):
        original_encode = jwt.encode
        captured_payload = {}

        def capture_payload(payload, key, algorithm):
            captured_payload.update(payload)
            return original_encode(payload, key, algorithm)

        with patch.object(jwt, "encode", side_effect=capture_payload):
            token = auth_utils.create_token({"sub": "owner", "admin": True})

        expiry = captured_payload["exp"]
        self.assertIsNotNone(expiry.tzinfo)
        self.assertEqual(expiry.utcoffset(), timedelta(0))
        self.assertEqual(jwt.get_unverified_header(token), {"alg": "HS256", "typ": "JWT"})
        claims = jwt.decode(token, auth_utils.SECRET_KEY, algorithms=["HS256"])
        self.assertEqual(claims["sub"], "owner")
        self.assertTrue(claims["admin"])
        self.assertIsInstance(claims["exp"], int)

    def test_login_rejects_ascii_and_utf8_passwords_over_72_bytes(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        User.__table__.create(engine)
        with Session(engine) as session:
            session.add(
                User(
                    username="login-owner",
                    nickname="login-owner",
                    hashed_password=auth_utils.hash_password("valid-test-password"),
                    is_admin=True,
                )
            )
            session.commit()

        app = FastAPI()
        app.include_router(auth_router)

        def isolated_session():
            with Session(engine) as session:
                yield session

        app.dependency_overrides[get_session] = isolated_session
        client = TestClient(app)
        try:
            for label, password in (("ascii", "a" * 73), ("utf8", "密" * 25)):
                with self.subTest(case=label):
                    response = client.post(
                        "/api/auth/login",
                        json={"username": "login-owner", "password": password},
                    )
                    self.assertEqual(response.status_code, 401, response.text)
                    self.assertNotIn("accessToken", response.text)
        finally:
            client.close()
            app.dependency_overrides.clear()
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
