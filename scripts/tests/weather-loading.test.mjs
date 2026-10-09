import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
}}).outputText;
const widget = compile(await readFile(new URL('../../components/widgets/toolbox/WeatherApp.tsx', import.meta.url), 'utf8'));
const helper = compile(await readFile(new URL('../../lib/bounded-request.ts', import.meta.url), 'utf8'));
const settle = () => new Promise(resolve => setImmediate(resolve));

function mount(fetcher, { blockedStorage = false, deadline = 1000 } = {}) {
  const states = [], effects = [], callbacks = [], requests = [];
  let index = 0, geolocationCalls = 0;
  const common = { Error, AbortController, URLSearchParams, queueMicrotask,
    AbortSignal: { any: signals => AbortSignal.any(signals), timeout: () => AbortSignal.timeout(deadline) },
    navigator: { geolocation: { getCurrentPosition() { geolocationCalls++; } } },
    window: {},
    localStorage: { getItem() { if (blockedStorage) throw new Error('Blocked storage'); return null; },
      setItem() { if (blockedStorage) throw new Error('Blocked storage'); } },
    fetch: (url, options) => { requests.push({ url, signal: options?.signal }); return fetcher(url, options); },
  };
  const bounded = { ...common, exports: {} };
  vm.runInNewContext(helper, bounded);
  const sandbox = { ...common, exports: {},
    require(name) {
      if (name === 'react') return { useEffect: effect => effects.push(effect), useRef: value => ({ current: value }),
        useCallback: fn => { callbacks.push(fn); return fn; },
        useState: initial => { const slot = index++; const value = typeof initial === 'function' ? initial() : initial;
          states[slot] = value; return [value, next => { states[slot] = typeof next === 'function' ? next(states[slot]) : next; }]; },
      };
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '@/lib/i18n') return { useTranslation: () => ({ tx: x => x, language: 'zh' }) };
      if (name === '@/lib/bounded-request') return bounded.exports;
      throw new Error(name);
    },
  };
  vm.runInNewContext(widget, sandbox);
  sandbox.exports.default();
  const cleanup = effects[0]();
  return { states, requests, fetchWeather: callbacks[0], cleanup, geolocationCalls: () => geolocationCalls };
}
const response = city => ({ ok: true, json: async () => ({ city, temperature: 20 }) });

test('initial weather reads without a GPS wait and still works with blocked storage', async () => {
  const fixture = mount(async () => response('北京'), { blockedStorage: true });
  await settle();
  assert.equal(fixture.geolocationCalls(), 0);
  assert.equal(fixture.requests.length, 1);
  assert.ok(fixture.requests[0].signal instanceof AbortSignal);
  assert.equal(fixture.states[2].city, '北京');
  assert.equal(fixture.states[3], false);
  assert.equal(fixture.states[4], '');
  fixture.cleanup();
});

test('an unresponsive weather service ends loading and offers a timeout state', async () => {
  const fixture = mount(() => new Promise(() => {}), { deadline: 15 });
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(fixture.states[3], false);
  assert.match(fixture.states[4], /超时/);
  fixture.cleanup();
});

test('older city results cannot replace a later city search', async () => {
  let finishFirst;
  const fixture = mount(url => new URL(url).searchParams.has('city')
    ? Promise.resolve(response('上海')) : new Promise(resolve => { finishFirst = resolve; }));
  await settle();
  await fixture.fetchWeather('上海');
  assert.equal(fixture.requests[0].signal.aborted, true);
  finishFirst(response('北京'));
  await settle();
  assert.equal(fixture.states[2].city, '上海');
  assert.equal(fixture.states[3], false);
  fixture.cleanup();
});

test('closing the widget aborts its request and late results do not update it', async () => {
  let finish;
  const fixture = mount(() => new Promise(resolve => { finish = resolve; }));
  await settle();
  fixture.cleanup();
  const oldState = fixture.states.slice();
  finish(response('北京'));
  await settle();
  assert.equal(fixture.requests[0].signal.aborted, true);
  assert.deepEqual(fixture.states, oldState);
});
