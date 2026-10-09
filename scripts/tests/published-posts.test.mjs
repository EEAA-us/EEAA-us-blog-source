import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(path.join(root, "app/api/posts.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const articleCode = compile(await readFile(path.join(root, "lib/published-article.ts"), "utf8"));
const boundedCode = compile(await readFile(path.join(root, "lib/bounded-request.ts"), "utf8"));

function fixture() {
  return {
    schemaVersion: 1,
    generatedAt: "fixture",
    posts: [
      { id: 1, slug: "one", title: "One", status: "published", category: "Notes", searchText: "one", views: 10, likes: 2 },
      { id: 2, slug: "two", title: "Two", status: "published", category: "Notes", searchText: "two", views: 20, likes: 3 },
      { id: 3, slug: "draft", title: "Draft", status: "draft", category: "Notes", searchText: "draft", views: 30, likes: 4 },
    ],
    categories: [{ slug: "notes", name: "Notes" }],
    photos: { "1": Array.from({ length: 10_000 }, (_, id) => ({ id, url: `/photo-${id}.png` })) },
  };
}

function loadPosts({ statsResponse } = {}) {
  const calls = [];
  const selections = [];
  const index = fixture();
  const sandbox = {
    exports: {},
    process: { env: { NEXT_PUBLIC_CONTENT_MODE: "published" } },
    URLSearchParams,
    AbortSignal,
    AbortController,
    Date,
    structuredClone,
    fetch: async url => {
      calls.push(String(url));
      if (String(url).startsWith('/content/posts/')) return { ok: true, json: async () => ({ id: Number(String(url).match(/(\d+)\.json/)[1]), content: "fixture body" }) };
      if (statsResponse instanceof Error) throw statsResponse;
      return statsResponse ?? { ok: true, json: async () => ({ posts: { "1": { views: 101, likes: 12 }, "2": { views: 202, likes: 23 } } }) };
    },
    require(specifier) {
      if (specifier === "./client") return { request: async () => [], qs: () => "" };
      if (specifier === "@/lib/published-content") return { readPublishedSelection: async select => {
        const result = select(index);
        selections.push(result);
        return structuredClone(result);
      } };
      if (specifier === "@/lib/cloud-stats-client") return { getCloudStatsIdentity: () => "test" };
      if (specifier === "@/lib/published-article") return article.exports;
      throw new Error(`Unexpected import: ${specifier}`);
    },
  };
  const bounded = { ...sandbox, exports: {} };
  vm.runInNewContext(boundedCode, bounded);
  const article = { ...sandbox, exports: {}, require: () => bounded.exports };
  vm.runInNewContext(articleCode, article);
  vm.runInNewContext(compiled, sandbox, { filename: "app/api/posts.ts" });
  return { ...sandbox.exports, calls, selections };
}

test("includeStats false preserves filtered pagination and skips statistics", async () => {
  const { getPosts, calls } = loadPosts();
  const result = await getPosts({ status: "published", category: "notes", page: 2, size: 1 }, { includeStats: false });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [{ id: 2, slug: "two", title: "Two", status: "published", category: "Notes", views: 20, likes: 3 }]);
  assert.deepEqual(calls, []);
});

test("default behavior refreshes and applies live statistics", async () => {
  const { getPosts, calls } = loadPosts();
  const result = await getPosts({ status: "published", page: 1, size: 2 });
  assert.deepEqual(result.map(post => [post.id, post.views, post.likes]), [[1, 101, 12], [2, 202, 23]]);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/api\/posts\/stats\?ids=1%2C2/);
});

test("statistics failure falls back to snapshot values", async () => {
  const { getPosts, calls } = loadPosts({ statsResponse: new Error("stats unavailable") });
  const result = await getPosts({ status: "published", page: 1, size: 1 });
  assert.deepEqual(result.map(post => [post.id, post.views, post.likes]), [[1, 10, 2]]);
  assert.equal(calls.length, 1);
});

test("article lists and counts clone only their selection even with a large photo library", async () => {
  const { getPosts, getPostsCount, selections } = loadPosts();
  await getPosts({ status: "published", size: 1 }, { includeStats: false });
  assert.deepEqual(await getPostsCount("published", { search: "two" }), { count: 1 });
  assert.equal(selections[0].length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(selections[1])), { count: 1 });
  assert.ok(selections.every(value => !('photos' in value)));
  assert.ok(JSON.stringify(selections).length < 500);
});

test("slug lookup selects the id and does not copy unrelated published content", async () => {
  const { getPostBySlug, calls, selections } = loadPosts();
  await getPostBySlug("two");
  assert.deepEqual(calls, ["/content/posts/2.json"]);
  assert.deepEqual(selections, [2]);
  await assert.rejects(getPostBySlug("missing"), /Article not found/);
});
