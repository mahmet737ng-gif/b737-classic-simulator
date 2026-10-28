'use strict';
const assert=require('node:assert/strict');
const irs=require('../engine/systems/irs-trainer-core-v1.cjs');
const {
  initialState,apply,tick,status,comparison,hdgStsCountdown,
  parseCoordinate,parseFmcPosition,move,distanceNm,resolveMotion
}=irs;
const approx=(x,y,tol=0.00001)=>assert(Math.abs(x-y)<=tol,'expected '+x+' ~= '+y);
approx(parseCoordinate('N35395','lat'),35+39.5/60);
approx(parseCoordinate('W122306','lon'),-(122+30.6/60));
approx(parseCoordinate('E051254','lon'),51+25.4/60);
assert.throws(()=>parseCoordinate('N35995','lat'),/minutes/);
assert.throws(()=>parseCoordinate('N99395','lat'),/degrees/);
assert.throws(()=>parseCoordinate('E181001','lon'),/degrees/);
assert.throws(()=>parseFmcPosition('35531 51262'),/NDDMMm/);
assert.deepEqual(parseFmcPosition('N35395 E051254'),{lat:35+39.5/60,lon:51+25.4/60});
assert.deepEqual(parseFmcPosition('N35395E051254'),{lat:35+39.5/60,lon:51+25.4/60});
assert.deepEqual(parseFmcPosition('N3539.5/E05125.4'),{lat:35+39.5/60,lon:51+25.4/60});
assert.throws(()=>parseFmcPosition('N3569.5E05125.4'),/minutes/);
approx(distanceNm({lat:0,lon:0},move({lat:0,lon:0},90,60)),60,0.001);
const wind=resolveMotion({tasKt:200,trueHeadingDeg:0,windFromDeg:270,windKt:30});
approx(wind.gsKt,Math.hypot(200,30),1e-9);
assert(wind.trackDeg>0&&wind.trackDeg<15,'Wind from west causes rightward ground track');
assert.equal(resolveMotion({trueHeadingDeg:90,gsKt:200}),null,'Heading + GS without track does not define ground course');
const frame={dtSec:5,stationary:true,valid:true,gsKt:0,trueTrackDeg:0,trueHeadingDeg:0,altitudeFt:3960};
let s=initialState();
s=apply(s,{type:'POWER',side:'L',available:true});
s=apply(s,{type:'POWER',side:'R',available:true});
s=apply(s,{type:'SELECT_MODE',side:'L',mode:'NAV'});
s=apply(s,{type:'SELECT_MODE',side:'R',mode:'NAV'});
assert.equal(status(s,'L').phase,'SELFTEST');
assert.equal(status(s,'L').onDcLamp,true);
assert.equal(status(s,'L').alignLamp,false);
assert.equal(status(s,'L').position,null,'No PPOS before initialization and alignment');
s=apply(s,{type:'FMC_SET_IRS_POS',position:'N35395 E051254',originPosition:{lat:35.65833,lon:51.42333}});
assert.equal(status(s,'L').entrySource,'FMC');assert.equal(status(s,'R').entrySource,'FMC');
assert.equal(hdgStsCountdown(s,'L').visible,false,'ON DC power test precedes ALIGN countdown');
s=tick(s,{...frame,dtSec:3.5});
assert.equal(status(s,'L').onDcLamp,false);
assert.equal(status(s,'L').alignLamp,true);
assert.equal(hdgStsCountdown(s,'L').value,7,'Alignment starts following 3.5 seconds ON DC test');
for(let i=0;i<48;i++)s=tick(s,frame); // 600 -> 360s = exactly 6 min
assert.equal(status(s,'L').alignSecondsRemaining,360);
assert.equal(hdgStsCountdown(s,'L').value,6,'At exactly 6:00 must display 6');
for(let i=48;i<120;i++)s=tick(s,frame);
assert.equal(status(s,'L').phase,'NAV_READY');
assert.equal(status(s,'R').phase,'NAV_READY');
assert.equal(hdgStsCountdown(s,'L').visible,false);
assert.equal(comparison(s).separationNm,0,'Both IRS agree after valid initial position set');
const reference={lat:35+39.5/60,lon:51+25.4/60};
for(let i=0;i<720;i++){
 s=tick(s,{dtSec:5,stationary:false,valid:true,gsKt:180,trueTrackDeg:75,trueHeadingDeg:72,
  altitudeFt:33000,windFromDeg:245,windKt:35});
}
const c=comparison(s);
assert(c.left.positionValid&&c.right.positionValid);
assert(c.separationNm>0.10&&c.separationNm<1.25,'Independent smooth drift should be on order of one NM after 1 hour: '+c.separationNm);
// Constant TRUE TRACK means a rhumb-like curve: integrate the reference at
// the SAME 5-second increments. A single 180NM great-circle leg would have
// evolving true track, so it is not an apples-to-apples reference.
let trueDestination=reference;
for(let i=0;i<720;i++)trueDestination=move(trueDestination,75,180*5/3600);
assert(distanceNm(c.left.position,trueDestination)<1.1);
assert(distanceNm(c.right.position,trueDestination)<1.1);
approx(c.left.gsKt,180,0.001);approx(c.left.trueTrackDeg,75,0.001);
assert.equal(c.left.trueHeadingDeg,72);
assert.equal(c.left.entrySource,'FMC');assert.equal(c.right.entrySource,'FMC');
// Never update with invented motion after a missing or stale simulator frame
const prior=c.left.position;
s=tick(s,{dtSec:5,stationary:false,valid:false,altitudeFt:12000});
approx(distanceNm(status(s,'L').position,prior),0,0.000001);
assert.equal(status(s,'L').warning,'NAV_FRAME_MISSING');
assert.throws(()=>tick(s,{dtSec:200,stationary:false,valid:true,gsKt:180,trueTrackDeg:0}),/substep/);
assert.throws(()=>apply(s,{type:'FMC_SET_IRS_POS',position:'N35395 E051254'}),/No powered IRS is eligible/);
// A separately entered selected-side PPOS must not change the other system.
let t=initialState();
t=apply(t,{type:'POWER',side:'R',available:true});
t=apply(t,{type:'SELECT_MODE',side:'R',mode:'NAV'});
t=apply(t,{type:'ISDU_LAT_ENT',side:'R',value:'N35395'});
assert.equal(status(t,'R').entrySource,null);
t=apply(t,{type:'ISDU_LON_ENT',side:'R',value:'E051254'});
assert.equal(status(t,'R').entrySource,'ISDU');
assert.equal(status(t,'L').entrySource,null);
assert.throws(()=>apply(t,{type:'ISDU_LON_ENT',side:'L',value:'E051254'}),/latitude/);
// FMC origin mismatch produces VERIFY POSITION warning but not an automatic
// rejection: the four-NM threshold is NOT an automatic IRS position fault.
const other=initialState();
let a=apply(other,{type:'POWER',side:'L',available:true});
a=apply(a,{type:'SELECT_MODE',side:'L',mode:'NAV'});
a=apply(a,{type:'FMC_SET_IRS_POS',sides:['L'],position:'N35395 E051254',
 originPosition:{lat:36.50,lon:52.0}});
assert.equal(status(a,'L').warning,'VERIFY POSITION');
// FMC SET IRS POS must still initialize L if R is powered off or unavailable.
let one=initialState();
one=apply(one,{type:'POWER',side:'L',available:true});
one=apply(one,{type:'SELECT_MODE',side:'L',mode:'NAV'});
one=apply(one,{type:'FMC_SET_IRS_POS',position:'N35395 E051254'});
assert.equal(status(one,'L').entrySource,'FMC');
assert.equal(status(one,'R').entrySource,null,'No false R initialization while R is OFF');
assert.throws(()=>apply(one,{type:'ISDU_LAT_ENT',side:'R',value:'N35395'}),/requires selected powered IRS in ALIGN/);
// High latitude from an invalid OFF -> NAV selection cannot produce NAV READY.
let wrongHigh=initialState();
wrongHigh=apply(wrongHigh,{type:'POWER',side:'L',available:true});
wrongHigh=apply(wrongHigh,{type:'SELECT_MODE',side:'L',mode:'NAV'});
wrongHigh=apply(wrongHigh,{type:'FMC_SET_IRS_POS',sides:['L'],position:'N71123 E041234'});
assert.equal(status(wrongHigh,'L').phase,'MODE_MISMATCH');
assert.equal(status(wrongHigh,'L').warning,'HIGH_LAT_SELECT_ALIGN');
assert.equal(status(wrongHigh,'L').positionValid,false);
// At ordinary latitude OFF -> ALIGN also performs 3.5s ON DC, then ten
// minutes and waits for the crew to select NAV (unlike OFF -> NAV auto entry).
let normalAlign=initialState();
normalAlign=apply(normalAlign,{type:'POWER',side:'L',available:true});
normalAlign=apply(normalAlign,{type:'SELECT_MODE',side:'L',mode:'ALIGN'});
assert.equal(status(normalAlign,'L').onDcLamp,true);
normalAlign=apply(normalAlign,{type:'FMC_SET_IRS_POS',sides:['L'],position:'N35395 E051254'});
normalAlign=tick(normalAlign,{...frame,dtSec:3.5});
assert.equal(status(normalAlign,'L').phase,'ALIGNING');
for(let i=0;i<120;i++)normalAlign=tick(normalAlign,frame);
assert.equal(status(normalAlign,'L').phase,'ALIGN_READY');
assert.equal(status(normalAlign,'L').positionValid,false);
normalAlign=apply(normalAlign,{type:'SELECT_MODE',side:'L',mode:'NAV'});
assert.equal(status(normalAlign,'L').phase,'NAV_READY');
assert.equal(status(normalAlign,'L').positionValid,true);
// High lat must wait 17 minutes and a NAV switch from ALIGN.
let h=initialState();
h=apply(h,{type:'POWER',side:'L',available:true});
h=apply(h,{type:'SELECT_MODE',side:'L',mode:'ALIGN'});
h=apply(h,{type:'FMC_SET_IRS_POS',sides:['L'],position:'N71123 E041234'});
assert.equal(hdgStsCountdown(h,'L').visible,false);
h=tick(h,{...frame,dtSec:3.5});
assert.equal(hdgStsCountdown(h,'L').value,7);
for(let i=0;i<204;i++)h=tick(h,frame);
assert.equal(status(h,'L').phase,'HIGH_LAT_READY');
assert.equal(status(h,'L').positionValid,false);
h=apply(h,{type:'SELECT_MODE',side:'L',mode:'NAV'});
assert.equal(status(h,'L').phase,'NAV_READY');
assert.equal(status(h,'L').positionValid,true);
// Motion during alignment inhibits readiness and hides countdown.
let b=initialState();b=apply(b,{type:'POWER',side:'L',available:true});
b=apply(b,{type:'SELECT_MODE',side:'L',mode:'NAV'});
b=apply(b,{type:'FMC_SET_IRS_POS',sides:['L'],position:'N35395 E051254'});
b=tick(b,{...frame,stationary:false,gsKt:4});
assert.equal(status(b,'L').phase,'BLOCKED_MOVEMENT');
assert.equal(hdgStsCountdown(b,'L').visible,false);
b=apply(b,{type:'SELECT_MODE',side:'L',mode:'OFF'});
assert.equal(status(b,'L').phase,'SHUTDOWN');
for(let i=0;i<6;i++)b=tick(b,frame);
assert.equal(status(b,'L').phase,'OFF');
// Loss of power invalidates NAV independently.
s=apply(s,{type:'POWER',side:'L',available:false});
assert.equal(status(s,'L').positionValid,false);
assert.equal(status(s,'R').positionValid,true);
// V2 electrical continuity: OFF is not an electrical fault and a restored
// NAV/ALIGN selector must automatically restart the 3.5s self-test + FULL
// alignment; no stale FMC coordinates or elapsed time may carry through.
const idleOff=apply(initialState(),{type:'POWER',side:'L',available:false});
assert.equal(status(idleOff,'L').mode,'OFF');
assert.equal(status(idleOff,'L').phase,'OFF','Unpowered OFF remains OFF');
let restart=initialState();
restart=apply(restart,{type:'POWER',side:'L',available:true});
restart=apply(restart,{type:'POWER',side:'R',available:true});
restart=apply(restart,{type:'SELECT_MODE',side:'L',mode:'NAV'});
restart=apply(restart,{type:'SELECT_MODE',side:'R',mode:'NAV'});
restart=apply(restart,{type:'FMC_SET_IRS_POS',position:'N35395 E051254'});
restart=tick(restart,{...frame,dtSec:3.5});
for(let i=0;i<120;i++)restart=tick(restart,frame);
assert.equal(status(restart,'L').phase,'NAV_READY');
assert.equal(status(restart,'R').phase,'NAV_READY');
restart=apply(restart,{type:'POWER',side:'R',available:false});
assert.equal(status(restart,'L').phase,'NAV_READY','L unaffected by right failure');
assert.equal(status(restart,'R').phase,'POWER_LOST');
assert.equal(status(restart,'R').positionValid,false);
assert.equal(status(restart,'R').entrySource,null,'No stale FMC entry after power loss');
restart=apply(restart,{type:'POWER',side:'R',available:true});
assert.equal(status(restart,'R').phase,'SELFTEST','Power restores while NAV selected');
assert.equal(status(restart,'R').onDcLamp,true,'Fresh 3.5s ON DC power test');
assert.equal(status(restart,'R').alignLamp,false);
assert.equal(status(restart,'L').phase,'NAV_READY');
assert.equal(status(restart,'R').entrySource,null);
const beforeRepeat=restart.units.R.powerTestElapsedSec;
restart=apply(restart,{type:'POWER',side:'R',available:true});
assert.equal(restart.units.R.powerTestElapsedSec,beforeRepeat,'Stable power must not restart');
restart=tick(restart,{...frame,dtSec:3.5});
assert.equal(status(restart,'R').phase,'ALIGNING');
assert.equal(status(restart,'R').alignSecondsRemaining,600,'Full alignment required after R outage');
for(let i=0;i<120;i++)restart=tick(restart,frame);
assert.equal(status(restart,'R').phase,'WAIT_POSITION','No stale solution after alignment');
assert.equal(status(restart,'R').positionValid,false);
restart=apply(restart,{type:'FMC_SET_IRS_POS',sides:['R'],position:'N35395 E051254'});
assert.equal(status(restart,'R').phase,'NAV_READY');
assert.equal(status(restart,'L').phase,'NAV_READY');

// Power removed during a selected ALIGN: restore triggers full normal alignment
// regardless of where its countdown had reached.
let partial=initialState();
partial=apply(partial,{type:'POWER',side:'L',available:true});
partial=apply(partial,{type:'SELECT_MODE',side:'L',mode:'ALIGN'});
partial=apply(partial,{type:'FMC_SET_IRS_POS',sides:['L'],position:'N35395 E051254'});
partial=tick(partial,{...frame,dtSec:3.5});
for(let i=0;i<20;i++)partial=tick(partial,frame);
assert.equal(status(partial,'L').alignSecondsRemaining,500);
partial=apply(partial,{type:'POWER',side:'L',available:false});
partial=apply(partial,{type:'POWER',side:'L',available:true});
assert.equal(status(partial,'L').phase,'SELFTEST');
partial=tick(partial,{...frame,dtSec:3.5});
assert.equal(status(partial,'L').alignSecondsRemaining,600);
assert.equal(status(partial,'L').entrySource,null);

// OFF with no supply remains OFF, and mode selection cannot start an
// unpowered unit. It is safe to turn OFF during a completed power failure.
partial=apply(partial,{type:'POWER',side:'L',available:false});
partial=apply(partial,{type:'SELECT_MODE',side:'L',mode:'OFF'});
assert.equal(status(partial,'L').phase,'OFF');
assert.throws(()=>apply(partial,{type:'SELECT_MODE',side:'L',mode:'NAV'}),/power/i);
partial=apply(partial,{type:'POWER',side:'L',available:true});
assert.equal(status(partial,'L').phase,'OFF','Power restored with selector OFF is inert');

// NAV selected before 30s fast realignment is complete becomes NAV_READY
// only at completion; no indefinite ALIGN_READY with NAV selected.
let quick=initialState();
quick=apply(quick,{type:'POWER',side:'L',available:true});
quick=apply(quick,{type:'SELECT_MODE',side:'L',mode:'NAV'});
quick=apply(quick,{type:'FMC_SET_IRS_POS',sides:['L'],position:'N35395 E051254'});
quick=tick(quick,{...frame,dtSec:3.5});
for(let i=0;i<120;i++)quick=tick(quick,frame);
assert.equal(status(quick,'L').phase,'NAV_READY');
quick=apply(quick,{type:'SELECT_MODE',side:'L',mode:'ALIGN'});
assert.equal(status(quick,'L').phase,'FAST_REALIGN');
for(let i=0;i<3;i++)quick=tick(quick,frame);
quick=apply(quick,{type:'SELECT_MODE',side:'L',mode:'NAV'});
assert.equal(status(quick,'L').positionValid,false,'Do not bypass remaining fast align');
for(let i=0;i<3;i++)quick=tick(quick,frame);
assert.equal(status(quick,'L').phase,'NAV_READY');
assert.equal(status(quick,'L').positionValid,true);
assert.equal(hdgStsCountdown(quick,'L').visible,false);
console.log('PASS IRS Trainer: FMC/ISDU lat/lon gates, 10/17min alignment, owner 7 count, independent L/R drift ~1NM, actual geodesic motion, missing frame validity, electrical/phase failures and owner-locked UI untouched');
