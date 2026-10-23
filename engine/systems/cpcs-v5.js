/* B737 Classic CPCS training module v5 (NOT DCPCS / EP-FSI installation).
 * Source-indexed FCOM 2.10.11-13, 2.40.1-2, .3, .5-.8, .10.
 * No undocumented relay/wiring, cabin physics or valve motion timings.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737CPCSV5=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const SOURCE={configuration:'FCOM 2.40.1 / DB page 1014 (CPCS listed for FSA, FSB, FSF, FSK, FSG, FST, FSE; FSI uses DCPCS)',control:'FCOM 2.10.11-13 / DB pages 992-994',sensors:'FCOM 2.40.1-3 / DB pages 1014-1016',automatic:'FCOM 2.40.6-8 / DB pages 1019-1021',standby:'FCOM 2.40.10 / DB page 1023',outflow:'FCOM 2.40.5 / DB page 1018',cabinHorn:'FCOM 2.10.11 / DB page 992'};
 const FAULTS=Object.freeze(['autoControllerFailed','standbyControllerFailed','autoAcPowerFailed','manualAcMotorFailed','dcMotorFailed','valveMechanismFailed','airGroundSensorInvalid','cabinSenseInvalid']);
 const INPUT_TYPES=Object.freeze({onGround:'boolean',acPowerAvailable:'boolean',dcPowerAvailable:'boolean',airplaneAltitudeFt:'number',cabinAltitudeFt:'number',cabinRateFtMin:'number',differentialPsid:'number',baroCaptainInHg:'number',baroFirstOfficerInHg:'number',recircFanOn:'boolean',mainOutflowNearlyClosed:'boolean',ambientPressureExceedsCabin:'boolean',bleedAirAvailable:'boolean',stallManagementSignalPresent:'boolean',offScheduleDescent:'boolean'});
 const LIMITS=Object.freeze({autoFailRateFtMin:1890,autoFailCabinAltitudeFt:13875,reliefPsid:8.65,flowValvePsid:2.5,standbyRatesFtMin:{DECR:50,INDEX:300,INCR:2000},groundFlightPressurizationOffsetFt:-200});
 const deepcopy=x=>JSON.parse(JSON.stringify(x));const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);const validNumber=x=>typeof x==='number'&&Number.isFinite(x);
 function initial(){return {schema:'b737-cpcs/5',seq:0,clockMs:0,selectedMode:'AUTO',flightGround:'GRD',valveSwitch:'NEUTRAL',cabinRate:'INDEX',autoFailTriggered:false,events:[],faults:Object.fromEntries(FAULTS.map(x=>[x,false])),settings:{flightAltitudeFt:28000,landingAltitudeFt:0,standbyCabinAltitudeFt:0},inputs:{onGround:true,acPowerAvailable:true,dcPowerAvailable:true,airplaneAltitudeFt:0,cabinAltitudeFt:0,cabinRateFtMin:0,differentialPsid:0,baroCaptainInHg:29.92,baroFirstOfficerInHg:29.92,recircFanOn:false,mainOutflowNearlyClosed:false,ambientPressureExceedsCabin:false,bleedAirAvailable:true,stallManagementSignalPresent:true,offScheduleDescent:false}};}
 function validate(s){if(!s||s.schema!=='b737-cpcs/5'||!s.settings||!s.inputs||!s.faults||!Array.isArray(s.events))throw Error('Invalid CPCS state')}
 function faultsAndSignals(s){const i=s.inputs,f=s.faults;const causes={autoAcPowerLoss:!i.acPowerAvailable||f.autoAcPowerFailed,excessiveCabinRate:Math.abs(i.cabinRateFtMin)>LIMITS.autoFailRateFtMin,highCabinAltitude:i.cabinAltitudeFt>LIMITS.autoFailCabinAltitudeFt,autoControllerFailed:f.autoControllerFailed};return {causes,anyAutoFailure:Object.values(causes).some(Boolean)};}
 function apply(state,command){validate(state);if(!command||typeof command.type!=='string')throw Error('Invalid CPCS command');if(command.type==='RESET')return initial();const s=deepcopy(state);switch(command.type){
 case 'MODE':if(!['AUTO','STBY','MAN_AC','MAN_DC'].includes(command.value))throw Error('Invalid CPCS selector mode');s.selectedMode=command.value;if(command.value==='STBY')s.autoFailTriggered=false;break;
 case 'AUTO_CHECK':if(command.pressed!==true)throw Error('CHECK is a momentary test request');if(s.selectedMode!=='AUTO')throw Error('AUTO CHECK only modeled with selector in AUTO');s.events.push({seq:s.seq+1,atMs:s.clockMs,command:{type:'AUTO_CHECK',pressed:true},policy:'CHECK_FUNCTION_NOT_SOURCE_SPECIFIED'});s.seq++;return s;
 case 'FLIGHT_GROUND':if(!['FLT','GRD'].includes(command.value))throw Error('Invalid FLT/GRD setting');s.flightGround=command.value;break;
 case 'VALVE_SWITCH':if(!['OPEN','CLOSE','NEUTRAL'].includes(command.value))throw Error('Invalid outflow switch');s.valveSwitch=command.value;break;
 case 'CABIN_RATE':if(!['DECR','INDEX','INCR'].includes(command.value))throw Error('Invalid cabin rate');s.cabinRate=command.value;break;
 case 'ALTITUDE':if(!['flightAltitudeFt','landingAltitudeFt','standbyCabinAltitudeFt'].includes(command.key)||!validNumber(command.value))throw Error('Invalid altitude setting');s.settings[command.key]=command.value;break;
 case 'INPUT':if(!own(INPUT_TYPES,command.key)||typeof command.value!==INPUT_TYPES[command.key]||(INPUT_TYPES[command.key]==='number'&&!validNumber(command.value)))throw Error('Invalid sourced sensor');s.inputs[command.key]=command.value;break;
 case 'FAULT':if(!FAULTS.includes(command.id)||typeof command.active!=='boolean'||command.instructor!==true)throw Error('Instructor-only CPCS fault');s.faults[command.id]=command.active;break;
 case 'ADVANCE':if(!Number.isInteger(command.ms)||command.ms<0||command.ms>600000)throw Error('Invalid elapsed time');s.clockMs+=command.ms;break;
 default:throw Error('Unknown CPCS command '+command.type);
 }
 const ff=faultsAndSignals(s);
 if(s.selectedMode==='AUTO'&&ff.anyAutoFailure)s.autoFailTriggered=true;
 s.seq++;s.events.push({seq:s.seq,atMs:s.clockMs,command:deepcopy(command)});if(s.events.length>400)s.events.shift();return s;
 }
 function derive(s){validate(s);const i=s.inputs,f=s.faults,ff=faultsAndSignals(s);const manuallySelected=s.selectedMode.startsWith('MAN_');
 const autoTrip=s.selectedMode==='AUTO'&&(s.autoFailTriggered||ff.anyAutoFailure);
 const operatingMode=manuallySelected?s.selectedMode:s.selectedMode==='STBY'||autoTrip?'STBY':'AUTO';
 const drive=operatingMode==='AUTO'?'AC':operatingMode==='STBY'?'DC':operatingMode==='MAN_AC'?'AC':'DC';
 const voltage=drive==='AC'?i.acPowerAvailable && (operatingMode==='AUTO'?!f.autoAcPowerFailed:!f.manualAcMotorFailed):i.dcPowerAvailable&&!f.dcMotorFailed;
 const controllerWorking=operatingMode==='AUTO'?!f.autoControllerFailed:operatingMode==='STBY'?!f.standbyControllerFailed:true;
 const actuationAvailable=voltage&&controllerWorking&&!f.valveMechanismFailed;
 const flightEffective=s.flightGround==='GRD'&&!i.onGround?'FLT':s.flightGround;
 let outflowCommand='HOLD_OR_UNDETERMINED';
 if(!actuationAvailable)outflowCommand='NO_ACTUATION_AVAILABLE';
 else if(manuallySelected)outflowCommand=s.valveSwitch;
 else if(flightEffective==='GRD')outflowCommand='DRIVE_FULL_OPEN';
 else if(i.onGround&&operatingMode==='STBY')outflowCommand='RATE_CONTROL_TO_SELECTED_CABIN_ALT';
 else if(i.onGround)outflowCommand='MODULATE_TOWARD_CLOSE_GROUND_PREPRESS';
 else if(operatingMode==='STBY')outflowCommand='RATE_CONTROL_TO_SELECTED_CABIN_ALT';
 else outflowCommand='AUTO_PRESSURE_SCHEDULE_NOT_NUMERICALLY_MODELED';
 const cabinTarget=operatingMode==='STBY'?s.settings.standbyCabinAltitudeFt:i.onGround&&flightEffective==='FLT'?i.airplaneAltitudeFt+LIMITS.groundFlightPressurizationOffsetFt:null;
 // AC-powered valve position indication is a *display*, not a physical position model.
 const valveIndicator=i.acPowerAvailable?'UNKNOWN_ACTUAL_POSITION':'FULL_LEFT_NO_AC';
 const fwdValveCloses=i.mainOutflowNearlyClosed||i.recircFanOn;
 const flowValveExhaust=i.onGround||i.differentialPsid<LIMITS.flowValvePsid;
 return {schema:'b737-cpcs-output/5',clockMs:s.clockMs,selectedMode:s.selectedMode,operatingMode,flightGroundRequested:s.flightGround,flightGroundEffective:flightEffective,standbyRateSelected:s.cabinRate,standbyRateTargetFtMin:LIMITS.standbyRatesFtMin[s.cabinRate],controller:{autoHealthy:!f.autoControllerFailed,standbyHealthy:!f.standbyControllerFailed,autoFailure:ff.causes,autoTrip,activeController:manuallySelected?'PILOT_MANUAL':operatingMode==='AUTO'?'AUTO_CONTROLLER':'STANDBY_CONTROLLER'},outflow:{drive,actuationAvailable,command:outflowCommand,manualSwitch:s.valveSwitch,display:valveIndicator,measuredPosition:'UNKNOWN',cabinTargetFt:cabinTarget},lamps:{autoFail:autoTrip,standby:operatingMode==='STBY',manual:manuallySelected,offSchedDescent:i.offScheduleDescent},relief:{positiveReliefAtLimit:i.differentialPsid>=LIMITS.reliefPsid,limitPsid:LIMITS.reliefPsid,negativeReliefRequired:i.ambientPressureExceedsCabin},airflow:{bleedAirAvailable:i.bleedAirAvailable,forwardValveClosedRequested:fwdValveCloses,flowValveExhaustRequested:flowValveExhaust},inputContract:{autoStaticPorts:'SOURCE_DESCRIBED_NOT_NUMERICALLY_INTERPRETED',standbyADC:'MIXED_CPCS_DCPCS_SECTION_NEEDS_VARIANT_QA',baroAuto:i.baroCaptainInHg,baroStby:i.baroFirstOfficerInHg,cabinSenseValid:!f.cabinSenseInvalid,airGroundSensorValid:!f.airGroundSensorInvalid,stallManagementComputerFunctionalSignal:i.stallManagementSignalPresent,stallManagementSignalPayload:'SOURCE_UNSPECIFIED'},cabAltitudeWarningSensorFt:i.cabinAltitudeFt,qa:{configuration:'CPCS_NOT_INSTALLED_ON_EP_FSI_FSI_DCPCS',physicalPressure:'NOT_CALCULATED',motorSpeed:'NOT_SOURCE_QUANTIFIED',valvePosition:'NOT_CALCULATED',faults:'INSTRUCTOR_TRAINING_FAULTS_NOT_HARDWARE_FAILURE_EFFECTS',autoCheck:'TEST_DETAILS_NOT_SOURCE_VERIFIED',source:SOURCE}};
 }
 function replay(commands){let s=initial();for(const cmd of commands)s=apply(s,cmd);return s;}
 return Object.freeze({SOURCE,FAULTS,INPUT_TYPES,LIMITS,initial,apply,derive,replay});
});