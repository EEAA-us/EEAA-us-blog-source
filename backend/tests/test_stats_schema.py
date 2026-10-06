import sqlite3
import unittest
from pathlib import Path


SCHEMA = Path(__file__).resolve().parents[2] / "deploy" / "stats-worker" / "schema.sql"


class CloudStatsSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript(SCHEMA.read_text(encoding="utf-8"))
        self.db.execute(
            "INSERT INTO posts(id,slug,title,views,likes,synced_at) VALUES(?,?,?,?,?,?)",
            (7, "hello", "Hello", 4, 2, "initial"),
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def counts(self):
        return self.db.execute("SELECT views,likes FROM posts WHERE id=7").fetchone()

    def test_duplicate_view_insert_increments_once_and_rollback_is_atomic(self):
        values = (7, "session-1", "2026-10-02")
        self.db.execute("INSERT OR IGNORE INTO post_views VALUES(?,?,?)", values)
        self.db.execute("INSERT OR IGNORE INTO post_views VALUES(?,?,?)", values)
        self.assertEqual(self.counts(), (5, 2))
        self.db.commit()

        self.db.execute("BEGIN")
        self.db.execute("INSERT OR IGNORE INTO post_views VALUES(?,?,?)", (7, "session-2", "2026-10-02"))
        self.assertEqual(self.counts(), (6, 2))
        self.db.rollback()
        self.assertEqual(self.counts(), (5, 2))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM post_views").fetchone()[0], 1)

    def test_like_insert_and_delete_triggers_are_idempotent_and_clamped(self):
        values = (7, "browser-hash")
        self.db.execute("INSERT OR IGNORE INTO post_likes VALUES(?,?)", values)
        self.db.execute("INSERT OR IGNORE INTO post_likes VALUES(?,?)", values)
        self.assertEqual(self.counts(), (4, 3))

        self.db.execute("DELETE FROM post_likes WHERE post_id=? AND browser_hash=?", values)
        self.db.execute("DELETE FROM post_likes WHERE post_id=? AND browser_hash=?", values)
        self.assertEqual(self.counts(), (4, 2))

        self.db.execute("UPDATE posts SET likes=0 WHERE id=7")
        self.db.execute("INSERT OR IGNORE INTO post_likes VALUES(?,?)", values)
        self.db.execute("UPDATE posts SET likes=0 WHERE id=7")
        self.db.execute("DELETE FROM post_likes WHERE post_id=? AND browser_hash=?", values)
        self.assertEqual(self.counts(), (4, 0))

    def test_trigger_failure_rolls_back_the_counter_row_together(self):
        self.db.executescript("""
            CREATE TRIGGER fail_view_count BEFORE UPDATE OF views ON posts
            BEGIN SELECT RAISE(ABORT, 'counter failure'); END;
        """)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO post_views VALUES(?,?,?)", (7, "session-fails", "2026-10-02"))
        self.assertEqual(self.counts(), (4, 2))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM post_views").fetchone()[0], 0)

    def test_post_sync_upsert_preserves_live_counters(self):
        self.db.execute(
            "INSERT INTO posts(id,slug,title,views,likes,synced_at) VALUES(?,?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,synced_at=excluded.synced_at",
            (7, "new-slug", "New title", 0, 0, "later"),
        )
        self.assertEqual(self.counts(), (4, 2))
        self.assertEqual(self.db.execute("SELECT slug,title FROM posts WHERE id=7").fetchone(), ("new-slug", "New title"))


if __name__ == "__main__":
    unittest.main()
