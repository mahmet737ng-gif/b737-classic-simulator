'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
let ticks=0;
const context={window:{},structuredClone,console};
const init=`const state={page:'INDEX',active:{ORIGIN:'',DEST:''},pending:{},stagedRoute:{},message:''};
const pages={};const core={pendingCount:s=>Object.keys(s.pending).length,hasStagedRoute:s=>Object.keys(s.stagedRoute).length>0,choose:(s,p,page)=>{s.page=page}};
function update(){globalTicks++};let globalTicks=0;`;
vm.runInNewContext(init,context);
const js=fs.readFileSync(path.resolve(__dirname,'../cdu-standalone-v6/nav-route-adapter.js'),'utf8');
vm.runInNewContext(js,context);
const api=context.window.CDU_NAV_API;
assert.ok(api,'adapter must publish CDU bridge');
const route={origin:'AAAA',destination:'BBBB',airac:'2610',sourceId:'PMDG_WORLD_2610_WITH_PROCEDURES_R1',fmcExecutable:false,
  legs:[{index:1,to:'FIXA',lat:0,lon:1,distanceNm:60,trueInitialTrackDeg:90,via:'DCT'},
        {index:2,to:'BBBB',lat:0,lon:2,distanceNm:60,trueInitialTrackDeg:90,via:'DCT'}]};
assert.equal(api.stage(route).status,'STAGED_NOT_ACTIVE');
assert.equal(api.snapshot().stage,'WAIT_ACTIVATE_EXEC');
assert.equal(api.snapshot().committed,0);
assert.throws(()=>api.stage(route),/uncommitted/);
vm.runInNewContext("state.pending={ORIGIN:state.stagedRoute.ORIGIN,DEST:state.stagedRoute.DEST};state.stagedRoute={};",context);
api.afterKey('CDU_CAPT_EXEC');assert.equal(api.snapshot().committed,0,'EXEC before commit must not prematurely activate');
vm.runInNewContext("Object.assign(state.active,state.pending);state.pending={};",context);
api.afterKey('CDU_CAPT_EXEC');assert.equal(api.snapshot().committed,2);
assert.equal(api.snapshot().guidance,false);
assert.equal(vm.runInNewContext('state.active.WPT1',context),'FIXA');
vm.runInNewContext("state.page='LEGS';",context);
class Element {constructor(){this.children=[];this.style={};this.className='';this.textContent=''}append(...c){this.children.push(...c)}replaceChildren(...c){this.children=c}}
context.document={createElement:()=>new Element()};
const box=new Element();api.paint(box);
const txt=box.children.flatMap(x=>x.children.map(y=>y.textContent)).join(' | ');
assert.match(txt,/REF ONLY/);assert.match(txt,/FIXA/);assert.match(txt,/NO LNAV/);
console.log('CDU NAVDB source → RTE stage → ACT/EXEC → LEGS reference: PASS');