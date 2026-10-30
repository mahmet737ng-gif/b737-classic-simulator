'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../cdu-airac-banks-v1.js');
const root=path.resolve(__dirname,'../../..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const good=(cycle)=>({schema:'B737_PRIVATE_NAVDATA_VALIDATED_V1',cycle,
 importStatus:'COMPLETE',integrityCheck:'PASS',procedureCoverage:'VALIDATED',
 fmcInstalled:true,fmcExecutable:true,approvedForTraining:true,
 sourceSha256:'a'.repeat(64),start:api.CALENDAR[cycle].start,
 endExclusive:api.CALENDAR[cycle].endExclusive,
 airportCount:17000,waypointCount:300000,procedureCount:100000,
 signedBy:'PRIVATE_SOURCE_REVIEW'});
test('Official AIRAC 2610/2611/2612 calendar uses exclusive UTC validity boundaries',()=>{
 assert.equal(api.current('2026-10-28').cycle,'2610');
 assert.equal(api.current('2026-10-29').cycle,'2611');
 assert.equal(api.current('2026-10-31').cycle,'2611');
 assert.equal(api.current('2026-11-25').cycle,'2611');
 assert.equal(api.current('2026-11-26').cycle,'2612');
 assert.throws(()=>api.current('2026-11-31'),/INVALID_UTC_DAY/);
});
test('Calendar-only 2611 cannot populate IDENT ACTIVE, INACTIVE or NAV DATA',()=>{
 const s=api.fcomIdent(null,'2026-10-31');
 assert.equal(s.currentCalendarCycle,'2611');
 assert.equal(s.NAV_DATA,null);assert.equal(s.ACTIVE,null);assert.equal(s.INACTIVE,null);
 assert.equal(s.importRequired,true);
 assert.equal(s.calendarIsNotFmcInstall,true);
});
test('Preserved private 2610 source cannot be mistaken for loaded FMC installation',()=>{
 const meta=api.archive();
 assert.equal(meta.old.cycle,'2610');
 assert.equal(meta.old.fmcInstalled,false);
 assert.equal(meta.old.fmcExecutable,false);
 assert.equal(meta.old.privateLicense,true);
 assert.equal(meta.requested.cycle,'2611');
 assert.equal(meta.requested.imported,false);
 assert.equal(api.install({ACTIVE:api.PRIVATE2610},'2026-10-31').ACTIVE,null);
});
test('A verified and installed 2611 test manifest maps ACTIVE and date band correctly',()=>{
 const s=api.fcomIdent({ACTIVE:good('2611')},'2026-10-31');
 assert.equal(s.ACTIVE.value,'29OCT-25NOV');
 assert.equal(s.ACTIVE.airac,'2611');
 assert.equal(s.NAV_DATA.value,'AIRAC2611');
 assert.equal(s.INACTIVE,null);
 assert.equal(s.importRequired,false);
 assert.equal(s.currentCycleInstalled,true);
});
test('Two explicitly installed verified banks retain their storage slots: no silent calendar swap',()=>{
 const s=api.fcomIdent({ACTIVE:good('2610'),INACTIVE:good('2611')},'2026-10-31');
 assert.equal(s.ACTIVE.airac,'2610');
 assert.equal(s.INACTIVE.airac,'2611');
 assert.equal(s.ACTIVE.value,'01OCT-28OCT');
 assert.equal(s.INACTIVE.value,'29OCT-25NOV');
 assert.equal(s.currentCycleInstalled,false);
});
test('No incomplete, wrong-cycle or counterfeit imported source becomes a bank',()=>{
 const invalid=[
  {...good('2611'),fmcExecutable:false},
  {...good('2611'),sourceSha256:'NOT_A_HASH'},
  {...good('2611'),start:'2026-10-01'},
  {...good('2611'),procedureCount:0},
  {...good('2611'),signedBy:''},
  {...good('2611'),schema:'NAVDB_CYCLE_ONLY'}
 ];
 for(const v of invalid){
  const out=api.install({ACTIVE:v},'2026-10-31');
  assert.equal(out.ACTIVE,null);
  assert.equal(out.failures.length,1);
 }
});
test('Source-effective dates and actual FMC banks remain independent',()=>{
 assert.equal(api.current('2026-10-31').cycle,'2611');
 const s=api.fcomIdent({ACTIVE:good('2610')},'2026-10-31');
 assert.equal(s.ACTIVE.airac,'2610');assert.equal(s.currentCycleInstalled,false);
});
test('Duplicate cycle cannot be simultaneously ACTIVE and INACTIVE',()=>{
 const r=api.install({ACTIVE:good('2611'),INACTIVE:good('2611')},'2026-10-31');
 assert.equal(r.ACTIVE.cycle,'2611');assert.equal(r.INACTIVE,null);
 assert.match(r.failures[0].reason,/DUPLICATE/);
});
test('Unified links calendar status and verified banks to both mounted CDU frames',()=>{
 const html=source('panel-mosaic-lab/cockpit/index.html'),stage=source('panel-mosaic-lab/cockpit/cdu-stage.html');
 const manifest=JSON.parse(source('panel-mosaic-lab/cockpit/assembly.json'));
 assert.match(html,/id="airacDatabaseStatus"/);
 assert.match(html,/cdu-airac-status-bridge-v1.js/);
 assert.match(stage,/cdu-airac-bank-receiver-v1.js/);
 assert.ok(stage.indexOf('cdu-airac-banks-v1.js')<stage.indexOf('cdu-airac-bank-receiver-v1.js'));
 for(const seat of ['CAPT','FO'])assert.ok(manifest.embeddedInstruments.some(x=>x.seat===seat));
});
test('Both CDUs re-validate source data; a calendar-only update never fabricates NAV_DATA',()=>{
 const code=source('panel-mosaic-lab/cockpit/cdu-airac-bank-receiver-v1.js');
 for(const seat of ['CAPT','FO']){
  const callbacks={},sent=[],parent={postMessage:x=>sent.push(x)};
  const state={preflightEvidence:{MODEL:{value:'737-300'},ACTIVE:{value:'stale'}}};
  let count=0;
  const ctx={window:null,URLSearchParams,location:{search:'?seat='+seat,origin:'https://sim.test'},
   parent,B737CDUAiracBanksV1:api,state,update(){count++},
   addEventListener:(key,fn)=>{callbacks[key]=fn}};
  ctx.window=ctx;
  vm.runInNewContext(code,ctx,{timeout:1000});
  assert.equal(sent[0].seat,seat);
  callbacks.message({origin:ctx.location.origin,source:parent,data:{
   type:'b737:cdu-navdb-bank-snapshot-v1',seat,asOf:'2026-10-31',bankRecords:{ACTIVE:null,INACTIVE:null}
  }});
  assert.equal(state.preflightEvidence.ACTIVE,undefined);
  assert.equal(state.preflightEvidence.NAV_DATA,undefined);
  assert.equal(state.preflightEvidence.MODEL.value,'737-300');
  assert.equal(count,1);
  callbacks.message({origin:ctx.location.origin,source:parent,data:{
   type:'b737:cdu-navdb-bank-snapshot-v1',seat,asOf:'2026-10-31',bankRecords:{ACTIVE:good('2611'),INACTIVE:null}
  }});
  assert.equal(state.preflightEvidence.ACTIVE.value,'29OCT-25NOV');
  assert.equal(state.preflightEvidence.NAV_DATA.value,'AIRAC2611');
  ctx.update();assert.equal(state.preflightEvidence.ACTIVE.value,'29OCT-25NOV');
  const before=count;
  callbacks.message({origin:'https://fake.test',source:parent,data:{
   type:'b737:cdu-navdb-bank-snapshot-v1',seat,asOf:'2026-10-31',bankRecords:{}}
  });
  assert.equal(count,before);
 }
});
