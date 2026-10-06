import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
test('large expanded album renders 24 cards per page and preserves full-gallery click index', () => {
  let page = 0;
  const sandbox = { exports: {}, require(name) {
    if (name === 'react') return {...React, useState: () => [page, value => {page=value;}]};
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'framer-motion') return {motion:{div:'div'},AnimatePresence:'div'};
    if (name === '@/lib/i18n') return {useTranslation:()=>({tx:value=>value})};
    return {__esModule:true,default:name === './PhotoCard' ? 'photo-card' : 'image'};
  }};
  vm.runInNewContext(ts.transpileModule(readFileSync('components/photos/AlbumCard.tsx','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,sandbox);
  const album = {id:1,title:'large',updatedAt:'',photoCount:10000,photos:Array.from({length:10000},(_,i)=>({id:String(i),url:'/x'}))};
  let clicked;
  const render = expanded => sandbox.exports.default({album,isExpanded:expanded,onToggle(){},onPhotoClick:(photos,index)=>{clicked=index;assert.equal(photos.length,10000);}});
  function nodes(root, type) {
    const result=[];
    function visit(node) {if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit);if(node.type===type) result.push(node);visit(node.props?.children);}
    visit(root);return result;
  }
  let tree=render(true);
  assert.equal(nodes(tree,'photo-card').length,24);
  nodes(tree,'button')[1].props.onClick();
  tree=render(true);
  nodes(tree,'photo-card')[0].props.onClick();
  assert.equal(clicked,24);
  page=416;
  assert.equal(nodes(render(true),'photo-card').length,16);
  assert.equal(nodes(render(false),'photo-card').length,0);
});
