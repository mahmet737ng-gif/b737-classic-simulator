'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const data=JSON.parse(fs.readFileSync(path.join(root,'cdu-standalone-v6/data/page-definitions.json'),'utf8'));
const pages=data.pages;
const core=require('../engine/cdu-engine.js');
const app=fs.readFileSync(path.join(root,'cdu-standalone-v6/app.js'),'utf8');

function prep(){
 const st=core.makeState('DEP_ARR');
 st.active.ORIGIN='OIII';
 st.active.DEST='OIMM';
 return st;
}
test('DEP/ARR INDEX is documented FCOM 11.40.32 and has correct 5 active LSK slots',()=>{
 const p=pages.DEP_ARR;
 assert.equal(p.title,'DEP/ARR INDEX');
 assert.equal(p.source_ref.folio_family,'11.40.32');
 assert.equal(p.source_ref.behavior_folio,'11.40.33');
 assert.equal(p.page_count,1);
 assert.equal(p.rows[0][0].label,'<DEP');
 assert.equal(p.rows[0][1].label,'ARR>');
 assert.equal(p.rows[1][0].label,'');
 assert.equal(p.rows[1][1].label,'ARR>');
 assert.equal(p.rows[4][0].label,'DEP');
 assert.equal(p.rows[4][1].label,'ARR');
 assert.equal(p.rows[5][0].label,'<----');
 assert.equal(p.rows[5][1].label,'---->');
 assert.equal(p.center_fields.row_1,'{ORIGIN}');
 assert.equal(p.center_fields.row_2,'{DEST}');
 assert.equal(p.center_fields.row_5,'OTHER');
});
test('L1 and R1 both use origin; R2 alone uses destination',()=>{
 for(const [key,airport,mode,page] of [
  ['L1','OIII','DEP','DEPARTURES'],
  ['R1','OIII','ARR','ARRIVALS'],
  ['R2','OIMM','ARR','ARRIVALS']]){
  const s=prep();
  core.press(s,pages,'CDU_CAPT_LSK_'+key);
  assert.equal(s.page,page,key);
  assert.deepEqual(s.depArrSelection,{airport,mode,
   source:key==='R2'?'DEST':'ORIGIN',referenceOnly:false,sourceFolio:'FCOM 11.40.32-33'});
 }
});
test('L2, R3, and L5 have no selectable airport actions',()=>{
 for(const key of ['L2','R3','L5']){
  const s=prep();
  core.press(s,pages,'CDU_CAPT_LSK_'+key);
  assert.equal(s.page,'DEP_ARR');
  assert.equal(s.message,'KEY INACTIVE');
 }
});
test('OTHER airport via scratchpad is reference-only and cannot edit an active route',()=>{
 for(const [key,page,mode] of [['L6','DEPARTURES','DEP'],['R6','ARRIVALS','ARR']]){
  const s=prep();
  s.scratch='OIIE';
  core.press(s,pages,'CDU_CAPT_LSK_'+key);
  assert.equal(s.page,page);
  assert.equal(s.depArrSelection.airport,'OIIE');
  assert.equal(s.depArrSelection.mode,mode);
  assert.equal(s.depArrSelection.referenceOnly,true);
  assert.equal(s.scratch,'');
  s.scratch='32L';
  core.press(s,pages,'CDU_CAPT_LSK_L2');
  assert.equal(s.message,'NOT ON ROUTE');
  assert.equal(s.active.RUNWAY,'');
 }
});
test('OTHER airport rejects empty and malformed ICAO IDs',()=>{
 const s=prep();
 core.press(s,pages,'CDU_CAPT_LSK_L6');
 assert.equal(s.page,'DEP_ARR');
 assert.equal(s.message,'INVALID ENTRY');
 s.scratch='OO';
 core.press(s,pages,'CDU_CAPT_LSK_R6');
 assert.equal(s.page,'DEP_ARR');
});
test('UI explicitly renders airport center column and OTHER instead of generic ORIGIN/DEST fields',()=>{
 assert.match(app,/function renderDepArrIndex\(box,screenTop,screenHeight\)/);
 assert.match(app,/makeDepArrTriplet\(y\(1\),'<DEP',airport\('ORIGIN'\),'ARR>'\)/);
 assert.match(app,/makeDepArrTriplet\(y\(2\),'',airport\('DEST'\),'ARR>'\)/);
 assert.match(app,/makeDepArrTriplet\(y\(6,-13\),'DEP','OTHER','ARR',true\)/);
 assert.match(app,/makeDepArrTriplet\(y\(6,10\),'<----','','---->'\)/);
});

test('Older AIRAC reference overlays cannot erase FCOM INDEX after it is rendered',()=>{
 const stage5=fs.readFileSync(path.join(root,'cdu-standalone-v6/stage5-adapter.js'),'utf8');
 const stage6=fs.readFileSync(path.join(root,'cdu-standalone-v6/stage6-selector.js'),'utf8');
 assert.match(stage5,/function paint\(box\)\{[\s\S]*?if\(state\.page==='DEP_ARR'\)return;/);
 assert.match(stage6,/function paint\(box\)\{[\s\S]*?if\(state\.page==='DEP_ARR'\)return;/);
});
test('Bundled live JS and JSON use the same FCOM INDEX definition',()=>{
 const js=fs.readFileSync(path.join(root,'cdu-standalone-v6/data/page-definitions.js'),'utf8');
 assert.ok(js.startsWith('window.CDU_PAGES='));
 const jsPage=JSON.parse(js.slice('window.CDU_PAGES='.length).replace(/;\s*$/,'')).DEP_ARR;
 assert.deepEqual(jsPage,pages.DEP_ARR);
});

test('Both Unified CDUs fetch versioned corrected page definitions, app and overlays',()=>{
 const html=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/cdu-stage.html'),'utf8');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/assembly.json'),'utf8'));
 for(const p of ['data/page-definitions.js','engine/cdu-engine.js','app.js','stage5-adapter.js','stage6-selector.js']){
  const at=html.indexOf('src="'+p);
  assert.ok(at>=0);
  assert.ok(html.slice(at,at+200).includes('DEPARR-FCOM-114032-0001'));
 }
 for(const seat of ['CAPT','FO']){
  const item=manifest.embeddedInstruments.find(x=>x.seat===seat);
  assert.ok(item);
  assert.match(item.embeddedUrl,/DEPARR-FCOM-114032-0001-CH11-COMPOSITOR-0001$/);
 }
});
