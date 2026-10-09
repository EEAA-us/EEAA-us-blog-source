import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function loadAnimation() {
  const source = await readFile(resolve(projectRoot, "lib/idle-animation.ts"), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const listeners = new Map();
  const pending = new Map();
  let nextFrame = 1;
  const document = {
    hidden: false,
    addEventListener(type, listener) {
      const group = listeners.get(type) ?? new Set();
      group.add(listener);
      listeners.set(type, group);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    dispatch(type) { for (const listener of listeners.get(type) ?? []) listener(); },
  };
  const sandbox = {
    exports: {},
    module: { exports: {} },
    document,
    requestAnimationFrame(callback) {
      const id = nextFrame++;
      pending.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { pending.delete(id); },
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(javascript, sandbox, { filename: "lib/idle-animation.ts" });
  return {
    createIdleAnimation: sandbox.module.exports.createIdleAnimation,
    document,
    pending,
    runNextFrame() {
      const entry = pending.entries().next().value;
      assert.ok(entry, "expected one scheduled animation frame");
      const [id, callback] = entry;
      pending.delete(id);
      callback(0);
    },
    listenerCount(type) { return listeners.get(type)?.size ?? 0; },
  };
}

test("does not schedule frames until drawing starts", async () => {
  const harness = await loadAnimation();
  let draws = 0;
  harness.createIdleAnimation(() => { draws++; return true; });

  assert.equal(harness.pending.size, 0);
  assert.equal(draws, 0);
});

test("repeated starts keep a single animation loop", async () => {
  const harness = await loadAnimation();
  let draws = 0;
  const animation = harness.createIdleAnimation(() => { draws++; return true; });

  animation.start();
  animation.start();
  animation.start();
  assert.equal(harness.pending.size, 1);

  harness.runNextFrame();
  assert.equal(draws, 1);
  assert.equal(harness.pending.size, 1);
  animation.start();
  animation.start();
  assert.equal(harness.pending.size, 1);
});

test("stops scheduling when draw reports no more work", async () => {
  const harness = await loadAnimation();
  let draws = 0;
  const animation = harness.createIdleAnimation(() => { draws++; return false; });

  animation.start();
  harness.runNextFrame();

  assert.equal(draws, 1);
  assert.equal(harness.pending.size, 0);
});

test("pauses while hidden and resumes when visible", async () => {
  const harness = await loadAnimation();
  let draws = 0;
  const animation = harness.createIdleAnimation(() => { draws++; return true; });
  animation.start();
  assert.equal(harness.pending.size, 1);

  harness.document.hidden = true;
  harness.document.dispatch("visibilitychange");
  assert.equal(harness.pending.size, 0);

  animation.start();
  assert.equal(harness.pending.size, 0);
  assert.equal(draws, 0);

  harness.document.hidden = false;
  harness.document.dispatch("visibilitychange");
  assert.equal(harness.pending.size, 1);
  harness.runNextFrame();
  assert.equal(draws, 1);
  assert.equal(harness.pending.size, 1);
});

test("dispose cancels pending work and prevents future starts", async () => {
  const harness = await loadAnimation();
  let draws = 0;
  const animation = harness.createIdleAnimation(() => { draws++; return true; });
  animation.start();
  const listenerCount = harness.listenerCount("visibilitychange");

  animation.dispose();
  animation.start();
  harness.document.hidden = true;
  harness.document.dispatch("visibilitychange");
  harness.document.hidden = false;
  harness.document.dispatch("visibilitychange");

  assert.equal(harness.pending.size, 0);
  assert.equal(draws, 0);
  assert.equal(harness.listenerCount("visibilitychange"), listenerCount - 1);
});
