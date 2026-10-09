import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await readFile(new URL('../../components/photos/PhotoCard.tsx', import.meta.url), 'utf8');
const component = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
}}).outputText;

function mount({ imageProperties = {} } = {}) {
  const instances = new Map(), pendingEffects = [], timers = new Map(), observers = [];
  let active = null, clock = 0, timerId = 0, rafId = 0;
  const rafs = new Map();
  const depsEqual = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? props?.key ?? null });
  const react = {
    useState(initial) {
      const instance = active, slot = instance.hook++;
      if (!(slot in instance.hooks)) instance.hooks[slot] = typeof initial === 'function' ? initial() : initial;
      return [instance.hooks[slot], next => {
        instance.hooks[slot] = typeof next === 'function' ? next(instance.hooks[slot]) : next;
      }];
    },
    useRef(initial) {
      const instance = active, slot = instance.hook++;
      if (!(slot in instance.hooks)) instance.hooks[slot] = { current: initial };
      return instance.hooks[slot];
    },
    useEffect(create, deps) {
      const instance = active, slot = instance.hook++;
      const previous = instance.effects[slot];
      if (!previous || !depsEqual(previous.deps, deps)) pendingEffects.push({ instance, slot, create, deps });
    },
  };
  class FakeIntersectionObserver {
    constructor(callback, options) { this.callback = callback; this.options = options; this.connected = true; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.connected = false; }
  }
  const sandbox = {
    exports: {},
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) { const id = ++rafId; rafs.set(id, callback); return id; },
    cancelAnimationFrame(id) { rafs.delete(id); },
    IntersectionObserver: FakeIntersectionObserver,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/image') return { __esModule: true, default: 'img' };
      if (name === 'framer-motion') return { motion: { div: 'div' } };
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(component, sandbox);
  const PhotoCard = sandbox.exports.default;
  let tree, used;

  function visit(node, path) {
    if (node === null || node === undefined || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map((child, index) => visit(child, `${path}.${index}`));
    if (typeof node.type === 'function') {
      const name = node.type.name || 'Anonymous';
      const childPath = `${path}/${node.key ?? 'no-key'}:${name}`;
      used.add(childPath);
      let instance = instances.get(childPath);
      if (!instance) { instance = { hooks: [], effects: [], hook: 0 }; instances.set(childPath, instance); }
      const previous = active;
      active = instance;
      instance.hook = 0;
      const rendered = node.type(node.props);
      active = previous;
      return visit(rendered, childPath);
    }
    const props = { ...node.props };
    if (props.ref && typeof props.ref === 'object') {
      if (node.type === 'img') {
        const override = imageProperties[props.src] ?? {};
        props.ref.current = { complete: false, naturalWidth: 0, ...override };
      } else props.ref.current = { nodeType: node.type };
    }
    if ('children' in props) props.children = visit(props.children, `${path}/${node.key ?? 'child'}`);
    return { ...node, props };
  }

  function render(photo, onClick = () => {}) {
    used = new Set();
    tree = visit({ type: PhotoCard, props: { photo, onClick }, key: 'root' }, 'root');
    for (const [path, instance] of instances) {
      if (!used.has(path)) {
        for (const effect of instance.effects) effect?.cleanup?.();
        instances.delete(path);
      }
    }
    while (pendingEffects.length) {
      const { instance, slot, create, deps } = pendingEffects.shift();
      instance.effects[slot]?.cleanup?.();
      const cleanup = create();
      instance.effects[slot] = { deps, cleanup };
    }
    return tree;
  }
  function find(predicate, node = tree, seen = new Set()) {
    if (!node || typeof node !== 'object') return undefined;
    if (seen.has(node)) return undefined;
    seen.add(node);
    if (Array.isArray(node)) { for (const item of node) { const found = find(predicate, item, seen); if (found) return found; } return undefined; }
    if (predicate(node)) return node;
    return find(predicate, node.props?.children, seen);
  }
  function advance(ms) {
    const end = clock + ms;
    while (true) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      clock = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    clock = end;
  }
  function flushRafs() { for (const [id, callback] of rafs) { rafs.delete(id); callback(); } }
  function intersect() {
    for (const observer of observers) if (observer.connected) {
      observer.callback([{ isIntersecting: true, target: observer.target }]);
    }
  }
  return { render, find, advance, flushRafs, intersect, observers, timerCount: () => timers.size };
}

const photo = (url = '/photo-a.webp') => ({ id: url, url, caption: 'photo', orientation: 'landscape' });
const byType = type => node => node.type === type;
const loadingPlaceholder = fixture => fixture.find(node => node.props?.className?.includes('animate-pulse'));
const image = fixture => fixture.find(byType('img'));
const retryButton = fixture => fixture.find(node => node.type === 'button' && node.props?.children === '重试');

test('image errors end the gray placeholder; retry stops bubbling and remounts a fresh attempt', () => {
  const fixture = mount();
  let outerClicks = 0, stopped = false;
  fixture.render(photo(), () => outerClicks++);
  assert.ok(loadingPlaceholder(fixture));
  image(fixture).props.onError();
  fixture.render(photo(), () => outerClicks++);
  assert.equal(loadingPlaceholder(fixture), undefined);
  assert.ok(retryButton(fixture));
  retryButton(fixture).props.onClick({ stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.equal(outerClicks, 0);
  fixture.render(photo(), () => outerClicks++);
  assert.ok(loadingPlaceholder(fixture));
  image(fixture).props.onError();
  fixture.render(photo(), () => outerClicks++);
  assert.ok(retryButton(fixture));
  assert.equal(loadingPlaceholder(fixture), undefined);
  retryButton(fixture).props.onClick({ stopPropagation() {} });
  fixture.render(photo(), () => outerClicks++);
  assert.ok(loadingPlaceholder(fixture));
  image(fixture).props.onLoad();
  fixture.render(photo(), () => outerClicks++);
  assert.equal(loadingPlaceholder(fixture), undefined);
});

test('the 20 second timeout starts only after the card enters the observer margin', () => {
  const fixture = mount();
  fixture.render(photo());
  assert.equal(fixture.timerCount(), 0);
  fixture.advance(20_000);
  fixture.render(photo());
  assert.ok(loadingPlaceholder(fixture));
  fixture.intersect();
  assert.equal(fixture.timerCount(), 1);
  fixture.advance(19_999);
  fixture.render(photo());
  assert.ok(loadingPlaceholder(fixture));
  fixture.advance(1);
  fixture.render(photo());
  assert.equal(loadingPlaceholder(fixture), undefined);
  assert.ok(fixture.find(node => node.props?.role === 'status'));
});

test('a cached complete image with a natural width is promoted to loaded', () => {
  const fixture = mount({ imageProperties: { '/cached.webp': { complete: true, naturalWidth: 900 } } });
  fixture.render(photo('/cached.webp'));
  assert.ok(loadingPlaceholder(fixture));
  fixture.flushRafs();
  fixture.render(photo('/cached.webp'));
  assert.equal(loadingPlaceholder(fixture), undefined);
  assert.equal(fixture.timerCount(), 0);
});

test('changing the URL isolates image state and starts an independent loading deadline', () => {
  const fixture = mount();
  fixture.render(photo('/old.webp'));
  fixture.intersect();
  assert.equal(fixture.timerCount(), 1);
  image(fixture).props.onError();
  fixture.render(photo('/old.webp'));
  assert.equal(loadingPlaceholder(fixture), undefined);
  fixture.render(photo('/new.webp'));
  assert.equal(image(fixture).props.src, '/new.webp');
  assert.ok(loadingPlaceholder(fixture));
  assert.equal(fixture.timerCount(), 0);
  fixture.intersect();
  assert.equal(fixture.timerCount(), 1);
});
