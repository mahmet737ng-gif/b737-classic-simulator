/* CDU First Officer electrical availability training gate.
 * CAPT CDU is deliberately not mounted in Unified. Do not create a second
 * FMC owner, mutate route state or change the approved CDU bitmap.
 */
(function(win){'use strict';
 const API=()=>win.B737UnifiedBusFailureInjectionV1?.live;
 let receivedState=null,eventRegistered=false;
 function receiveElectricalAvailability(state){
  if(!['NORMAL','OFF','UNKNOWN','DEGRADED','NOT_INSTALLED'].includes(state))return false;
  if(eventRegistered&&state===receivedState)return false;
  eventRegistered=true;receivedState=state;refresh();return true;
 }
 function refresh(){
  const frame=win.document?.getElementById('cduFrameFO');
  if(!frame)return;
  const aperture=frame.closest?.('.cdu-frame-window')||frame.parentElement;
  const station=frame.closest?.('.cdu-station');
  if(!aperture||!station)return;
  const scenario=API()?.get();
  const injecting=scenario?.active===true;
  const bus=win.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
  // Electronic Bus 1 AC is the MRG source for the FO CDU. The generic
  // Classic model derives it from Generator Bus 1; a direct electronic bus
  // injection can independently remove this LRU feed.
  const loss=eventRegistered?
   (receivedState==='OFF'||receivedState==='NOT_INSTALLED'):
   injecting&&(scenario.offBusKeys.includes('electronic1@115VAC')||
    bus?.generator1===false);
  station.dataset.busInjectionPower=loss?'OFF':'UNINJECTED';
  aperture.style.filter=loss?'brightness(0)':'';
  aperture.style.pointerEvents=loss?'none':'';
  const status=win.document.getElementById('cduStatus');
  if(status){
   status.dataset.injectedPower=String(loss);
   status.title=loss?'FO CDU feed lost (Electronic Bus 1 AC), training injection only':'';
  }
 }
 for(const e of ['b737:bus-failure-injection-changed','b737:electrical-owner-ready',
  'b737:cockpit-mounted','b737:electrical-v7-state'])
  win.addEventListener(e,()=>{if(!eventRegistered||e==='b737:cockpit-mounted')refresh();});
 if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',refresh,{once:true});
 else refresh();
 win.B737UnifiedCduBusFailureGateV1=Object.freeze({refresh,receiveElectricalAvailability,
  powered:()=>win.document?.getElementById('cduFrameFO')?.closest?.('.cdu-station')?.dataset?.busInjectionPower!=='OFF'});
})(window);
