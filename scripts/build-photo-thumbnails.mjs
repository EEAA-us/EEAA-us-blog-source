import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const defaultPublic = fileURLToPath(new URL('../public/', import.meta.url));

// Only create derivatives of the site's local gallery images. Originals and
// their attribution metadata remain untouched; the lightbox keeps their URLs.
export async function buildPhotoThumbnails(publicRoot = defaultPublic) {
  const manifest = {};
  const results = [];
  const destination = join(publicRoot, 'images/photo-thumbnails');
  await mkdir(destination, { recursive: true });
  for (const folder of ['article-covers', 'anime-stills', 'games']) {
    const directory = join(publicRoot, 'images', folder);
    let files;
    try { files = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const entry of files) {
      if (!entry.isFile() || !/\.(webp|png|jpe?g)$/i.test(entry.name)) continue;
      const source = await readFile(join(directory, entry.name));
      const hash = createHash('sha256').update(source).digest('hex');
      const name = `${folder}-${hash.slice(0, 16)}.webp`;
      const output = await sharp(source).rotate().resize({ width: 640, height: 800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      await writeFile(join(destination, name), output);
      const url = `/images/${folder}/${entry.name}`;
      manifest[url] = `/images/photo-thumbnails/${name}`;
      results.push({ url, originalBytes: source.length, thumbnailBytes: output.length, originalSha256: hash });
    }
  }
  await writeFile(join(publicRoot, 'photo-thumbnails.json'), JSON.stringify(manifest, null, 2) + '\n');
  return results;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const results = await buildPhotoThumbnails();
  console.log(JSON.stringify({ photos: results.length,
    originalBytes: results.reduce((total, item) => total + item.originalBytes, 0),
    thumbnailBytes: results.reduce((total, item) => total + item.thumbnailBytes, 0) }));
}
