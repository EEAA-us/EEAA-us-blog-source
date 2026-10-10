import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const videoCode = await compile('../../components/ui/CoverVideo.tsx');
const coverCode = await compile('../../components/ui/CoverMedia.tsx');
const welcomeCode = await compile('../../components/layout/WelcomeScreen.tsx');
const settle = () => new Promise(resolve => setImmediate(resolve));
const find = (tree, type) => {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === type) return tree;
  for (const child of [tree.props?.children].flat()) { const found = find(child, type); if (found) return found; }
  return null;
};

function fixture(code, component, initialProps = {}) {
  const hooks = [], effects = [], listeners = new Map(), videoListeners = new Map();
  const prefs = { heroMode: 'animated', heroMediaKind: 'video', heroMediaUrl: '/hero.mp4', heroSlides: [], heroCustomMedia: [], heroInterval: 4, welcomeEnabled: true, language: 'zh' };
  const appearance = { preferences: prefs, reducedMotion: false, welcomeActive: true, setWelcomeActive() {}, mediaCatalog: { items: [{ kind: 'video', url: '/hero.mp4', poster: '/poster.webp' }] } };
  let cursor = 0, tree, props = initialProps, scheduled = false, intersection;
  const video = { plays: 0, pauses: 0, play() { this.plays++; return Promise.resolve(); }, pause() { this.pauses++; }, addEventListener: (key, fn) => videoListeners.set(key, fn), removeEventListener: key => videoListeners.delete(key) };
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = cursor++; hooks[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [hooks[i].value, next => { const value = typeof next === 'function' ? next(hooks[i].value) : next; if (Object.is(value, hooks[i].value)) return; hooks[i].value = value; if (!scheduled) { scheduled = true; queueMicrotask(render); } }]; },
    useRef(initial) { const i = cursor++; hooks[i] ??= { current: initial }; return hooks[i]; },
    useEffect(run, deps) { const i = cursor++, prior = hooks[i]; if (!prior || !same(prior.deps, deps)) { prior?.cleanup?.(); const slot = hooks[i] = { deps }; effects.push(() => { slot.cleanup = run(); }); } },
    useMemo(run, deps) { const i = cursor++; if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = { value: run(), deps }; return hooks[i].value; },
    useSyncExternalStore: (_, snapshot) => snapshot(),
  };
  const jsx = (type, props) => ({ type, props });
  const sandbox = { exports: {}, URL, Date, Intl, queueMicrotask, setTimeout: () => 1, clearTimeout() {},
    sessionStorage: { setItem() {} },
    document: { hidden: false, readyState: 'loading', addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) },
    window: { matchMedia: () => ({ matches: true }), setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}, Image: class { set src(value) { this.value = value; } } },
    IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} disconnect() {} },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name.endsWith('AppearanceProvider')) return { useAppearance: () => appearance };
      if (name.endsWith('useDocumentVisible')) return { useDocumentVisible: () => !sandbox.document.hidden };
      if (name.endsWith('CoverVideo')) return { default: 'CoverVideo' };
      if (name.endsWith('siteConfig')) return { siteConfig: { heroImage: '/fallback.webp', heroVideoVariants: {} } };
      if (name.endsWith('cover-video-source')) return { coverVideoSource: url => url };
      if (name === 'framer-motion') return { AnimatePresence: 'AnimatePresence', motion: new Proxy({}, { get: (_, key) => `motion.${key}` }) };
      throw new Error(`Unexpected dependency ${name}`);
    },
  };
  vm.runInNewContext(code + '\nexports.Playback = typeof AnimatedVideo === "function" ? AnimatedVideo : null;', sandbox);
  function render() {
    scheduled = false; cursor = 0;
    tree = sandbox.exports[component](props);
    const element = find(tree, 'video'); if (element?.props.ref) element.props.ref.current = video;
    const root = find(tree, 'div'); if (root?.props.ref) root.props.ref.current = {};
    for (const effect of effects.splice(0)) effect();
  }
  render();
  return { appearance, video, sandbox, listeners, videoListeners, get tree() { return tree; }, render,
    update(next) { props = { ...props, ...next }; render(); }, intersect(value) { intersection([{ isIntersecting: value }]); } };
}

test('selected cover attaches and requests playback before load/canplay, and keeps its source on pause', async () => {
  const f = fixture(videoCode, 'Playback', { src: '/hero.mp4', poster: '/poster.webp', playing: true, onFailure() {} });
  assert.equal(find(f.tree, 'video').props.src, '/hero.mp4');
  assert.equal(f.video.plays, 1, 'buffering must already have a play request');
  assert.equal(f.listeners.has('load'), false);
  assert.equal(find(f.tree, 'video').props.style.opacity, 0, 'poster stays until playback starts');
  find(f.tree, 'video').props.onPlaying(); await settle();
  assert.equal(find(f.tree, 'video').props.style.opacity, 1);
  f.update({ playing: false }); await settle();
  assert.ok(f.video.pauses > 0);
  assert.equal(find(f.tree, 'video').props.src, '/hero.mp4');
  assert.equal(find(f.tree, 'video').props.preload, 'none');
  f.update({ playing: true });
  assert.ok(f.video.plays > 1, 'resume also works when canplay has already fired');
  find(f.tree, 'video').props.onError(); await settle();
  assert.equal(find(f.tree, 'video').props.style.opacity, 0);
  assert.ok(find(f.tree, 'img'), 'failed media retains its poster');
});

test('welcome starts the cover immediately; offscreen, hidden and reduced-motion states pause it', async () => {
  const f = fixture(coverCode, 'default', { image: '/fallback.webp' });
  assert.equal(find(f.tree, 'CoverVideo').props.playing, true, 'welcome does not defer the cover');
  f.sandbox.document.hidden = true; f.render();
  assert.equal(find(f.tree, 'CoverVideo').props.playing, false);
  f.sandbox.document.hidden = false; f.appearance.reducedMotion = true; f.render();
  assert.equal(find(f.tree, 'CoverVideo').props.playing, false);
  f.appearance.reducedMotion = false; f.appearance.welcomeActive = false; f.render();
  assert.equal(find(f.tree, 'CoverVideo').props.playing, false, 'offscreen cover pauses after welcome');
  f.intersect(true); await settle();
  assert.equal(find(f.tree, 'CoverVideo').props.playing, true, 'no 800 ms post-intro hold');
});

test('built-in welcome media plays; reduced motion and hidden documents keep a static background', () => {
  const f = fixture(welcomeCode, 'default');
  assert.equal(find(f.tree, 'CoverVideo').props.playing, true);
  assert.equal(find(f.tree, 'CoverVideo').props.src, '/hero.mp4');
  f.appearance.reducedMotion = true; f.render();
  assert.equal(find(f.tree, 'CoverVideo'), null);
  f.appearance.reducedMotion = false; f.sandbox.document.hidden = true; f.render();
  assert.equal(find(f.tree, 'CoverVideo'), null);
});
