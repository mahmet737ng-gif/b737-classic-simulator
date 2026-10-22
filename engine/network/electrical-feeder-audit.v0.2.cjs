'use strict';
/**
 * Electrical functional feeder/effectivity audit v0.2.
 *
 * FCOM §6.20.1-4, PDF 1150-1153 documents bus topology/transfer.
 * FCOM §6.20.18-19, PDF 1167-1168 documents INOPERATIVE consumers
 * with GEN1 or GEN2 failed IN FLIGHT and transfer buses NORMAL.
 *
 * An INOPERATIVE list is NOT a Boeing WDM/SSM wiring diagram. The
 * corresponding contactor/CB/direct AC feeder is NOT inferred here.
 */
const SOURCE='FCOM-SEPEHRAN-1937';
const FEEDS=Object.freeze({
  'FUEL.MAIN1_FWD': {effect:'FUEL.TANK1_FORWARD_PUMP',genLost:'GEN1',pdfPage:1167},
  'FUEL.CTR_RIGHT': {effect:'FUEL.CENTER_RIGHT_PUMP',genLost:'GEN1',pdfPage:1167},
  'HYD.B_ELECTRIC': {effect:'HYD.SYSTEM_B_ELECTRIC_PUMP',genLost:'GEN1',pdfPage:1167},
  'FUEL.MAIN2_FWD': {effect:'FUEL.TANK2_FORWARD_PUMP',genLost:'GEN2',pdfPage:1168},
  'FUEL.CTR_LEFT': {effect:'FUEL.CENTER_LEFT_PUMP',genLost:'GEN2',pdfPage:1168},
  'HYD.A_ELECTRIC': {effect:'HYD.SYSTEM_A_ELECTRIC_PUMP',genLost:'GEN2',pdfPage:1168},
  'FUEL.MAIN1_AFT': {effect:null,genLost:null,pdfPage:null},
  'FUEL.MAIN2_AFT': {effect:null,genLost:null,pdfPage:null}
});
const VALID_SOURCE_IDS=Object.keys(FEEDS);
function evaluateFeeder(electrical,id) {
  if(!VALID_SOURCE_IDS.includes(id)) throw new TypeError('Unknown feeder consumer '+String(id));
  if(!electrical || !electrical.buses || !electrical.sourceAssignments ||
     !Array.isArray(electrical.crossSystemEffects))
    throw new TypeError('evaluateElectricalPower() result required');
  const rule=FEEDS[id], b=electrical.buses;
  const verifiedLoss=rule.effect &&
    electrical.crossSystemEffects.some(e=>e.id===rule.effect);
  const source=(rule.genLost ?
    {sourceId:SOURCE,pdfPage:rule.pdfPage,section:rule.genLost==='GEN1'?'6.20.18':'6.20.19'}:
    {sourceId:SOURCE,pdfPage:1153,section:'6.20.4'});
  const base={
    id, physicalFeeder:'UNVERIFIED_WDM_SSM_REQUIRED',
    circuitBreaker:'UNVERIFIED_WDM_SSM_REQUIRED',
    relay:'UNVERIFIED_WDM_SSM_REQUIRED',
    flightFaultCase:electrical.documentedFailureCase,source
  };
  if(verifiedLoss) return {...base,state:'UNPOWERED',
    basis:'FCOM_SPECIFIED_FAILED_LOAD_IN_NARROW_FLIGHT_CASE',
    functionalCertainty:'SOURCE_EQUIPMENT_LOSS_LIST'};
  if(b.generator1==='UNPOWERED' && b.generator2==='UNPOWERED')
    return {...base,state:'UNPOWERED',
      basis:'NO_MAIN_GENERATOR_AC_IN_MODEL',functionalCertainty:'FCOM_GENERAL_AC_PUMP_DEPENDENCY'};
  if(b.generator1==='POWERED' && b.generator2==='POWERED')
    return {...base,state:'POWERED',
      basis:'BOTH_GENERATOR_BUSES_LIVE_NORMAL_FIXTURE',
      functionalCertainty:'OPERATIONAL_TEST_FIXTURE_NOT_WIRING'};
  if(electrical.documentedFailureCase)
    return {...base,state:'POWERED',
      basis:'OTHER_CONSUMER_NOT_IN_FCOM_FAILED_LIST',
      functionalCertainty:'CONDITIONAL_NEGATIVE_INFERENCE_NOT_WIRING'};
  return {...base,state:'UNKNOWN',basis:'FEEDER_OR_ALTERNATE_PATH_NOT_SOURCE_VERIFIED',
    functionalCertainty:'UNKNOWN'};
}
function evaluateAllFeeders(electrical) {
  return Object.fromEntries(VALID_SOURCE_IDS.map(id=>[id,evaluateFeeder(electrical,id)]));
}
function compareElectricalTransitions(before,after) {
  if(!before || !after) throw new TypeError('electrical snapshots required');
  const diff=(group,oldValues,newValues) =>
    Object.keys(newValues).filter(k=>oldValues[k]!==newValues[k]).map(id=>({
      group,id,before:oldValues[id],after:newValues[id]}));
  const buses=diff('BUS',before.buses,after.buses);
  const consumers=diff('FEEDER',Object.fromEntries(Object.entries(evaluateAllFeeders(before))
    .map(([id,x])=>[id,x.state])),
    Object.fromEntries(Object.entries(evaluateAllFeeders(after)).map(([id,x])=>[id,x.state])));
  return {buses,consumers,nonParalleling:true,
    physicalRelayTiming:'UNVERIFIED_NO_DELAY_INVENTED'};
}
module.exports={FEEDS,evaluateFeeder,evaluateAllFeeders,compareElectricalTransitions};
