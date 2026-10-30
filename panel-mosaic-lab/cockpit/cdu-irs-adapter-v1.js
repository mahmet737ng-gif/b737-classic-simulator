/* Unified CDU 4R -> independent IRS core; additive content adapter.
 * Does not edit approved CDU photo, hotspot sizes, original engine or typography.
 * Shared FMC POS INIT state synchronizes through existing CAPT/FO CDU sessions.
 */
(function(){
'use strict';
if(typeof state==='undefined'||typeof update!=='function'||typeof send!=='function')return;
if(!new URLSearchParams(location.search).get('seat'))return;
const original=send,originalUpdate=update;
function parentIRS(){try{return parent.B737IRSTrainerUnified||null}catch{return null}}
function inputFormat(raw){
 const s=String(raw||'').trim().toUpperCase().replace(/[\s./]+/g,'');
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
  paint(0,'FMC POS','GS');paint(1,'-----','-----');
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
  if(state.message&&state.message!==irsOwnedMessage&&!IRS_MESSAGES.has(state.message))return false;
  if(state.message===desired){irsOwnedMessage=desired;return false;}
  state.message=desired;irsOwnedMessage=desired;return true;
 }
 if(irsOwnedMessage&&state.message===irsOwnedMessage){
  state.message='';irsOwnedMessage='';return true;
 }
 irsOwnedMessage='';return false;
}
update=function(){originalUpdate();patchPositionPages();};
window.updateStage5View=update;
send=function(key){
 const normalized=String(key).replace(/^CDU_CAPT_/,'');
 if(state.page==='POS_INIT'&&normalized==='LSK_R4'){
  try{
   const input=inputFormat(state.scratch);
   const t=parentIRS();if(!t)throw Error('IRS TRAINER NOT READY');
   const result=t.setFmcPosition(input);
   if(!result.ok)throw Error('IRS POSITION NOT ACCEPTED');
   // LSK 4R commits without CDU EXEC, as on the FCOM POS INIT page.
   state.active.IRS_POS=input;delete state.pending.IRS_POS;
   state.scratch='';state.message='';
  }catch(e){state.message=String(e.message||e).slice(0,32);}
  update();return;
 }
 return original(key);
};
const previousRender=parentIRS()?.getState?.();
let lastSig='';
setInterval(()=>{
 const t=parentIRS(),data=t?.getState?.();if(!data)return;
 const alertChanged=syncIrsAlerts(data);
 if(['POS_REF','POS_INIT'].includes(state.page)){
  const signature=JSON.stringify({L:data.units.L,R:data.units.R,last:data.lastCDUSource});
  if(signature!==lastSig){lastSig=signature;patchPositionPages();}
 }
 if(alertChanged)update();
},1100);
window.B737CDUIRSAdapterV1=Object.freeze({inputFormat,patchPositionPages,syncIrsAlerts});
})();
