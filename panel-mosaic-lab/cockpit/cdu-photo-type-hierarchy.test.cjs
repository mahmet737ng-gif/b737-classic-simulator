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
 assert.equal(result.photoProfile,'CLASSIC-CDU-PHOTO-HIERARCHY-0001');
 assert.equal(result.scratchLength,24);
 assert.ok(result.labelPx>=result.fontSizePx*.60&&result.labelPx<=result.fontSizePx*.73,'reference baseline for labels preserved');
 assert.equal(result.pageLabelMultiplier,1.8,'field label 10 percent smaller than prior');
 assert.equal(result.pageValueMultiplier,1.44,'LSK text is 20% smaller than previous 1.8x');
 assert.equal(result.entryPromptMultiplier,.56,'field blanks 30 percent smaller than prior');
 assert.ok(result.pageValuePx>result.fontSizePx,'scratchpad font stays independent');
 assert.ok(Math.abs(result.headerPx/result.fontSizePx-.88)<.001);
 assert.ok(Math.abs(result.promptPx/result.fontSizePx-.95)<.001);
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
assert.match(embedded,/cdu-screen-fit-v6\.js\?v=CDU-24COL-0006-R10-LABEL90-ENTRY70/);
assert.doesNotMatch(src,/@font-face|BoeingCDU-Large\.ttf|\.bbox_px\s*=/);
console.log('PASS: INDEX IDENT POS INIT RTE PERF INIT TAKEOFF LEGS: small titles, large LSK prompts, exact 24A scratchpad, untouched FCOM cells');
