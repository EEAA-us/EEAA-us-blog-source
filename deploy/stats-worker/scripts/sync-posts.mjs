import { readFile } from "node:fs/promises";

const missing = ["BLOG_STATS_URL", "BLOG_STATS_ADMIN_TOKEN", "BLOG_STATS_SYNC_FILE"].filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing configuration: ${missing.join(", ")}`);
  process.exitCode = 2;
} else {
  try {
    const payload = JSON.parse(await readFile(process.env.BLOG_STATS_SYNC_FILE, "utf8"));
    if (!payload || typeof payload.revision !== "string" || !Array.isArray(payload.posts)) throw new Error("Sync file must contain {revision,posts}");
    const endpoint = new URL("/admin/sync", process.env.BLOG_STATS_URL);
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${process.env.BLOG_STATS_ADMIN_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), redirect: "error", signal: AbortSignal.timeout(10000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`Worker returned ${response.status}: ${text.slice(0, 300)}`);
    console.log(text);
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
