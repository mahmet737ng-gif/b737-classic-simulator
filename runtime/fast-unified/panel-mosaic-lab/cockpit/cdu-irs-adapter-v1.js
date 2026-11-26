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
function arp(icao){
 if(!/^[A-Z]{4}$/.test(String(icao||'')))return null;
 const published=ARP[icao];
 const refs=parent.B737IranNavReferenceV1;
 const reference=Array.isArray(refs)?refs.find(r=>r.type==='AIRPORT'&&r.ident===icao&&r.verified===true):null;
 const scenario=parent.B737FlightScenarioCoreV1?.AIRPORTS?.[icao];
 const p=published||reference||scenario;
 if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)return null;
 return {icao,lat:p.lat,lon:p.lon,display:fmt(p).join(' '),source:published?'JEPPESEN_2621_10_9':reference?'UNIFIED_AIRPORT_REFERENCE':'UNIFIED_SCENARIO_AIRPORT'};
}
function syncArp(){if(state.page==='POS_INIT')state.refAirportArp=arp(state.active?.REF_AIRPORT);}
function sharedPosition(){try{return parent.B737FmcEnteredPositionV1||null}catch{return null}}
// The actual IRS core, not a CDU-local entry or scenario flag, owns position.
const alignmentPhases=new Set(['SELFTEST','ALIGNING','ALIGN_READY','WAIT_POSITION','HIGH_LAT_READY','FAST_REALIGN','WAIT_LATITUDE_SENSOR']);
function validPosition(p){return !!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;}
function syncEnteredPosition(){
 const t=parentIRS(),snap=t?.getState?.(),raw=t?.getCoreState?.();
 if(!snap?.units)return false;
 const candidates=[];let missing=false;
 for(const side of ['L','R']){
  const u=snap.units[side],r=raw?.units?.[side];
  if(!u||u.powered!==true||!['NAV','ALIGN'].includes(u.mode))continue;
  const nav=u.positionValid===true&&validPosition(u.position);
  const aligning=alignmentPhases.has(r?.phase||u.phase);
  const entered=validPosition(r?.enteredPosition)&&r?.initialized!==false;
  if(nav)candidates.push({side,nav:true,reference:entered?r.enteredPosition:u.position,current:u.position});
  else if(aligning&&entered)candidates.push({side,nav:false,reference:r.enteredPosition,current:r.enteredPosition});
  else if(aligning)missing=true;
 }
 candidates.sort((a,b)=>Number(b.nav)-Number(a.nav));
 const selected=candidates[0],reference=selected?fmt(selected.reference).join(' '):'';
 const display=selected?fmt(selected.current).join(' '):'';
 const required=!selected||missing;
 const changed=(state.active.IRS_POS||'')!==reference||state.irsPositionRequired!==required||state.irsPositionDisplay!==display;
 if(reference)state.active.IRS_POS=reference;else delete state.active.IRS_POS;
 delete state.pending.IRS_POS;
 state.irsPositionRequired=required;state.irsPositionDisplay=display;
 return changed;
}
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
update=function(){
 try{syncPosInitEvidence();syncArp();syncEnteredPosition();}catch(e){console.warn('CDU POS source unavailable',e);state.refAirportArp=null;}
 originalUpdate();
 try{patchPositionPages();}catch(e){console.warn('CDU POS reference paint unavailable',e);}
};
window.updateStage5View=update;
function handleKey(key){
 const normalized=String(key).replace(/^CDU_(?:CAPT|FO)_/,'');
 // Route the photographed key here, before any legacy stage interceptors.
 if(normalized==='INIT_REF'){
  const g=parent.B737UnifiedAvionicsNetworkV1?.getSignal?.('aircraft.airground');
  const f=parent.B737UnifiedFlightScenarioV1;
  const flight=f?.getDiagnostics?.()?.active===true?f.getState?.():null;
  if(typeof flight?.airborne==='boolean')state.fmcOnGroundVerified=!flight.airborne;
  else if(g?.quality==='VALID'&&typeof g.value?.onGround==='boolean')state.fmcOnGroundVerified=g.value.onGround;
  syncPosInitEvidence();syncEnteredPosition();
  core.press(state,pages,'CDU_CAPT_INIT_REF');update();return true;
 }
 if(state.page==='INDEX'&&/^LSK_[LR][1-6]$/.test(normalized)){
  core.press(state,pages,'CDU_CAPT_'+normalized);update();return true;
 }
 if(state.page==='POS_INIT'&&normalized==='LSK_L6'){
  core.press(state,pages,'CDU_CAPT_LSK_L6');update();return true;
 }
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
   syncEnteredPosition();
   if(state.irsPositionDisplay||state.active.IRS_POS){state.scratch=state.irsPositionDisplay||state.active.IRS_POS;state.message='';}
   else state.message='ENTER IRS POS';
   update();return true;
  }
  try{
   const input=inputFormat(state.scratch);
   const t=parentIRS();if(!t)throw Error('IRS TRAINER NOT READY');
   // Validate the FMC reference even if the IRS is already in NAV.
   const parse=(part,d,max)=>{const deg=Number(part.slice(1,d+1)),minute=Number(part.slice(d+1))/10;
    if(deg>max||minute>=60||(deg===max&&minute!==0))throw Error('INVALID IRS POSITION');
    return (part[0]==='S'||part[0]==='W'?-1:1)*(deg+minute/60);};
   const [lat,lon]=input.split(' ');const p={lat:parse(lat,2,90),lon:parse(lon,3,180)};
   let result=null,delivery='ACCEPTED',accepted=[];
   try{result=t.setFmcPosition(input);}catch(error){
    if(!String(error?.message||error).includes('NO IRS ALIGNING'))throw error;
    delivery='NOT_ALIGNING';
   }
   const raw=t.getCoreState?.();
   const matches=q=>q&&Math.abs(q.lat-p.lat)<1e-7&&Math.abs(q.lon-p.lon)<1e-7;
   if(result){
    if(!result.ok)throw Error('IRS POSITION NOT ACCEPTED');
    accepted=(result.sides||[]).filter(s=>matches(raw?.units?.[s]?.enteredPosition));
    if(!accepted.length)throw Error('ENTER IRS POS');
   }else{
    const snap=t.getState?.();
    accepted=['L','R'].filter(s=>snap?.units?.[s]?.powered===true&&snap.units[s].mode==='NAV'&&snap.units[s].positionValid===true&&matches(raw?.units?.[s]?.enteredPosition));
    if(accepted.length)delivery='ALREADY_INITIALIZED';
    else throw Error('SELECT IRS NAV OR ALIGN');
   }
   const display=fmt(p).join(' ');
   const flight=parent.B737UnifiedFlightScenarioV1;
   if(delivery==='ACCEPTED'&&flight?.getDiagnostics?.()?.active===true&&flight.getState()?.airborne!==true){
    if(typeof flight.setFmcPosition!=='function')throw Error('FLIGHT POSITION LINK NOT READY');
    flight.setFmcPosition(p);
   }else if(delivery==='ACCEPTED'&&flight?.getDiagnostics?.()?.active!==true){
    parent.B737UnifiedFlightLocationV1?.choose({...p,icao:state.active.REF_AIRPORT,source:'FMC_POS_INIT'});
   }
   state.active.IRS_POS=display;delete state.pending.IRS_POS;
   parent.B737FmcEnteredPositionV1=Object.freeze({lat:p.lat,lon:p.lon,display,sides:accepted,source:'FMC_POS_INIT',irsDelivery:delivery});
   state.scratch='';state.message='';
   // Publish shared FMC state before notifying the other CDU.
   update();
   parent.dispatchEvent(new parent.CustomEvent('b737:fmc-entered-position',{detail:parent.B737FmcEnteredPositionV1}));
   return true;
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
 const before=state.active.IRS_POS||'',required=state.irsPositionRequired;
 const evidenceChanged=syncPosInitEvidence(),changed=syncEnteredPosition();
 if(alertChanged||before!==(state.active.IRS_POS||'')||required!==state.irsPositionRequired||(state.page==='POS_INIT'&&(changed||evidenceChanged)))update();
 else if(state.page==='POS_REF'){
  const signature=JSON.stringify({L:data.units.L,R:data.units.R});
  if(signature!==lastSig){lastSig=signature;patchPositionPages();}
 }
},1100);
try{parent.addEventListener('b737:fmc-entered-position',()=>{if(state.page==='POS_INIT'||state.page==='POS_REF')update();else syncEnteredPosition();});parent.addEventListener('b737:flight-location-reference',()=>{
 if(state.page==='POS_REF')patchPositionPages();
});}catch(_){/* CDU iframe on a different origin cannot read the parent */ }
// Defer event handling until IRS writes finish; both CDU seats observe the same owner.
let queued=false;
try{parent.addEventListener('b737:irs-trainer-state',()=>{
 if(queued)return;queued=true;
 setTimeout(()=>{queued=false;const old=state.active.IRS_POS||'',required=state.irsPositionRequired;
  const evidence=syncPosInitEvidence(),changed=syncEnteredPosition();
  if(old!==(state.active.IRS_POS||'')||required!==state.irsPositionRequired||state.page==='POS_INIT'&&(changed||evidence))update();
  else if(state.page==='POS_REF')patchPositionPages();
 },0);
});}catch(_){}
window.B737CDUIRSAdapterV1=Object.freeze({inputFormat,patchPositionPages,syncIrsAlerts,syncPosInitEvidence,syncEnteredPosition,arp,handleKey});
})();
