'use strict';
/* Photo-based Classic CDU hierarchy test: no browser dependency; synthetic
 * font advances, real page definitions, actual Unity screen-fit script.
 * Guard approved fonts / 24A scratch width / FCOM canonical DEP ARR.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'cdu-screen-fit-v6.js'),'utf8');
const pages=JSON.parse(fs.readFileSync(path.join(__dirname,'../../cdu-standalone-v6/data/page-definitions.json'),'utf8')).pages;
const metrics=require('../../engine/ch11/cdu-24-column-metrics-v1');
const copy=()=>JSON.stringify(pages);

class FakeElement {
 constructor(classes='',text='',width=220){
  this.classes=new Set(classes.split(' ').filter(Boolean));
  this.classList={contains:name=>this.classes.has(name),add:name=>this.classes.add(name)};
  this.textContent=String(text||'');this.children=[];this.width=width;
  const properties={};
  this.style={properties,setProperty:(name,val)=>{properties[name]=String(val)},
   removeProperty:name=>{delete properties[name]}};
 }
 add(...children){this.children.push(...children);return this}
 querySelector(selector){
  const classes=[...selector.matchAll(/\.([\w-]+)/g)].map(x=>x[1]);
  return this.children.find(n=>classes.every(c=>n.classList.contains(c)))||null;
 }
 querySelectorAll(selector){
  if(selector==='span')return this.children;
  return this.children.filter(x=>selector.includes('span'));
 }
 getBoundingClientRect(){return {width:this.width,bottom:400}}
}
function pair(label,lt,rt){
 const line=new FakeElement('fmc-line fmc-pairline'+(label?' fmc-small':''),'',460);
 return line.add(new FakeElement('fmc-left',lt,215),new FakeElement('fmc-right',rt,215));
}
function checkPage(id){
 const definitions=pages[id],previous=copy();
 assert.ok(definitions,'Missing real page '+id);
 const lines=[new FakeElement('fmc-line fmc-header','',460).add(
  new FakeElement('fmc-header-title',definitions.title,360),
  new FakeElement('fmc-header-count','1/1',100))];
 const originals=[];
 for(const row of definitions.rows){
  const l=row?.[0]||{},r=row?.[1]||{};
  const labels=pair(true,l.label,r.label);
  const values=pair(false,l.field?'-----':l.value||'',r.field?'-----':r.value||'');
  originals.push({l,r,labels,values});lines.push(labels,values);
 }
 const scratch=pair(false,'A'.repeat(24),'');
 scratch.classList.add('scratch');
 scratch.querySelector('.fmc-left').classList.add('full');
 scratch.querySelector('.fmc-left').width=480;
 lines.push(scratch);
 const box={style:new FakeElement().style,querySelector(sel){
  if(sel==='.fmc-line.scratch')return scratch;
  if(sel==='.fmc-line.fmc-small .fmc-left')return originals[0].labels.querySelector('.fmc-left');
  return null;
 },querySelectorAll:sel=>sel==='.fmc-line'?lines:[]};
 const screen={getBoundingClientRect:()=>({bottom:1000})};
 const ctx={font:'',measureText(text){
  const px=Number(/([\d.]+)px/.exec(this.font)?.[1]||0);
  return {width:px*.53*String(text).length};
 }};
 const document={documentElement:{dataset:{}},fonts:{check:()=>true},
  createElement:name=>name==='canvas'?{getContext:()=>ctx}:new FakeElement(),
  getElementById:name=>name==='fmc-lines'?box:name==='fmc-screen'?screen:
   name==='page-now'?{textContent:id}:null};
 const root={document,location:{search:'?seat=FO'},CDU_PAGES:pages,
  B737CDU24ColumnMetricsV1:metrics,
  getComputedStyle:element=>({fontFamily:element.classList?.contains('fmc-small')?
   '"BoeingCDUSmall"':'"BoeingCDULarge"',top:'0px'}),
  addEventListener(){},requestAnimationFrame:fn=>fn()};
 class Observer {observe(){}}
 new Function('window','MutationObserver','URLSearchParams',src)(root,Observer,URLSearchParams);
 const result=root.B737CduScreenFitV6.getState();
 assert.equal(result.ready,true,id+' calibrated');
 assert.equal(result.columns,24);
 assert.equal(result.large.valid,true);
 assert.equal(result.large.width24Px<=result.large.availablePx+0.01,true);
 assert.equal(result.large.width25Px>result.large.availablePx,true);
 assert.equal(result.photoProfile,'OWNER-CLASSIC-CDU-LEGS-PHOTO-20261031');
 assert.equal(result.scratchLength,24);
 assert.ok(result.labelPx>=result.fontSizePx*.60&&result.labelPx<=result.fontSizePx*.73,'reference baseline for labels preserved');
 assert.equal(result.pageLabelMultiplier,1,'small labels retain photo-derived 70% cap height');
 assert.equal(result.pageValueMultiplier,1,'LSK data is the calibrated full-size font');
 assert.equal(result.entryPromptMultiplier,1,'field blanks share data size');
 assert.equal(result.navigationPromptMultiplier,1,'navigation actions share data size');
 assert.equal(result.pageValuePx,result.fontSizePx,'data and scratchpad are the same size');
 assert.ok(Math.abs(result.headerPx/result.fontSizePx-.94)<.001);
 assert.ok(Math.abs(result.promptPx/result.fontSizePx-1)<.001);
 for(const entry of originals){
  for(const [side,cell] of [['fmc-left',entry.l],['fmc-right',entry.r]]){
   if(!cell.action||cell.field||cell.value||!cell.label)continue;
   const label=entry.labels.querySelector('.'+side);
   const data=entry.values.querySelector('.'+side);
   assert.equal(label.textContent,'',id+' prompt must not occupy small line');
   assert.equal(data.textContent,cell.label,id+' prompt moved to LSK data line');
   assert.ok(data.classList.contains('cdu-lsk-prompt'));
  }
 }
 if(id==='IDENT'){
  assert.ok(result.identReference,'Owner IDENT has its own stable 12-column fit');
  for(const entry of originals)for(const span of entry.values.children){
   assert.equal(parseFloat(span.style.properties['font-size']),
    Number(result.identReference.largePx.toFixed(2)));
   assert.equal(span.style.properties.transform,'none','IDENT date glyphs must not be compressed');
  }
 }
 assert.equal(copy(),previous,'FCOM source cells unchanged');
 assert.equal(document.documentElement.dataset.cduScreenFit,'CDU-24COL-0006');
 return result;
}
for(const name of ['INDEX','IDENT','POS_INIT','RTE','PERF_INIT','TAKEOFF','LEGS']){
 checkPage(name);
}
assert.match(src,/if\(!standard\)return 0;/,'nonstandard/FCOM DEP ARR must be guarded');
assert.match(src,/const TOP=\{header:\.5/,'approved LSK vertical coordinates retained');
assert.match(src,/PHOTO_PROFILE\.lskPromptToLarge/);
const embedded=fs.readFileSync(path.join(__dirname,'cdu-stage.html'),'utf8');
assert.match(embedded,/cdu-screen-fit-v6\.js\?v=CDU-24COL-0006-R11-ENTRY110-ACTION105-L6SAFE/);
assert.doesNotMatch(src,/@font-face|BoeingCDU-Large\.ttf|\.bbox_px\s*=/);
console.log('PASS: INDEX IDENT POS INIT RTE PERF INIT TAKEOFF LEGS: small titles, large LSK prompts, exact 24A scratchpad, untouched FCOM cells');

/* Owner photo: selectable text must meet its own LSK, not sit in the centre.
   This is a horizontal-only correction; preserve the 24-A calibration width. */
{
 const css=fs.readFileSync(path.join(__dirname,'../../cdu-standalone-v6/style.css'),'utf8');
 const lsk=css.split('/* OWNER 2026-10-31 LSK horizontal registration')[1];
 assert.ok(lsk,'Both Standalone and Unified must load common LSK-edge alignment');
 assert.match(lsk,/#fmc-screen #fmc-lines \.fmc-line\.fmc-pairline:not\(\.scratch\)\s*\{[^}]*left:2\.7%!important;[^}]*right:2\.7%!important;[^}]*width:94\.6%!important;/s,'LSK text must anchor to both CRT edges');
 assert.match(lsk,/#fmc-screen #fmc-lines \.fmc-line\.scratch\s*\{[^}]*left:2\.7%!important;[^}]*width:77%!important;/s,'24A scratchpad measured width must not change');
 for(const html of ['../../cdu-standalone-v6/index.html','cdu-stage.html']){
  const page=fs.readFileSync(path.join(__dirname,html),'utf8');
  assert.match(page,/style\.css\?v=CDU-OWNER-PHOTO-20261031-LSK-EDGE-01/,'Both embedded and standalone must invalidate cached style');
 }
}
