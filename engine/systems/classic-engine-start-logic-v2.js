/* B737 Classic start-panel logical diagnosis.
 * Pure read-only evidence of the existing ISN-03/18 ECU state.
 * Sources: FCOM 7.10.22/25/29, 7.20.7-9, NP.21.33-35;
 * MRG IV.6/IV.7; LAN ATA74/80 (functional training, not EP-FSI WDM).
 * The physical OH switches and pedals own input; never silently move them.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicEngineStartLogicV2=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const REF=Object.freeze({
  startSwitch:'FCOM 7.10.22/7.20.7, NP.21.33-35',
  ignition:'FCOM 7.20.8-9 / LAN ATA74',
  oil:'FCOM 7.20 / LAN ATA79',
  starter:'FCOM 7.20.7 / LAN ATA80',
  supply:'MRG IV.6/IV.7 and FCOM 6.20'
 });
 const faultPhases=new Set(['N2_STALLED','EARLY_STARTER_CUTOUT','NO_LIGHT_OFF',
  'HUNG_START','ABNORMAL_EGT','FLAMEOUT','FUEL_STARVATION','AWAIT_FUEL_CUTOFF']);
 const norm=v=>v===true?'ON':v===false?'OFF':'UNKNOWN';
 function project({chain,ecu,electrical}={}){
  if(!chain?.observations||!chain?.phase)throw Error('Actual ISN start observations required');
  const power=electrical?.bus||electrical||{},engines={};
  for(const side of [1,2]){
   const id='engine'+side,record=chain.observations[id];
   if(!record?.rules||!record?.feedback)throw Error('Start rule observation missing for '+id);
   const r=record.rules,fb=record.feedback;
   const v=key=>fb[key]?.value??null;
   const n2=v('n2Percent'),egt=v('egtC');
   const starter=r.starter||{},ignition=r.ignition||{},fuel=r.fuel||{};
   const selection=r.startSwitch??chain.controls?.['engine-start-'+side]??null;
   const ignitionSelector=ignition.selector??chain.controls?.['ignition-source']??null;
   const air=starter.motorDrivePossible;
   const battery=power.battery;
   const running=chain.phase[id]==='RUNNING';
   const ignitionDemand=ignition.demand||{},ignitionEligible=ignition.supplyEligible||{};
   // A start valve command, a physically open valve and starter motoring
   // are different facts. This avoids false START VALVE OPEN on command alone.
   const actualValve=v('startValveOpen');
   const fuelLever=v('fuelStartLever');
   const failed=faultPhases.has(chain.phase[id]);
   const caution=[];
   if(failed)caution.push(chain.phase[id]);
   if(selection==='GRD'&&battery===false)caution.push('NO_BATTERY_BUS');
   if(selection==='GRD'&&air===false)caution.push('START_AIR_NOT_PROVEN');
   if(fuelLever==='IDLE'&&ignitionDemand.left===true&&ignitionEligible.left===false&&
      ignitionDemand.right===true&&ignitionEligible.right===false)caution.push('IGNITION_POWER_UNAVAILABLE');
   if(chain.phase[id]==='ABNORMAL_EGT'||(Number.isFinite(egt)&&r.advisory?.egt725Criterion===true))
    caution.push('ABNORMAL_START_EGT_ADVISORY');
   if(chain.phase[id]==='FLAMEOUT'||chain.phase[id]==='FUEL_STARVATION')
    caution.push('ENGINE_NOT_RUNNING_FUEL_INTERRUPTED');
   const nextFuelLeverAllowed=fuel.recommendMovingLeverToIdle===true;
   engines[id]={
    phase:chain.phase[id],startSwitch:selection,ignitionSelector,
    batteryBus:norm(battery),acTransfer1:norm(power.transfer1),
    acTransfer2:norm(power.transfer2),acStandby:norm(power.acStandby),
    starterValveCommand:norm(starter.startValveOpenCommand),
    starterValveObserved:norm(actualValve),
    starterMotorPossible:norm(air),starterEngaged:norm(v('starterEngaged')),
    ignitionLeftDemand:norm(ignitionDemand.left),
    ignitionRightDemand:norm(ignitionDemand.right),
    ignitionLeftEligible:norm(ignitionEligible.left),
    ignitionRightEligible:norm(ignitionEligible.right),
    ignitionObserved:norm(v('ignitionEnergized')),
    fuelLever,fuelValveCommand:norm(fuel.wingFuelValveOpenCommand),
    fuelFlowKgHr:v('fuelFlowKgHr'),n2Percent:n2,egtC:egt,
    n1RotationObserved:norm(v('n1RotationObserved')),
    atFuelEntryCriterion:nextFuelLeverAllowed?'YES':fuel.recommendMovingLeverToIdle===false?'NO':'UNKNOWN',
    approxStarterCutout:starter.cutoutAtApprox46N2===true,
    startWindow:!!r.groundStartWindow,
    startAdvisoryLatched:r.advisory?.egt725Latched===true,
    warnings:[...new Set(caution)],
    status:failed?'ABNORMAL':running?'RUNNING':chain.phase[id]==='OFF'?'STOPPED':'IN_PROGRESS',
    quality:'SOURCE_LINKED_DISCRETE_AND_TRAINING_SIMULATION',
    source:REF
   };
  }
  return {
   schema:'b737classic.engine-start-panel-logical-diagnostics/2',
   engines,apu:{phase:chain.phase.apu||'UNKNOWN',bleedValve: norm(chain.bleed?.apuBleedValveOpen),
    running:norm(chain.sources?.apu?.running)},
   sharedPower:{battery:norm(power.battery),dcStandby:norm(power.dcStandby),
    acStandby:norm(power.acStandby)},
   electricalOwner:'EXISTING_ELECTRICAL_V7',ecuOwner:'EXISTING_ISN_18',
   limits:['NO_EPFSI_WDM_VERIFICATION','FLIGHT_RESTART_AND_EXTERNAL_AIR_NOT_FULLY_MODELLED',
    'DO_NOT_USE_FOR_AIRCRAFT_OPERATION'],source:REF
  };
 }
 return Object.freeze({REF,project});
});
