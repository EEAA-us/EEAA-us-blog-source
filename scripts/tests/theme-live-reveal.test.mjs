import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const preferences = { exports: {} };
vm.runInNewContext(ts.transpileModule(await readFile(new URL('../../lib/theme-transition-preferences.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, preferences);
const module = { exports: {}, require: () => preferences.exports };
vm.runInNewContext(ts.transpileModule(await readFile(new URL('../../lib/theme-live-reveal.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, module);
const { prepareLiveThemeReveal } = module.exports;
function fixture(visible = true) {
  let dark = false;
  const nodes = [], animations = [];
  const box = { left: 0, top: 0, right: 256, bottom: visible ? 128 : -10, width: 256, height: 128 };
  const style = () => { const values = new Map(); return { setProperty: (k,v,p='') => values.set(k,{v,p}), getPropertyValue: k => values.get(k)?.v ?? '', getPropertyPriority: k => values.get(k)?.p ?? '', removeProperty: k => values.delete(k) }; };
  const surface = { className: 'page-cover-shade', style: style(), getBoundingClientRect: () => box, before: node => nodes.push(node) };
  const document = {
    querySelectorAll: selector => selector === '[data-theme-live-media]' ? [{ getBoundingClientRect: () => box }] : [surface],
    defaultView: { getComputedStyle: () => ({ getPropertyValue: key => key === 'background-image' ? (dark ? 'linear-gradient(black, transparent)' : 'linear-gradient(white, transparent)') : key === 'opacity' ? '1' : '' }) },
    createElement: tag => { assert.equal(tag, 'div', 'never create an extra image or video'); return {
      style: style(), setAttribute() {}, remove() { this.removed = true; },
      animate(frames, options) { const animation = { frames, options, finished: new Promise(() => {}), cancel() { this.cancelled = true; } }; animations.push(animation); return animation; },
    }; },
  };
  return { document, surface, nodes, animations, setDark: () => { dark = true; } };
}
test('live cover reveals use only old/new decorative surfaces and cleanup restores visibility', () => {
  const f = fixture(); f.surface.style.setProperty('visibility', 'visible', 'important');
  const reveal = prepareLiveThemeReveal(f.document, 256, 128);
  assert.equal(f.nodes.length, 1);
  assert.match(f.nodes[0].style.getPropertyValue('background-image'), /white/);
  f.setDark(); reveal.play(750, 'top');
  assert.equal(f.nodes.length, 2);
  assert.match(f.nodes[1].style.getPropertyValue('background-image'), /black/);
  assert.equal(f.surface.style.getPropertyValue('visibility'), 'hidden');
  assert.equal(f.animations.length, 2);
  assert.ok(f.animations.every(a => a.options.duration === 750));
  reveal.stop();
  assert.ok(f.nodes.every(n => n.removed));
  assert.ok(f.animations.every(a => a.cancelled));
  assert.equal(f.surface.style.getPropertyValue('visibility'), 'visible');
  assert.equal(f.surface.style.getPropertyPriority('visibility'), 'important');
});
test('offscreen media creates no surface copies', () => {
  const f = fixture(false);
  assert.equal(prepareLiveThemeReveal(f.document, 256, 128), null);
  assert.equal(f.nodes.length, 0);
});
test('top-to-bottom midpoint is dark at the top and old/light at the bottom, rather than a uniform fade', async () => {
  const f = fixture(); const reveal = prepareLiveThemeReveal(f.document, 256, 128);
  f.setDark(); reveal.play(750, 'top');
  const [a,b] = f.animations[1].frames.map(k => k.maskPosition.split(' ').map(parseFloat));
  const y = (a[1]+b[1])/2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="128"><defs><linearGradient id="front" x1="0" y1="${y}" x2="0" y2="${y+384}" gradientUnits="userSpaceOnUse"><stop offset="45%" stop-color="white"/><stop offset="55%" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="256" height="128" fill="url(#front)"/></svg>`;
  const {data,info} = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha = y => data[(y*256+128)*info.channels+3];
  assert.equal(alpha(16), 255);
  assert.equal(alpha(112), 0);
  assert.ok(alpha(64)>0 && alpha(64)<255, 'the front must have a soft gradient');
  reveal.stop();
});
test('all directions share viewport coordinates even when a decorative surface starts lower', () => {
  for (const [direction,setting] of Object.entries(preferences.exports.themeTransitionDirections)) {
    const f = fixture(); f.surface.getBoundingClientRect = () => ({left:20,top:40,right:236,bottom:128,width:216,height:88});
    const reveal = prepareLiveThemeReveal(f.document,256,128); reveal.play(750,direction);
    const [x,y] = setting.from.split(' ').map(parseFloat);
    assert.equal(f.animations[0].frames[0].maskPosition, `${-512*x/100-20}px ${-256*y/100-40}px`);
    assert.equal(f.nodes[1].style.maskSize,'768px 384px');
    reveal.stop();
  }
});
