'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const M=require('../fmc-systems-network-v1.js');
const feed=(s,unit,evidence,nowMs,provenance='DIRECT_VERIFIED_EQUIPMENT_FEED')=>M.apply(s,{type:'FEED',unit,evidence,nowMs,provenance});
test('every aircraft FMC/CDU feeder starts unknown; energized bus alone proves nothing',()=>{
 const a=M.createState();assert.equal(a.power.FMC1.feed,'UNKNOWN');
 const bus=Object.fromEntries(M.POWER_BUSES.map(k=>[k,true]));
 assert.equal(M.globalPower({bus}),'UNKNOWN');
 assert.equal(M.globalPower({bus:{generator1:false}}),'UNKNOWN');
 assert.equal(M.globalPower({bus:Object.fromEntries(M.POWER_BUSES.map(k=>[k,false]))}),'ABSENT');
 assert.throws(()=>feed(a,'FMC1','PRESENT',1000,'ALL_POWER_BUSES_PROVEN_ABSENT'));
});
test('all photo-index CB coordinates remain UNVERIFIED and never enable trip consequences',()=>{
 assert.equal(M.BREAKERS.length,11);
 assert(M.BREAKERS.every(x=>x.verification==='PHOTO_LABEL_CANDIDATE_ONLY'&&x.bus==='UNVERIFIED'&&x.activeTripEffect===false));
 assert(M.BREAKERS.some(x=>x.id==='P18-2:E8'&&x.unit==='FMC1'));
 assert(M.BREAKERS.some(x=>x.id==='P6-1:C13'&&x.unit==='CDU_FO'));
});
test('five-second confirmed FMC1 outage retains route and does not require reinitialization',()=>{
 let s=M.createState();s=M.apply(s,{type:'ROUTE',route:{origin:'OIII',dest:'OIMM',active:true}});
 s=feed(s,'FMC1','PRESENT',0);s=feed(s,'FMC1','ABSENT',1000);
 assert.equal(s.guidance.forceDisengage,true);
 s=feed(s,'FMC1','PRESENT',6000);
 assert.equal(s.power.FMC1.lastDurationMs,5000);
 assert.equal(s.recovery.reinitializePreflight,false);
 assert.equal(s.route.origin,'OIII');
});
test('ten seconds or more ground requires new preflight',()=>{
 let s=M.createState();s=feed(s,'FMC1','PRESENT',0);s=feed(s,'FMC1','ABSENT',2000);s=feed(s,'FMC1','PRESENT',12000);
 assert.equal(s.recovery.reinitializePreflight,true);
 assert.equal(s.recovery.selectActiveWaypoint,false);
});
test('more than ten seconds airborne flags MOD LEGS and active-leg selection',()=>{
 let s=M.apply(M.createState(),{type:'PHASE',phase:'FLIGHT'});
 s=feed(s,'FMC1','PRESENT',0);s=feed(s,'FMC1','ABSENT',5000);s=feed(s,'FMC1','PRESENT',16001);
 assert.equal(s.recovery.showModRteLegs,true);
 assert.equal(s.recovery.selectActiveWaypoint,true);
});
test('AFDS LNAV/VNAV evidence requires real powered FMC, IRS and audited legs',()=>{
 let s=M.createState();
 s=M.apply(s,{type:'ROUTE',route:{origin:'OIII',dest:'OIMM',active:true,legsVerified:true,discontinuitiesUnknown:false}});
 s=M.apply(s,{type:'IRS',leftValid:true});
 assert.equal(M.mcpEvidence(s),null);
 s=feed(s,'FMC1','PRESENT',1);
 assert.equal(M.mcpEvidence(s),true);
 s=feed(s,'FMC1','ABSENT',2);assert.equal(M.mcpEvidence(s),null);
 s=feed(s,'FMC2','ABSENT',3);assert.equal(M.mcpEvidence(s),false);
});
test('24-column 14-row screen contract rejects overflow',()=>{
 const grid=M.screenGrid(Array.from({length:14},()=>''));assert(grid.every(x=>x.length===24));
 assert.throws(()=>M.screenGrid(Array(13).fill('')));
 assert.throws(()=>M.screenGrid([...Array(13).fill(''), 'X'.repeat(25)]));
});
