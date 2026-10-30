/* Source-of-truth: Unified Aircraft Settings -> both CDU IDENT screens.
 * No cockpit bitmap/hotspot edits. This does not certify an actual
 * aircraft installation or alter electrical/FMC/engine physics.
 */
(function(root){
 'use strict';
 const store=root.B737AircraftProfileStore;
 const catalog=root.B737CDUIdentInstallationV1;
 if(!store||!catalog){root.console?.error('CDU engine IDENT configuration dependencies missing');return;}
 const seats=['CAPT','FO'];
 function current(){return catalog.select(store.get());}
 function send(seat){
  if(!seats.includes(seat))return false;
  const frame=root.document.getElementById('cduFrame'+seat);
  if(!frame?.contentWindow)return false;
  frame.contentWindow.postMessage({
   type:'b737:cdu-installation-v1',seat,installation:current()
  },root.location.origin);
  return true;
 }
 function broadcast(){return seats.map(seat=>({seat,delivered:send(seat)}));}
 root.addEventListener('message',event=>{
  if(event.origin!==root.location.origin||!seats.includes(event.data?.seat)||
     event.data?.type!=='b737:cdu-installation-request-v1')return;
  const frame=root.document.getElementById('cduFrame'+event.data.seat);
  if(event.source!==frame?.contentWindow)return;
  send(event.data.seat);
 });
 // The two IFRAMES are mounted after the settings bootstrap; handle both
 // the initial load and later iframe reloads, not just settings changes.
 root.document.addEventListener('load',event=>{
  for(const seat of seats){
   if(event.target===root.document.getElementById('cduFrame'+seat)){send(seat);break;}
  }
 },true);
 store.subscribe(broadcast);
 root.B737CDUIdentProfileBridgeV1=Object.freeze({
  version:catalog.VERSION,current,broadcast
 });
 broadcast();
})(window);
