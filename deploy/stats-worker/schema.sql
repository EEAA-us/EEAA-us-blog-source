CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, slug TEXT NOT NULL, title TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0, synced_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS post_views (post_id INTEGER NOT NULL, session_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(post_id, session_id, day));
CREATE TABLE IF NOT EXISTS post_likes (post_id INTEGER NOT NULL, browser_hash TEXT NOT NULL, PRIMARY KEY(post_id, browser_hash));
CREATE TRIGGER IF NOT EXISTS post_views_count_insert
AFTER INSERT ON post_views
BEGIN
  UPDATE posts SET views = views + 1 WHERE id = NEW.post_id;
END;
CREATE TRIGGER IF NOT EXISTS post_likes_count_insert
AFTER INSERT ON post_likes
BEGIN
  UPDATE posts SET likes = likes + 1 WHERE id = NEW.post_id;
END;
CREATE TRIGGER IF NOT EXISTS post_likes_count_delete
AFTER DELETE ON post_likes
BEGIN
  UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = OLD.post_id;
END;
CREATE TABLE IF NOT EXISTS visitor_events (event_id TEXT PRIMARY KEY, browser_id TEXT NOT NULL, session_id TEXT NOT NULL, path TEXT NOT NULL, day TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS visitor_events_day ON visitor_events(day);
CREATE INDEX IF NOT EXISTS visitor_events_browser_day ON visitor_events(browser_id, day);
