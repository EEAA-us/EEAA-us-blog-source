import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
// The package contains extensionless ESM imports supported by Next's bundler,
// so load its real color engine as CommonJS for these isolated Node checks.
const loadedModules = new Map();
function loadColorModule(filename) {
  if (loadedModules.has(filename)) return loadedModules.get(filename);
  const exports = {};
  loadedModules.set(filename, exports);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true } }).outputText;
  vm.runInNewContext(compiled, { exports, require(specifier) {
    const target = path.resolve(path.dirname(filename), specifier);
    return loadColorModule(path.extname(target) ? target : `${target}.js`);
  } }, { filename });
  return exports;
}
const materialColors = loadColorModule(require.resolve("@material/material-color-utilities"));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(path.join(root, "lib/appearance.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = {
  exports: {},
  URL,
  require(specifier) {
    if (specifier === "../siteConfig") return { siteConfig: { heroImages: [], initialAppearance: {
      heroMode: "animated", heroMediaKind: "video", heroMediaUrl: "/videos/covers/evanescia.mp4", live2dCharacter: "cyrene",
    } }, retiredHeroImages: [] };
    if (specifier === "@material/material-color-utilities") return materialColors;
    throw new Error(`Unexpected import: ${specifier}`);
  },
};
vm.runInNewContext(compiled, sandbox, { filename: "lib/appearance.ts" });
const { defaultAppearance, normalizeAppearance } = sandbox.exports;
const pickerSandbox = { exports: {} };
vm.runInNewContext(ts.transpileModule(await readFile(path.join(root, "lib/color-picker.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, pickerSandbox);
const homeSource = await readFile(path.join(root, "lib/home-card-colors.ts"), "utf8");
const homeSandbox = { exports: {}, require: specifier => { if (specifier === "./appearance") return sandbox.exports; if (specifier === "./color-picker") return pickerSandbox.exports; if (specifier === "@material/material-color-utilities") return materialColors; throw new Error(`Unexpected import: ${specifier}`); } };
vm.runInNewContext(ts.transpileModule(homeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, homeSandbox);
const { resolveHomeCardAppearance } = homeSandbox.exports;

test("first visit and reset select Evanescia video without replacing saved cover choices", () => {
  for (const saved of [{}, defaultAppearance]) {
    const prefs = normalizeAppearance(saved);
    assert.equal(prefs.heroMode, "animated");
    assert.equal(prefs.heroMediaKind, "video");
    assert.equal(prefs.heroMediaUrl, "/videos/covers/evanescia.mp4");
  }
  assert.equal(normalizeAppearance({ heroMode: "slideshow" }).heroMode, "slideshow");
  assert.equal(normalizeAppearance({ heroMode: "fixed" }).heroMode, "fixed");
  assert.equal(normalizeAppearance({ heroMediaUrl: "/videos/covers/silverwolf.mp4" }).heroMediaUrl, "/videos/covers/silverwolf.mp4");
});

test("a static template default works without bundled video or character assets", () => {
  const template = { exports: {}, URL, require(specifier) {
    if (specifier === "../siteConfig") return { siteConfig: { heroImages: ["/images/cover.svg"], initialAppearance: {
      heroMode: "fixed", heroMediaKind: "video", heroMediaUrl: "", live2dCharacter: "off",
    } }, retiredHeroImages: [] };
    if (specifier === "@material/material-color-utilities") return materialColors;
    throw new Error(`Unexpected import: ${specifier}`);
  } };
  vm.runInNewContext(compiled, template, { filename: "lib/appearance.ts" });
  const prefs = template.exports.normalizeAppearance({});
  assert.equal(prefs.heroMode, "fixed");
  assert.equal(prefs.heroMediaUrl, "");
  assert.equal(prefs.live2dCharacter, "off");
  assert.deepEqual([...prefs.heroSlides], ["/images/cover.svg"]);
  assert.equal(template.exports.normalizeAppearance({ heroMode: "animated", heroMediaUrl: "https://example.com/own.mp4" }).heroMediaUrl, "https://example.com/own.mp4");
});

test("theme free source persists and independent cards ignore global source and spread", () => {
  const prefs = normalizeAppearance({ themeColorMode: "free", themeHex: "#198754", themeColorSpread: true });
  assert.equal(prefs.themeHex, "#198754");
  assert.equal(normalizeAppearance({ themeHex: "bad", themeColorMode: "bad" }).themeColorMode, "palette");
  assert.equal(normalizeAppearance({ themeHex: "bad" }).themeHex, "#6750a4");
  const global = sandbox.exports.resolveAppearance(prefs, false);
  assert.notEqual(global.roles.primary, sandbox.exports.resolveAppearance({ ...prefs, themeHex: "#e85d75" }, false).roles.primary);
  for (const homeCardColor of ["solid", "custom"]) {
    const local = { ...prefs, homeCardColor, homeCardHex: "#ffffff", homeCardTone: "light" };
    assert.deepEqual(resolveHomeCardAppearance(local, false), resolveHomeCardAppearance({ ...local, themeHex: "#e85d75", themeColorSpread: false }, false));
  }
  assert.deepEqual(resolveHomeCardAppearance(prefs, false), global);
  for (const themeHex of ["#000000", "#ffffff"]) {
    const neutral = sandbox.exports.resolveAppearance({ ...prefs, themeHex }, false).roles.primary;
    assert.equal(neutral.slice(1, 3), neutral.slice(3, 5));
    assert.equal(neutral.slice(3, 5), neutral.slice(5, 7));
  }
});

test("color slider conversion preserves RGB and reaches pure black and white", () => {
  const { hexToHsl, hslToHex } = pickerSandbox.exports;
  for (const hex of ["#198754", "#6750a4", "#000000", "#ffffff", "#808080", "#ff0000"]) assert.equal(hslToHex(hexToHsl(hex)), hex);
  assert.equal(hslToHex({ h: 270, s: 75, l: 0 }), "#000000");
  assert.equal(hslToHex({ h: 270, s: 75, l: 100 }), "#ffffff");
});

test("exact card colors accept arbitrary RGB, black and white with contrasting text", () => {
  for (const homeCardHex of ["#000000", "#ffffff", "#198754", "#E4A2C8"]) {
    const settings = normalizeAppearance({ homeCardColor: "solid", homeCardHex });
    assert.equal(settings.homeCardHex, homeCardHex.toLowerCase());
    for (const dark of [false, true]) {
      const palette = resolveHomeCardAppearance(settings, dark);
      assert.equal(palette.roles.card, homeCardHex.toLowerCase());
      assert.ok(["#000000", "#ffffff"].includes(palette.roles.onSurface));
      assert.notEqual(palette.roles.card, palette.roles.onSurface);
    }
  }
  assert.equal(normalizeAppearance({ homeCardHex: "red" }).homeCardHex, "#ffffff");
});

test("custom card colors persist independently and pure colors ignore site brightness", () => {
  const saved = normalizeAppearance({ homeCardColor: "custom", homeCardHue: 999, homeCardStyle: "rainbow", homeCardTone: "dark", hue: 100 });
  assert.equal(saved.homeCardHue, 360);
  assert.equal(saved.homeCardStyle, "rainbow");
  assert.equal(saved.homeCardTone, "dark");
  assert.equal(saved.hue, 100);
  assert.equal(resolveHomeCardAppearance(saved, false).roles.card, resolveHomeCardAppearance(saved, true).roles.card);
  for (const dark of [false, true]) {
    const white = resolveHomeCardAppearance(normalizeAppearance({ homeCardColor: "white" }), dark);
    const black = resolveHomeCardAppearance(normalizeAppearance({ homeCardColor: "black" }), dark);
    assert.equal(white.roles.card, "#ffffff");
    assert.equal(black.roles.card, "#000000");
    assert.notEqual(white.roles.onSurface, black.roles.onSurface);
  }
  const invalid = normalizeAppearance({ homeCardStyle: "unknown", homeCardTone: "unknown" });
  assert.equal(invalid.homeCardStyle, "tonalSpot");
  assert.equal(invalid.homeCardTone, "theme");
});

test("independent wave layers preserve legacy settings and normalize endpoints", () => {
  assert.equal(normalizeAppearance({ waveOpacity: 60 }).waveBackOpacity, 60);
  const separate = normalizeAppearance({ waveOpacity: 0, waveBackOpacity: 100, waveLayerStyle: "uniform" });
  assert.equal(separate.waveOpacity, 0);
  assert.equal(separate.waveBackOpacity, 100);
  assert.equal(separate.waveLayerStyle, "uniform");
  const invalid = normalizeAppearance({ waveBackOpacity: 300, waveLayerStyle: "unknown" });
  assert.equal(invalid.waveBackOpacity, 100);
  assert.equal(invalid.waveLayerStyle, "layered");
});

test("home card color normalizes independently from the global hue", () => {
  assert.equal(normalizeAppearance({}).homeCardColor, "theme");
  assert.equal(normalizeAppearance({ homeCardColor: "invalid" }).homeCardColor, "theme");
  for (const homeCardColor of ["rose", "mint", "sky", "lavender", "sand", "slate"]) {
    const normalized = normalizeAppearance({ homeCardColor, hue: 100 });
    assert.equal(normalized.homeCardColor, homeCardColor);
    assert.equal(normalized.hue, 100);
  }
});

test("retired low-resolution GIF selections migrate to matching video, custom GIFs remain", () => {
  for (const name of ["swing", "cottage", "columbina", "evanescia"]) {
    const migrated = normalizeAppearance({ heroMode: "animated", heroMediaKind: "gif", heroMediaUrl: `/videos/covers/${name}-loop.gif` });
    assert.equal(migrated.heroMediaKind, "video");
    assert.equal(migrated.heroMediaUrl, `/videos/covers/${name}.mp4`);
    assert.equal(migrated.heroMode, "animated");
  }
  const custom = normalizeAppearance({ heroMediaKind: "gif", heroMediaUrl: "https://example.com/custom.gif" });
  assert.equal(custom.heroMediaKind, "gif");
  assert.equal(custom.heroMediaUrl, "https://example.com/custom.gif");
  assert.equal(normalizeAppearance({ heroMediaUrl: "constructor" }).heroMediaUrl, "");
});

test("article, navigation, and cover typography defaults and bounds normalize", () => {
  const legacy = normalizeAppearance({});
  assert.equal(legacy.articleTextScale, 100);
  assert.equal(legacy.articleTextWeight, "default");
  assert.equal(legacy.navigationTextScale, 100);
  assert.equal(legacy.navigationTextWeight, "default");
  assert.equal(legacy.coverTextWeight, "default");
  assert.equal(legacy.homeTextWeight, "default");

  const adjusted = normalizeAppearance({
    articleTextScale: 999,
    articleTextWeight: "bold",
    navigationTextScale: 75,
    navigationTextWeight: "default",
    coverTextWeight: "default",
  });
  assert.equal(adjusted.articleTextScale, 150);
  assert.equal(adjusted.articleTextWeight, "bold");
  assert.equal(adjusted.navigationTextScale, 100);
  assert.equal(adjusted.navigationTextWeight, "default");
  assert.equal(adjusted.coverTextWeight, "default");
  assert.equal(defaultAppearance.homeTextScale, 100);
});

test("exact background retains RGB across styles, palettes differ and cache cannot be mutated", () => {
 const settings = normalizeAppearance({ homeCardColor: "solid", homeCardHex: "#198754" });
 const palettes = Object.keys(sandbox.exports.colorStyles).map(homeCardStyle => resolveHomeCardAppearance({ ...settings, homeCardStyle }, false));
 for (const palette of palettes) assert.equal(palette.roles.card, "#198754");
 assert.ok(new Set(palettes.map(palette => palette.roles.primary)).size > 1);
 palettes[0].variables["--ui-primary"] = "corrupted";
 assert.notEqual(resolveHomeCardAppearance(settings, false).variables["--ui-primary"], "corrupted");
});

const defaultsSource = ts.transpileModule(await readFile(path.join(root, "lib/blog-appearance-defaults.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const defaultsModule = { exports: {}, require(specifier) { if (specifier === "./appearance") return sandbox.exports; if (specifier === "../siteConfig") return { siteConfig: { bgImages: ["/images/default.webp"] } }; throw new Error(specifier); } };
vm.runInNewContext(defaultsSource, defaultsModule);
test("site defaults clamp partial preferences and omit visitor position", () => {
  const result = defaultsModule.exports.readBlogAppearanceDefaults({ preferences: { articleTextScale: 999, homeCardHex: "#000000", live2dPosition: {x:1,y:2} }, theme: "light" });
  assert.equal(result.preferences.articleTextScale, 150);
  assert.equal(result.preferences.homeCardHex, "#000000");
  assert.equal(result.preferences.live2dPosition, null);
  assert.equal(result.preferences.heroMediaUrl, sandbox.exports.defaultAppearance.heroMediaUrl);
  assert.equal(result.theme, "light");
  assert.deepEqual(JSON.parse(JSON.stringify(result.background)), { image: "/images/default.webp", blur: 20 });
  const background = defaultsModule.exports.readBlogAppearanceDefaults({ background: {image: "javascript:invalid", blur: 99} }).background;
  assert.equal(background.image, "/images/default.webp");
  assert.equal(background.blur, 20);
});
test("site default arrival never overwrites saved or in-flight visitor choices", () => {
  const apply = defaultsModule.exports.shouldApplyBlogDefaults;
  assert.equal(apply(false, false), true);
  assert.equal(apply(true, false), false);
  assert.equal(apply(false, true), false);
  assert.equal(apply(true, true), false);
});

test("site effect defaults preserve legacy fallback and normalize each switch", () => {
  const read=defaultsModule.exports.readBlogAppearanceDefaults;
  assert.deepEqual(JSON.parse(JSON.stringify(read(null).effects)), {clickEffect:true,mouseTrail:false,sparkleEffect:false,fallingEffect:"none"});
  assert.deepEqual(JSON.parse(JSON.stringify(read({effects:{clickEffect:false,mouseTrail:true,sparkleEffect:true,fallingEffect:"constellation"}}).effects)), {clickEffect:false,mouseTrail:true,sparkleEffect:true,fallingEffect:"constellation"});
  assert.equal(read({effects:{fallingEffect:"unknown",mouseTrail:"true"}}).effects.fallingEffect,"none");
  assert.equal(read({effects:{mouseTrail:"true"}}).effects.mouseTrail,false);
});
