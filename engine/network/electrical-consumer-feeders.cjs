'use strict';
/** FCOM-backed electrical consumer feeder assessment: no invented WDM pinouts.
 * FCOM 6.20.18-19 PDF 1167-68 and §6.20.3-4 PDF 1152-53.
 */
const SOURCE='FCOM-SEPEHRAN-1937';
const loads=[
 ['FUEL.MAIN1_FWD','FUEL.TANK1_FORWARD_PUMP','FUEL',1,1167],
 ['FUEL.CTR_RIGHT','FUEL.CENTER_RIGHT_PUMP','FUEL',1,1167],
 ['HYD.B_ELECTRIC','HYD.SYSTEM_B_ELECTRIC_PUMP','HYD',1,1167],
 ['FUEL.MAIN2_FWD','FUEL.TANK2_FORWARD_PUMP','FUEL',2,1168],
 ['FUEL.CTR_LEFT','FUEL.CENTER_LEFT_PUMP','FUEL',2,1168],
 ['HYD.A_ELECTRIC','HYD.SYSTEM_A_ELECTRIC_PUMP','HYD',2,1168],
 ['FUEL.MAIN1_AFT',null,'FUEL',null,null],
 ['FUEL.MAIN2_AFT',null,'FUEL',null,null]
];
function evaluateConsumerFeederMap(e) {
 if(!e||!e.buses||!Array.isArray(e.crossSystemEffects)) throw new TypeError('electrical output required');
 const mapped={};
 for(const [id,original,category,lossSide,page] of loads) {
  const failure=e.crossSystemEffects.find(x=>x.id===original);
  let state='UNKNOWN',basis='PHYSICAL_FEEDER_BUS_UNVERIFIED';
  if(failure){state='UNPOWERED';basis='FCOM_INOPERATIVE_LIST';}
  else if(e.buses.generator1==='POWERED' && e.buses.generator2==='POWERED'){
    state='POWERED';basis='BOTH_GENERATOR_BUSES_POWERED_NOMINAL_PILOT';
  }else if(e.buses.generator1==='UNPOWERED' && e.buses.generator2==='UNPOWERED'){
    state='UNPOWERED';basis='BOTH_GENERATOR_BUSES_UNPOWERED';
  }else if(e.documentedFailureCase) {
    state='POWERED';basis='NOT_LISTED_AS_INOPERATIVE_FCOM_CASE_PROVISIONAL';
  }
  mapped[id]={
   id,category,state,basis,physicalFeederBus:null,
   exactContactorPath:null,wireAndCircuitBreaker:'UNVERIFIED',
   source:{sourceId:SOURCE,section:page===1167?'6.20.18':page===1168?'6.20.19':'6.20.3-4',pdfPage:page||1153},
   caseApplicable:e.documentedFailureCase!==null,
   mustNotInfer:'Generator failure equipment list is not a WDM wiring diagram'
  };
 }
 return {status:'FUNCTIONAL_SOURCE_GROUNDED_NOT_WDM_VERIFIED',consumers:mapped,
   transferRelays:{left:{bus:e.buses.transfer1Feed,qualifier:'FCOM_6.20.3-4'},
    right:{bus:e.buses.transfer2Feed,qualifier:'FCOM_6.20.3-4'}},
   groundRules:['AC sources cannot parallel','Source selection replaces previous generator-bus source'],
   unresolved:['actual pump supply feeder and contactor IDs','CB/relay topology','source switching transients']};
}
module.exports={evaluateConsumerFeederMap};
