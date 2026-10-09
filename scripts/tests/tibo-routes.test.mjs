import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url), ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const helper = compile(await readFile(new URL('../../lib/bounded-request.ts', import.meta.url), 'utf8'));
const parseCode = compile(await readFile(new URL('../../lib/tibo-posts.ts', import.meta.url), 'utf8'));
const feedCode = compile(await readFile(new URL('../../lib/tibo-feed.ts', import.meta.url), 'utf8'));
const feedRoute = compile(await readFile(new URL('../../app/api/tibo/route.ts', import.meta.url), 'utf8'));
const translateRoute = compile(await readFile(new URL('../../app/api/tibo/translate/route.ts', import.meta.url), 'utf8'));
const post = { __typename: 'Tweet', rest_id: '1234567890123', core: { user_results: { result: { core: { screen_name: 'thsottiaux' } } } }, details: { full_text: 'synthetic text', created_at_ms: 1_700_000_000_000 } };
const sourceHtml = `<title>Tibo (@thsottiaux)</title><script>$R[1] = ${JSON.stringify(post)};</script>`;
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data, text: async () => sourceHtml });
function loadTranslate({ feed = { posts: [{ id: post.rest_id, text: 'synthetic text' }] }, translate = response({ translate: 'translated' }), timeoutMs = 1000 } = {}) {
  let feedCalls = 0; const requests = [];
  const baseSignal = { any: signals => AbortSignal.any(signals), timeout: () => AbortSignal.timeout(timeoutMs) };
  const bounded = { exports: {}, AbortSignal: baseSignal };
  vm.runInNewContext(helper, bounded);
  const sandbox = { exports: {}, AbortSignal: baseSignal, AbortController, fetch: async (url, init) => { requests.push({ url, init }); return typeof translate === 'function' ? translate(url, init) : translate; },
    require(name) { if (name === 'next/server') return { NextRequest: class {}, NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } };
      if (name === '@/lib/tibo-feed') return { readTiboFeed: async () => { feedCalls++; return feed; } };
      if (name === '@/lib/bounded-request') return bounded.exports; throw new Error(name); } };
  vm.runInNewContext(translateRoute, sandbox);
  return { GET: (id, lang = 'zh', signal = new AbortController().signal) => sandbox.exports.GET({ nextUrl: new URL(`https://blog.test/api/tibo/translate?id=${encodeURIComponent(id)}&lang=${lang}`), signal }), requests, feedCalls: () => feedCalls };
}
function loadFeed({ fetcher = async () => response({}) } = {}) {
  const bounded = { exports: {}, AbortController, AbortSignal };
  vm.runInNewContext(helper, bounded);
  const parser = { exports: {}, require(name) { if (name === 'acorn') return require('acorn'); throw new Error(name); } };
  vm.runInNewContext(parseCode, parser);
  const feed = { exports: {}, fetch: fetcher, AbortController, AbortSignal, Date,
    require(name) { if (name === '@/lib/bounded-request') return bounded.exports; if (name === '@/lib/tibo-posts') return parser.exports; throw new Error(name); } };
  vm.runInNewContext(feedCode, feed);
  const route = { exports: {}, require(name) { if (name === 'next/server') return { NextRequest: class {}, NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } };
      if (name === '@/lib/tibo-feed') return feed.exports; throw new Error(name); } };
  vm.runInNewContext(feedRoute, route);
  return { GET: (signal = new AbortController().signal) => route.exports.GET({ signal }) };
}

 test('feed route reads only the fixed public profile source', async () => {
  const calls = [];
  const api = loadFeed({ fetcher: async (url, options) => { calls.push({ url, options }); return { ok: true, text: async () => sourceHtml }; } });
  const result = await api.GET();
  assert.equal(result.status, 200);
  assert.equal(result.data.posts[0].id, post.rest_id);
  assert.deepEqual(calls.map(call => call.url), ['https://x.com/thsottiaux']);
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('invalid translation IDs return 400 without reading the feed or calling a service', async () => {
  const api = loadTranslate();
  for (const id of ['', 'abc', '123', '12345678901234567890123456']) assert.equal((await api.GET(id)).status, 400);
  assert.equal(api.feedCalls(), 0);
  assert.equal(api.requests.length, 0);
});

test('IDs outside the feed return 404 and long source text returns 422 without translation', async () => {
  const missing = loadTranslate();
  assert.equal((await missing.GET('1234567890124')).status, 404);
  assert.equal(missing.requests.length, 0);
  const long = loadTranslate({ feed: { posts: [{ id: post.rest_id, text: 'x'.repeat(3001) }] } });
  assert.equal((await long.GET(post.rest_id)).status, 422);
  assert.equal(long.requests.length, 0);
});

test('invalid translation payloads return 502', async () => {
  const api = loadTranslate({ translate: response({ translate: '   ' }) });
  const result = await api.GET(post.rest_id);
  assert.equal(result.status, 502);
  assert.equal(api.requests.length, 1);
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { text: 'synthetic text', to_lang: 'zh' });
});

test('aborting the request or reaching its deadline returns 502 and aborts upstream', async () => {
  const api = loadTranslate({ translate: () => new Promise(() => {}), timeoutMs: 10 });
  const result = await api.GET(post.rest_id);
  assert.equal(result.status, 502);
  assert.equal(api.requests[0].init.signal.aborted, true);
  const cancelled = loadTranslate({ translate: () => new Promise(() => {}) });
  const controller = new AbortController();
  const pending = cancelled.GET(post.rest_id, 'en', controller.signal);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  assert.equal((await pending).status, 502);
});
