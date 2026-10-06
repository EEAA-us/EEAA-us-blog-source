"""Batch-query contracts on disposable data, including zero-count and ordering."""
import unittest
from sqlalchemy import event
from sqlmodel import SQLModel, Session, create_engine
from app.models import Post, Tag, PostTag
from app.models.bookmark import BookmarkCategory, BookmarkSite
from app.services import post_service, bookmark_service


class BatchContentTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://')
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.queries = []
        def record(connection, cursor, statement, parameters, context, many):
            if statement.lstrip().upper().startswith('SELECT'):
                self.queries.append(statement)
        event.listen(self.engine, 'before_cursor_execute', record)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_tag_recount_flushes_pending_links_and_resets_empty_tags(self):
        tags = [Tag(id=i+1, name=str(i), slug=str(i), post_count=99) for i in range(100)]
        self.session.add_all(tags + [Post(id=1, title='x', slug='x')])
        self.session.flush()
        self.session.add(PostTag(post_id=1, tag_id=1))
        self.queries.clear()
        post_service._update_tag_counts(self.session)
        self.assertEqual(tags[0].post_count, 1)
        self.assertTrue(all(tag.post_count == 0 for tag in tags[1:]))
        self.assertEqual(len(self.queries), 2)
        self.session.delete(self.session.get(PostTag, (1, 1)))
        post_service._update_tag_counts(self.session)
        self.assertEqual(tags[0].post_count, 0)

    def test_bookmark_batch_keeps_category_site_order_and_empty_groups(self):
        self.session.add_all([BookmarkCategory(id=i+1, name=str(i), sort=100-i) for i in range(100)])
        self.session.add_all([
            BookmarkSite(category_id=1, name='later', url='https://example.com', sort=2, platforms='["web"]'),
            BookmarkSite(category_id=1, name='earlier', url='https://example.com', sort=1),
            BookmarkSite(category_id=2, name='other', url='https://example.com', sort=0),
        ])
        self.session.commit()
        self.queries.clear()
        result = bookmark_service.get_full_bookmarks(self.session)
        self.assertEqual(len(self.queries), 2)
        self.assertEqual([group['id'] for group in result], list(range(100, 0, -1)))
        self.assertEqual([site['name'] for site in result[-1]['sites']], ['earlier', 'later'])
        self.assertEqual(result[-1]['sites'][1]['platforms'], ['web'])
        self.assertEqual(result[0]['sites'], [])
        self.assertFalse(self.session.dirty)

    def test_edit_and_delete_only_recount_affected_tags(self):
        tags = [Tag(id=i, name=f't{i}', slug=f't{i}', post_count=7) for i in range(1, 101)]
        self.session.add_all(tags + [Post(id=1, title='x', slug='x')])
        self.session.add(PostTag(post_id=1, tag_id=1))
        self.session.commit()
        post_service._sync_tags(self.session, 1, ['t2'])
        self.session.flush()
        self.assertEqual(tags[0].post_count, 0)
        self.assertEqual(tags[1].post_count, 1)
        self.assertTrue(all(tag.post_count == 7 for tag in tags[2:]))
        post_service.delete_post(self.session, 1)
        self.assertEqual(tags[1].post_count, 0)
        self.assertTrue(all(tag.post_count == 7 for tag in tags[2:]))
