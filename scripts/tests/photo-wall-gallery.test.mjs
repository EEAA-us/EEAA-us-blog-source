import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function compile(relative) {
  const source = await readFile(path.join(root, relative), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

async function loadRealBuiltinAlbums() {
  async function evaluate(relative, imports = {}) {
    const sandbox = {
      exports: {},
      require(specifier) {
        if (Object.hasOwn(imports, specifier)) return imports[specifier];
        throw new Error(`Unexpected import in ${relative}: ${specifier}`);
      },
    };
    vm.runInNewContext(await compile(relative), sandbox, { filename: relative });
    return sandbox.exports;
  }
  const articleSources = JSON.parse(await readFile(path.join(root, "public/images/article-covers/sources.json"), "utf8"));
  const animeSources = JSON.parse(await readFile(path.join(root, "public/images/anime-stills/sources.json"), "utf8"));
  const siteConfig = { siteConfig: { defaultPostCover: "/images/cover.webp" } };
  const [{ articleCoverAlbum }, { gameAlbums }, { localAnimePhotos }] = await Promise.all([
    evaluate("data/article-covers.ts", { "@/public/images/article-covers/sources.json": { __esModule: true, default: articleSources }, "@/siteConfig": siteConfig }),
    evaluate("data/game-gallery.ts"),
    evaluate("data/photos.ts", { "@/public/images/anime-stills/sources.json": { __esModule: true, default: animeSources } }),
  ]);
  return { articleCoverAlbum, gameAlbums, localAnimePhotos };
}

function loadGallery({ albums = [], photos = {}, failure, articleCoverAlbum = { id: 0, title: "文章封面库", updatedAt: "", photoCount: 60, photos: Array.from({ length: 60 }, (_, i) => ({ id: `a${i}`, url: `/a/${i}`, caption: `文章 ${i}`, orientation: "landscape" })) }, gameAlbums = Array.from({ length: 60 }, (_, i) => ({ id: 10 + i, title: `游戏 ${i}`, updatedAt: "", photoCount: 1, photos: [{ id: `g${i}`, url: `/g/${i}`, caption: `游戏图 ${i}`, orientation: "landscape" }] })), localAnimePhotos = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, url: `/n/${i}`, caption: `动漫图 ${i}`, orientation: "landscape" })) } = {}) {
  const originalAlbums = albums;
  const compiled = loadGallery.compiled;
  const sandbox = {
    exports: {},
    require(specifier) {
      if (specifier === "@/app/api/albums") return {
        getAlbums: async () => { if (failure) throw failure; return originalAlbums; },
        getAlbumPhotos: async (id) => { if (failure) throw failure; return photos[id] ?? []; },
      };
      if (specifier === "@/data/article-covers") return { articleCoverAlbum };
      if (specifier === "@/data/game-gallery") return { gameAlbums };
      if (specifier === "@/data/photos") return { localAnimePhotos };
      throw new Error(`Unexpected import: ${specifier}`);
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: "lib/photo-wall-gallery.ts" });
  return sandbox.exports;
}
loadGallery.compiled = await compile("lib/photo-wall-gallery.ts");

test("personal albums sort by updated time, photos reverse, and API arrays stay untouched", async () => {
  const albums = [
    { id: 1, title: "older", updated_at: "2025-01-01", photo_count: 2 },
    { id: 2, title: "newer", updated_at: "2026-01-01", photo_count: 2 },
  ];
  const photos = {
    1: [{ id: 1, url: "/1", caption: "first" }, { id: 2, url: "/2", caption: "second" }],
    2: [{ id: 3, url: "/3", caption: "third" }, { id: 4, url: "/4", caption: "fourth" }],
  };
  const albumsBefore = structuredClone(albums);
  const photosBefore = structuredClone(photos);
  const { loadPhotoWallAlbums, builtinPhotoWallAlbums } = loadGallery({ albums, photos });
  const result = await loadPhotoWallAlbums();
  assert.deepEqual(result.slice(0, builtinPhotoWallAlbums.length).map((item) => item.id), builtinPhotoWallAlbums.map((item) => item.id));
  assert.deepEqual(JSON.parse(JSON.stringify(result.slice(builtinPhotoWallAlbums.length).map((item) => item.id))), [2, 1]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.slice(builtinPhotoWallAlbums.length).map((item) => item.photos.map((photo) => photo.caption)))), [["fourth", "third"], ["second", "first"]]);
  assert.deepEqual(albums, albumsBefore);
  assert.deepEqual(photos, photosBefore);
});

test("configured built-in galleries keep their photos and an empty template catalog remains valid", async () => {
  const real = await loadRealBuiltinAlbums();
  const { loadPhotoWallAlbums, fallbackPhotoWallAlbums } = loadGallery({
    articleCoverAlbum: real.articleCoverAlbum,
    gameAlbums: real.gameAlbums,
    localAnimePhotos: real.localAnimePhotos,
  });
  const result = await loadPhotoWallAlbums();
  assert.equal(result, fallbackPhotoWallAlbums);
  assert.deepEqual(JSON.parse(JSON.stringify(result.flatMap(album => album.photos))), JSON.parse(JSON.stringify([
    ...real.articleCoverAlbum.photos, ...real.gameAlbums.flatMap(album => album.photos), ...real.localAnimePhotos,
  ])));
  assert.ok(result.flatMap((album) => album.photos).every((photo) => typeof photo.caption === "string" && photo.caption.trim().length > 0));
});

test("large independent fallback fixtures preserve 60 covers, 60 game photos and 24 anime photos", async () => {
  const anime = Array.from({ length: 24 }, (_, i) => ({ id: `anime${i}`, url: `/anime/${i}`, caption: `Caption ${i}`, orientation: "landscape" }));
  const { loadPhotoWallAlbums } = loadGallery({ localAnimePhotos: anime });
  const result = await loadPhotoWallAlbums();
  assert.equal(result[0].photos.length, 60);
  assert.equal(result.slice(1, -1).reduce((sum, album) => sum + album.photos.length, 0), 60);
  assert.equal(result.at(-1).photos.length, 24);
});

test("album API failures reject to the caller", async () => {
  const failure = new Error("album service unavailable");
  const { loadPhotoWallAlbums } = loadGallery({ failure });
  await assert.rejects(loadPhotoWallAlbums(), (error) => error === failure);
});

test("appearance uses the current animated default and preserves stored cover modes", async () => {
  const compiled = await compile("lib/appearance.ts");
  const mediaDefaults = JSON.parse(await readFile(path.join(root, "public/hero-media-defaults.json"), "utf8"));
  const configSandbox = { exports: {}, process: { env: {} }, require(specifier) {
    if (specifier === "./public/hero-media-defaults.json") return { __esModule: true, default: mediaDefaults };
    throw new Error(`Unexpected site config import: ${specifier}`);
  } };
  vm.runInNewContext(await compile("siteConfig.ts"), configSandbox, { filename: "siteConfig.ts" });
  const sandbox = {
    exports: {},
    URL,
    require(specifier) {
      if (specifier === "../siteConfig") return { ...configSandbox.exports, retiredHeroImages: ["/images/retired-a.webp", "/images/retired-b.jpg"] };
      if (specifier === "@material/material-color-utilities") return Object.fromEntries([
        "SchemeTonalSpot", "SchemeVibrant", "SchemeContent", "SchemeExpressive", "SchemeRainbow", "SchemeFruitSalad", "SchemeMonochrome", "SchemeNeutral", "SchemeFidelity",
      ].map((key) => [key, class {}]));
      throw new Error(`Unexpected import: ${specifier}`);
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: "lib/appearance.ts" });
  const { defaultAppearance, normalizeAppearance } = sandbox.exports;
  assert.equal(defaultAppearance.heroMode, configSandbox.exports.siteConfig.initialAppearance.heroMode);
  assert.equal(defaultAppearance.heroMediaUrl, configSandbox.exports.siteConfig.initialAppearance.heroMediaUrl);
  assert.equal(defaultAppearance.homeTextScale, 100);
  assert.equal(defaultAppearance.homeTextWeight, "default");
  assert.equal(defaultAppearance.heroInterval, 4);
  assert.equal(normalizeAppearance({}).heroMode, configSandbox.exports.siteConfig.initialAppearance.heroMode);
  assert.equal(normalizeAppearance({ heroMode: "slideshow" }).heroMode, "slideshow");
  assert.equal(normalizeAppearance({}).homeTextScale, 100);
  assert.equal(normalizeAppearance({}).homeTextWeight, "default");
  assert.equal(normalizeAppearance({ homeTextScale: undefined, homeTextWeight: undefined }).homeTextScale, 100);
  assert.equal(normalizeAppearance({ homeTextScale: NaN, homeTextWeight: "heavy" }).homeTextScale, 100);
  assert.equal(normalizeAppearance({ homeTextScale: 99, homeTextWeight: "heavy" }).homeTextScale, 100);
  assert.equal(normalizeAppearance({ homeTextScale: 100 }).homeTextScale, 100);
  assert.equal(normalizeAppearance({ homeTextScale: 107 }).homeTextScale, 107);
  assert.equal(normalizeAppearance({ homeTextScale: 115 }).homeTextScale, 115);
  assert.equal(normalizeAppearance({ homeTextScale: 116 }).homeTextScale, 115);
  assert.equal(normalizeAppearance({ homeTextWeight: "default" }).homeTextWeight, "default");
  assert.equal(normalizeAppearance({ homeTextWeight: "medium" }).homeTextWeight, "medium");
  assert.equal(normalizeAppearance({ homeTextWeight: "bold" }).homeTextWeight, "bold");
  assert.equal(normalizeAppearance({ heroMode: "fixed" }).heroMode, "fixed");
  assert.equal(normalizeAppearance({ heroMode: "animated" }).heroMode, "animated");
  const migrated = normalizeAppearance({ heroSlides: ["/images/retired-a.webp", "/images/retired-b.jpg", "/images/1.webp", "https://example.com/custom.jpg"], waveOpacity: 100, heroInterval: 6 });
  assert.deepEqual(Array.from(migrated.heroSlides), ["/images/1.webp", "https://example.com/custom.jpg"]);
  assert.equal(migrated.waveOpacity, 100);
  assert.equal(normalizeAppearance({ waveSpeed: 300, waveOpacity: 100 }).waveSpeed, 300);
  assert.equal(normalizeAppearance({ waveSpeed: 400, waveOpacity: 120 }).waveSpeed, 300);
  assert.equal(normalizeAppearance({ waveOpacity: 120 }).waveOpacity, 100);
  assert.equal(normalizeAppearance({ waveOpacity: 50 }).waveOpacity, 50);
  assert.equal(migrated.heroInterval, 6);
  assert.equal(normalizeAppearance({ waveOpacity: 0 }).waveOpacity, 0);
});
