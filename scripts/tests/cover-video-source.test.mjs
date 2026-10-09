import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function loadCoverVideoSource() {
  const source = await readFile(resolve(projectRoot, "lib/cover-video-source.ts"), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} } };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(javascript, sandbox, { filename: "lib/cover-video-source.ts" });
  return sandbox.module.exports.coverVideoSource;
}

test("selects compact video variants at mobile widths through 1024px", async () => {
  const coverVideoSource = await loadCoverVideoSource();
  const variants = { "/videos/covers/hero.mp4": { compact: "/videos/covers/hero-mobile.mp4", standard: "/videos/covers/hero-desktop.mp4" } };

  for (const width of [320, 375, 768, 1024]) {
    assert.equal(coverVideoSource("/videos/covers/hero.mp4", width, variants), "/videos/covers/hero-mobile.mp4");
  }
});

test("selects standard variants above mobile through common desktop widths", async () => {
  const coverVideoSource = await loadCoverVideoSource();
  const variants = { "/videos/covers/hero.mp4": { compact: "/videos/covers/hero-mobile.mp4", standard: "/videos/covers/hero-desktop.mp4" } };

  for (const width of [1025, 1280, 1440, 1920]) {
    assert.equal(coverVideoSource("/videos/covers/hero.mp4", width, variants), "/videos/covers/hero-desktop.mp4");
  }
});

test("keeps original URLs for large screens and videos without a mapping", async () => {
  const coverVideoSource = await loadCoverVideoSource();
  const original = "/videos/covers/hero.mp4";
  const variants = { [original]: { compact: "/videos/covers/hero-mobile.mp4", standard: "/videos/covers/hero-desktop.mp4" } };

  assert.equal(coverVideoSource(original, 1921, variants), original);
  assert.equal(coverVideoSource(original, 2560, variants), original);
  assert.equal(coverVideoSource("/videos/covers/unmapped.mp4", 375, variants), "/videos/covers/unmapped.mp4");
});

test("keeps the original URL when the viewport width is non-positive", async () => {
  const coverVideoSource = await loadCoverVideoSource();
  const original = "/videos/covers/hero.mp4";
  const variants = { [original]: { compact: "/videos/covers/hero-mobile.mp4", standard: "/videos/covers/hero-desktop.mp4" } };

  assert.equal(coverVideoSource(original, 0, variants), original);
  assert.equal(coverVideoSource(original, -1, variants), original);
});
