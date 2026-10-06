import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const defaults = JSON.parse(await readFile(new URL("../../public/hero-media-defaults.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../../lib/hero-media-catalog.ts", import.meta.url), "utf8");
const sandbox = { exports: {}, require(name) {
  assert.equal(name, "@/public/hero-media-defaults.json");
  return { __esModule: true, default: defaults };
} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, sandbox);
const { readMediaCatalog, visibleMediaCatalog, defaultMediaCatalog } = sandbox.exports;
// Logic fixtures are independent of optional, redistributable media assets.
const sampleCatalog = { version: 1, categories: [
  { id: "a", name: "A", enabled: true, order: 1 },
  { id: "b", name: "B", enabled: true, order: 2 },
], items: Array.from({ length: 4 }, (_, i) => ({ id: `item${i}`, name: `Item ${i}`, category: i < 2 ? "a" : "b", kind: "video", url: `/media/${i}.mp4`, poster: `/media/${i}.webp`, enabled: true, order: i + 1 })) };

test("bundled animations do not repeat a video scene as a low-resolution GIF", () => {
  const posters = defaults.items.filter(item => item.poster).map(item => item.poster);
  assert.equal(new Set(posters).size, posters.length);
  assert.ok(defaults.items.every(item => item.kind === "video"));
});

test("missing configuration uses bundled examples, deliberate empty catalog stays empty", () => {
  assert.equal(readMediaCatalog(undefined), defaultMediaCatalog);
  const empty = { version: 1, categories: [], items: [] };
  assert.equal(JSON.stringify(readMediaCatalog(JSON.stringify(empty))), JSON.stringify(empty));
});

test("public selection respects category visibility and configured order without mutating catalog", () => {
  const catalog = structuredClone(sampleCatalog);
  catalog.categories[0].enabled = false;
  catalog.items[1].enabled = false;
  catalog.items.at(-1).order = 0;
  const before = JSON.stringify(catalog);
  const visible = visibleMediaCatalog(catalog);
  assert.equal(visible.categories.length, catalog.categories.length - 1);
  assert.ok(visible.items.every(item => item.enabled && item.category !== catalog.categories[0].id));
  assert.ok(visible.items.every((item, index) => index === 0 || visible.items[index - 1].order <= item.order));
  assert.equal(JSON.stringify(catalog), before);
});

test("unsafe metadata and broken references fall back instead of entering public controls", () => {
  const badLink = structuredClone(sampleCatalog);
  badLink.items[0].sourceUrl = "javascript:alert(1)";
  assert.equal(readMediaCatalog(badLink), defaultMediaCatalog);
  const badReference = structuredClone(sampleCatalog);
  badReference.items[0].category = "missing";
  assert.equal(readMediaCatalog(badReference), defaultMediaCatalog);
});
