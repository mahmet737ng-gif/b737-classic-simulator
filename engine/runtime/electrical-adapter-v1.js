/* Source-gated Electrical V7 and Loads V8: exactly one Electrical runtime state owner.
 * Engine/APU running signals are SCENARIO inputs until their upstream owner is integrated.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737RuntimeElectricalAdapterV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const COCKPIT=new Set(['batterySwitch','busTransferAuto','groundServiceSelected','standbySelector']);
 const SCENARIO=new Set(['onGround','groundPowerAttached','groundPowerQualityGood','apuRunning','engine1Running','engine2Running','glideslopeCaptured']);
 function create(Electrical,Loads){
  if(!Electrical?.initialState||!Electrical?.apply||!Electrical?.evaluate||!Loads?.project)throw Error('Electrical V7 and Loads V8 required');
  return Object.freeze({
   id:'electrical',owns:['electrical','electricalLoads'],dependsOn:[],
   initialState:()=>Electrical.initialState(),
   apply(state,c){
    const a=c.action;
    if(a.type==='CONTROL'){
     if(!(c.actor==='COCKPIT'&&COCKPIT.has(a.key))&&!(c.actor==='SCENARIO'&&SCENARIO.has(a.key)))
      throw Error('Electrical control forbidden for actor/key');
     return Electrical.apply(state,a);
    }
    if(a.type==='SELECT_SOURCE'){
     if(c.actor!=='COCKPIT')throw Error('Only physical cockpit selects electrical source');
     return Electrical.apply(state,a);
    }
    if(a.type==='FAULT'){
     if(c.actor!=='INSTRUCTOR'||a.instructor!==true)throw Error('Instructor-only electrical fault');
     return Electrical.apply(state,a);
    }
    throw Error('Electrical action not allowed');
   },
   project(state){
    const electrical=Electrical.evaluate(state);
    return {electrical,loads:Loads.project(electrical),authority:'ELECTRICAL_V7',accuracy:'TRAINER_SOURCE_GATED'};
   }
  });
 }
 return Object.freeze({create,COCKPIT_KEYS:[...COCKPIT],SCENARIO_KEYS:[...SCENARIO]});
});
