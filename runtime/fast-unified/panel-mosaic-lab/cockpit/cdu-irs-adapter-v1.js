/* Unified CDU 4R -> independent IRS core; additive content adapter.
 * Does not edit approved CDU photo, hotspot sizes, original engine or typography.
 * Shared FMC POS INIT state synchronizes through existing CAPT/FO CDU sessions.
 */
(function(){
'use strict';
if(typeof state==='undefined'||typeof update!=='function'||typeof send!=='function')return;
if(!new URLSearchParams(location.search).get('seat'))return;
const original=send,originalUpdate=update;
// Published Jeppesen airport diagram coordinates, cycle 2621, 10-9; tenths of arcminute. Not runway thresholds.
const ARP=Object.freeze({OIII:{lat:35+41.3/60,lon:51+18.9/60},OIMM:{lat:36+14.1/60,lon:59+38.7/60},OIFM:{lat:32+45.1/60,lon:51+51.8/60},OISS:{lat:29+32.4/60,lon:52+35.3/60}});
function arp(icao){const p=ARP[icao];return p?{icao,...p,display:fmt(p).join(' '),source:'JEPPESEN_2621_10_9'}:null;}
function syncArp(){state.refAirportArp=arp(state.active.REF_AIRPORT);}
function sharedPosition(){try{return parent.B737FmcEnteredPositionV1||null}catch{return null}}
function syncEnteredPosition(){const record=sharedPosition(),raw=parentIRS()?.getCoreState?.();if(!record||!raw?.units)return;const match=u=>u?.enteredPosition&&Math.abs(u.enteredPosition.lat-record.lat)<1e-7&&Math.abs(u.enteredPosition.lon-record.lon)<1e-7;if(['L','R'].some(s=>match(raw.units[s])))state.active.IRS_POS=record.display;}
function parentIRS(){try{return parent.B737IRSTrainerUnified||null}catch{return null}}
function inputFormat(raw){
 const s=String(raw||'').trim().toUpperCase().replace(/[\s./°]+/g,'');
 const match=s.match(/^([NS]\d{5})([EW]\d{6})$/);
 if(!match)throw Error('INVALID IRS POSITION · NDDMMm EDDDMMm');
 return match[1]+' '+match[2];
}
function fmt(p){
 if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return ['-----','-----'];
 const f=(num,deg)=>{
  const c=num<0?(deg===2?'S':'W'):(deg===2?'N':'E');
  let x=Math.abs(num),d=Math.floor(x),m=Math.round((x-d)*600);
  if(m===600){d++;m=0;}
  return c+String(d).padStart(deg,'0')+String(Math.floor(m/10)).padStart(2,'0')+'.'+m%10;
 };
 return [f(p.lat,2),f(p.lon,3)];
}
function syncPosInitEvidence(){
 const trainer=parentIRS();
 const snap=trainer?.getState?.(),raw=trainer?.getCoreState?.();
 if(!snap?.units)return false;
 const stateUnits={};
 for(const side of ['L','R']){
  const u=snap.units[side],r=raw?.units?.[side];
  if(!u)continue;
  stateUnits[side]={mode:u.mode||'OFF',powered:u.powered===true,
   phase:r?.phase||u.phase||null,positionEntered:!!r?.enteredPosition};
 }
 const previous=JSON.stringify(state.preflightEvidence?.irs||{});
 state.preflightEvidence={...(state.preflightEvidence||{}),irs:stateUnits};
 return previous!==JSON.stringify(stateUnits);
}
function patchPositionPages(){
 const trainer=parentIRS();if(!trainer)return;
 const b=document.getElementById('fmc-lines'),snapshot=trainer.getState();
 if(!b||!snapshot)return;
 const pairs=[...b.querySelectorAll('.fmc-pairline')];
 const paint=(idx,left,right)=>{if(!pairs[idx])return;
  const l=pairs[idx].querySelector('.fmc-left'),r=pairs[idx].querySelector('.fmc-right');
  if(l)l.textContent=left;if(r)r.textContent=right;
 };
 if(state.page==='POS_REF'&&pairs.length>=12){
  const L=snapshot.units.L,R=snapshot.units.R;
  const position=u=>u?.positionValid&&u.position?fmt(u.position).join(' '):'-----';
  const speed=u=>u?.positionValid&&Number.isFinite(u.gsKt)?u.gsKt.toFixed(1)+'KT':'-----';
  const trainingRef=(()=>{try{return parent.B737UnifiedFlightLocationV1?.getLocation?.()}catch{return null}})();
  paint(0,trainingRef?'FLT PHASE REF':'FMC POS','GS');
  paint(1,trainingRef?fmt(trainingRef).join(' '):'-----','-----');
  paint(2,'IRS L','GS');paint(3,position(L),speed(L));
  paint(4,'IRS R','GS');paint(5,position(R),speed(R));
  paint(6,'GPS L','');paint(7,'-----','');
  paint(8,'GPS R','');paint(9,'-----','');
  paint(10,'RADIO','');paint(11,'-----','');
 }
}
// CDU scratchpad indications follow the actual L/R IRS core faults.
// The CDU artwork is not touched; preserve unrelated FMC crew messages.
let irsOwnedMessage='';
const IRS_MESSAGES=new Set(['IRS MOTION','ENTER IRS POS','VERIFY POSITION']);
function syncIrsAlerts(snapshot){
 const units=[snapshot?.units?.L,snapshot?.units?.R].filter(Boolean);
 const find=code=>units.find(u=>u.alignStatusCode===code);
 const desired=find(3)?'IRS MOTION':
   (find(4)||find(8)||find(12))?'ENTER IRS POS':
   units.some(u=>u.cduMessage==='VERIFY POSITION')?'VERIFY POSITION':null;
 if(desired){
  if(state.scratch&&!state.message)return false;
  if(state.message&&state.message!==irsOwnedMessage&&!IRS_MESSAGES.has(state.message))return false;
  if(state.message===desired){irsOwnedMessage=desired;return false;}
  state.message=desired;irsOwnedMessage=desired;return true;
 }
 if(irsOwnedMessage&&state.message===irsOwnedMessage){
  state.message='';irsOwnedMessage='';return true;
 }
 irsOwnedMessage='';return false;
}
update=function(){syncPosInitEvidence();syncArp();syncEnteredPosition();originalUpdate();patchPositionPages();};
window.updateStage5View=update;
function handleKey(key){
 const normalized=String(key).replace(/^CDU_(?:CAPT|FO)_/,'');
 if(state.page==='POS_INIT'&&normalized==='LSK_L2'){
  const icao=String(state.scratch).trim().toUpperCase();
  if(icao&&icao!=='DELETE'&&!/^[A-Z]{4}$/.test(icao)){state.message='INVALID ENTRY';update();return true;}
  if(icao&&icao!=='DELETE'&&!arp(icao)){state.message='NOT IN DATABASE';update();return true;}
  core.press(state,pages,'CDU_CAPT_LSK_L2');update();return true;
 }
 if(state.page==='POS_INIT'&&normalized==='LSK_L3'){
  core.press(state,pages,'CDU_CAPT_LSK_L3');update();return true;
 }
 if(state.page==='POS_INIT'&&normalized==='LSK_R2'){
  const ref=arp(state.active.REF_AIRPORT);
  if(ref){state.scratch=ref.display;state.message='';}else state.message='ENTER REF AIRPORT';
  update();return true;
 }
 if(state.page==='POS_INIT'&&normalized==='LSK_R4'){
  if(!state.scratch){
   if(state.active.IRS_POS){state.scratch=state.active.IRS_POS;state.message='';}
   else state.message='ENTER IRS POS';
   update();return true;
  }
  try{
   const input=inputFormat(state.scratch);
   const t=parentIRS();if(!t)throw Error('IRS TRAINER NOT READY');
   const result=t.setFmcPosition(input);
   if(!result.ok)throw Error('IRS POSITION NOT ACCEPTED');
   const p=result.position,raw=t.getCoreState?.();
   const accepted=(result.sides||[]).filter(s=>{const q=raw?.units?.[s]?.enteredPosition;return q&&Math.abs(q.lat-p.lat)<1e-7&&Math.abs(q.lon-p.lon)<1e-7;});
   if(!accepted.length)throw Error('ENTER IRS POS');
   const display=fmt(p).join(' ');
   state.active.IRS_POS=display;delete state.pending.IRS_POS;
   parent.B737FmcEnteredPositionV1=Object.freeze({lat:p.lat,lon:p.lon,display,sides:accepted,source:'FMC_POS_INIT'});
   parent.dispatchEvent(new parent.CustomEvent('b737:fmc-entered-position',{detail:parent.B737FmcEnteredPositionV1}));
   state.scratch='';state.message='';
  }catch(e){state.message=String(e.message||e).slice(0,32);}
  update();return true;
 }
 return false;
}
send=function(key){if(handleKey(key))return;return original(key);};
const previousRender=parentIRS()?.getState?.();
let lastSig='';
setInterval(()=>{
 const t=parentIRS(),data=t?.getState?.();if(!data)return;
 const alertChanged=syncIrsAlerts(data);
 if(['POS_REF','POS_INIT'].includes(state.page)){
  const signature=JSON.stringify({L:data.units.L,R:data.units.R,last:data.lastCDUSource});
  if(signature!==lastSig){lastSig=signature;if(state.page==='POS_INIT'&&syncPosInitEvidence())update();else patchPositionPages();}
 }
 if(alertChanged)update();
},1100);
try{parent.addEventListener('b737:fmc-entered-position',()=>{if(state.page==='POS_INIT'||state.page==='POS_REF')update();else syncEnteredPosition();});parent.addEventListener('b737:flight-location-reference',()=>{
 if(state.page==='POS_REF')patchPositionPages();
});}catch(_){/* CDU iframe on a different origin cannot read the parent */ }
window.B737CDUIRSAdapterV1=Object.freeze({inputFormat,patchPositionPages,syncIrsAlerts,syncPosInitEvidence,arp,handleKey});
})();
