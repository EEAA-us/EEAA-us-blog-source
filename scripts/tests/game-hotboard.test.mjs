import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const route = compile(await readFile(new URL('../../app/api/game-hotboard/route.ts', import.meta.url), 'utf8'));
const helper = compile(await readFile(new URL('../../lib/bounded-request.ts', import.meta.url), 'utf8'));
function fixture(fetcher) {
  const common = { AbortController, AbortSignal, fetch: fetcher };
  const bounded = { ...common, exports: {} };
  vm.runInNewContext(helper, bounded);
  const sandbox = { ...common, exports: {}, require(name) {
    if (name === 'next/server') return { NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } };
    return bounded.exports;
  } };
  vm.runInNewContext(route, sandbox);
  return type => sandbox.exports.GET({ nextUrl: new URL('https://blog.test/api/game-hotboard?type=' + type), signal: new AbortController().signal });
}
test('game topics filter real titles, reject unsafe links, and deduplicate without inventing content', async () => {
  const urls = [];
  const get = fixture(async url => { urls.push(url); return Response.json({ list: [
    { title: '鸣潮新版本', url: 'https://example.com/1', hot_value: 200 },
    { title: '其他游戏', url: 'https://example.com/2' },
    { title: '鸣潮', url: 'javascript:alert(1)' },
  ] }); });
  const result = await get('wuthering-waves');
  assert.equal(result.status, 200);
  assert.equal(result.data.list.length, 1);
  assert.equal(result.data.list[0].title, '鸣潮新版本');
  assert.equal(result.data.list[0].source, 'B站');
  assert.match(result.data.notice, /并非游戏独立排行榜/);
  assert.deepEqual(urls, ['https://uapis.cn/api/v1/misc/hotboard?type=bilibili', 'https://uapis.cn/api/v1/misc/hotboard?type=tieba']);
});
test('one failed source leaves real matching content and discloses partial failure', async () => {
  const get = fixture(async url => url.endsWith('tieba') ? Response.json({}, { status: 502 }) : Response.json({ list: [{ title: 'Overwatch赛事', url: 'https://example.com/event' }] }));
  const result = await get('overwatch');
  assert.equal(result.status, 200);
  assert.equal(result.data.list.length, 1);
  assert.match(result.data.notice, /部分来源暂不可用/);
});
test('invalid topics make no external request; failed sources are not disguised as an empty list', async () => {
  let calls = 0;
  const get = fixture(async () => { calls++; throw new Error('offline'); });
  assert.equal((await get('unknown')).status, 400);
  assert.equal(calls, 0);
  assert.equal((await get('overwatch')).status, 502);
});
