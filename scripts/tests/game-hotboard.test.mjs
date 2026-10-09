import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const routeSource = await readFile(new URL('../../app/api/game-hotboard/route.ts', import.meta.url), 'utf8');
const helper = compile(await readFile(new URL('../../lib/bounded-request.ts', import.meta.url), 'utf8'));

function fixture(fetcher, deadlineMs = 10_000) {
  const route = compile(routeSource.replace('const DEADLINE_MS = 10_000;', `const DEADLINE_MS = ${deadlineMs};`));
  const common = { AbortController, AbortSignal, URL, fetch: fetcher };
  const bounded = { ...common, exports: {} };
  vm.runInNewContext(helper, bounded);
  const sandbox = { ...common, exports: {}, require(name) {
    if (name === 'next/server') return { NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } };
    return bounded.exports;
  } };
  vm.runInNewContext(route, sandbox);
  return (type, signal = new AbortController().signal) => sandbox.exports.GET({
    nextUrl: new URL(`https://blog.test/api/game-hotboard?type=${encodeURIComponent(type)}`), signal,
  });
}

test('Overwatch uses the official weekly forum order and builds validated topic links', async () => {
  const requested = [];
  const get = fixture(async (url, options) => {
    requested.push({ url, options });
    return Response.json({ topic_list: { topics: [
      { title: 'First topic', slug: 'first-topic', id: 101, views: 646, posts_count: 74, like_count: 172 },
      { title: 'Second topic', slug: 'second-topic', id: 102, views: 565, posts_count: 37, like_count: 86 },
      { title: 'Unsafe slug', slug: '../other', id: 103 },
    ] } });
  });

  const result = await get('overwatch');
  assert.equal(result.status, 200);
  assert.equal(requested.length, 1);
  assert.equal(requested[0].url, 'https://us.forums.blizzard.com/en/overwatch/top.json?period=weekly');
  assert.equal(requested[0].options.next.revalidate, 60);
  assert.deepEqual(result.data.list.map(item => item.index), [1, 2]);
  assert.equal(result.data.list[0].url, 'https://us.forums.blizzard.com/en/overwatch/t/first-topic/101');
  assert.equal(result.data.list[0].hot_value, '646 浏览 · 73 回复 · 172 赞');
  assert.equal(result.data.list[0].source, '暴雪论坛周榜');
  assert.match(result.data.notice, /不是全网热搜/);
});

test('Wuthering Waves preserves Bilibili rank then appends real aggregate search results without synthetic ranks', async () => {
  const requested = [];
  const bilibiliList = Array.from({ length: 93 }, (_, i) => ({ title: `其他视频 ${i + 1}`, url: `https://www.bilibili.com/video/BVother${i}` }));
  bilibiliList.push({ title: '神迹之下,皆是人心！鸣潮如何诠释文明不屈？', url: 'https://www.bilibili.com/video/BV1mKpx6CEFH', hot_value: '61134播放' });
  const get = fixture(async (url, options) => {
    requested.push({ url, options });
    if (url.endsWith('/misc/hotboard?type=bilibili')) return Response.json({ list: bilibiliList });
    assert.equal(url, 'https://uapis.cn/api/v1/search/aggregate');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), { query: '鸣潮 游戏', sort: 'date' });
    return Response.json({ results: [
      { title: '鸣潮游戏启动', url: 'https://www.bilibili.com/video/BV1FfeXzWEnA', publish_time: '2025-08-28T00:00:00Z' },
      { title: '鸣潮 介绍', url: 'http://www.appchina.com/app/com.kurogame.mingchao' },
      { title: '其他游戏', url: 'https://example.com/unrelated' },
      { title: '鸣潮危险链接', url: 'javascript:alert(1)' },
      { title: '鸣潮重复视频', url: 'https://www.bilibili.com/video/BV1mKpx6CEFH' },
    ] });
  });

  const result = await get('wuthering-waves');
  assert.equal(result.status, 200);
  assert.equal(requested.length, 2);
  const [hot, ...search] = result.data.list;
  assert.equal(hot.index, 94);
  assert.equal(hot.source, 'B站全站热榜');
  assert.equal(hot.title, '神迹之下,皆是人心！鸣潮如何诠释文明不屈？');
  assert.equal(search.length, 2);
  assert.ok(search.every(item => item.index === undefined && item.source === 'UAPI 聚合搜索'));
  assert.equal(search[0].publish_time, '2025-08-28T00:00:00Z');
  assert.match(result.data.notice, /搜索结果不是热度排名/);
  assert.match(result.data.notice, /按服务端日期顺序/);
});

test('a failed source is disclosed while the remaining real source still renders', async () => {
  const get = fixture(async url => {
    if (url.endsWith('/misc/hotboard?type=bilibili')) throw new Error('offline');
    return Response.json({ results: [{ title: '鸣潮官方版本更新', url: 'https://example.com/news' }] });
  });
  const result = await get('wuthering-waves');
  assert.equal(result.status, 200);
  assert.equal(result.data.list.length, 1);
  assert.match(result.data.notice, /部分来源暂不可用/);
});

test('invalid topic avoids requests; all failed or timed out sources return an error', async () => {
  let calls = 0;
  const get = fixture(async () => { calls++; throw new Error('offline'); });
  assert.equal((await get('unknown')).status, 400);
  assert.equal(calls, 0);
  assert.equal((await get('wuthering-waves')).status, 502);

  const never = fixture((_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }), 15);
  const timedOut = await never('overwatch');
  assert.equal(timedOut.status, 502);
});

test('client cancellation reaches the external request signal', async () => {
  let observedSignal;
  const get = fixture((_url, options) => {
    observedSignal = options.signal;
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  });
  const controller = new AbortController();
  const pending = get('overwatch', controller.signal);
  controller.abort();
  const result = await pending;
  assert.equal(result.status, 502);
  assert.equal(observedSignal.aborted, true);
});
