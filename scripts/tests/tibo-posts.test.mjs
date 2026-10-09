import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url), ts = require('typescript');
const source = await readFile(new URL('../../lib/tibo-posts.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const makePost = ({ id = '1234567890123', user = 'thsottiaux', text = 'sample', timestamp = 1_700_000_000_000, note } = {}) => ({
  __typename: 'Tweet', rest_id: id,
  core: { user_results: { result: { core: { screen_name: user } } } },
  details: { full_text: text, created_at_ms: timestamp },
  ...(note === undefined ? {} : { note_tweet: { note_tweet_results: { result: { text: note } } } }),
});
function parser() {
  const sandbox = { exports: {}, require(name) { if (name === 'acorn') return require('acorn'); throw new Error(name); } };
  vm.runInNewContext(code, sandbox, { filename: 'lib/tibo-posts.ts' });
  return sandbox.exports.parseTiboPosts;
}
const html = (...posts) => `<html><title>Tibo (@thsottiaux)</title><script>${posts.map((post, i) => `$R[${i + 1}] = ${JSON.stringify(post)};`).join('\n')}</script></html>`;

test('reads only @thsottiaux posts and prefers note-tweet long text', () => {
  const parse = parser();
  const output = parse(html(
    makePost({ id: '1234567890123', note: 'long-form note body', text: 'short fallback' }),
    makePost({ id: '1234567890124', user: 'different_account', text: 'must not appear' }),
  ));
  assert.deepEqual(JSON.parse(JSON.stringify(output)), [{ id: '1234567890123', text: 'long-form note body', publishedAt: new Date(1_700_000_000_000).toISOString(), url: 'https://x.com/thsottiaux/status/1234567890123' }]);
});

test('deduplicates IDs, sorts newest first, and returns at most six posts', () => {
  const parse = parser();
  const rows = Array.from({ length: 8 }, (_, i) => makePost({ id: String(1234567890120 + i), timestamp: 1_700_000_000_000 + i * 1000, text: `post-${i}` }));
  rows.push(makePost({ id: '1234567890127', timestamp: 1_700_000_008_000, text: 'duplicate-latest' }));
  const output = parse(html(...rows));
  assert.equal(output.length, 6);
  assert.deepEqual(JSON.parse(JSON.stringify(output.map(post => post.id))), ['1234567890127', '1234567890126', '1234567890125', '1234567890124', '1234567890123', '1234567890122']);
  assert.equal(output[0].text, 'duplicate-latest');
});

test('rejects non-profile pages and oversized HTML before parsing', () => {
  const parse = parser();
  assert.throws(() => parse('<title>Other (@someone)</title>'), /无法确认动态来源/);
  assert.throws(() => parse(`<title>Tibo (@thsottiaux)</title>${'x'.repeat(2_000_001)}`), /无法确认动态来源/);
});

test('drops malformed IDs and does not execute scripts or arbitrary calls', () => {
  const sandbox = { exports: {}, __executed: false, require(name) { if (name === 'acorn') return require('acorn'); throw new Error(name); } };
  vm.runInNewContext(code, sandbox);
  const malicious = `<title>Tibo (@thsottiaux)</title><script>globalThis.__executed = true; $R[1] = ${JSON.stringify(makePost({ id: '123', text: 'bad id' }))}; $R[99] = attack();</script>`;
  const output = sandbox.exports.parseTiboPosts(malicious);
  assert.deepEqual(JSON.parse(JSON.stringify(output)), []);
  assert.equal(sandbox.__executed, false);
});

test('rejects finite timestamps outside the JavaScript date range', () => {
  const parse = parser();
  const invalidDate = html(makePost({ id: '1234567890125', timestamp: 8_640_000_000_000_001, text: 'bad time' }));
  assert.deepEqual(JSON.parse(JSON.stringify(parse(invalidDate))), []);
});
