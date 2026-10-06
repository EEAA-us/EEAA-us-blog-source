import importlib.util
import os
import secrets
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


CONFIG_SOURCE = Path(__file__).resolve().parents[1] / "app" / "config.py"


def load_isolated_config(root: Path, environment: dict[str, str]):
    app_dir = root / "app"
    app_dir.mkdir(parents=True)
    isolated_config = app_dir / "config.py"
    shutil.copyfile(CONFIG_SOURCE, isolated_config)
    spec = importlib.util.spec_from_file_location(
        f"isolated_config_{secrets.token_hex(8)}", isolated_config
    )
    if spec is None or spec.loader is None:
        raise AssertionError("Could not load isolated config module")
    module = importlib.util.module_from_spec(spec)
    with patch.dict(os.environ, environment, clear=True):
        spec.loader.exec_module(module)
    return module


class SecretKeyConfigTests(unittest.TestCase):
    def test_missing_blank_whitespace_example_and_short_keys_are_rejected_without_leaks(self):
        invalid_cases = (
            ("missing", None),
            ("blank", ""),
            ("whitespace", " \t \n"),
            ("example_local", "change-this-local-secret"),
            ("example_generic", "your-secret-key"),
            ("short", "s" * 31),
        )
        for label, value in invalid_cases:
            with self.subTest(case=label), tempfile.TemporaryDirectory() as directory:
                environment = {} if value is None else {"SECRET_KEY": value}
                with self.assertRaises(RuntimeError) as raised:
                    load_isolated_config(Path(directory), environment)
                message = str(raised.exception)
                self.assertIn("SECRET_KEY must be", message)
                if value:
                    self.assertNotIn(value, message)

    def test_exactly_32_utf8_bytes_are_preserved(self):
        value = "k" * 32
        with tempfile.TemporaryDirectory() as directory:
            config = load_isolated_config(Path(directory), {"SECRET_KEY": value})
        self.assertEqual(config.SECRET_KEY, value)

    def test_random_longer_key_is_preserved_exactly(self):
        value = secrets.token_urlsafe(48)
        self.assertGreater(len(value.encode("utf-8")), 32)
        with tempfile.TemporaryDirectory() as directory:
            config = load_isolated_config(Path(directory), {"SECRET_KEY": value})
        self.assertEqual(config.SECRET_KEY, value)

    def test_utf8_byte_length_is_used_for_short_keys(self):
        value = "密" * 10
        self.assertEqual(len(value), 10)
        self.assertLess(len(value.encode("utf-8")), 32)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(RuntimeError) as raised:
                load_isolated_config(Path(directory), {"SECRET_KEY": value})
        self.assertNotIn(value, str(raised.exception))

    def test_temporary_dotenv_loads_and_overrides_process_environment(self):
        dotenv_secret = "d" * 40
        process_secret = "p" * 40
        dotenv_database = "sqlite:///temporary-dotenv.db"
        process_database = "sqlite:///process-environment.db"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".env").write_text(
                f"SECRET_KEY={dotenv_secret}\nDATABASE_URL={dotenv_database}\n",
                encoding="utf-8",
            )
            config = load_isolated_config(
                root,
                {"SECRET_KEY": process_secret, "DATABASE_URL": process_database},
            )
        self.assertEqual(config.SECRET_KEY, dotenv_secret)
        self.assertEqual(config.DATABASE_URL, dotenv_database)


if __name__ == "__main__":
    unittest.main()
