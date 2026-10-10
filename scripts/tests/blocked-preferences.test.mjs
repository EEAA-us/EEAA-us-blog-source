import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
async function load(name) {
  const source = await readFile(new URL(`../../components/providers/${name}.tsx`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
  const blocked = () => { throw new Error('Storage access blocked'); };
  const themeClasses = new Set();
  const sandbox = { exports: {},
    document: { documentElement: { classList: { toggle: (key, enabled) => enabled ? themeClasses.add(key) : themeClasses.delete(key) } } },
    window: { matchMedia: () => ({ matches: false }) },
    localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked },
    require(specifier) {
      if (specifier === 'react') return { ...require('react'), useRef: value => ({ current: value }),
        useState: value => [typeof value === 'function' ? value() : value, () => {}],
        useEffect() {}, useSyncExternalStore: (_, snapshot) => snapshot(),
      };
      if (specifier === 'react/jsx-runtime') return require(specifier);
      if (specifier === '@/siteConfig') return { siteConfig: { bgImages: ['/default.webp'] } };
      if (specifier === '@/lib/appearance') return { validHeroMediaUrl: () => true };
      if (specifier === '@/app/api/site-config') return { getSiteConfig: async () => ({}) };
      if (specifier === '@/lib/blog-appearance-defaults') return { readBlogAppearanceDefaults: () => ({ background: { image: '/default.webp', blur: 20 } }), shouldApplyBlogDefaults: () => true };
      throw new Error(specifier);
    },
  };
  vm.runInNewContext(compiled, sandbox);
  return { ...sandbox.exports, themeClasses };
}
test('blocked browser storage does not prevent theme rendering or session theme changes', async () => {
  const { ThemeProvider, themeClasses } = await load('ThemeProvider');
  const rendered = ThemeProvider({ children: 'article' });
  assert.equal(rendered.props.children, 'article');
  assert.equal(rendered.props.value.theme, 'light');
  assert.doesNotThrow(() => rendered.props.value.setTheme('dark'));
  assert.equal(themeClasses.has('dark'), true, 'the clicked theme applies in the same task even with blocked storage');
  rendered.props.value.setTheme('light');
  assert.equal(themeClasses.has('dark'), false);
});
test('blocked browser storage does not crash background and article rendering after hydration', async () => {
  const { BackgroundProvider } = await load('BackgroundProvider');
  const hydrated = BackgroundProvider({ children: 'article' });
  const rendered = hydrated.type(hydrated.props);
  assert.equal(rendered.props.children, 'article');
  assert.equal(rendered.props.value.bgImage, '/default.webp');
  assert.equal(rendered.props.value.bgBlur, 20);
});
