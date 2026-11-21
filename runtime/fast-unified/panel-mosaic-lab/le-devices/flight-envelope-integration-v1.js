/* Flight-envelope input through LE DEVICES OWNER FINAL approved open port.
 * No edits to core, photo/lenses, or the approved LE annunciation engine.
 */
(function(win){
 'use strict';
 const Ports=win.B737LEIntegrationPortsV1;
 const trainer=win.B737LEDevicesTrainer;
 if(!Ports?.create||!trainer){win.console?.warn?.('LE external dynamics port unavailable');return;}
 const port=Ports.create(trainer);
 let last=null,rejected=0;
 win.addEventListener('message',e=>{
  if(e.origin!==win.location.origin||e.source!==win.parent||
     e.data?.type!=='b737:cockpit-command'||
     e.data?.action!=='le-aircraft-dynamics')return;
  const s=e.data.snapshot;
  if(e.data.source!=='INSTRUCTOR_LOW_SPEED_ENVELOPE_NOT_AOA'||
     !s||typeof s.onGround!=='boolean'||
     typeof s.autoslatRequested!=='boolean'){rejected++;return;}
  const key=JSON.stringify([s.onGround,s.autoslatRequested]);
  if(last===key)return;
  try{port.setAircraftDynamics({
   onGround:s.onGround,
   autoslatRequested:s.onGround?false:s.autoslatRequested});
   last=key;
  }catch(err){rejected++;win.console?.warn?.('LE external dynamics rejected',err);}
 });
 win.B737FlightEnvelopeLEPortV1=Object.freeze({
  snapshot:()=>({last,rejected,port:port.snapshot().aircraftDynamics,
   policy:'TRAINING_IAS_PROXY_NOT_CALIBRATED_AOA'})
 });
})(window);
