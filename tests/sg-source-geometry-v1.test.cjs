'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const sg=require('../engine/fmc/sg-source-geometry-v1.js');
const pos=(ident,lat,lon)=>({kind:'FIX_PASSAGE',values:{ident},
 reference_status:'LOCAL_FIX_COORDINATE_VERIFIED',fix:{ident,lat,lon}});
const v={airport:'OIII',kind:'SID',ident:'TEST1A',airac:'2610',fmc_executable:false,
 segments:[{events:[pos('ALFA',35.4,51),pos('BRAV',35.5,51.1),
  {kind:'ATC_VECTORS'},pos('CHAR',35.6,51.2),pos('DENO',35.7,51.3)]}]};
const selection={airport:'OIII',kind:'SID',ident:'TEST1A',runway:'29R'};
test('source-to-SG renders known consecutive fixes but never crosses vectors',()=>{
 const g=sg.compile(v,selection),lines=g.features.filter(f=>f.geometry.type==='LineString');
 assert.equal(lines.length,2);
 assert.deepEqual(lines.map(f=>f.properties.to),['BRAV','DENO']);
 assert.equal(g.features.filter(f=>f.geometry.type==='Point').length,4);
 assert.equal(g.metadata.fmc_executable,false);
 assert.ok(g.metadata.warnings.some(x=>x.kind==='ATC_VECTORS'));
});
test('unknown or ambiguous fix coordinates cannot create invented legs',()=>{
 const bad={...v,segments:[{events:[pos('ALFA',35.4,51),
  {kind:'FIX_PASSAGE',values:{ident:'MISSING'}},pos('DENO',35.7,51.3)]}]};
 assert.equal(sg.compile(bad,selection).features.filter(f=>f.geometry.type==='LineString').length,0);
});
test('source identity and unsafe executable data fail closed',()=>{
 assert.throws(()=>sg.compile({...v,fmc_executable:true},selection),/UNVERIFIED/);
 assert.throws(()=>sg.compile(v,{...selection,airport:'OIMM'}),/UNVERIFIED/);
 assert.throws(()=>sg.compile({segments:[]},selection),/UNVERIFIED/);
});

test('Unified route bus shares SG segments and fix labels without a second CDU engine',()=>{
 const route=require('../panel-mosaic-lab/cockpit/cdu-sg-route-state-v1.js').create();
 const preview=require('../panel-mosaic-lab/cockpit/cdu-sg-ehsi-preview-v1.js');
 route.setConnected(true);route.setContext({origin:'OIII',destination:'OIMM'});
 const procedure={...v,requires_runway_selection:false,requires_transition_selection:false,
  runway_options:['29R'],transition_options:[]};
 const geometry=sg.compile(procedure,selection);
 const snap=route.select({airport:'OIII',kind:'SID',ident:'TEST1A',runway:'29R',procedure,geometry});
 assert.equal(preview.collect(snap).length,2);
 assert.equal(preview.collectFixes(snap).length,4);
 assert.equal(snap.selections['SID@OIII'].fmcExecutable,false);
 route.setConnected(false);
 assert.equal(preview.collectFixes(route.snapshot()).length,0);
});

test('procedure text FIX identifiers join directly to verified local NAVDATA coordinates',()=>{
 const ast={...v,segments:[{ast:[
  {kind:'FIX_PASSAGE',values:{ident:'ALFA'}},
  {kind:'FIX_PASSAGE',values:{ident:'BRAV'}}
 ]}],local_fixes:{
  ALFA:[{ident:'ALFA',lat:35.4,lon:51,post_marker_line:4}],
  BRAV:[{ident:'BRAV',lat:35.5,lon:51.1,post_marker_line:6}]
 }};
 assert.equal(sg.compile(ast,selection).features.filter(f=>f.geometry.type==='LineString').length,1);
 const ambiguous={...ast,local_fixes:{...ast.local_fixes,
  BRAV:[...ast.local_fixes.BRAV,{ident:'BRAV',lat:38,lon:57,post_marker_line:9}]}};
 assert.equal(sg.compile(ambiguous,selection).features.filter(f=>f.geometry.type==='LineString').length,0);
});
