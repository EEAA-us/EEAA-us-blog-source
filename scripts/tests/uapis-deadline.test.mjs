import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url), ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}}).outputText;
const helper = compile(await readFile(new URL('../../lib/bounded-request.ts', import.meta.url), 'utf8'));
const route = compile(await readFile(new URL('../../app/api/uapis/route.ts', import.meta.url), 'utf8'));

function load(fetcher, timeout = 1000) {
  const base = { URLSearchParams, AbortSignal: { any: signals => AbortSignal.any(signals), timeout: () => AbortSignal.timeout(timeout) } };
  const bounded = { ...base, exports: {} };
  vm.runInNewContext(helper, bounded);
  const sandbox = { ...base, exports: {}, fetch: fetcher, require(name) {
    if (name === 'next/server') return { NextResponse: Response };
    if (name === '@/lib/bounded-request') return bounded.exports;
    throw new Error(name);
  } };
  vm.runInNewContext(route, sandbox);
  return sandbox.exports;
}
const request = (suffix = '?path=misc/hotboard&type=weibo') => ({
  nextUrl: new URL('https://blog.example/api/uapis' + suffix),
  signal: new AbortController().signal, json: async () => ({ text: 'example' }),
});

test('GET retains the fixed upstream address, query and response status', async () => {
  let called;
  const api = load(async (url, init) => { called = { url, init }; return Response.json({ message: 'Unavailable' }, { status: 503 }); });
  const result = await api.GET(request());
  assert.equal(called.url, 'https://uapis.cn/api/v1/misc/hotboard?type=weibo');
  assert.ok(called.init.signal instanceof AbortSignal);
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { message: 'Unavailable' });
});

test('a stuck upstream body terminates with a recoverable 502 response', async () => {
  const api = load(async () => ({ status: 200, json: () => new Promise(() => {}) }), 15);
  const keepAlive = setTimeout(() => {}, 40);
  try { assert.equal((await api.GET(request())).status, 502); }
  finally { clearTimeout(keepAlive); }
});

test('POST retains the existing JSON forwarding contract', async () => {
  let init;
  const api = load(async (_, options) => { init = options; return Response.json({ ok: true }); });
  assert.equal((await api.POST(request('?path=text/example'))).status, 200);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), { text: 'example' });
});

test('POST body parsing also has a deadline before contacting upstream', async () => {
  let calls = 0;
  const api = load(async () => { calls++; return Response.json({}); }, 15);
  const req = { ...request(), json: () => new Promise(() => {}) };
  const keepAlive = setTimeout(() => {}, 40);
  try { assert.equal((await api.POST(req)).status, 502); assert.equal(calls, 0); }
  finally { clearTimeout(keepAlive); }
});

test('a missing path still returns 400 without starting an upstream request', async () => {
  const api = load(() => { throw new Error('Should not fetch'); });
  assert.equal((await api.GET(request(''))).status, 400);
});
