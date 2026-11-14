/* B737 Classic Stall Warning Computer - source-grounded instructor training slice.
 * References: Sepehran FCOM 15.20.7/1911, 15.10.3/1880,
 * 10.40.5/1404, 10.40.7/1406, 10.40.8/1407, 2.40.4/1017.
 * No AoA-to-stall law inferred; no hardware wiring/tail effectivity asserted.
 */
(function(root,factory){'use strict'; const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737StallWarningV3=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const refs=Object.freeze({flight:'FCOM 15.20.7 / DB page 1911',test:'FCOM 15.10.3 / DB page 1880',
 pitch:'FCOM 10.40.5 / DB page 1404',speed:'FCOM 10.40.7-8 / DB pages 1406-1407',dcpcs:'FCOM 2.40.4 / DB page 1017'});
 const FAULTS=Object.freeze(['computer1Failed','computer2Failed','aoaInput1Invalid','aoaInput2Invalid','adcInput1Invalid','adcInput2Invalid']);
 function clone(x){return JSON.parse(JSON.stringify(x));}
 function initialState(){return {schema:'b737-stall-trainer/3',seq:0,
   tests:{1:false,2:false},instructorDemand:{1:null,2:null},
   faults:Object.fromEntries(FAULTS.map(x=>[x,false])),events:[]};}
 function apply(s,command){if(!s||s.schema!=='b737-stall-trainer/3')throw Error('Invalid stall training state');
  if(!command||typeof command.type!=='string')throw Error('Command required');
  if(command.type==='RESET')return initialState();
  const n=clone(s);const side=Number(command.channel);
  if(command.type==='TEST'){if(![1,2].includes(side)||typeof command.pressed!=='boolean')throw Error('Invalid test channel/pressed');n.tests[side]=command.pressed;}
  else if(command.type==='INSTRUCTOR_DEMAND'){
    if(![1,2].includes(side)||![true,false,null].includes(command.active)||command.instructor!==true)throw Error('Instructor-only stall envelope input required');
    n.instructorDemand[side]=command.active;
  } else if(command.type==='FAULT'){
    if(!FAULTS.includes(command.id)||typeof command.active!=='boolean'||command.instructor!==true)throw Error('Instructor-only listed fault required');
    n.faults[command.id]=command.active;
  } else throw Error('Unsupported stall command');
  n.seq++;n.events.push({seq:n.seq,command:clone(command)});if(n.events.length>400)n.events.shift();return n;
 }
 function evaluate(s,input){if(!s||s.schema!=='b737-stall-trainer/3')throw Error('Invalid state');
  if(!input||typeof input.onGround!=='boolean'||typeof input.ac115Available!=='boolean')throw Error('Explicit onGround/ac115Available required');
  const onGround=input.onGround,flaps=typeof input.flaps==='number'&&Number.isFinite(input.flaps)?input.flaps:null;
  const channel={};let anyTest=false,anyFlight=false;const activeChannels=[],unknownChannels=[];
  for(const i of [1,2]){
    const failed=s.faults['computer'+i+'Failed'];
    const invalidInput=s.faults['aoaInput'+i+'Invalid']||s.faults['adcInput'+i+'Invalid'];
    // The FCOM confirms test prerequisites and channel association, but does not
    // define the response to internal computer failure or loss of individual inputs.
    // Suppressing simulated output on injected failures is TRAINER POLICY.
    const testEligible=onGround&&input.ac115Available;
    const testAttempted=Boolean(s.tests[i]);
    const tested=testEligible&&testAttempted&&!failed;
    const demand=s.instructorDemand[i];
    const flightOutput=onGround?false:failed?null:invalidInput?null:demand;
    const drive=onGround?tested:flightOutput===true;
    if(tested)anyTest=true;
    if(!onGround&&flightOutput===true)anyFlight=true;
    if(!onGround&&flightOutput===null)unknownChannels.push(i);
    if(drive)activeChannels.push(i);
    channel[i]={failed,invalidInput,testAttempted,testEligible,testPassedSimulation:tested,
      flightDemand:flightOutput,shakerMotorCommand:drive,
      label:failed?'TRAINING_FAULT_SUPPRESSED':invalidInput?'INPUT_INVALID_OUTPUT_UNKNOWN':
        onGround?'GROUND_TEST_ONLY':demand===null?'NO_STALL_ENVELOPE_LAW':'INSTRUCTOR_DEMAND'};
  }
  return {schema:'b737-stall-output/3',sourceRefs:refs,armedInFlight:!onGround,
    channel,activeChannels,unknownChannels,
    physical:{captainShakerMotor:channel[1].shakerMotorCommand,firstOfficerShakerMotor:channel[2].shakerMotorCommand,
      bothColumnsVibrate:activeChannels.length>0,groundTestActive:anyTest,flightShakerRequested:anyFlight},
    // These outputs exist functionally; numerical data/channel selection unavailable.
    efis:{pitchLimitSymbolVisible:flaps===null?null:flaps>0,
      pitchLimitValueDeg:null,stickShakerSpeedKt:null,minimumFlapRetractionSpeedKt:null,
      flapsUpManeuverSpeedEligible:flaps===null?null:flaps>0?false:input.fmcGrossWeightAvailable===null?null:input.fmcGrossWeightAvailable===true,
      highSpeedBuffetLimitKt:null},
    gpws:{windshearSignalValue:null,status:'OUTPUT_PATH_DOCUMENTED_ALGORITHM_UNKNOWN'},
    dcpcs:{engineN1Pct:Number.isFinite(input.engineN1Pct)?input.engineN1Pct:null,
      engineN2Pct:Number.isFinite(input.engineN2Pct)?input.engineN2Pct:null,
      signal:'FUNCTIONAL_LINK_DOCUMENTED_CHANNEL_OR_ENCODING_UNKNOWN'},
    qa:['STALL_ENVELOPE_NUMERIC_LAW_UNKNOWN','STALL_CHANNEL_FAULT_RESPONSE_IS_TRAINER_POLICY',
      '115VAC_TEST_FEED_NOT_MAPPED_TO_SPECIFIC_BUS','EFIS_GPWS_OUTPUT_VALUES_NOT_COMPUTED','DCPCS_LINK_ONLY_NO_CHANNEL_PIN_MAPPING']};
 }
 function replay(commands){return commands.reduce((s,c)=>apply(s,c),initialState());}
 return Object.freeze({refs,FAULTS,initialState,apply,evaluate,replay});
});