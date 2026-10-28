/* ASP-OBS-BRIDGE-0003: render OBS only in the real Overhead iframe.
 * CAPT and FO pedestal geometry and renderer remain untouched.
 * Retain the hidden parent OBS host as the existing backend's DOM adapter;
 * relay actual OBS controls from the atlas via origin/source-validated messages.
 */
(function(root){
 'use strict';
 let received=0,rejected=0;
 function iframe(){return document.getElementById('overheadFrame');}
 function hideStaleParent(){
  const old=document.querySelector('#region-overhead > .asp-bare-mounted[data-seat="OBS"]');
  if(old){
   old.style.setProperty('visibility','hidden','important');
   old.style.setProperty('pointer-events','none','important');
   old.dataset.aspObserverNative='in-overhead-iframe';
  }
 }
 const style=document.createElement('style');
 style.textContent='#region-overhead > .asp-bare-mounted[data-seat="OBS"]{visibility:hidden!important;pointer-events:none!important}';
 (document.head||document.documentElement).append(style);
 root.addEventListener('message',e=>{
  if(e.origin!==root.location.origin||!iframe()||e.source!==iframe().contentWindow)return;
  const message=e.data;
  if(!message||message.type!=='b737:asp-obs-control')return;
  const d=message.detail||{};
  if(d.seat!=='OBS'||!['mic','volume'].includes(d.kind)||typeof d.channel!=='string'){
   rejected++;return;
  }
  const model=root.B737ASPControlsModel;
  if(!model?.sockets?.some(x=>x.kind===d.kind&&x.channel===d.channel)){
   rejected++;return;
  }
  received++;
  root.dispatchEvent(new CustomEvent('b737:asp-control',{detail:{
   seat:'OBS',kind:d.kind,channel:d.channel,selected:d.selected,
   volume:d.volume,angle:d.angle,source:'actual-overhead-photo'
  }}));
 });
 const listener=new MutationObserver(hideStaleParent);
 function boot(){
  hideStaleParent();
  const overhead=document.getElementById('region-overhead');
  if(overhead)listener.observe(overhead,{subtree:false,childList:true});
  else listener.observe(document.documentElement,{subtree:true,childList:true});
 }
 root.B737ASPObserverBridge=Object.freeze({
  inspect:()=>{
   const frame=iframe(),native=frame?.contentWindow?.B737ASPObserverOverhead;
   const control=frame?.contentWindow?.B737ASPControls;
   return {display:'embedded-iframe-only',legacyParentHidden:true,
    iframeReady:!!native,observer:native?.audit?.()||null,calibration:control?.getCalibrationStatus?.()||null,
    eventsReceived:received,rejected};
  }
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})(window);
