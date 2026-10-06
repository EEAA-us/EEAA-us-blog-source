import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");

test("advanced config failure preserves rows, retry clears error and saving serializes double clicks", async () => {
  const save = deferred();
  const started = deferred();
  let calls = 0;
  let fail = true;
  const page = await component("backend/admin/src/views/site-config/index.vue", {
    "./components/MediaCatalogManager.vue": {},
    "@/api/siteConfig": {
      getAllSiteConfig: async () => { if (fail) throw new Error('offline'); return [{key:'one'}]; },
      createSiteConfig: async () => { calls++; started.resolve(); await save.promise; }
    }
  }, ['onSearch', 'loadError', 'dataList', 'formRef', 'form', 'saving', 'handleSubmit']);
  page.dataList.value = [{key:'old'}];
  await page.onSearch();
  assert.equal(page.loadError.value, true);
  assert.equal(page.dataList.value[0].key, 'old');
  fail = false;
  await page.onSearch();
  assert.equal(page.loadError.value, false);
  page.formRef.value = { validate: async () => {} };
  page.form.value = {key:'test',value:'value',description:''};
  const first = page.handleSubmit();
  const second = page.handleSubmit();
  await started.promise;
  assert.equal(calls, 1);
  assert.equal(page.saving.value, true);
  save.resolve();
  await Promise.all([first, second]);
  assert.equal(page.saving.value, false);
});
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function component(path, imports, names, globals = {}) {
  const source = (await readFile(path, "utf8")).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const mounted = [];
  const sandbox = {
    ...globals,
    exports: {}, defineOptions() {},
    require(name) {
      if (name === "vue") return { ref: value => ({ value }), computed: read => ({ get value() { return read(); } }), onMounted: fn => mounted.push(fn) };
      if (name === "@/utils/message") return { message() {} };
      if (name === "@/components/ReIcon/src/hooks") return { useRenderIcon() {} };
      if (name === "@/lib/blog-media") return { blogPhotoAlbums: [], curatedBlogBookmarks: [], getBlogMediaUrl: url => url };
      if (name === "@/lib/use-local-pagination") return { useLocalPagination: () => ({ resetPage() {} }) };
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    }
  };
  vm.runInNewContext(ts.transpileModule(`${source}\nObject.assign(exports, {${names.join(",")}});`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  return { ...sandbox.exports, mounted };
}

test("a slow photo upload stays attached to the album selected at upload start", async () => {
  const upload = deferred();
  const created = [];
  const page = await component("backend/admin/src/views/album/index.vue", { "@/api/album": {
    uploadImage: () => upload.promise, createPhoto: async data => created.push(data), getAlbums: async () => []
  } }, ["handleUpload", "currentAlbum", "drawerVisible"]);
  page.currentAlbum.value = { id: 1 };
  const pending = page.handleUpload({ type: "image/gif", name: "animation.gif" });
  page.currentAlbum.value = { id: 2 };
  upload.resolve({ url: "/uploads/test.gif", orientation: "landscape" });
  await pending;
  assert.equal(created[0].album_id, 1);
});

test("late album and bookmark responses cannot overwrite a newer selection", async () => {
  for (const [path, api, loader, current, list] of [
    ["album", "getAlbumPhotos", "loadPhotos", "currentAlbum", "photos"],
    ["bookmark", "getBookmarkSites", "loadSites", "currentCategory", "sites"]
  ]) {
    const first = deferred();
    const second = deferred();
    const page = await component(`backend/admin/src/views/${path}/index.vue`, { [`@/api/${path}`]: { [api]: id => id === 1 ? first.promise : second.promise }, "@/api/album": path === "album" ? { [api]: id => id === 1 ? first.promise : second.promise } : {} }, [loader, current, list]);
    page[current].value = { id: 1 };
    const old = page[loader](1);
    page[current].value = { id: 2 };
    const newer = page[loader](2);
    second.resolve([{ id: 2 }]);
    await newer;
    first.resolve([{ id: 1 }]);
    await old;
    assert.equal(page[list].value[0].id, 2);
  }
});

test("project save keeps selections made while the previous snapshot is saving", async () => {
  const save = deferred();
  const page = await component("backend/admin/src/views/project/BlogProjects.vue", {
    "../../../../../app/projects/projectsData": { projects: [] }, "@/api/album": {},
    "@/api/siteConfig": { saveProjectCovers: () => save.promise }
  }, ["loading", "selectCover", "saveDraft", "covers", "dirty"]);
  page.loading.value = false;
  page.selectCover("project", "/old.png");
  const pending = page.saveDraft();
  page.selectCover("project", "/new.png");
  save.resolve({ covers: { project: "/old.png" } });
  await pending;
  assert.equal(page.covers.value.project, "/new.png");
  assert.equal(page.dirty.value, true);
});

test("failed category loading prevents an article save from clearing its category", async () => {
  let writes = 0;
  const page = await component("backend/admin/src/views/post/edit.vue", {
    "vue-router": { useRouter: () => ({ push() {} }), useRoute: () => ({ params: { id: "1" } }) },
    "@/api/post": { getPostById: async () => ({ title: "existing", slug: "existing", category: "learning" }), updatePost: async () => { writes++; } },
    "@/api/category": { getCategories: async () => { throw new Error("offline"); } },
    "@/api/tag": { getTags: async () => [] }, "@/api/album": {},
    "@/views/markdown/components/Vditor.vue": {}
  }, ["handleSave", "loadError"]);
  await page.mounted[0]();
  await page.handleSave();
  assert.ok(page.loadError.value);
  assert.equal(writes, 0);
});

test("expired admin requests reject immediately instead of waiting for unsupported refresh", async () => {
  let interceptor;
  let responseFailure;
  let logouts = 0;
  let token = { expires: Date.now() - 1, accessToken: "test" };
  const axios = { isCancel: () => false, create: () => ({ interceptors: { request: { use(fn) { interceptor = fn; } }, response: { use(success, failure) { responseFailure = failure; } } } }) };
  const sandbox = { exports: {}, require(name) {
    if (name === "axios") return { __esModule: true, default: axios };
    if (name === "qs") return { stringify() {} };
    if (name === "@/utils/message") return { message() {} };
    if (name === "@/plugins/i18n") return { $t: s => s, transformI18n: s => s };
    if (name === "@/utils/auth") return { getToken: () => token, formatToken: value => `Bearer ${value}` };
    if (name === "@/store/modules/user") return { useUserStoreHook: () => ({ logOut() { logouts++; } }) };
    throw new Error(`Unexpected import: ${name}`);
  } };
  vm.runInNewContext(ts.transpileModule(await readFile("backend/admin/src/utils/http/index.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  await assert.rejects(interceptor({ url: "/api/albums", headers: {} }), /登录已过期/);
  assert.equal(logouts, 1);
  token = { expires: Date.now() + 60000, accessToken: "test" };
  assert.equal((await interceptor({ url: "/api/albums", headers: {} })).headers.Authorization, "Bearer test");
  assert.equal((await interceptor({ url: "/api/auth/login", headers: {} })).headers.Authorization, undefined);
  const failure = new Error("generic");
  failure.response = { status: 409, data: { detail: "分类名称已存在" } };
  await assert.rejects(responseFailure(failure), /分类名称已存在/);
  failure.response.status = 401;
  await assert.rejects(responseFailure(failure));
  assert.equal(logouts, 2);
});

test("bookmark icon compression retains PNG transparency, WebP format, and GIF animation", async () => {
  const encoded = [];
  class Reader { readAsDataURL() { this.result = "data:test"; this.onload(); } }
  class Picture { width = 100; height = 200; set src(value) { this.onload(); } }
  class TestFile { constructor(parts, name, options) { this.name = name; this.type = options.type; } }
  const page = await component("backend/admin/src/views/bookmark/index.vue", { "@/api/bookmark": {}, "@/api/album": {} }, ["compressImage"], {
    FileReader: Reader, Image: Picture, File: TestFile,
    document: { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob(callback, type) { encoded.push(type); callback({}); } }) }
  });
  for (const type of ["image/png", "image/webp"]) {
    assert.equal((await page.compressImage({ name: "icon.png", type })).type, type);
  }
  const gif = { name: "animation.gif", type: "image/gif" };
  assert.equal(await page.compressImage(gif), gif);
  assert.deepEqual(encoded, ["image/png", "image/webp"]);
});

test("a delayed icon upload cannot write into another newly opened form", async () => {
  const upload = deferred();
  const page = await component("backend/admin/src/views/bookmark/index.vue", { "@/api/bookmark": {}, "@/api/album": { uploadImage: () => upload.promise } }, ["handleCatIconUpload", "form"]);
  page.form.value = { id: 1, icon: "old" };
  const pending = page.handleCatIconUpload({ name: "icon.svg", type: "image/svg+xml" });
  page.form.value = { id: 2, icon: "new" };
  upload.resolve({ url: "/uploaded.svg" });
  await pending;
  assert.equal(page.form.value.icon, "new");
});

async function saveFunction(path, state) {
  const source = (await readFile(path, "utf8")).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const declaration = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "save");
  assert.ok(declaration, "production save function exists");
  const sandbox = { exports: {}, message() {}, ...state };
  vm.runInNewContext(ts.transpileModule(`${declaration.getText(file)}\nexports.save=save;`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  return sandbox.exports.save;
}

test("default appearance edits made during saving remain in the draft", async () => {
  const request = deferred();
  const draft = { value: { preferences: { color: "old" } } };
  const save = await saveFunction("backend/admin/src/views/site-config/components/BlogDefaults.vue", {
    draft, saving: { value: false }, loading: { value: false }, preferencesTooLarge: { value: false },
    normalizeAppearance: value => value, readBlogAppearanceDefaults: value => value,
    http: { request: () => request.promise }
  });
  const pending = save();
  draft.value.preferences.color = "new";
  request.resolve({ preferences: { color: "old" } });
  await pending;
  assert.equal(draft.value.preferences.color, "new");
});

test("media visibility changes made during saving remain in the draft", async () => {
  const request = deferred();
  const categories = { value: [{ id: "test", order: 0 }] };
  const items = { value: [{ id: "test", order: 0, enabled: true }] };
  const save = await saveFunction("backend/admin/src/views/site-config/components/MediaCatalogManager.vue", {
    categories, items, saving: { value: false }, loaded: { value: true },
    saveMediaCatalog: () => request.promise
  });
  const pending = save();
  items.value[0].enabled = false;
  request.resolve({ categories: categories.value, items: [{ id: "test", order: 0, enabled: true }] });
  await pending;
  assert.equal(items.value[0].enabled, false);
});
