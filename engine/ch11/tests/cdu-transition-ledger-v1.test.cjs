'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const ledger=require('../cdu-transition-ledger-v1.js');
const pages=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../../../cdu-standalone-v6/data/page-definitions.json'),'utf8')).pages;
function state(page='RTE',scratch=''){return {page,active:{ORIGIN:'OIII',DEST:'OIMM'},
 pending:{},stagedRoute:{},scratch,message:'',stage6AwaitingExec:false};}
test('CPT and FO journal maintain independent sequence but shared-page semantics',()=>{
 const cp=ledger.create({seat:'CAPT',validPages:Object.keys(pages),now:()=>10});
 const fo=ledger.create({seat:'FO',validPages:Object.keys(pages),now:()=>10});
 let a=cp.capture(state()),b=cp.capture(state('DEP_ARR'));
 cp.record('CDU_CAPT_KEY_DEP_ARR',a,b);
 fo.record('CDU_CAPT_KEY_RTE',fo.capture(state('IDENT')),fo.capture(state()));
 assert.equal(cp.audit().events,1);assert.equal(fo.audit().events,1);
 assert.equal(cp.getTrace()[0].seat,'CAPT');assert.equal(fo.getTrace()[0].seat,'FO');
 assert.equal(cp.getTrace()[0].guidanceCommanded,false);
 assert.equal(cp.audit().commandsIssued,0);
});
test('Every trace has deterministic ACT/MOD evidence and scrubs actual scratch content',()=>{
 const j=ledger.create({seat:'CAPT',validPages:Object.keys(pages)});
 const b=j.capture(state('RTE','SECRET')),a=j.capture({...state('LEGS','CHECK FMC'),pending:{RUNWAY:'32L'}});
 const entry=j.record('CDU_CAPT_LSK_L1',b,a);
 assert.equal(entry.fromPage,'RTE');assert.equal(entry.toPage,'LEGS');
 assert.equal(entry.beforePending,0);assert.equal(entry.afterPending,1);
 assert.equal(entry.toScratchLength,9);
 assert.doesNotMatch(JSON.stringify(j.getTrace()),/SECRET|CHECK FMC/);
});
test('Scratch >24 becomes explicit backend error and cannot silently be certified',()=>{
 const j=ledger.create({validPages:Object.keys(pages)});
 const b=j.capture(state('RTE','A'.repeat(24))),a=j.capture(state('RTE','A'.repeat(25)));
 j.record('CDU_CAPT_KEY_A',b,a);
 assert.equal(j.audit().errors[0].type,'SCRATCHPAD_OVER_24');
});
test('Unregistered screens are blocked instead of invented',()=>{
 const j=ledger.create({validPages:Object.keys(pages)});
 assert.throws(()=>j.capture(state('PHANTOM')),/UNREGISTERED_CDU_SCREEN/);
});
