import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = ts.transpileModule(readFileSync(new URL("../../data/article-covers.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function covers(photos) {
  const sandbox = { exports: {}, require(specifier) {
    if (specifier.endsWith("sources.json")) return { __esModule: true, default: { photos } };
    if (specifier === "@/siteConfig") return { siteConfig: { defaultPostCover: "/images/cover.webp" } };
    throw new Error(`Unexpected import: ${specifier}`);
  } };
  vm.runInNewContext(source, sandbox);
  return sandbox.exports;
}
test("empty cover catalogs use the configured placeholder and preserve custom covers", () => {
  const { getArticleCover, articleCoverPhotos } = covers([]);
  assert.equal(articleCoverPhotos.length, 0);
  assert.equal(getArticleCover({ id: 1 }), "/images/cover.webp");
  assert.equal(getArticleCover({ id: 1, cover: "  " }), "/images/cover.webp");
  assert.equal(getArticleCover({ id: 1, cover: "/my-cover.png" }), "/my-cover.png");
});
test("the existing sixty-slot assignment stays stable and partial catalogs fall back to their first cover", () => {
  const photos = Array.from({ length: 60 }, (_, i) => ({ id: String(i), url: `/covers/${i}.webp`, caption: "", width: 800, height: 600 }));
  const { getArticleCover } = covers(photos);
  assert.equal(getArticleCover({ id: 1 }), "/covers/0.webp");
  assert.equal(getArticleCover({ id: 60 }), "/covers/59.webp");
  assert.equal(getArticleCover({ id: 61 }), "/covers/0.webp");
  assert.equal(covers(photos.slice(0, 2)).getArticleCover({ id: 3 }), "/covers/0.webp");
});
