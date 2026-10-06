"""Explicit first-owner creation, with no demonstration account or content seeding."""
from __future__ import annotations

import argparse
from getpass import getpass
from pathlib import Path
import re
import sys

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.models import User
from app.utils.auth import hash_password


def validate_credentials(username: str, password: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_.-]{3,50}", username):
        raise ValueError("Username must contain 3–50 letters, digits, dots, underscores or hyphens")
    if not 12 <= len(password.encode("utf-8")) <= 72 or not password.strip():
        raise ValueError("Password must contain 12–72 UTF-8 bytes")


def create_admin(engine: Engine, username: str, password: str) -> None:
    validate_credentials(username, password)
    with Session(engine) as session:
        if session.exec(select(User).where(User.is_admin == True)).first():  # noqa: E712
            raise ValueError("An owner already exists; this command never replaces accounts")
        if session.exec(select(User).where(User.username == username)).first():
            raise ValueError("This username already exists; choose another username")
        session.add(User(username=username, nickname=username, is_admin=True, hashed_password=hash_password(password)))
        session.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", required=True)
    args = parser.parse_args()
    if Path.cwd().resolve() != BACKEND:
        parser.error("Run this command from the backend directory")
    password = getpass("Owner password (12–72 UTF-8 bytes): ")
    confirmation = getpass("Repeat password: ")
    if password != confirmation:
        print("Passwords do not match; no account created", file=sys.stderr)
        return 1
    try:
        validate_credentials(args.username, password)
        from app.database import engine, init_db
        init_db()
        create_admin(engine, args.username, password)
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 1
    print("Owner created. Log in using the username and password you selected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
