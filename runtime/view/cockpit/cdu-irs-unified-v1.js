/* Unified CDU ↔ IRS cockpit bridge, additive to approved CDU artwork.
 * Installed after original cdu-bridge.js, only inside the Unified CDU iframe.
 * Never provides fabricated position, power or inertial alignment.
 */
(function(root){
'use strict';
const seat=new URLSearchParams(location.search).get('seat');
if(!['CAPT','FO'].includes(seat)||parent===root)return;
if(typeof state==='undefined'||typeof update!=='function'||typeof send!=='function')return;
let latest=null,requestPending=false;
const MAX_LEN=24;
const copy=x=>JSON.parse(JSON.stringify(x));
function sendParent(packet){parent.postMessage({seat,...packet},location.origin);}
function ffmt(pos,lat){
 if(!pos||!Number.isFinite(pos.lat)||!Number.isFinite(pos.lon))return '-----';
 const value=lat?pos.lat:pos.lon,d=Math.floor(Math.abs(value)+1e-10),minutes=Math.round((Math.abs(value)-d)*600);
 const deg=minutes>=600?d+1:d,m=minutes>=600?0:minutes;
 return (lat?(value<0?'S':'N'):(value<0?'W':'E'))+String(deg).padStart(lat?2:3,'0')+
  String(Math.floor(m/10)).padStart(2,'0')+'.'+String(m%10);
}
function positionText(pos){return ffmt(pos,true)+' '+ffmt(pos,false);}
function set(row,side,content){
 const lines=document.querySelectorAll('#fmc-lines .fmc-pairline');
 const node=lines[(row-1)*2+1]?.querySelector(side==='L'?'.fmc-left':'.fmc-right');
 if(node)node.textContent=String(content||'').slice(0,MAX_LEN);
}
function paint(){
 if(!latest)return;
 if(state.page==='POS_INIT'){
  const l=latest.units.L,r=latest.units.R;
  const p=l.positionValid?l.position:r.positionValid?r.position:null;
  set(1,'L',ffmt(p,true));set(1,'R',ffmt(p,false));
  const queued=state.active.IRS_POS||'';
  if(queued)set(4,'R',queued.split(/\s+/).join(' ').slice(0,24));
 }
 if(state.page==='POS_REF'){
  const l=latest.units.L,r=latest.units.R;
  set(1,'L',l.positionValid?positionText(l.position):'IRS NOT ALIGNED');
  set(1,'R',latest.comparison!==null?'DIFF '+latest.comparison.toFixed(2)+' NM':'NO NAV SOURCE');
  set(2,'L',l.positionValid?positionText(l.position):'L '+l.phase);
  set(2,'R',r.positionValid?positionText(r.position):'R '+r.phase);
 }
}
const originalUpdate=update;
update=function(){originalUpdate();paint();};
const originalSend=send;
send=function(k){
 const key=String(k||'').replace(/^CDU_CAPT_/,'');
 if(state.page==='POS_INIT'&&key==='LSK_R4'){
  const position=String(state.scratch||'').trim().toUpperCase();
  if(!position){state.message='ENTER IRS POSITION';originalUpdate();return;}
  if(requestPending){state.message='IRS POS PENDING';originalUpdate();return;}
  requestPending=true;state.message='IRS POSITION CHECK';originalUpdate();
  sendParent({type:'b737:irs-cdu-position-set',position});return;
 }
 originalSend(k);
};
root.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==parent)return;
 const d=e.data;
 if(d?.type==='b737:irs-trainer-cdu-state'){
  latest=d.snapshot;paint();return;
 }
 if(d?.type==='b737:irs-cdu-position-result'&&d.seat===seat){
  requestPending=false;
  if(d.ok){
   state.active.IRS_POS=String(d.position||'').toUpperCase();
   state.scratch='';state.message='';originalUpdate();
  }else{
   state.message='INVALID IRS POSITION';originalUpdate();
  }
  return;
 }
});
function addPosRefButton(){
 const actions=document.querySelector('header .actions');
 if(!actions||document.getElementById('irsPosRefJump'))return;
 const button=document.createElement('button');button.id='irsPosRefJump';button.type='button';
 button.textContent='IRS POS REF';button.title='Procedure Trainer: view the L / R independent IRS positions';
 button.addEventListener('click',()=>{core.choose(state,pages,'POS_REF');update();});
 actions.append(button);
}
addPosRefButton();
sendParent({type:'b737:irs-cdu-source-ready'});
})(window);
