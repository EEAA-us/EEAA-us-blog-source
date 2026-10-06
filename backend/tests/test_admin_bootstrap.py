import io
import importlib.util
import sys
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from types import ModuleType
from unittest.mock import Mock, patch

from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool

from app.models import User
from app.utils.auth import hash_password, verify_password


BOOTSTRAP_PATH = Path(__file__).resolve().parents[1] / "scripts" / "create_admin.py"
BOOTSTRAP_SPEC = importlib.util.spec_from_file_location("create_admin_script", BOOTSTRAP_PATH)
if BOOTSTRAP_SPEC is None or BOOTSTRAP_SPEC.loader is None:
    raise RuntimeError("Unable to load create_admin script for isolated tests")
bootstrap = importlib.util.module_from_spec(BOOTSTRAP_SPEC)
BOOTSTRAP_SPEC.loader.exec_module(bootstrap)


class AdminBootstrapTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        User.__table__.create(self.engine)

    def tearDown(self):
        self.engine.dispose()

    def users(self):
        with Session(self.engine) as session:
            return list(session.exec(select(User)))

    @staticmethod
    def snapshot(user):
        return (
            user.id,
            user.username,
            user.nickname,
            user.hashed_password,
            user.avatar,
            user.email,
            user.bio,
            user.is_admin,
            user.created_at,
            user.updated_at,
        )

    def test_valid_credentials_create_one_admin_with_matching_bcrypt_hash(self):
        password = "unique-test-owner-password"

        bootstrap.create_admin(self.engine, "owner.test", password)

        users = self.users()
        self.assertEqual(len(users), 1)
        self.assertTrue(users[0].is_admin)
        self.assertEqual(users[0].username, "owner.test")
        self.assertNotEqual(users[0].hashed_password, password)
        self.assertTrue(verify_password(password, users[0].hashed_password))

    def test_empty_short_and_over_72_utf8_byte_passwords_are_rejected_without_accounts(self):
        cases = (
            ("empty", ""),
            ("short", "short"),
            ("overlong_ascii", "a" * 73),
            ("overlong_utf8", "密" * 25),
        )
        for label, password in cases:
            with self.subTest(case=label):
                with self.assertRaises(ValueError):
                    bootstrap.create_admin(self.engine, "new-owner", password)
                self.assertEqual(self.users(), [], "invalid password created an account")

    def test_invalid_or_overlong_usernames_are_rejected_without_accounts(self):
        for label, username in (
            ("too_short", "ab"),
            ("illegal_character", "bad name"),
            ("too_long", "u" * 51),
        ):
            with self.subTest(case=label):
                with self.assertRaises(ValueError):
                    bootstrap.create_admin(self.engine, username, "valid-test-password")
                self.assertEqual(self.users(), [], "invalid username created an account")

    def test_existing_admin_is_never_replaced_or_modified(self):
        with Session(self.engine) as session:
            owner = User(
                username="existing-owner",
                nickname="Original owner",
                hashed_password=hash_password("existing-test-owner-password"),
                avatar="/original.png",
                email="owner@example.test",
                bio="Keep this profile",
                is_admin=True,
            )
            session.add(owner)
            session.commit()
            session.refresh(owner)
            before = self.snapshot(owner)

        with self.assertRaisesRegex(ValueError, "owner already exists"):
            bootstrap.create_admin(self.engine, "another-owner", "replacement-test-password")

        after_users = self.users()
        self.assertEqual(len(after_users), 1)
        self.assertTrue(self.snapshot(after_users[0]) == before, "existing owner fields changed")

    def test_existing_same_name_visitor_is_never_promoted_or_modified(self):
        with Session(self.engine) as session:
            visitor = User(
                username="reserved-name",
                nickname="Visitor nickname",
                hashed_password=hash_password("existing-visitor-password"),
                avatar="/visitor.png",
                email="visitor@example.test",
                bio="Keep visitor data",
                is_admin=False,
            )
            session.add(visitor)
            session.commit()
            session.refresh(visitor)
            before = self.snapshot(visitor)

        with self.assertRaisesRegex(ValueError, "username already exists"):
            bootstrap.create_admin(self.engine, "reserved-name", "replacement-test-password")

        after_users = self.users()
        self.assertEqual(len(after_users), 1)
        self.assertTrue(self.snapshot(after_users[0]) == before, "existing visitor fields changed")
        self.assertFalse(after_users[0].is_admin)

    def test_cli_password_mismatch_does_not_initialize_database(self):
        fake_database = ModuleType("app.database")
        fake_database.engine = object()
        fake_database.init_db = Mock()
        error_output = io.StringIO()
        with (
            patch.dict(sys.modules, {"app.database": fake_database}),
            patch.object(bootstrap, "getpass", side_effect=["first-test-password", "second-test-password"]),
            patch.object(sys, "argv", ["create_admin.py", "--username", "cli-owner"]),
            redirect_stderr(error_output),
        ):
            result = bootstrap.main()

        self.assertEqual(result, 1)
        fake_database.init_db.assert_not_called()
        self.assertIn("Passwords do not match", error_output.getvalue())


if __name__ == "__main__":
    unittest.main()
