import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const sandbox = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../../lib/appearance-reset.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
const { applyLoadedAppearanceReset } = sandbox.exports;
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
test("early reset waits and applies the loaded owner snapshot instead of built-in values", async () => {
  const pending = deferred(), applied = [];
  const task = applyLoadedAppearanceReset(() => pending.promise, () => "0:0:0:0", defaults => applied.push(defaults));
  assert.deepEqual(applied, []);
  const owner = { preferences: { hue: 35 }, theme: "light", background: { image: "/images/mine.jpg", blur: 3 }, effects: { fallingEffect: "snow" } };
  pending.resolve(owner);
  assert.equal(await task, true);
  assert.equal(applied[0], owner);
});
test("an appearance, theme, background, or effect adjustment cancels a pending reset", async () => {
  for (let field = 0; field < 4; field++) {
    const pending = deferred(), revisions = [0,0,0,0], applied = [];
    const task = applyLoadedAppearanceReset(() => pending.promise, () => revisions.join(":"), value => applied.push(value));
    revisions[field]++;
    pending.resolve({ hue: 35 });
    assert.equal(await task, false);
    assert.deepEqual(applied, []);
  }
});
test("load failure leaves current settings untouched and a retry can succeed", async () => {
  const applied = [], revision = () => "0";
  await assert.rejects(applyLoadedAppearanceReset(() => Promise.reject(new Error("offline")), revision, value => applied.push(value)), /offline/);
  assert.deepEqual(applied, []);
  assert.equal(await applyLoadedAppearanceReset(() => Promise.resolve("owner"), revision, value => applied.push(value)), true);
  assert.deepEqual(applied, ["owner"]);
});
test("only the latest reset request may apply", async () => {
  const first = deferred(), second = deferred(), applied = [];
  let revision = 1;
  const one = applyLoadedAppearanceReset(() => first.promise, () => String(revision), value => applied.push(value));
  revision++;
  const two = applyLoadedAppearanceReset(() => second.promise, () => String(revision), value => applied.push(value));
  first.resolve("old"); second.resolve("latest");
  assert.equal(await one, false); assert.equal(await two, true);
  assert.deepEqual(applied, ["latest"]);
});
