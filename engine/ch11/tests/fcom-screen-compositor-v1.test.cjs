'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const read=x=>fs.readFileSync(path.join(ROOT,x),'utf8');
const compositor=require('../../../cdu-standalone-v6/engine/screen-compositor-v1.js');
const contract=require('../fcom-screen-contract-v1.js');
const pages=JSON.parse(read('cdu-standalone-v6/data/page-definitions.json')).pages;
const core=require('../../../cdu-standalone-v6/engine/cdu-engine.js');
const manifest=JSON.parse(read('engine/ch11/master-screen-registry-v1.json'));

function element(type,text){
 const tags=new Set(type.split(' '));
 return {classList:{contains:k=>tags.has(k)},textContent:text||''};
}
function frame(children){
 const x={childNodes:[...children],replaceChildren(...next){this.childNodes=[...next]},
  appendChild(node){this.childNodes.push(node);return node},
  removeChild(node){this.childNodes.splice(this.childNodes.indexOf(node),1);return node},
  insertBefore(node,before){const at=this.childNodes.indexOf(before);this.childNodes.splice(at<0?0:at,0,node)},
  get firstChild(){return this.childNodes[0]||null},
  querySelector(selector){return selector==='.fmc-header'?this.childNodes.find(n=>n.classList?.contains('fmc-header')):null}};
 return x;
}
const baseline=()=>[element('fmc-line fmc-header','ACT RTE'),element('fmc-line','ORIGIN OIII'),element('fmc-line scratch','ABCDEFGHIJKLMNO')];
test('single owner: source-verified DEP/ARR wins against private Stage5/Stage6',()=>{
 const f=frame(baseline());let overlays=0;
 const s={page:'DEP_ARR',stage6PendingPlan:{},stage5Committed:{},navdbActive:{}};
 const out=compositor.compose({state:s,frame:f,renderers:{STAGE6:()=>overlays++,STAGE5:()=>overlays++}});
 assert.equal(out.owner,'FCOM_NATIVE');assert.equal(out.sourceVerified,false);assert.equal(out.layoutAudited,true);
 assert.equal(overlays,0);assert.equal(f.childNodes.length,3);
});
test('Stage6 wins over Stage5, paints only the detached frame and scratchpad always survives',()=>{
 const f=frame(baseline());let got;
 const output=compositor.compose({state:{page:'RTE',stage6PendingPlan:{route:1},stage5Committed:{route:1}},frame:f,
  renderers:{STAGE6:node=>{got=node;node.replaceChildren(element('fmc-line','MOD RTE REF'))}}});
 assert.strictEqual(got,f);assert.equal(output.owner,'STAGE6');
 assert.equal(f.childNodes.some(x=>x.classList.contains('scratch')),true);
 assert.equal(f.childNodes.some(x=>x.classList.contains('fmc-header')),true);
 assert.equal(f.childNodes.at(-1).textContent,'ABCDEFGHIJKLMNO');
});
test('Overlay fault restores baseline state, no partial corrupted view',()=>{
 const original=baseline(),f=frame(original);
 const out=compositor.compose({state:{page:'LEGS',navdbActive:{}},frame:f,
  renderers:{NAVDB_LEGS:node=>{node.replaceChildren(element('fmc-line','CORRUPT'));throw Error('simulated failure')}}});
 assert.equal(out.owner,'FCOM_NATIVE');assert.equal(out.errors.length,1);
 assert.deepEqual(f.childNodes,original);
});
test('Adding advisory to LEGS does not discard scratchpad or other content',()=>{
 const f=frame(baseline());let called=false;
 const out=compositor.compose({state:{page:'LEGS',stage10Advisory:{fix:'X'}},frame:f,
  renderers:{STAGE10_ADVISORY:node=>{called=true;node.appendChild(element('fmc-line','DTG 10NM'))}}});
 assert.equal(out.owner,'FCOM_NATIVE');assert.equal(called,true);
 assert.equal(f.childNodes.at(-1).classList.contains('scratch'),true);
 assert.equal(f.childNodes.some(x=>x.textContent==='DTG 10NM'),true);
});
test('Screen compiler has exactly 37 live pages, all 24x14, no fake full approval',()=>{
 const a=contract.audit(pages);
 assert.equal(a.total,37);assert.equal(a.layoutAudited,1);assert.equal(a.fullyVerified,0);
 assert.equal(Object.keys(pages).length,manifest.pages.length);
 assert.equal(manifest.totals.fullyVerified,0);
 assert.deepEqual(new Set(manifest.pages.map(x=>x.id)),new Set(Object.keys(pages)));
 for(const p of a.pages){
  assert.equal(p.grid.columns,24);assert.equal(p.grid.rows,14);assert.equal(p.grid.keys.length,12);
  assert.ok(p.source.folio);
  assert.equal(p.verification.full,'NOT_VERIFIED');
  assert.equal(manifest.pages.find(x=>x.id===p.id).folio,p.source.folio);
 }
 assert.equal(a.issues.length,manifest.totals.unresolvedStaticCellIssues);
});
test('DEP/ARR canonical 24x14 frame places origin, destination and OTHER without inventing data',()=>{
 const a=contract.grid(pages,'DEP_ARR',{readValue:key=>({ORIGIN:'OIII',DEST:'OIMM'})[key]||''});
 assert.equal(a.lines.length,14);
 for(const line of a.lines)assert.equal(line.length,24);
 assert.equal(a.lines[2].slice(0,4),'<DEP');
 assert.equal(a.lines[2].slice(10,14),'OIII');
 assert.equal(a.lines[4].slice(10,14),'OIMM');
 assert.equal(a.lines[10].slice(10,15),'OTHER');
 assert.equal(a.lines[13],' '.repeat(24));
});
test('Scratchpad enforces 24 columns and captures oversize as an explicit issue',()=>{
 const good=contract.grid(pages,'IDENT',{readScratch:()=>''.padEnd(24,'A')});
 const bad=contract.grid(pages,'IDENT',{readScratch:()=>''.padEnd(25,'A')});
 assert.equal(good.lines[13],'A'.repeat(24));
 assert.equal(good.issues.some(x=>x.type==='SCRATCHPAD_OVER_24_COLUMNS'),false);
 assert.equal(bad.lines[13],'A'.repeat(24));
 assert.equal(bad.issues.some(x=>x.type==='SCRATCHPAD_OVER_24_COLUMNS'),true);
});
test('Both real CDU hosts load authoritative compositor before their application',()=>{
 for(const p of ['cdu-standalone-v6/index.html','panel-mosaic-lab/cockpit/cdu-stage.html']){
  const html=read(p);
  const a=html.indexOf('fcom-screen-contract-v1.js'),b=html.indexOf('screen-compositor-v1.js'),c=html.indexOf('app.js?v=');
  assert.ok(a>=0&&a<b&&b<c,p+' script order');
 }
 const app=read('cdu-standalone-v6/app.js');
 assert.match(app,/const frame=document.createElement\('div'\)/);
 assert.match(app,/CDU_SCREEN_COMPOSITOR_V1\?\.compose/);
 assert.match(app,/box.replaceChildren\(\.\.\.frame.childNodes\)/);
 assert.doesNotMatch(app,/window.CDU_STAGE5_API\.paint\(box\)/);
});

test('INIT/REF INDEX matches the FCOM 11.40.6 figure and six physical LSK rows',()=>{
 const x=contract.compile(pages,'INDEX');
 assert.equal(x.source.folio,'11.40.6');
 assert.equal(x.source.pdfPageNear,1558);
 assert.deepEqual(x.grid.pairs.map(pair=>pair.map(y=>y.label)),[
  ['<IDENT','NAV DATA>'],['<POS',''],['<PERF',''],
  ['<TAKEOFF',''],['<APPROACH',''],['','MAINT>']]);
 const figure=contract.grid(pages,'INDEX');
 assert.equal(figure.lines[1].trim(),'');
 assert.equal(figure.lines[2].slice(0,6),'<IDENT');
 assert.equal(figure.lines[2].slice(-9),'NAV DATA>');
 assert.equal(figure.lines[12].trim(),'MAINT>');
 const optional=contract.grid(pages,'INDEX',{indexOffsetAvailable:true,fmcOnGroundVerified:false});
 assert.equal(optional.lines[12].slice(0,7),'<OFFSET');
 assert.equal(optional.lines[12].slice(-11),'NAV STATUS>');
 assert.equal(x.verification.full,'NOT_VERIFIED');
});
test('INDEX LSK routes respect the ground and installed-option gates',()=>{
 const basic=core.makeState('INDEX');
 core.pressLSK(basic,pages,'L3');assert.equal(basic.page,'PERF_INIT');
 const offset=core.makeState('INDEX');
 core.pressLSK(offset,pages,'L6');assert.equal(offset.page,'INDEX');
 offset.indexOffsetAvailable=true;core.pressLSK(offset,pages,'L6');assert.equal(offset.page,'OFFSET');
 const supp=core.makeState('INDEX');supp.scratch='SUPP';supp.fmcOnGroundVerified=true;
 core.pressLSK(supp,pages,'R1');assert.equal(supp.page,'SUPP_NAV');assert.equal(supp.scratch,'');
 const unknown=core.makeState('INDEX');unknown.scratch='SUPP';
 core.pressLSK(unknown,pages,'R1');assert.equal(unknown.page,'NAV_DATA');
});
