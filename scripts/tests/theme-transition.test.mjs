import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const compiled = ts.transpileModule(await readFile(new URL('../../lib/theme-transition.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture(supported = true) {
  const classes = new Set(), timers = new Map(), captures = [];
  const document = { documentElement: { classList: {
    add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)),
  } } };
  if (supported) document.startViewTransition = update => {
    let finish;
    const capture = { update, skipped: false, ready: Promise.resolve(), finished: new Promise(resolve => { finish = resolve; }),
      skipTransition() { this.skipped = true; finish(); }, finish() { finish(); } };
    captures.push(capture);
    return capture;
  };
  const sandbox = { exports: {}, document, setTimeout: callback => { const id = timers.size + 1; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(compiled, sandbox);
  return { ...sandbox.exports, classes, timers, captures };
}
test('rapid theme clicks cancel stale captures and apply only the latest requested theme', async () => {
  const f = fixture(), applied = [];
  f.runThemeTransition(() => applied.push('first'), false);
  f.runThemeTransition(() => applied.push('last'), false);
  assert.equal(f.captures[0].skipped, true);
  f.captures[0].update();
  f.captures[1].update();
  await settle();
  assert.deepEqual(applied, ['last']);
  assert.ok(f.classes.has('theme-wiping'), 'old finished callbacks must not clear the active reveal');
  f.captures[1].finish();
  await settle();
  assert.equal(f.classes.size, 0);
});
test('reduced motion applies immediately and cancels an outstanding capture', async () => {
  const f = fixture();
  let applied = 0;
  f.runThemeTransition(() => applied++, false);
  f.runThemeTransition(() => applied++, true);
  f.captures[0].update();
  await settle();
  assert.equal(applied, 1);
  assert.equal(f.captures.length, 1);
  assert.equal(f.classes.size, 0);
  assert.equal(f.timers.size, 0);
});
test('unsupported browsers use a bounded fade and cleanup cancels its timer', () => {
  const f = fixture(false);
  let applied = 0;
  f.runThemeTransition(() => applied++, false);
  assert.equal(applied, 1);
  assert.ok(f.classes.has('theme-switching'));
  assert.equal(f.classes.has('theme-wiping'), false);
  assert.equal(f.timers.size, 1);
  f.stopThemeTransition();
  assert.equal(f.timers.size, 0);
  assert.equal(f.classes.size, 0);
});
