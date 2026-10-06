import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(new URL("../../app/api/music-audio/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function route(resolve, fetch) {
  const bitrates = [];
  class Meting {
    format() {}
    async url(id, bitrate) { bitrates.push(bitrate); return JSON.stringify(await resolve(id, bitrate)); }
  }
  class NextResponse extends Response {
    static json(body, options) { return new NextResponse(JSON.stringify(body), options); }
  }
  const sandbox = { exports: {}, URL, Response, Headers, AbortSignal, fetch,
    require: name => name === "@meting/core" ? { default: Meting } : { NextResponse } };
  vm.runInNewContext(compiled, sandbox);
  return { get: sandbox.exports.GET, bitrates };
}
function request(range = "bytes=0-0") {
  return { nextUrl: new URL("http://localhost/api/music-audio?id=5235487"), headers: new Headers({ Range: range }), signal: new AbortController().signal };
}

test("unavailable high bitrate resolves a lower bitrate and preserves range streaming", async () => {
  const r = route((id, bitrate) => bitrate === 320 ? {} : { url: "https://m7.music.126.net/available.mp3" }, async (url, options) => {
    assert.equal(options.headers.Range, "bytes=0-0");
    return new Response(new Uint8Array([10]), { status: 206, headers: { "content-type": "audio/mpeg", "content-range": "bytes 0-0/999", "content-length": "1" } });
  });
  const result = await r.get(request());
  assert.deepEqual(r.bitrates, [320, 128]);
  assert.equal(result.status, 206);
  assert.equal(result.headers.get("content-range"), "bytes 0-0/999");
  assert.equal((await result.arrayBuffer()).byteLength, 1);
});

test("a failing high quality CDN response falls back; unavailable sources differ from network errors", async () => {
  let calls = 0;
  const r = route(() => ({ url: "https://m7.music.126.net/audio.mp3" }), async () => ++calls === 1
    ? new Response("Unavailable", { status: 503 })
    : new Response(new Uint8Array([10]), { status: 206, headers: { "content-type": "audio/mpeg" } }));
  assert.equal((await r.get(request())).status, 206);
  assert.deepEqual(r.bitrates, [320, 128]);
  const unavailable = route(() => ({}), () => { throw new Error("should not fetch"); });
  assert.equal((await unavailable.get(request())).status, 404);
  const offline = route(() => ({ url: "https://m7.music.126.net/audio.mp3" }), () => { throw new Error("offline"); });
  assert.equal((await offline.get(request())).status, 502);
});

test("unsatisfiable ranges keep their status and size without trying another encoding", async () => {
  const r = route(() => ({ url: "https://m7.music.126.net/audio.mp3" }), async () => new Response(null, { status: 416, headers: { "content-range": "bytes */99" } }));
  const result = await r.get(request("bytes=999-"));
  assert.equal(result.status, 416);
  assert.equal(result.headers.get("content-range"), "bytes */99");
  assert.deepEqual(r.bitrates, [320]);
});
