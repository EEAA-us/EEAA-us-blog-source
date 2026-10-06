import unittest
from datetime import datetime, timedelta
from unittest.mock import patch
from sqlmodel import SQLModel, Session, create_engine
from app.api.dashboard import get_dashboard_stats
from app.models import Post, Category

class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.now = datetime(2026, 10, 4, 15, 30)
    def tearDown(self):
        self.session.close()
        self.engine.dispose()
    def stats(self):
        with patch("app.api.dashboard.datetime") as clock:
            clock.now.return_value = self.now
            return get_dashboard_stats(self.session)
    def test_thirty_days_includes_today_and_first_day_midnight(self):
        first = self.now.replace(hour=0, minute=0) - timedelta(days=29)
        for i, date in enumerate([first, self.now, first-timedelta(seconds=1), self.now+timedelta(days=1)]):
            self.session.add(Post(title=str(i), slug=str(i), status="published", published_at=date))
        self.session.commit()
        trend = self.stats()["post_trend"]
        self.assertEqual(len(trend), 30)
        self.assertEqual(trend[0], {"date": "2026-09-05", "count": 1})
        self.assertEqual(trend[-1], {"date": "2026-10-04", "count": 1})
        self.assertEqual(sum(item["count"] for item in trend), 2)
    def test_category_chart_uses_published_posts_not_cached_counter(self):
        category = Category(name="Notes", slug="notes", post_count=999)
        self.session.add(category)
        self.session.commit()
        for i, status in enumerate(["published", "draft"]):
            self.session.add(Post(title=str(i), slug=str(i), category_id=category.id, status=status))
        self.session.commit()
        self.assertEqual(self.stats()["category_distribution"], [{"name": "Notes", "value": 1}])
    def test_empty_database_has_no_invented_counts(self):
        result = self.stats()
        self.assertEqual(result["counts"]["posts"], 0)
        self.assertEqual(result["category_distribution"], [])
        self.assertEqual(result["browser_distribution"], [])

if __name__ == "__main__":
    unittest.main()
