import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await readFile(new URL('../../app/projects/[id]/ProjectDetailClient.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
}}).outputText;
const settle = () => new Promise(resolve => setImmediate(resolve));

function projectPage() {
  const hooks = [], pendingEffects = [], frames = new Map(), requests = [], scrolls = [];
  let cursor = 0, nextFrame = 1, tree, currentContent = null, scheduled = false;
  const chapters = [
    { id: 'intro', title: 'Intro', slug: 'chapter-a' },
    { id: 'second', title: 'Second', slug: 'chapter-b', parentId: 'intro' },
    { id: 'third', title: 'Third', slug: 'chapter-c' },
  ];
  const posts = chapters.map((chapter, index) => ({ ...chapter, status: 'published', description: '', id: index + 1 }));
  const project = { id: 'demo', name: 'Demo', categorySlug: 'demo', statusLabel: 'Active', updatedAt: 'today', longDescription: 'Project', outline: chapters };
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  function render() {
    cursor = 0;
    tree = resolve(sandbox.exports.default());
    const effects = pendingEffects.splice(0);
    for (const effect of effects) {
      const cleanup = effect.run();
      effect.slot.cleanup = cleanup;
    }
    scheduled = false;
  }
  function rerender() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(render);
  }
  function resolve(node) {
    if (Array.isArray(node)) return node.map(resolve);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return resolve(node.type(node.props ?? {}));
    if (node.props?.children) return { ...node, props: { ...node.props, children: resolve(node.props.children) } };
    return node;
  }
  const sandbox = {
    exports: {}, queueMicrotask, process: { env: {} },
    window: { location: { hash: '', pathname: '/projects/demo', search: '' }, history: { state: {}, replaceState() {} }, setTimeout, clearTimeout },
    document: { getElementById: id => id === 'page-content' ? { scrollIntoView: () => scrolls.push(currentContent) } : null },
    requestAnimationFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    navigator: { clipboard: { writeText: async () => {} } },
    require(name) {
      if (name === 'react') return {
        useState(initial) {
          const slot = cursor++;
          if (!hooks[slot]) hooks[slot] = { value: typeof initial === 'function' ? initial() : initial };
          return [hooks[slot].value, value => {
            hooks[slot].value = typeof value === 'function' ? value(hooks[slot].value) : value;
            rerender();
          }];
        },
        useRef(initial) {
          const slot = cursor++;
          if (!hooks[slot]) hooks[slot] = { current: initial };
          return hooks[slot];
        },
        useMemo(factory, deps) {
          const slot = cursor++;
          if (!hooks[slot] || !same(hooks[slot].deps, deps)) hooks[slot] = { value: factory(), deps };
          return hooks[slot].value;
        },
        useEffect(effect, deps) {
          const slot = cursor++;
          const prior = hooks[slot];
          if (!prior || !same(prior.deps, deps)) {
            if (prior?.cleanup) prior.cleanup();
            const next = { deps, cleanup: null };
            hooks[slot] = next;
            pendingEffects.push({ slot: next, run: effect });
          }
        },
      };
      if (name === 'react/jsx-runtime') return {
        Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }),
      };
      if (name === 'next/link') return { default: 'Link' };
      if (name === 'next/navigation') return { useParams: () => ({ id: 'demo' }) };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => key });
      if (name === '@/components/ui/ArticleContent') return { default: props => { currentContent = props.content; return { type: 'ArticleContent', props }; } };
      if (name === '@/components/providers/AppearanceProvider') return { useAppearance: () => ({ preferences: { navigationScroll: 'instant', readingLayout: 'default' }, reducedMotion: false }) };
      if (name === '@/lib/i18n') return { useTranslation: () => ({ tx: text => text }) };
      if (name === '../projectsData') return { projects: [project] };
      if (name === '@/app/api') return {
        getPosts: async () => posts,
        getPostBySlug: slug => new Promise(resolve => requests.push({ slug, resolve, completed: false })),
      };
      if (name === '@/lib/project-covers') return { projectCoverUrl: () => '', useProjectCovers: () => ({ covers: {}, error: null }) };
      if (name.startsWith('@/')) return { default: 'div' };
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(compiled, sandbox);
  render();
  return {
    get tree() { return tree; }, requests, scrolls, frames,
    flushFrames() { let guard = 0; while (frames.size && guard++ < 20) { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(); } },
    chapter(id) { return find(tree, node => node.type === 'button' && textOf(node).includes(chapters.find(ch => ch.id === id).title)); },
    nextButton() { return find(tree, node => node.type === 'button' && textOf(node).includes('下一篇')); },
    previousButton() { return find(tree, node => node.type === 'button' && textOf(node).includes('上一篇')); },
    complete(slug, content) {
      const request = [...requests].reverse().find(item => item.slug === slug && !item.completed);
      request.completed = true;
      request.resolve({ slug, status: 'published', content, id: 1 });
    },
  };
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const result = find(child, predicate);
    if (result) return result;
  }
  return null;
}
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return (Array.isArray(node) ? node : [node]).map(child => typeof child === 'object' ? textOf(child.props?.children) : textOf(child)).join('');
}

test('outline selection waits for the new chapter body before scrolling', async () => {
  const page = projectPage();
  await settle();
  page.flushFrames(); page.scrolls.length = 0;
  page.complete('chapter-a', 'A'.repeat(8000));
  await settle();
  page.chapter('second').props.onClick();
  await settle();
  assert.deepEqual(page.scrolls, [], 'loading placeholder must not trigger chapter positioning');
  page.complete('chapter-b', 'new body');
  await settle();
  page.flushFrames();
  assert.deepEqual(page.scrolls, ['new body']);
});

test('previous and next chapter controls both position after loading their target', async () => {
  const page = projectPage();
  await settle();
  page.flushFrames(); page.scrolls.length = 0;
  page.complete('chapter-a', 'A'.repeat(8000));
  await settle();
  page.nextButton().props.onClick();
  await settle();
  page.complete('chapter-b', 'second body');
  await settle();
  page.flushFrames();
  assert.deepEqual(page.scrolls, ['second body']);
  page.previousButton().props.onClick();
  await settle();
  page.complete('chapter-a', 'restored body');
  await settle();
  page.flushFrames();
  assert.deepEqual(page.scrolls, ['second body', 'restored body']);
});

test('collapsing the selected outline group does not scroll, and rapid selection loads only the final body', async () => {
  const page = projectPage();
  await settle();
  page.flushFrames(); page.scrolls.length = 0;
  page.complete('chapter-a', 'A'.repeat(8000));
  await settle();
  page.chapter('intro').props.onClick();
  await settle();
  page.flushFrames();
  assert.deepEqual(page.scrolls, [], 'same-item expand/collapse is not a chapter navigation');

  // Reopen the group and rapidly choose two leaf chapters before requests settle.
  page.chapter('intro').props.onClick();
  await settle();
  page.chapter('second').props.onClick();
  await settle();
  page.chapter('third').props.onClick();
  await settle();
  assert.deepEqual(page.requests.map(request => request.slug), ['chapter-a', 'chapter-b', 'chapter-c']);
  page.complete('chapter-c', 'final body');
  await settle();
  page.flushFrames();
  assert.deepEqual(page.scrolls, ['final body']);
  assert.equal(page.frames.size, 0, 'the completed positioning frames are cleared');
});
