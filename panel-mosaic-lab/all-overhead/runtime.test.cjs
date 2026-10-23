'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'stage.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const nodes=new Map();
function node(id){
 if(!nodes.has(id)){
  const classes=new Set(id==='gallery'||id==='atlasView'?['hidden']:[]);
  if(id==='modeMosaic')classes.add('active');
  nodes.set(id,{id,children:[],style:{},classList:{
   toggle:(name,force)=>{const next=force===undefined?!classes.has(name):!!force;if(next)classes.add(name);else classes.delete(name);return next;},
   contains:name=>classes.has(name)
  },addEventListener(){},scrollTo(){},offsetHeight:1500,clientWidth:1300,
  setAttribute(){},textContent:''});
 }
 return nodes.get(id);
}
const document={
 getElementById:node,
 querySelectorAll:()=>[],
 addEventListener(){},
 createElement:()=>({classList:{toggle(){}},append(){},addEventListener(){},dataset:{},style:{}}),
 createElementNS:()=>({setAttribute(){},addEventListener(){},dataset:{}})
};
const window={addEventListener(){}};
const ctx=vm.createContext({document,window,console,location:{reload(){}},setTimeout,clearTimeout,Intl,Set,Math,Array,Date,Promise});
const withoutStart=source.replace(/\nstart\(\);\s*$/,'\n');
assert.notEqual(withoutStart,source,'remove auto-start solely for isolated tab unit test');
vm.runInContext(withoutStart,ctx,{filename:'stage.js'});
assert.match(html,/stage\\.js\\?v=UPD-[A-Za-z0-9-]+/,'versioned browser JS loads current mosaic files, not stale cache');
assert.ok(html.includes('id="viewModeStatus"'),'visible mode indicator');
assert.doesNotThrow(()=>node('modeGallery').onclick(),'clicking before metadata should not crash');
vm.runInContext("spec={images:Array.from({length:16},()=>({id:'image'})),columns:[]};geometry={parts:[]};fitMode=false;highlight=()=>{};updateDimensions=()=>{};populateGallery=()=>document.getElementById('gallery').children.push({});",ctx);
node('columns').children.push({}); // assembly was populated during the real page's start() before tabs were clicked
node('modeGallery').onclick();
assert.equal(node('assembly').classList.contains('hidden'),true,'gallery hides mosaic');
assert.equal(node('gallery').classList.contains('hidden'),false,'gallery visible');
assert.equal(node('modeGallery').classList.contains('active'),true,'gallery active');
node('modeMosaic').onclick();
assert.equal(node('assembly').classList.contains('hidden'),false,'clicking mosaic restores montage');
assert.equal(node('gallery').classList.contains('hidden'),true,'mosaic hides gallery');
assert.equal(node('modeMosaic').classList.contains('active'),true,'mosaic active');
node('assembly').classList.toggle('hidden',true);
node('modeMosaic').onclick();
assert.equal(node('assembly').classList.contains('hidden'),false,'clicking active mosaic reasserts visible montage');
node('modeAtlas').onclick();
assert.equal(node('atlasView').classList.contains('hidden'),false,'atlas visible');
assert.equal(node('assembly').classList.contains('hidden'),true,'atlas hides mosaic');
node('modeMosaic').onclick();
assert.equal(node('assembly').classList.contains('hidden'),false,'return from atlas restores montage');
assert.match(node('viewModeStatus').textContent,/چیدمان یکپارچه/);
console.log('PASS: mosaic↔gallery↔atlas controls, re-click active mosaic, pre-load click, active mode status, browser cache-bust.');
