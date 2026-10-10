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

function fixture(supported = true, live = false, pending = false) {
  const classes = new Set(), timers = new Map(), captures = [], styles = new Map(), reveals = []; let timerId = 0;
  const document = { querySelector: () => null, querySelectorAll: () => live ? [{ getBoundingClientRect: () => ({ left: 0, top: 64, right: 1920, bottom: 1080 }), closest: () => null }] : [], documentElement: { style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key) }, classList: {
    add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)),
  } } };
  if (supported) document.startViewTransition = update => {
    let finish;
    const capture = { update, skipped: false, ready: pending ? new Promise(() => {}) : Promise.resolve(), finished: new Promise(resolve => { finish = resolve; }),
      skipTransition() { this.skipped = true; finish(); }, finish() { finish(); } };
    captures.push(capture);
    return capture;
  };
  const sandbox = { exports: {}, document, window: { innerWidth: 1920, innerHeight: 1080 }, require: name => name === './theme-live-reveal' ? { prepareLiveThemeReveal: () => { if (!live) return null; const reveal = { stopped: false, play(duration, direction) { this.duration = duration; this.direction = direction; }, stop() { this.stopped = true; } }; reveals.push(reveal); return reveal; } } : transitionPreferences.exports, setTimeout: (callback, duration) => { const id = ++timerId; timers.set(id, { callback, duration }); return id; }, clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(compiled, sandbox);
  return { ...sandbox.exports, classes, timers, captures, styles, reveals };
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

test('live covers apply each click synchronously, never request a viewport capture, and reverse immediately', async () => {
  const f = fixture(true, true), applied = [];
  f.runThemeTransition(() => applied.push('dark'), false, { duration: 750, direction: 'top' });
  assert.deepEqual(applied, ['dark'], 'a click must apply before runThemeTransition returns');
  assert.equal(f.captures.length, 0, 'video mode must not wait for snapshot promises');
  assert.equal(f.reveals[0].direction, 'top');
  assert.equal([...f.timers.values()][0].duration, 750);
  f.runThemeTransition(() => applied.push('light'), false, { duration: 750, direction: 'top' });
  assert.deepEqual(applied, ['dark', 'light']);
  assert.equal(f.reveals[0].stopped, true);
  assert.equal(f.timers.size, 1);
  [...f.timers.values()][0].callback();
  assert.equal(f.classes.size, 0);
  f.runThemeTransition(() => applied.push('dark'), false);
  assert.deepEqual(applied, ['dark', 'light', 'dark'], 'the next click needs no cooldown');
  f.stopThemeTransition();
});

test('a stalled static capture is skipped within 120ms and never applies twice', async () => {
  const f = fixture(true, false, true); let applied = 0;
  f.runThemeTransition(() => applied++, false);
  const deadline = [...f.timers.values()][0];
  assert.equal(deadline.duration, 120);
  deadline.callback();
  assert.equal(applied, 1);
  assert.equal(f.captures[0].skipped, true);
  f.captures[0].update(); await settle();
  assert.equal(applied, 1);
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
  assert.equal(f.styles.get('--theme-reveal-from'), '17.5% 82.5%');
  assert.equal(f.styles.get('--theme-reveal-to'), '82.5% 17.5%');
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
      const positions = value => value.split(' ').map(part => parseFloat(part) / 100);
      const progress = (position, x, y) => {
        const [px, py] = positions(position);
        return ((x + px * width * 2 - width * 1.5) * Math.sin(angle)
          - (y + py * height * 2 - height * 1.5) * Math.cos(angle) + gradientLength / 2) / gradientLength;
      };
      for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) {
        assert.ok(progress(setting.from, x, y) >= .55 - 1e-12, `${setting.label} must initially hide every viewport corner`);
        assert.ok(progress(setting.to, x, y) <= .45 + 1e-12, `${setting.label} must finally reveal every viewport corner`);
      }
    }
  }
});

test('default reveal lasts 0.75 seconds and a click after completion starts immediately', async () => {
  const f = fixture(), applied = [];
  f.runThemeTransition(() => applied.push('dark'), false);
  assert.equal(f.styles.get('--theme-transition-duration'), '750ms');
  f.captures[0].update();
  f.captures[0].finish();
  await settle();
  f.runThemeTransition(() => applied.push('light'), false);
  f.captures[1].update();
  assert.deepEqual(applied, ['dark', 'light']);
  assert.equal([...f.timers.values()][0].duration, 120);
  f.stopThemeTransition();
});
