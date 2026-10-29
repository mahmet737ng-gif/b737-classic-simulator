/* B737 Classic TAT probe heat — generic ground test trainer.
 * FCOM 3.10.4: momentary TAT TEST on ground applies power to TEMP PROBE.
 * FCOM 3.20.4: probe electrically heated; amber means probe not heated.
 * Classic MRG: MAIN BUS 2 115V AC, TEMP PROBE CB P18-3 C5 (photo catalogue).
 * No AMM-level aircraft wiring or heat-rate guesses. No protected artwork.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737TATProbeV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const CB_ID='P18-3|ALL|C5';
 const FAULTS=Object.freeze(['HEATER_FAIL','CURRENT_SENSE_FAIL','INDICATOR_STUCK_ON','INDICATOR_STUCK_OFF']);
 const initialState=()=>({schema:'b737-tat-probe/1',faults:Object.fromEntries(FAULTS.map(id=>[id,false]))});
 const copy=s=>({schema:s.schema,faults:{...s.faults}});
 function injectFault(state,id,active){
  if(!FAULTS.includes(id)||typeof active!=='boolean')throw Error('Invalid TAT fault');
  const next=copy(state);next.faults[id]=active;return next;
 }
 function evaluate(state,input={}){
  if(state?.schema!=='b737-tat-probe/1')throw Error('Invalid TAT probe state');
  const onGround=input.onGround===true;
  const groundKnown=typeof input.onGround==='boolean';
  const pitotAOn=String(input.switches?.['pitot-a']||'OFF').toUpperCase()==='ON';
  const testPressed=input.testPressed===true;
  const cbClosed=input.breakers?.[CB_ID]!==false;
  const liveBus=input.buses?.main2;
  const busMain2=input.trainingPower===true||liveBus===true;
  // On the ground the spring-loaded test contact is the heater demand.
  // In flight the normal PITOT STATIC HEAT A selection requests heating.
  const heaterRequested=groundKnown&&(onGround?testPressed:pitotAOn);
  const heaterPower=heaterRequested&&busMain2&&cbClosed&&!state.faults.HEATER_FAIL;
  const heatVerified=heaterPower&&!state.faults.CURRENT_SENSE_FAIL;
  // Amber indicates the related temperature probe is not verified heated.
  // The indicator is modelled separately from the heater supply: MRG does
  // not substantiate its exact electrical feeder.
  const amberOn=state.faults.INDICATOR_STUCK_ON?true:
   state.faults.INDICATOR_STUCK_OFF?false:!heatVerified;
  return {
   onGround:groundKnown?onGround:null,groundKnown,pitotAOn,testPressed,
   cbId:CB_ID,cbClosed,main2Present:busMain2,liveMain2:liveBus===true?true:liveBus===false?false:null,
   trainingPower:input.trainingPower===true,heaterRequested,heaterPower,heatVerified,amberOn,
   faults:{...state.faults},testEligible:groundKnown&&onGround,
   status:!groundKnown?'GROUND/AIR STATUS UNKNOWN':
    testPressed&&!onGround?'TAT GROUND TEST INHIBITED IN FLIGHT':
    heaterRequested&&!busMain2?'MAIN BUS 2 UNPOWERED':
    heaterRequested&&!cbClosed?'TEMP PROBE CB P18-3 C5 PULLED':
    heaterRequested&&state.faults.HEATER_FAIL?'HEATER FAILED':
    heaterPower&&state.faults.CURRENT_SENSE_FAIL?'CURRENT DETECTOR FAILED':
    heaterPower?'HEATER POWERED / TEMP PROBE LAMP OFF':
    'TAT PROBE HEAT NOT REQUESTED'
  };
 }
 return Object.freeze({CB_ID,FAULTS,initialState,injectFault,evaluate});
});
