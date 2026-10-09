import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url), ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const widget = compile(await readFile(new URL('../../components/widgets/toolbox/TiboApp.tsx', import.meta.url), 'utf8'));
const helper = compile(await readFile(new URL('../../lib/bounded-request.ts', import.meta.url), 'utf8'));
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
const response = (data, ok = true) => ({ ok, json: async () => data });
function mount(fetcher) {
  const states = [], effects = [], requests = [], refs = [];
  let index = 0;
  const common = { AbortController, AbortSignal, queueMicrotask,
    fetch: (url, options) => { requests.push({ url, signal: options?.signal }); return fetcher(url, options); } };
  const bounded = { ...common, exports: {} };
  vm.runInNewContext(helper, bounded);
  const sandbox = { ...common, exports: {}, require(name) {
    if (name === 'react') return {
      useEffect: effect => { if (!effects.length) effects.push(effect); },
      useRef: initial => { const slot = index++; if (!refs[slot]) refs[slot] = { current: initial }; return refs[slot]; },
      useState: initial => { const slot = index++; if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial;
        return [states[slot], next => { states[slot] = typeof next === 'function' ? next(states[slot]) : next; }]; },
    };
    if (name === 'react/jsx-runtime') return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
    if (name === 'lucide-react') return { RefreshCw: 'RefreshCw' };
    if (name === '@/lib/bounded-request') return bounded.exports;
    throw new Error(name);
  } };
  vm.runInNewContext(widget, sandbox);
  const Component = sandbox.exports.default;
  const render = () => { index = 0; return Component(); };
  const tree = render();
  const cleanup = effects[0]();
  return { states, effects, requests, cleanup, render: () => render(), tree };
}
function flatten(node, out = []) {
  if (node == null || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out; }
  if (Array.isArray(node)) { node.forEach(item => flatten(item, out)); return out; }
  flatten(node.props?.children, out); return out;
}
const feed = posts => ({ posts, checkedAt: '2026-10-09T00:00:00.000Z', notice: 'fixture notice' });
const post = (id, text) => ({ id, text, publishedAt: '2026-10-08T00:00:00.000Z', url: `https://x.com/thsottiaux/status/${id}` });

test('original posts render as soon as the feed arrives and translations run sequentially', async () => {
  let resolveFeed, resolveFirst, resolveSecond;
  const feedPending = new Promise(resolve => { resolveFeed = resolve; });
  const firstPending = new Promise(resolve => { resolveFirst = resolve; });
  const secondPending = new Promise(resolve => { resolveSecond = resolve; });
  const fixture = mount(url => url === '/api/tibo' ? feedPending : url.includes('id=1234567890123') ? firstPending : secondPending);
  await settle();
  resolveFeed(response(feed([post('1234567890123', 'English original'), post('1234567890124', '中文原文')])));
  await settle();
  assert.equal(fixture.states[0].posts.length, 2);
  assert.equal(fixture.states[1], false, 'loading ends before translation completes');
  assert.deepEqual(fixture.requests.map(item => item.url), ['/api/tibo', '/api/tibo/translate?id=1234567890123&lang=zh']);
  const text = flatten(fixture.render()).join('\n');
  assert.match(text, /English original/);
  assert.match(text, /中文原文/);
  resolveFirst(response({ message: 'translation unavailable' }, false));
  await settle();
  assert.deepEqual(fixture.requests.map(item => item.url), ['/api/tibo', '/api/tibo/translate?id=1234567890123&lang=zh', '/api/tibo/translate?id=1234567890124&lang=en']);
  assert.match(fixture.states[3]['1234567890123'].error, /translation unavailable/);
  resolveSecond(response({ text: 'translated second' }));
  await settle();
  assert.equal(fixture.states[3]['1234567890124'].text, 'translated second');
  fixture.cleanup();
});

test('closing the widget cancels translation and ignores late state updates', async () => {
  let resolveTranslation;
  const pending = new Promise(resolve => { resolveTranslation = resolve; });
  const fixture = mount(async url => url === '/api/tibo' ? response(feed([post('1234567890123', 'original remains visible')])) : pending);
  await settle();
  await settle();
  assert.equal(fixture.requests.length, 2);
  const signal = fixture.requests[1].signal;
  assert.ok(signal instanceof AbortSignal);
  fixture.cleanup();
  const statesAtClose = fixture.states.slice();
  assert.equal(signal.aborted, true);
  resolveTranslation(response({ text: 'late translation' }));
  await settle();
  assert.deepEqual(fixture.states, statesAtClose);
});
