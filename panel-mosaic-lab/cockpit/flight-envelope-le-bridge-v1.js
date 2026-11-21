/* Instructor flight envelope -> OWNER FINAL LE Devices external dynamics port.
 * Do not modify the locked LE model, trainer bridge or physical lever.
 * Conditional autoslat demand is an IAS proxy, not certified AoA logic.
 */
(function(win){
 'use strict';
 const VALID='B737_FLIGHT_SCENARIO_STATE_V1';
 const source=()=>win.document.getElementById('overheadFrame')?.contentWindow;
 let ready=false,onGround=true,requested=false,previous=null;
 function transmit(force=false){
  const target=source(),key=JSON.stringify([onGround,requested]);
  if(!ready||!target||(!force&&previous===key))return false;
  target.postMessage({type:'b737:cockpit-command',action:'le-aircraft-dynamics',
   source:'INSTRUCTOR_LOW_SPEED_ENVELOPE_NOT_AOA',
   snapshot:{onGround,autoslatRequested:requested}},win.location.origin);
  previous=key;return true;
 }
 win.addEventListener('b737:flight-scenario-state',e=>{
  const f=e.detail;if(f?.schema!==VALID)return;
  onGround=f.airborne!==true;
  const p=win.B737LEDevicesUnifiedLink?.getState?.();
  requested=!onGround&&[1,2,5].includes(p?.lever)&&f.autoSlatRequest===true;
  transmit();
 });
 win.addEventListener('b737:flight-scenario-stopped',()=>{
  onGround=true;requested=false;transmit();
 });
 win.addEventListener('message',e=>{
  if(e.origin!==win.location.origin||e.source!==source()||
     e.data?.type!=='b737:cockpit-overhead'||e.data.kind!=='ready')return;
  ready=true;previous=null;transmit(true);
 });
 win.B737FlightEnvelopeLEBridgeV1=Object.freeze({snapshot:()=>({
  ready,onGround,requested,source:'INSTRUCTOR_LOW_SPEED_ENVELOPE_NOT_AOA'
 })});
})(window);
