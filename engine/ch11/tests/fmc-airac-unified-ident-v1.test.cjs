'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const banks=require('../fmc-airac-banks-v1.js');
const script=read('panel-mosaic-lab/cockpit/cdu-airac-ident-adapter-v1.js');
function seatFixture(seat='CAPT'){
 const sent=[],parent={postMessage:(x)=>sent.push(x)};
 let updateCount=0,sendCount=0;
 const ctx={window:null,parent,location:{search:'?seat='+seat,origin:'https://unified.example'},
  B737FMCAiracBanksV1:banks,
  state:{page:'IDENT',active:{ORIGIN:'OIII',DEST:'OIMM'},pending:{},
   stagedRoute:{},scratch:'',message:'',preflightEvidence:{MODEL:{quality:'VALID',origin:'SELECTED_TRAINER_AIRCRAFT_MODEL',value:'737-300'}}},
  update(){updateCount++},send(){sendCount++},URLSearchParams,
  Date,console:{warn(){}},Object,JSON
 };
 ctx.window=ctx;
 vm.runInNewContext(script,ctx,{timeout:1000});
 return {ctx,sent,parent,getUpdates:()=>updateCount,getSends:()=>sendCount};
}
const sha='d'.repeat(64),verified=p=>p.sourceSha256===sha;
const packageOf=cycle=>({cycle,sourceSha256:sha,navDataIdentifier:'NAV'+cycle,
 effectiveStart:banks.CALENDAR[cycle].start,effectiveEndExclusive:banks.CALENDAR[cycle].endExclusive,
 proceduresParsed:true,legEncodingValidated:true,records:{airports:20000,waypoints:100000}});
test('CDU without physical 2611 NAVDATA never shows calendar date as ACTIVE',()=>{
 const f=seatFixture();
 assert.equal(f.ctx.state.preflightEvidence.ACTIVE,null);
 assert.equal(f.ctx.state.preflightEvidence.NAV_DATA,null);
 assert.equal(f.ctx.B737CDUAiracIdentAdapterV1.status().pendingCycle2611,true);
 assert.equal(f.sent[0].activeCycle,null);
 f.ctx.send('CDU_CAPT_LSK_R3');
 assert.equal(f.ctx.state.message,'NAV DATA NOT LOADED');
 assert.equal(f.getSends(),0);
});
test('Verified active/inactive metadata displays R2/R3 only when actual banks are installed',()=>{
 const f=seatFixture('FO');
 let s=banks.install(banks.initial(),packageOf('2610'),verified);
 s=banks.activate(s,'2610',{onGround:true,utcDay:'2026-10-28'}).state;
 s=banks.install(s,packageOf('2611'),verified);
 f.ctx.state.fmcNavDataBanks=s;f.ctx.update();
 assert.equal(f.ctx.state.preflightEvidence.ACTIVE.value,'OCT01OCT28/26');
 assert.equal(f.ctx.state.preflightEvidence.INACTIVE.value,'OCT29NOV25/26');
 f.ctx.send('CDU_CAPT_LSK_R3');
 assert.equal(f.ctx.state.scratch,'OCT29NOV25/26');
 assert.equal(f.ctx.state.fmcNavDataBanks.activeCycle,'2610');
});
test('Selecting 2611 while ground is unknown cannot activate or erase route',()=>{
 const f=seatFixture();
 let s=banks.install(banks.initial(),packageOf('2610'),verified);
 s=banks.activate(s,'2610',{onGround:true,utcDay:'2026-10-28'}).state;
 s=banks.install(s,packageOf('2611'),verified);
 f.ctx.state.fmcNavDataBanks=s;
 f.ctx.state.scratch=banks.dateRange('2611');
 f.ctx.send('CDU_CAPT_LSK_R2');
 assert.equal(f.ctx.state.fmcNavDataBanks.activeCycle,'2610');
 assert.equal(f.ctx.state.active.ORIGIN,'OIII');
 assert.equal(f.ctx.state.message,'GROUND_STATE_NOT_VERIFIED');
});
test('After verified ground transition, old bank is inactive and route fields are cleared',()=>{
 const f=seatFixture();
 let s=banks.install(banks.initial(),packageOf('2610'),verified);
 s=banks.activate(s,'2610',{onGround:true,utcDay:'2026-10-28'}).state;
 s=banks.install(s,packageOf('2611'),verified);
 f.ctx.state.fmcNavDataBanks=s;
 f.ctx.state.fmcOnGroundVerified=true;
 f.ctx.state.scratch=banks.dateRange('2611');
 f.ctx.send('CDU_CAPT_LSK_R2');
 assert.equal(f.ctx.state.fmcNavDataBanks.activeCycle,'2611');
 assert.equal(f.ctx.state.fmcNavDataBanks.inactiveCycle,'2610');
 assert.equal(f.ctx.state.active.ORIGIN,'');
 assert.equal(f.ctx.state.preflightEvidence.ACTIVE.value,'OCT29NOV25/26');
 assert.equal(f.ctx.state.preflightEvidence.INACTIVE.value,'OCT01OCT28/26');
});
test('Corrupt bank after reset is discarded without inventing NAV DATA',()=>{
 const f=seatFixture();
 f.ctx.state.fmcNavDataBanks=null;
 f.ctx.update();
 assert.equal(f.ctx.state.fmcNavDataBanks.activeCycle,null);
 assert.equal(f.ctx.state.preflightEvidence.ACTIVE,null);
});
test('Both CDU seats use the same session NAVDB bank but independent page and scratch',()=>{
 const session=read('panel-mosaic-lab/cockpit/cdu-session.js');
 assert.match(session,/'fmcNavDataBanks'/);
 const stage=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 assert.match(stage,/fmc-airac-banks-v1\.js/);
 assert.match(stage,/cdu-airac-ident-adapter-v1\.js/);
 const html=read('panel-mosaic-lab/cockpit/index.html');
 assert.match(html,/fmcAiracCycleStatus/);
 const manifest=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json'));
 for(const seat of ['CAPT','FO']){
  const item=manifest.embeddedInstruments.find(x=>x.seat===seat);
  assert.ok(item);
  assert.match(item.embeddedUrl,/AIRAC-2611-0001$/);
 }
});
