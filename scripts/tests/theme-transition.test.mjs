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
const transitionPreferences = { exports: {} };
vm.runInNewContext(ts.transpileModule(await readFile(new URL('../../lib/theme-transition-preferences.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, transitionPreferences);
function fixture(supported = true) {
  const classes = new Set(), timers = new Map(), captures = [], styles = new Map();
  const document = { documentElement: { style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key) }, classList: {
    add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)),
  } } };
  if (supported) document.startViewTransition = update => {
    let finish;
    const capture = { update, skipped: false, ready: Promise.resolve(), finished: new Promise(resolve => { finish = resolve; }),
      skipTransition() { this.skipped = true; finish(); }, finish() { finish(); } };
    captures.push(capture);
    return capture;
  };
  const sandbox = { exports: {}, document, require: () => transitionPreferences.exports, setTimeout: (callback, duration) => { const id = timers.size + 1; timers.set(id, { callback, duration }); return id; }, clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(compiled, sandbox);
  return { ...sandbox.exports, classes, timers, captures, styles };
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

test('chosen direction and duration reach the capture, and cleanup leaves no stale properties', async () => {
  const f = fixture();
  f.runThemeTransition(() => {}, false, { duration: 1200, direction: 'top-right' });
  assert.equal(f.styles.get('--theme-transition-duration'), '1200ms');
  assert.equal(f.styles.get('--theme-reveal-angle'), '225deg');
  assert.equal(f.styles.get('--theme-reveal-from'), '0% 100%');
  assert.equal(f.styles.get('--theme-reveal-to'), '100% 0%');
  f.captures[0].finish();
  await settle();
  assert.equal(f.styles.size, 0);
  const fallback = fixture(false);
  fallback.runThemeTransition(() => {}, false, { duration: 1600, direction: 'top' });
  assert.equal([...fallback.timers.values()][0].duration, 1650, 'fallback must not clear a slow fade early');
  fallback.stopThemeTransition();
  assert.equal(fallback.styles.size, 0);
});

test('all eight mask directions begin transparent and finish opaque in portrait and landscape viewports', () => {
  for (const setting of Object.values(transitionPreferences.exports.themeTransitionDirections)) {
    const angle = setting.angle * Math.PI / 180;
    for (const [width, height] of [[1920, 1080], [390, 844]]) {
      const gradientLength = Math.abs(Math.sin(angle)) * width * 3 + Math.abs(Math.cos(angle)) * height * 3;
      const positions = value => value.split(' ').map(part => parseInt(part, 10) / 100);
      const progress = (position, x, y) => {
        const [px, py] = positions(position);
        return ((x + px * width * 2 - width * 1.5) * Math.sin(angle)
          - (y + py * height * 2 - height * 1.5) * Math.cos(angle) + gradientLength / 2) / gradientLength;
      };
      for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) {
        assert.ok(progress(setting.from, x, y) >= .55, `${setting.label} must initially hide every viewport corner`);
        assert.ok(progress(setting.to, x, y) <= .45, `${setting.label} must finally reveal every viewport corner`);
      }
    }
  }
});
