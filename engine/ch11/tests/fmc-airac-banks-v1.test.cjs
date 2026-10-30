'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const bank=require('../fmc-airac-banks-v1.js');
const sha='a'.repeat(64);
const pkg=cycle=>({cycle,sourceSha256:sha,navDataIdentifier:'NAV'+cycle,
 effectiveStart:bank.CALENDAR[cycle].start,effectiveEndExclusive:bank.CALENDAR[cycle].endExclusive,
 proceduresParsed:true,legEncodingValidated:true,records:{airports:16000,waypoints:300000}});
const trust=p=>p.sourceSha256===sha&&p.records.waypoints>0;
const ready=()=>bank.install(bank.install(bank.initial(),pkg('2610'),trust),pkg('2611'),trust);
test('Published 2026 AIRAC calendar: cycle 2611 is Oct 29-Nov 25',()=>{
 assert.equal(bank.currentCycle('2026-10-28'),'2610');
 assert.equal(bank.currentCycle('2026-10-31'),'2611');
 assert.equal(bank.currentCycle('2026-11-25'),'2611');
 assert.equal(bank.currentCycle('2026-11-26'),'2612');
 assert.equal(bank.dateRange('2610'),'OCT01OCT28/26');
 assert.equal(bank.dateRange('2611'),'OCT29NOV25/26');
});
test('Calendar metadata alone never creates an installed or active FMC NAVDB',()=>{
 const x=bank.initial(),s=bank.status(x,'2026-10-31'),v=bank.ident(x);
 assert.equal(s.calendarCurrentCycle,'2611');
 assert.equal(s.activeCycle,null);
 assert.equal(s.pendingCycle2611,true);
 assert.equal(v.NAV_DATA,null);assert.equal(v.ACTIVE,null);assert.equal(v.INACTIVE,null);
 assert.throws(()=>bank.activate(x,'2611',{onGround:true,utcDay:'2026-10-31'}),/NOT_INSTALLED/);
});
test('Imported data must have real decoded records, source SHA and a trusted validator',()=>{
 assert.throws(()=>bank.install(bank.initial(),pkg('2611')),/TRUSTED_IMPORT_VALIDATOR/);
 assert.throws(()=>bank.install(bank.initial(),{...pkg('2611'),sourceSha256:'bad'},trust),/SHA256/);
 assert.throws(()=>bank.install(bank.initial(),{...pkg('2611'),effectiveStart:'2026-11-01'},trust),/DATES_MISMATCH/);
 assert.throws(()=>bank.install(bank.initial(),{...pkg('2611'),legEncodingValidated:false},trust),/UNVALIDATED/);
 assert.throws(()=>bank.install(bank.initial(),pkg('2611'),()=>false),/VERIFICATION_FAILED/);
 const s=bank.install(bank.initial(),pkg('2611'),trust);
 assert.equal(s.activeCycle,null);assert.equal(s.inactiveCycle,'2611');
 assert.equal(bank.ident(s).ACTIVE,null);
 assert.equal(bank.ident(s).INACTIVE.value,'OCT29NOV25/26');
});
test('Switchover is ground-only and never silently happens just because a cycle date arrives',()=>{
 const b=ready();
 assert.throws(()=>bank.activate(b,'2611',{onGround:false,utcDay:'2026-10-31'}),/IN_FLIGHT/);
 assert.throws(()=>bank.activate(b,'2611',{utcDay:'2026-10-31'}),/GROUND_STATE_NOT_VERIFIED/);
 assert.equal(b.activeCycle,null);
 const installed=bank.activate(b,'2610',{onGround:true,utcDay:'2026-10-28'}).state;
 assert.equal(installed.activeCycle,'2610');
 assert.equal(bank.status(installed,'2026-10-31').activeStatus,'ACTIVE_EXPIRED_OR_NONCURRENT');
 assert.equal(installed.activeCycle,'2610'); // expired in flight is retained
});
test('Change of active date moves old active to inactive and clears entire old flight plan',()=>{
 const b=ready();
 const started=bank.activate(b,'2610',{onGround:true,utcDay:'2026-10-28'}).state;
 const current={fmcNavDataBanks:started,active:{ORIGIN:'OIII',DEST:'OIMM',RUNWAY:'29R',ENG_RATING:'20K'},
  pending:{DEST:'OMDB',CRZ_ALT:'FL330'},stagedRoute:{FLIGHT:'IR123'},scratch:'2611',
  stage5Committed:{route:'OLD'},stage6PendingPlan:{route:'OLD'},navdbActive:{airac:'2610'}};
 const result=bank.switchFmc(current,'2611',{onGround:true,utcDay:'2026-10-31'});
 assert.equal(result.changed,true);assert.equal(result.clearedRoute,true);
 assert.equal(result.state.fmcNavDataBanks.activeCycle,'2611');
 assert.equal(result.state.fmcNavDataBanks.inactiveCycle,'2610');
 assert.equal(result.state.active.ORIGIN,'');
 assert.equal(result.state.active.DEST,'');
 assert.equal(result.state.active.ENG_RATING,'20K');
 assert.equal(result.state.pending.DEST,undefined);
 assert.equal(result.state.pending.CRZ_ALT,'FL330'); // non-route performance setting unchanged
 assert.equal(result.state.stage5Committed,undefined);
 assert.equal(result.state.navdbActive,undefined);
 assert.equal(result.state.scratch,'');
 assert.equal(bank.ident(result.state.fmcNavDataBanks).ACTIVE.value,'OCT29NOV25/26');
 assert.equal(bank.ident(result.state.fmcNavDataBanks).INACTIVE.value,'OCT01OCT28/26');
});
test('No-op reselect does not erase the route',()=>{
 const b=bank.activate(ready(),'2611',{onGround:true,utcDay:'2026-10-31'}).state;
 const fmc={fmcNavDataBanks:b,active:{ORIGIN:'OIII'},pending:{DEST:'OIMM'},scratch:'TEXT'};
 const r=bank.switchFmc(fmc,'2611',{onGround:true,utcDay:'2026-10-31'});
 assert.equal(r.changed,false);assert.equal(r.clearedRoute,false);
 assert.equal(r.state.active.ORIGIN,'OIII');assert.equal(r.state.scratch,'TEXT');
});
