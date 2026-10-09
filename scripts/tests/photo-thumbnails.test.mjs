import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { buildPhotoThumbnails } from '../build-photo-thumbnails.mjs';

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
test('thumbnail generation preserves original bytes and produces bounded, decodable derivatives', async () => {
  const root = await mkdtemp(join(tmpdir(), 'blog-photo-thumbnails-'));
  try {
    await mkdir(join(root, 'images/games'), { recursive: true });
    const original = await sharp({ create: { width: 2000, height: 1400, channels: 3, background: '#45a7bf' } }).png().toBuffer();
    const source = join(root, 'images/games/example.png');
    await writeFile(source, original);
    const result = await buildPhotoThumbnails(root);
    assert.equal(result.length, 1);
    assert.deepEqual(await readFile(source), original);
    const map = JSON.parse(await readFile(join(root, 'photo-thumbnails.json'), 'utf8'));
    const thumb = await readFile(join(root, map['/images/games/example.png']));
    const decoded = await sharp(thumb).raw().toBuffer({ resolveWithObject: true });
    assert.ok(decoded.info.width <= 640 && decoded.info.height <= 800);
    assert.ok(thumb.length < original.length);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + '\\') || resolve(root).startsWith(resolve(tmpdir()) + '/'));
    await rm(root, { recursive: true, force: true });
  }
});
