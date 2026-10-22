'use strict';
/** ISN-08 deterministic QA fault scenarios. Training inputs, not sourced
 * auto-generated thermodynamics or simulated airframe hardware failures.
 */
const A=(type,rest={})=>({type,...rest});
const startApu=[
 A('ENTER_COLD_DARK'),
 A('SET_APU_SWITCH',{value:'START'}),
 A('SET_APU_INLET_OPEN',{value:true}),
 A('CONFIRM_APU_READY')
];
const powered=[
 ...startApu,
 A('SET_GENERATOR_SOURCE',{bus:'bus1',value:'APU'}),
 A('SET_GENERATOR_SOURCE',{bus:'bus2',value:'APU'})
];
const scenarios=Object.freeze({
 'APU_LOW_OIL':[...startApu,
  A('SET_APU_PROTECTION_SIGNAL',{fault:'LOW_OIL_PRESSURE',value:true})],
 'APU_OVERSPEED':[...startApu,
  A('SET_APU_PROTECTION_SIGNAL',{fault:'OVERSPEED',value:true})],
 'APU_FIRE':[...startApu,
  A('SET_APU_PROTECTION_SIGNAL',{fault:'FIRE',value:true})],
 'APU_FCU_FAILURE':[...startApu,
  A('SET_APU_PROTECTION_SIGNAL',{fault:'FCU_FAILURE',value:true})],
 'BLEED_TRIP_1':[...powered,
  A('SET_BLEED_TRIP_CONDITION',{engine:1,value:true})],
 'ABORTED_START_2':[...powered,
  A('SET_APU_BLEED',{value:true}),
  A('SET_DUCT_PSI',{value:35}),
  A('SET_FUEL_PUMP_SWITCH',{pump:'MAIN2_AFT',value:true}),
  A('SET_ENGINE_START_SWITCH',{engine:2,value:'GRD'}),
  A('SET_ENGINE_N1_ROTATION',{engine:2,value:true}),
  A('SET_ENGINE_N2',{engine:2,value:25}),
  A('SET_ENGINE_START_LEVER',{engine:2,value:'IDLE'}),
  A('SET_ENGINE_EGT_C',{engine:2,value:725})],
 'ENGINE_FIRE_1':[...powered,
  A('SET_FIRE_LOOP',{loop:'A',field:'fire',value:true}),
  A('SET_FIRE_LOOP',{loop:'B',field:'fire',value:true})]
});
function trainingScenarioActions(id){
 if(!Object.prototype.hasOwnProperty.call(scenarios,id))
   throw new TypeError('Unknown training scenario');
 return JSON.parse(JSON.stringify(scenarios[id]));
}
module.exports={TRAINING_SCENARIO_IDS:Object.keys(scenarios),trainingScenarioActions};
