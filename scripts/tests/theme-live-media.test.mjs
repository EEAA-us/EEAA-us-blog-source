import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';

const sandbox = { exports: {} };
vm.runInNewContext(ts.transpileModule(await readFile(new URL('../../lib/theme-live-media.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, sandbox);
const { themeLiveMediaMasks } = sandbox.exports;
const rectangle = (left, top, right, bottom) => ({ left, top, right, bottom });
function documentWith(bounds, clip, nav) {
  return { querySelectorAll: () => bounds.map(r => ({ getBoundingClientRect: () => r, closest: () => clip ? { getBoundingClientRect: () => clip } : null })),
    querySelector: () => nav ? { getBoundingClientRect: () => nav } : null };
}
async function raster(value) {
  const svg = decodeURIComponent(value.slice('url("data:image/svg+xml,'.length, -2));
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return (x, y) => data[(y * info.width + x) * info.channels + info.channels - 1];
}
test('live video masks stay continuous behind the navbar and clip scaled media to the cover', async () => {
  const masks = themeLiveMediaMasks(documentWith([rectangle(-20, -40, 660, 600)], rectangle(10, 0, 630, 400), rectangle(0, 0, 640, 64)), 640, 480);
  const old = await raster(masks['--theme-static-mask']), live = await raster(masks['--theme-live-mask']);
  for (const [x, y] of [[320, 0], [320, 20], [320, 63], [320, 64], [320, 65], [20, 80], [320, 200], [620, 390]]) {
    assert.equal(old(x, y), 0, 'the old frozen frame must be removed');
    assert.equal(live(x, y), 255, 'the live frame stays fully visible at every wipe position');
  }
  for (const [x, y] of [[5, 200], [635, 200], [320, 450]]) {
    assert.equal(old(x, y), 255, 'regions outside the cover retain the directional reveal');
    assert.equal(live(x, y), 0);
  }
});
test('static, offscreen and zero-sized scenes do not add a live mask', () => {
  for (const d of [documentWith([]), documentWith([rectangle(0, 600, 640, 900)]), documentWith([rectangle(1, 1, 1, 1)])]) {
    assert.equal(Object.keys(themeLiveMediaMasks(d, 640, 480)).length, 0);
  }
});
test('multiple visible media areas remain live while the space between them still transitions', async () => {
  const masks = themeLiveMediaMasks(documentWith([rectangle(10, 80, 100, 150), rectangle(300, 200, 400, 300)]), 640, 480);
  const old = await raster(masks['--theme-static-mask']), live = await raster(masks['--theme-live-mask']);
  for (const [x, y] of [[20, 100], [350, 250]]) { assert.equal(old(x, y), 0); assert.equal(live(x, y), 255); }
  assert.equal(old(200, 180), 255); assert.equal(live(200, 180), 0);
});
