/* LEDEV-LINK-0002: physical Flap Lever -> indication of LE devices + flap L/R needles + two forward lamps.
   No new graphics, no simulated second Electrical runtime. Only the approved lever
   'b737:flap-detent-visual-test' event is promoted to the LE training command.
*/
(function(){
 'use strict';
 const allowed=new Set([0,1,2,5,10,15,25,30,40]);
 let lever=0,actualTe=0,ready=false,lastProjection=null,lastProjectedRevision=-1;
 let ownerIdentity=null,lastSent=null,lastSendAt=0,pendingUntil=0,lastPaintKey='';
 const frame=()=>document.getElementById('overheadFrame');
 function sendLever(){
  const child=frame()?.contentWindow;
  if(!ready||!child)return false;
  if(lastSent===lever&&Date.now()-lastSendAt<750)return true;
  lastSent=lever;lastSendAt=Date.now();
  child.postMessage({type:'b737:cockpit-command',action:'le-devices',
    command:{type:'FLAP_LEVER',value:lever},originator:'physical-flap-lever'},location.origin);
  return true;
 }
 function updateIndication(){
  if(!lastProjection)return false;
  const p=lastProjection,center=p.center;
  if(Number.isFinite(p.tePosition)&&p.tePosition>=0&&p.tePosition<=40){
   actualTe=p.tePosition;
   window.B737FlapNeedles?.setCommon(actualTe);
  }
  if(!window.B737CockpitLights||!center||![true,false,null].includes(center.power))return false;
  const leadingEdge=center.transit?'DISAGREE':
   center.extended?(p.leStage==='EXT'||(p.leStage==null&&[1,2,5].includes(p.lever))?'INTERMEDIATE':'FULL'):
   p.leStage==='RETRACTED'&&!p.mismatch?.length?'RETRACTED':'TRANSIT';
  window.B737CockpitLights.setInputs({
   trailingFlaps:lever,
   leadingEdge,
   autoslatInFlight:!!p.autoslatInhibit,
   leCenterPowered:center.power===true,
   leDirectValid:true,leDirectTransit:center.transit===true,
   leDirectExtended:center.extended===true
  });
  return true;
 }
 function setLever(detent){
  const n=Number(detent);
  if(!allowed.has(n))return false;
  pendingUntil=Date.now()+7000;
  if(n===lever){sendLever();return true;}
  lever=n;lastSent=null;
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
  if(payload.kind==='ready'){ready=true;lastProjectedRevision=-1;lastSent=null;sendLever();return;}
  if(payload.kind!=='le-devices-projection'||!payload.projection)return;
  const p=payload.projection;
  if(!Number.isInteger(p.revision))return;
  // Reset/reload can legitimately restart the owner's revision counter.
  if(p.revision<lastProjectedRevision){observeOwner();return;}
  if(!allowed.has(p.lever)||p.lever!==lever)return;
  lastProjectedRevision=p.revision;
  lastProjection=p;
  updateIndication();
 });
 // Same-origin direct observation is a recovery path for dropped ready/projection
 // messages. Never set actual position from a lever command or bypass hydraulics.
 function observeOwner(){
  try{
   const owner=frame()?.contentWindow?.B737LEDevicesTrainer;
   if(!owner)return;
   if(owner!==ownerIdentity){ownerIdentity=owner;ready=true;lastProjectedRevision=-1;lastSent=null;}
   const le=owner.snapshot?.(),te=owner.flapActuator?.();
   if(!le||!te||!allowed.has(le.lever)||!Number.isFinite(te.actual)||te.actual<0||te.actual>40)return;
   ready=true;
   if(le.lever!==lever&&Date.now()<pendingUntil){sendLever();}
   const p={...le,tePosition:te.actual,teTarget:te.command,teMoving:te.moving===true};
   const key=JSON.stringify([p.lever,p.revision,p.tePosition,p.teTarget,p.teMoving,p.center,p.leStage,p.mismatch,!!window.B737FlapNeedles,!!window.B737CockpitLights]);
   lastProjection=p;lastProjectedRevision=Number.isInteger(p.revision)?p.revision:-1;
   if(key!==lastPaintKey){lastPaintKey=key;updateIndication();}
  }catch(error){/* frame may still be loading */}
 }
 const observer=setInterval(observeOwner,200);
 window.addEventListener('pagehide',()=>clearInterval(observer),{once:true});
 window.B737LEDevicesUnifiedLink=Object.freeze({
  getState:()=>({lever,actualTe,overheadReady:ready,projection:lastProjection,
    centerLightsReady:!!window.B737CockpitLights}),
  // For QA and simulator model integration; physical handler remains the only lever DOM owner.
  syncLever:setLever
 });
})();
