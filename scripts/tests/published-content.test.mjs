import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

test("album selection clones only selected data and isolates mutations", async () => {
  const originalFetch = globalThis.fetch;
  const originalClone = globalThis.structuredClone;
  const selected = [];
  globalThis.fetch = async () => jsonResponse(index());
  globalThis.structuredClone = value => { selected.push(value); return originalClone(value); };
  try {
    const { readPublishedSelection } = await loadFreshModule();
    const photos = await readPublishedSelection(data => data.photos['1']);
    photos.reverse();
    assert.deepEqual(await readPublishedSelection(data => data.photos['1']), ['a', 'b', 'c']);
    assert.ok(selected.every(Array.isArray));
  } finally { globalThis.fetch = originalFetch; globalThis.structuredClone = originalClone; }
});

const moduleUrl = pathToFileURL(fileURLToPath(new URL("../../lib/published-content.ts", import.meta.url)));
let moduleSequence = 0;

async function loadFreshModule() {
  const url = new URL(moduleUrl);
  url.searchParams.set("test", String(++moduleSequence));
  return import(url.href);
}

function index(generatedAt = "first") {
  return {
    schemaVersion: 1,
    generatedAt,
    posts: [{ id: 1, slug: "one", searchText: "one" }, { id: 2, slug: "two", searchText: "two" }],
    categories: [{ name: "A" }, { name: "B" }],
    albums: [], photos: { "1": ["a", "b", "c"] }, bookmarks: [], chatters: [], messages: [], projects: [], siteConfig: {},
  };
}

function jsonResponse(body, status = 200) {
  return Response.json(body, { status });
}

test("concurrent reads share one fetch", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; await Promise.resolve(); return jsonResponse(index()); };
  try {
    const { readPublishedIndex } = await loadFreshModule();
    const results = await Promise.all([readPublishedIndex(), readPublishedIndex(), readPublishedIndex()]);
    assert.equal(calls, 1);
    assert.deepEqual(results.map(result => result.generatedAt), ["first", "first", "first"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fresh cache avoids fetch and each caller receives isolated data", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return jsonResponse(index()); };
  try {
    const { readPublishedIndex } = await loadFreshModule();
    const first = await readPublishedIndex();
    first.categories.sort((a, b) => b.name.localeCompare(a.name));
    first.photos["1"].reverse();
    first.posts[0].slug = "mutated";

    const second = await readPublishedIndex();
    assert.equal(calls, 1);
    assert.deepEqual(second.categories.map(item => item.name), ["A", "B"]);
    assert.deepEqual(second.photos["1"], ["a", "b", "c"]);
    assert.equal(second.posts[0].slug, "one");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("expired cache fetches a newly published index", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 10_000;
  let calls = 0;
  Date.now = () => now;
  globalThis.fetch = async () => jsonResponse(index(++calls === 1 ? "first" : "second"));
  try {
    const { readPublishedIndex } = await loadFreshModule();
    assert.equal((await readPublishedIndex()).generatedAt, "first");
    now += 30_001;
    assert.equal((await readPublishedIndex()).generatedAt, "second");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("fetch, HTTP, and schema failures are not cached and can be retried", async () => {
  const originalFetch = globalThis.fetch;
  const failures = [
    async () => { throw new Error("network down"); },
    async () => jsonResponse({}, 503),
    async () => jsonResponse({ ...index(), schemaVersion: 2 }),
  ];
  try {
    for (const fail of failures) {
      const { readPublishedIndex } = await loadFreshModule();
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        if (calls === 1) return fail();
        return jsonResponse(index("recovered"));
      };
      await assert.rejects(readPublishedIndex());
      assert.equal((await readPublishedIndex()).generatedAt, "recovered");
      assert.equal(calls, 2);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
