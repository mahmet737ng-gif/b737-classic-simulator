'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={window:{},structuredClone,console};
vm.runInNewContext(`
const state={page:'FLIGHT_PLAN',active:{ORIGIN:'',DEST:''},
 pending:{VIA1:'DCT',TO1:'FIXA'},stagedRoute:{ORIGIN:'AAAA',DEST:'BBBB'},message:''};
const pages={};
const core={pendingCount:s=>Object.keys(s.pending).length,hasStagedRoute:s=>Object.keys(s.stagedRoute).length>0,
 readValue:(s,k)=>s.pending[k]??s.stagedRoute[k]??s.active[k]??'',choose:(s,p,page)=>{s.page=page}};
function update(){}
`,ctx);
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../cdu-standalone-v6/nav-route-adapter.js'),'utf8'),ctx);
const a=ctx.window.CDU_NAV_API;
const draft=a.draft();assert.equal(draft.origin,'AAAA');assert.equal(draft.via[0].type,'DCT');
const route={origin:'AAAA',destination:'BBBB',airac:'2610',sourceId:'PMDG_WORLD_2610_WITH_PROCEDURES_R1',fmcExecutable:false,afdsCommands:false,
  legs:[{to:'FIXA',lat:0,lon:1,distanceNm:60,via:'DCT'}, {to:'BBBB',lat:0,lon:2,distanceNm:60,via:'DCT'}]};
assert.throws(()=>a.stageFromDraft(route,{origin:'CCCC',destination:'BBBB',via:draft.via}),/changed/);
assert.equal(a.snapshot().pending,0); // navdbPending is not set
const staged=a.stageFromDraft(route,draft);
assert.equal(staged.status,'STAGED_NOT_ACTIVE');assert.equal(a.snapshot().committed,0);
assert.equal(a.snapshot().stage,'WAIT_ACTIVATE_EXEC');
vm.runInNewContext('state.pending={ORIGIN:"AAAA",DEST:"BBBB"};state.stagedRoute={}',ctx);
a.afterKey('CDU_CAPT_EXEC');assert.equal(a.snapshot().committed,0);
vm.runInNewContext('state.active.ORIGIN="AAAA";state.active.DEST="BBBB";state.pending={}',ctx);
a.afterKey('CDU_CAPT_EXEC');assert.equal(a.snapshot().committed,2);assert.equal(a.snapshot().guidance,false);
console.log('CDU Native RTE/FLIGHT_PLAN import: data checked, ACTIVATE+EXEC gated, NO NAV guidance PASS');