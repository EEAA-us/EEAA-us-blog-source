import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const source = compile(await readFile(new URL('../../lib/published-article.ts', import.meta.url), 'utf8'));
const helper = compile(await readFile(new URL('../../lib/bounded-request.ts', import.meta.url), 'utf8'));
function fixture(fetcher, deadline = 1000) {
  let now = 1000;
  const common = { AbortController, AbortSignal: { any: signals => AbortSignal.any(signals), timeout: () => AbortSignal.timeout(deadline) },
    structuredClone, Date: { now: () => now }, fetch: fetcher };
  const bounded = { ...common, exports: {} };
  vm.runInNewContext(helper, bounded);
  const sandbox = { ...common, exports: {}, require: () => bounded.exports };
  vm.runInNewContext(source, sandbox);
  return { load: sandbox.exports.loadPublishedArticle, advance: () => { now += 30_001; } };
}
test('chapter revisits share requests, isolate counters, and refresh after the short cache expires', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; return Response.json({ id: 1, content: 'chapter', views: 2 }); });
  const [a, b] = await Promise.all([f.load(1), f.load(1)]);
  a.views = 50;
  assert.equal(b.views, 2);
  assert.equal((await f.load(1)).views, 2);
  assert.equal(calls, 1);
  f.advance();
  await f.load(1);
  assert.equal(calls, 2);
});
test('a hung JSON body times out and a later retry can load the article', async () => {
  let calls = 0;
  const f = fixture(async () => ++calls === 1 ? { ok: true, json: () => new Promise(() => {}) } : Response.json({ id: 1, content: 'recovered' }), 15);
  const keeper = setTimeout(() => {}, 100);
  try { await assert.rejects(f.load(1)); } finally { clearTimeout(keeper); }
  assert.equal((await f.load(1)).content, 'recovered');
});
test('a different article ID cannot be cached as the requested chapter', async () => {
  let calls = 0;
  const f = fixture(async () => Response.json({ id: ++calls === 1 ? 2 : 1, content: 'body' }));
  await assert.rejects(f.load(1), /Invalid published article/);
  assert.equal((await f.load(1)).id, 1);
});
