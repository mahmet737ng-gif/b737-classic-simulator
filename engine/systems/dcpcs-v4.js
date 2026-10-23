/* B737 Classic DCPCS systems/procedure trainer v4 — source-linked discrete logic.
 * Private DB: FCOM Sepehran 2.10.14-16 (pages 995-997), 2.40.1-11
 * (pages 1014-1024) and 15.20 Cabin Altitude warning.
 * DOES NOT simulate actual cabin pressure dynamics, physical valve rates or wiring.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737DCPCSV4=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const SOURCES=Object.freeze({indicators:'FCOM 2.10.14-16 / DB 995-997',controllers:'FCOM 2.40.1-2,7,9 / DB 1014-1015,1020,1022',manual:'FCOM 2.40.11 / DB 1024',relief:'FCOM 2.40.1 / DB 1014',horn:'FCOM 15.20 / source-indexed WarningEngine'});
 const FAULTS=Object.freeze(['controller1Fault','controller2Fault','outflowControlFault','pressureSensorInvalid','altitudeSensorInvalid','rateSensorInvalid']);
 const INPUT_TYPES=Object.freeze({onGround:'boolean',taxiIn:'boolean',dcPowerAvailable:'boolean',engineN1Pct:'number',engineN2Pct:'number',cabinAltitudeFt:'number',cabinRateFtMin:'number',cabinDifferentialPsid:'number',airplaneAltitudeFt:'number',flightAltitudeFt:'number',landingAltitudeFt:'number',controllerNotResponding:'boolean',descentBeforeCruise:'boolean'});
 const LIMITS=Object.freeze({prepressN1GreaterThan:60,prepressN2GreaterThan:89,prepressHoldMs:1500,taxiOpenN1LessThan:50,autoFailDiffGreaterThan:8.30,autoFailRateAbsGreaterThan:2000,autoFailCabinAltitudeGreaterThan:15800,mechanicalReliefPsid:8.65,maxSelectedFlightAltitudeFt:37000,cruiseLimitBelowEqual28000Psid:7.45,cruiseLimitAbove28000Psid:7.80,manualFullTravelIllustrativeMs:20000});
 const clone=v=>JSON.parse(JSON.stringify(v));
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 function initial(){return {schema:'b737-dcpcs/4',seq:0,clockMs:0,selector:'AUTO',manualCommand:'NEUTRAL',flightNumber:0,primary:1,autoFailLatched:false,acknowledged:false,prepressQualifiedSince:null,manualValveFraction:1,events:[],faults:Object.fromEntries(FAULTS.map(f=>[f,false])),input:{onGround:true,taxiIn:false,dcPowerAvailable:true,engineN1Pct:25,engineN2Pct:70,cabinAltitudeFt:0,cabinRateFtMin:0,cabinDifferentialPsid:0,airplaneAltitudeFt:0,flightAltitudeFt:28000,landingAltitudeFt:0,controllerNotResponding:false,descentBeforeCruise:false}};}
 function validateInput(k,v){if(!(k in INPUT_TYPES))throw Error('Unknown DCPCS input '+k);if(INPUT_TYPES[k]==='boolean'&&typeof v!=='boolean')throw Error('Expected Boolean for '+k);if(INPUT_TYPES[k]==='number'&&!finite(v))throw Error('Expected finite number for '+k);if((k==='flightAltitudeFt'&&(v < -1000||v>37000||v%500!==0))||(k==='landingAltitudeFt'&&(v < -1000||v>14000||v%50!==0)))throw Error('FCOM selector range/increment not met');}
 function apply(state,cmd){if(!state||state.schema!=='b737-dcpcs/4'||!cmd||typeof cmd.type!=='string')throw Error('Invalid DCPCS state/command');if(cmd.type==='RESET')return initial();const s=clone(state),i=s.input;
  switch(cmd.type){
   case 'INPUT':validateInput(cmd.key,cmd.value);i[cmd.key]=cmd.value;break;
   case 'MODE':if(!['AUTO','ALTN','MAN'].includes(cmd.value))throw Error('Invalid DCPCS mode');s.selector=cmd.value;if(cmd.value==='ALTN'&&s.autoFailLatched)s.acknowledged=true;if(cmd.value==='AUTO')s.acknowledged=false;break;
   case 'MANUAL_SWITCH':if(!['OPEN','CLOSE','NEUTRAL'].includes(cmd.value))throw Error('Invalid manual valve switch');s.manualCommand=cmd.value;break;
   case 'FAULT':if(!FAULTS.includes(cmd.id)||typeof cmd.active!=='boolean'||cmd.instructor!==true)throw Error('Instructor-only fault expected');s.faults[cmd.id]=cmd.active;break;
   case 'NEW_FLIGHT':s.flightNumber++;s.primary=s.primary===1?2:1;s.prepressQualifiedSince=null;s.autoFailLatched=false;s.acknowledged=false;s.selector='AUTO';s.manualCommand='NEUTRAL';break;
   case 'ADVANCE':if(!Number.isInteger(cmd.ms)||cmd.ms<0||cmd.ms>600000)throw Error('Invalid time delta');s.clockMs+=cmd.ms;break;
   default:throw Error('Unsupported DCPCS command '+cmd.type);
  }
  const qualified=i.onGround&&i.engineN1Pct>LIMITS.prepressN1GreaterThan&&i.engineN2Pct>LIMITS.prepressN2GreaterThan;
  if(!qualified)s.prepressQualifiedSince=null;else if(s.prepressQualifiedSince===null)s.prepressQualifiedSince=s.clockMs;
  // Instructor model uses explicit power/health inputs; not an inferred DC bus connection.
  const abnormalities=i.controllerNotResponding&&((!s.faults.pressureSensorInvalid&&i.cabinDifferentialPsid>8.30)||(!s.faults.rateSensorInvalid&&Math.abs(i.cabinRateFtMin)>2000)||(!s.faults.altitudeSensorInvalid&&i.cabinAltitudeFt>15800));
  const activeFault=s.faults['controller'+s.primary+'Fault'];
  if(s.selector!=='MAN'&&(!i.dcPowerAvailable||s.faults.outflowControlFault||abnormalities||activeFault))s.autoFailLatched=true;
  if(s.selector==='MAN'&&s.manualCommand!=='NEUTRAL'&&i.dcPowerAvailable&&!s.faults.outflowControlFault&&cmd.type==='ADVANCE'){
    // Deliberate trainer approximation: fixed upper-bound full travel, not a measured installed speed.
    const dx=cmd.ms/LIMITS.manualFullTravelIllustrativeMs*(s.manualCommand==='OPEN'?1:-1);
    s.manualValveFraction=Math.max(0,Math.min(1,s.manualValveFraction+dx));
  }
  s.seq++;s.events.push({seq:s.seq,atMs:s.clockMs,command:clone(cmd)});if(s.events.length>500)s.events.shift();return s;
 }
 function derive(s){if(!s||s.schema!=='b737-dcpcs/4')throw Error('Invalid DCPCS state');const i=s.input,f=s.faults,nominal=s.primary,other=nominal===1?2:1;
  const health={1:i.dcPowerAvailable&&!f.controller1Fault&&!f.outflowControlFault,2:i.dcPowerAvailable&&!f.controller2Fault&&!f.outflowControlFault};
  const thresholdProblem=i.controllerNotResponding&&((!f.pressureSensorInvalid&&i.cabinDifferentialPsid>8.30)||(!f.rateSensorInvalid&&Math.abs(i.cabinRateFtMin)>2000)||(!f.altitudeSensorInvalid&&i.cabinAltitudeFt>15800));
  const currentIsFailed=!health[nominal]||thresholdProblem;
  const autoTransferNeeded=s.autoFailLatched||currentIsFailed;
  const manual=s.selector==='MAN';
  let channel=manual?null:s.selector==='ALTN'?other:autoTransferNeeded?other:nominal;
  const channelHealthy=channel!==null&&health[channel]&&!(thresholdProblem&&channel===nominal);
  if(!channelHealthy)channel=null;
  const operatingMode=manual?'MAN':channel===null?'NO_AUTO_CONTROL':(channel===nominal?'AUTO':'ALTN');
  const autoFail= !manual && (autoTransferNeeded||!health[nominal]||!health[other]) && !(s.selector==='ALTN'&&channel!==null&&s.acknowledged);
  const altn= !manual && channel===other;
  const prepress=i.onGround&&i.engineN1Pct>60&&i.engineN2Pct>89&&s.prepressQualifiedSince!==null&&s.clockMs-s.prepressQualifiedSince>=1500;
  let outflow='UNDETERMINED_NO_PRESSURE_PHYSICS';
  if(manual)outflow=i.dcPowerAvailable&&!f.outflowControlFault?(s.manualCommand==='NEUTRAL'?'HOLD':s.manualCommand):'NO_DRIVE_AVAILABLE';
  else if(channel===null)outflow='NO_AUTO_COMMAND';
  else if(i.onGround)outflow=prepress?'MODULATE_TOWARD_CLOSED':(i.taxiIn&&i.engineN1Pct<50?'SLOWLY_OPEN_FULL':'DRIVE_FULL_OPEN_LOW_POWER');
  else outflow='AUTO_RATE_CONTROL_NO_NUMERIC_SCHEDULE';
  const detected={powerLoss:!i.dcPowerAvailable,controller1:f.controller1Fault,controller2:f.controller2Fault,outflowControl:f.outflowControlFault,controllerNotResponding:i.controllerNotResponding,
   differentialHigh:i.cabinDifferentialPsid>8.30,rateHigh:Math.abs(i.cabinRateFtMin)>2000,cabinAltitudeHigh:i.cabinAltitudeFt>15800,
   triggerByQualifiedAbnormality:thresholdProblem};
  return {clockMs:s.clockMs,selectedMode:s.selector,operatingMode,primary:nominal,activeController:channel,controllerHealthy:health,
   lamps:{autoFail,altn,manual,offSchedDescent:i.descentBeforeCruise},detected,
   prepressQualified:prepress,outflowCommand:outflow,manualValveFraction:s.manualValveFraction,
   relief:{limitPsid:8.65,aboveMechanicalReliefThreshold:i.cabinDifferentialPsid>8.65,mechanicalNotSoftwareControlled:true},
   maxCruiseDifferentialPsid:i.flightAltitudeFt<=28000?7.45:7.80,
   cabinHornSensorFt:i.cabinAltitudeFt,
   statuses:{pressureDynamics:'NOT_MODELED',manualTravel:'ILLUSTRATIVE_UPPER_BOUND_20S',dcPowerFeed:'EXPLICIT_TRAINER_INPUT_BUS_NOT_VERIFIED',engineSignals:'AGGREGATE_CHANNEL_UNKNOWN',sensorFaultHandling:'SOURCE_UNKNOWN_TRAINER_PROJECTION',dualControllerFailure:'AUTO_FAIL_ALONE_WHEN_NO_ALTN',source:SOURCES}};
 }
 function replay(commands){let s=initial();for(const c of commands)s=apply(s,c);return s;}
 return Object.freeze({SOURCES,FAULTS,INPUT_TYPES,LIMITS,initial,apply,derive,replay});
});