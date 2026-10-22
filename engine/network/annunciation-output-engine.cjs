'use strict';
/**
 * ISN-05: logical output adapter, NOT aircraft WDM lamp-pin validation.
 * FCOM Sepehran Ch 12 §12.10.2-3 PDF pp1826-27; Ch13 §13.10.1,
 * 13.10.4 pp1842,1845; Ch15 §15.20.1-4 pp1905-08;
 * Ch8 §8.20.1-2 pp1234-35.
 *
 * The real visual output layer gets lamp commands, physical visibility
 * confidence, and an audio *intent* (not an automatically played file).
 * In particular: MASTER CAUTION / FUEL / HYD low pressure have NO
 * general caution aural cue in these source cases.
 */
const SOURCE='FCOM-SEPEHRAN-1937';
const ref=(section,pdfPages)=>({sourceId:SOURCE,section,pdfPages});
const desc={
  masterCaution:ref('15.20.2',[1906]),
  system:ref('15.20.3-4',[1907,1908]),
  fuel:ref('12.10.2-3',[1826,1827]),
  hydraulic:ref('13.10.1,13.10.4',[1842,1845]),
  fire:ref('8.20.1-2,15.20.2',[1234,1235,1906])
};
function logical(v){
  if(v===true)return 'ON';
  if(v===false)return 'OFF';
  if(v===null||v===undefined)return 'UNKNOWN';
  throw new TypeError('lamp input must be boolean or null');
}
function annunciationDisplay(logicalDemand, panelPower){
  if(panelPower==='PILOT_ASSUMED_PANEL_AVAILABLE')return logical(logicalDemand);
  return 'UNKNOWN';
}
function makeLamp(id,control,kind,source,power,group){
  const demand=logical(control);
  return {
    id,group,severity:kind,
    logicalDemand:demand,
    projectedVisibility:annunciationDisplay(control,power),
    actualLampCircuit:'NOT_VERIFIED_WDM',
    source
  };
}
function projectAnnunciation(view,fire){
  if(!view||!view.warnings||!view.pumps||!view.electrical)
    throw new TypeError('integrated aircraft view required');
  if(!fire||!fire.alerts)
    throw new TypeError('fire-detection evaluation required');
  const warning=view.warnings, panelPower=warning.displayPower;
  const lamps={};
  const set=(id,d,kind,source,group='OVERHEAD')=>{
    lamps[id]=makeLamp(id,d,kind,source,panelPower,group);
  };
  set('MASTER_CAUTION_CAPT',warning.masterCaution.logicalDemand,'CAUTION',desc.masterCaution,'GLARESHIELD');
  set('MASTER_CAUTION_FO',warning.masterCaution.logicalDemand,'CAUTION',desc.masterCaution,'GLARESHIELD');
  // System-annunciator lenses are resettable. Existing warning domain
  // owns active causes and ACKs; recall can temporarily show simple faults.
  // Keep physical pump pressure lamps independent of master ACK.
  const anyUnack=warning.unacknowledgedCauseIds.length>0;
  const recalling=view.warningControl?.recallPressed===true;
  const activeSystem=id=>view.warningCauses.active.some(x=>x.system===id && 
    warning.unacknowledgedCauseIds.includes(x.id));
  const simpleSystem=id=>recalling && view.warningCauses.simple.some(x=>x.system===id);
  const fuelAnn=activeSystem('FUEL')||simpleSystem('FUEL');
  const fltAnn=activeSystem('FLT CONT');
  const hydAnn=warning.systemAnnunciators.HYD.logicalDemand===null?
    null:(activeSystem('FLT CONT')?true:false);
  set('ANNUN_FUEL',fuelAnn,'CAUTION',desc.system,'GLARESHIELD');
  set('ANNUN_HYD',hydAnn,'CAUTION',desc.system,'GLARESHIELD');
  set('ANNUN_FLT_CONT',fltAnn,'CAUTION',desc.system,'GLARESHIELD');
  set('ANNUN_OVHT_DET',activeSystem('OVHT/DET'),'CAUTION',desc.system,'GLARESHIELD');
  // Electrical system status: bus state is NOT equivalent to bus-off
  // bulb-feed logic; explicit uncertain until source schematic is audited.
  set('ANNUN_ELEC',null,'CAUTION',ref('6.20.1-19,15.20.3',[1150,1168,1907]),'GLARESHIELD');
  for(const [id,pump] of Object.entries(view.pumps.fuel))
    set('FUEL_'+id+'_LOW',pump.lowPressureLampDemand,'CAUTION',desc.fuel,'FUEL_PANEL');
  for(const [system,p] of Object.entries(view.pumps.hydraulic)){
    set('HYD_'+system+'_ELEC_LOW',p.electric.lowPressureLampDemand,'CAUTION',desc.hydraulic,'HYD_PANEL');
    set('HYD_'+system+'_ENG_LOW',p.engineDriven.lowPressureLampDemand,'CAUTION',desc.hydraulic,'HYD_PANEL');
    set('FLT_CONT_'+system+'_LOW',p.flightControlLowPressureLampDemand,'CAUTION',desc.hydraulic,'FLT_CONT_PANEL');
  }
  // Fire section: these are DETECTOR outputs, not actual thermodynamic fire.
  // MASTER FIRE WARN is separate from MASTER CAUTION and has a separate
  // acknowledgement/cutout (FCOM §15.20.2).
  set('ENG1_FIRE_SWITCH',fire.alerts.engFireSwitch,'WARNING',desc.fire,'FIRE_PANEL');
  set('ENG1_OVHT',fire.alerts.engOverheat,'CAUTION',desc.fire,'FIRE_PANEL');
  set('MASTER_FIRE_WARN_CAPT',fire.alerts.masterFireWarn,'WARNING',desc.fire,'GLARESHIELD');
  set('MASTER_FIRE_WARN_FO',fire.alerts.masterFireWarn,'WARNING',desc.fire,'GLARESHIELD');
  const sound=fire.alerts.fireBell;
  const audio={
    activeKeys:sound===true?['fireBell']:[],
    unresolvedKeys:sound===null?['fireBell']:[],
    rules:{
      fireBell:{
        condition:sound===null?'UNKNOWN':sound?'ACTIVE':'INACTIVE',
        key:'fireBell',priority:95,
        auralModulePower:'UNVERIFIED',
        sampleCandidate:'fire-alarm.mp3',
        physicalPlayer:'NOT_CONNECTED_BY_THIS_PURE_FUNCTION',
        source:desc.fire
      },
      masterCaution:{
        condition:'NO_GENERAL_AURAL_IN_FCOM_CASE',
        key:null,
        source:desc.masterCaution
      }
    }
  };
  return {
    schema:'b737cl-annunciation-isn05-v0.1',
    lamps,audio,
    confirmedLogicPower:panelPower,
    panelProjectionQuality:warning.displayQuality,
    warningCauseIds:[...warning.causeIds],
    simpleRecallIds:[...warning.simpleRecallIds],
    unresolvedIndications:[...warning.unresolvedCauses],
    unresolvedPhysical:['Individual lamp supply and electrical warning relay WDM/SSM',
      'Master fire lamp feed and aural module supply',
      'Graphic panel coordinates pending cockpit artwork reference calibration'],
    provenance:desc
  };
}
function compareAnnunciation(before,after){
  if(!before||!after)throw new TypeError('annunciation snapshots required');
  const changes=Object.keys(after.lamps).filter(id=>{
    const a=before.lamps[id],b=after.lamps[id];
    return !a||a.logicalDemand!==b.logicalDemand||
      a.projectedVisibility!==b.projectedVisibility;
  }).map(id=>({
    id,from:before.lamps[id]?.logicalDemand||'UNKNOWN',
    to:after.lamps[id].logicalDemand,
    projectedVisibility:after.lamps[id].projectedVisibility
  }));
  const oldKeys=new Set(before.audio.activeKeys),newKeys=new Set(after.audio.activeKeys);
  const start=[...newKeys].filter(k=>!oldKeys.has(k));
  const stop=[...oldKeys].filter(k=>!newKeys.has(k));
  return {lamps:changes,audio:{
    start:start.map(key=>({key,command:'START',source:'FIRE_DETECTOR_CONDITION'})),
    stop:stop.map(key=>({key,command:'STOP',source:'CLEARED_OR_ACKNOWLEDGED'})),
    keep:[...newKeys].filter(k=>oldKeys.has(k)).map(key=>({key,command:'HOLD'}))
  }};
}
module.exports={projectAnnunciation,compareAnnunciation};
