import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await readFile(new URL('../../app/posts/page.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
}}).outputText;
const settle = () => new Promise(resolve => setImmediate(resolve));

function page({ failedContent = false } = {}) {
  const states = [], effects = [], calls = [];
  let index = 0, finishStats;
  const stats = new Promise(resolve => { finishStats = resolve; });
  const row = { id: 1, slug: 'test', views: 12, likes: 3 };
  const sandbox = {
    exports: {}, queueMicrotask, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    window: { location: { hash: '' }, setTimeout, clearTimeout },
    require(name) {
      if (name === 'react') return { useEffect: fn => effects.push(fn), useState: initial => {
        const slot = index++; states[slot] = initial;
        return [initial, value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
      } };
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'framer-motion') return { motion: { div: 'div' }, AnimatePresence: 'div' };
      if (name === 'lucide-react') return {};
      if (name === '@/lib/i18n') return { useTranslation: () => ({ tx: x => x, language: 'zh' }) };
      if (name === '@/app/api') return {
        getCategories: async () => [],
        getPosts: async (_, options) => {
          calls.push(options);
          if (failedContent) throw new Error('Content request failed');
          return [row];
        },
        getPostsCount: async () => ({ count: 1 }),
        refreshPublishedStats: () => stats,
      };
      if (name.startsWith('@/components/')) return { default: 'div' };
      throw new Error(name);
    },
  };
  vm.runInNewContext(compiled, sandbox);
  sandbox.exports.default();
  const cleanup = effects.at(-1)();
  return { states, calls, finishStats, cleanup, row };
}

test('article cards become ready while live statistics are still pending', async () => {
  const fixture = page();
  await settle();
  assert.equal(fixture.calls[0].includeStats, false);
  assert.equal(fixture.states[5], false, 'loading stops before stats resolve');
  assert.equal(fixture.states[6], false);
  assert.equal(fixture.states[1][0].id, 1);
  assert.equal(fixture.states[8], 1);
  fixture.finishStats([{ ...fixture.row, views: 99 }]);
  await settle();
  assert.equal(fixture.states[1][0].views, 99);
});

test('statistics from an abandoned list cannot overwrite later navigation', async () => {
  const fixture = page();
  await settle();
  fixture.cleanup();
  fixture.finishStats([{ ...fixture.row, views: 99 }]);
  await settle();
  assert.equal(fixture.states[1][0].views, 12);
});

test('a failed article request stops loading and exposes the retry state', async () => {
  const fixture = page({ failedContent: true });
  await settle();
  assert.equal(fixture.states[5], false);
  assert.equal(fixture.states[6], true);
  assert.equal(fixture.states[1].length, 0);
});
