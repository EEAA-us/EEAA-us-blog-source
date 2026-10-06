# Blog statistics Worker

Create a Cloudflare D1 database, apply `schema.sql`, set `BLOG_SERVICE_TOKEN` and `BLOG_ADMIN_TOKEN` as Worker secrets, then replace the placeholder `database_id` in `wrangler.toml` and deploy from this directory with Wrangler. No account credentials or remote deployment are stored here.

When upgrading a D1 database created before the counter triggers were added, reapply `schema.sql` before deploying the new Worker (`wrangler d1 execute blog-stats --remote --file=schema.sql`). The table/index/trigger statements are idempotent, and adding the triggers does not backfill or reset current totals.

The published Next.js deployment needs `NEXT_PUBLIC_CONTENT_MODE=published`, `BLOG_STATS_URL`, and `BLOG_STATS_SERVICE_TOKEN`. The admin token belongs only to the local publisher and local admin tools; it is not a runtime setting for the public site. Public statistics requests go through same-origin Next routes; browser code never contacts the Worker.

Initial `likes` values are preserved as aggregate legacy totals. The old browser `post-like-v1` state is not treated as ownership of a Cloudflare like; an unlike request only removes a like previously recorded by that browser identity in D1. This prevents migrated visitors from subtracting someone else's legacy count. A later new like from that identity is counted normally.

To seed the published registry, prepare a JSON file with `{ "revision": "content-build-id", "posts": [{ "id": 1, "slug": "example", "title": "Example", "views": 0, "likes": 0 }] }`, then set `BLOG_STATS_SYNC_FILE` and run `node scripts/sync-posts.mjs`. Existing counts are preserved on later syncs, including IDs no longer present in the latest registry. Publishing syncs the registry before promoting the preview; if promotion later fails, the added metadata/initial rows remain in D1, while existing counts remain unchanged.

`GET /admin/summary?start=YYYY-MM-DD&end=YYYY-MM-DD` uses inclusive calendar dates in Asia/Shanghai. `pv`, `sessions`, and anonymous browser UV come from deduplicated events by event ID; article ranking counts recorded Cloudflare article views in the requested interval. Legacy seeded counts have no historical event dates and therefore do not appear in date-range ranking.

For visitor location, the Next.js server sends a validated `X-Stats-Visitor-IP` over the authenticated service connection. The Worker does not use Cloudflare's `CF-Connecting-IP` for this lookup because it would identify the Vercel origin connection.
