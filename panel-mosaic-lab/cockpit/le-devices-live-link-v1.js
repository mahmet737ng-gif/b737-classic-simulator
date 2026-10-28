/* LEDEV-LINK-0002: physical Flap Lever -> indication of LE devices + flap L/R needles + two forward lamps.
   No new graphics, no simulated second Electrical runtime. Only the approved lever
   'b737:flap-detent-visual-test' event is promoted to the LE training command.
*/
(function(){
 'use strict';
 const allowed=new Set([0,1,2,5,10,15,25,30,40]);
 let lever=0,actualTe=0,ready=false,lastProjection=null,lastProjectedRevision=-1;
 const frame=()=>document.getElementById('overheadFrame');
 function sendLever(){
  const child=frame()?.contentWindow;
  if(!ready||!child)return false;
  child.postMessage({type:'b737:cockpit-command',action:'le-devices',
    command:{type:'FLAP_LEVER',value:lever},originator:'physical-flap-lever'},location.origin);
  return true;
 }
 function updateIndication(){
  if(!lastProjection||!window.B737CockpitLights)return false;
  const p=lastProjection,center=p.center;
  if(Number.isFinite(p.tePosition)&&p.tePosition>=0&&p.tePosition<=40){
   actualTe=p.tePosition;
   window.B737FlapNeedles?.setCommon(actualTe);
  }
  if(!center||![true,false,null].includes(center.power))return false;
  const leadingEdge=center.transit?'DISAGREE':
   center.extended?(p.lever>=10?'FULL':'INTERMEDIATE'):
   p.lever===0&&p.mismatch?.length===0?'RETRACTED':'TRANSIT';
  window.B737CockpitLights.setInputs({
   trailingFlaps:lever,
   leadingEdge,
   autoslatInFlight:!!p.autoslatInhibit,
   leCenterPowered:center.power===true
  });
  return true;
 }
 function setLever(detent){
  const n=Number(detent);
  if(!allowed.has(n))return false;
  if(n===lever){sendLever();return true;}
  lever=n;
  // Lever is the command, never the indication. L/R needles follow actualTe
  // published by the shared flap actuator inside the overhead physics bridge.
  // Both forward lamps live in the original panel; no duplicate image/overlay.
  window.B737CockpitLights?.setInputs({trailingFlaps:n,leadingEdge:'TRANSIT'});
  sendLever();
  return true;
 }
 document.addEventListener('b737:flap-detent-visual-test',event=>{
  if(event.detail?.visualOnly!==true)return;
  setLever(event.detail.detent);
 });
 document.addEventListener('b737:flap-ready',event=>setLever(event.detail?.position??0));
 window.addEventListener('b737:cockpit-lights-ready',()=>updateIndication());
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame()?.contentWindow||
     event.data?.type!=='b737:cockpit-overhead')return;
  const payload=event.data;
  if(payload.kind==='ready'){ready=true;sendLever();return;}
  if(payload.kind!=='le-devices-projection'||!payload.projection)return;
  const p=payload.projection;
  if(!Number.isInteger(p.revision)||p.revision<lastProjectedRevision)return;
  if(!allowed.has(p.lever)||p.lever!==lever)return;
  lastProjectedRevision=p.revision;
  lastProjection=p;
  updateIndication();
 });
 window.B737LEDevicesUnifiedLink=Object.freeze({
  getState:()=>({lever,actualTe,overheadReady:ready,projection:lastProjection,
    centerLightsReady:!!window.B737CockpitLights}),
  // For QA and simulator model integration; physical handler remains the only lever DOM owner.
  syncLever:setLever
 });
})();
