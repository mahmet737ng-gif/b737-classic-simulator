/* ATA 24 approximate LIVE LOAD ledger for the B737 Classic trainer.
 * NOT a WDM circuit map or verified EP-FSI equipment load schedule.
 * Only the existing Electrical V7 owner can energize buses/sources.
 * AC ratings are equivalent AC GENERATOR AMMETER amperes (three-phase 200V);
 * DC ratings are 28V consumer amperes; never add these unlike units directly.
 * This module does not set switch positions, faults, or alter cockpit artwork.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ElectricalDemandEstimateV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='ATA24-LOAD-EST-0001';
 const entry=(id,label,system,bus,kind,amps,control=null,states=['ON'])=>
  Object.freeze({id,label,system,bus,kind,amps,control,states:Object.freeze(states)});
 const CATALOG=Object.freeze([
  entry('AVIONICS_1','Avionics/equipment DC 1','AVIONICS','dc1','DC',8),
  entry('AVIONICS_2','Avionics/equipment DC 2','AVIONICS','dc2','DC',8),
  entry('FMC_L','FMC/CDU L','AVIONICS','dc1','DC',2.5),
  entry('FMC_R','FMC/CDU R','AVIONICS','dc2','DC',2.5),
  entry('STANDBY_BASE','Essential DC standby','STANDBY','dcStandby','DC',8),
  entry('FUEL_1_FWD','Fuel No.1 FWD','FUEL','transfer1','AC',5.5,'fuel-1-fwd'),
  entry('FUEL_1_AFT','Fuel No.1 AFT','FUEL','transfer1','AC',5.5,'fuel-1-aft'),
  entry('FUEL_2_FWD','Fuel No.2 FWD','FUEL','transfer2','AC',5.5,'fuel-2-fwd'),
  entry('FUEL_2_AFT','Fuel No.2 AFT','FUEL','transfer2','AC',5.5,'fuel-2-aft'),
  entry('FUEL_CENTER_L','Fuel CENTER L','FUEL','transfer1','AC',7,'fuel-center-l'),
  entry('FUEL_CENTER_R','Fuel CENTER R','FUEL','transfer2','AC',7,'fuel-center-r'),
  entry('HYD_ELEC_1','Hydraulic ELEC 1','HYDRAULIC','transfer1','AC',29,'hyd-elec-1'),
  entry('HYD_ELEC_2','Hydraulic ELEC 2','HYDRAULIC','transfer2','AC',29,'hyd-elec-2'),
  entry('WIN_L_FWD','Window L FWD heater','ANTI_ICE','generator1','AC',9,'window-l-fwd'),
  entry('WIN_L_SIDE','Window L SIDE heater','ANTI_ICE','generator2','AC',5,'window-l-side'),
  entry('WIN_R_FWD','Window R FWD heater','ANTI_ICE','generator2','AC',9,'window-r-fwd'),
  entry('WIN_R_SIDE','Window R SIDE heater','ANTI_ICE','generator1','AC',5,'window-r-side'),
  entry('PITOT_A','Pitot/static heat A','ANTI_ICE','transfer1','AC',7,'pitot-a'),
  entry('PITOT_B','Pitot/static heat B','ANTI_ICE','transfer2','AC',7,'pitot-b'),
  entry('EQUIP_COOL_SUP','Equipment cooling supply fan','AIR_COND','transfer1','AC',5.5),
  entry('EQUIP_COOL_EXH','Equipment cooling exhaust fan','AIR_COND','transfer2','AC',5.5),
  entry('RECIRC_FAN','Recirculation fan','AIR_COND','transfer1','AC',6.5,'recirc-fan',['AUTO','ON']),
  entry('PACK_L_CTL','PACK L electrical controls (bleed-air pack)','AIR_COND','dc1','DC',1.2,'pack-l',['AUTO','HIGH']),
  entry('PACK_R_CTL','PACK R electrical controls (bleed-air pack)','AIR_COND','dc2','DC',1.2,'pack-r',['AUTO','HIGH']),
  entry('BLEED_1_VALVE','Engine bleed 1 control','PNEUMATIC','dc1','DC',0.4,'bleed-eng-1'),
  entry('BLEED_2_VALVE','Engine bleed 2 control','PNEUMATIC','dc2','DC',0.4,'bleed-eng-2'),
  entry('BLEED_APU_VALVE','APU bleed valve control','PNEUMATIC','battery','DC',0.4,'bleed-apu'),
  entry('ENG_AI_1_VALVE','Engine anti-ice 1 valve controls','ANTI_ICE','dc1','DC',0.5,'engine-anti-ice-1'),
  entry('ENG_AI_2_VALVE','Engine anti-ice 2 valve controls','ANTI_ICE','dc2','DC',0.5,'engine-anti-ice-2'),
  entry('WING_AI_VALVE','Wing anti-ice valve controls','ANTI_ICE','dc1','DC',0.6,'wing-anti-ice'),
  entry('YAW_DAMPER','Yaw damper controls','FLIGHT_CONTROLS','dc1','DC',1.3,'yaw-damper'),
  entry('OUTFLOW_MAN','Manual outflow DC drive (moving)','PRESSURIZATION','dcStandby','DC',2.8,'outflow-manual',['OPEN','CLOSE']),
  entry('GALLEY_1','Galley heaters group L','GALLEY','main1','AC',29,'galley'),
  entry('GALLEY_2','Galley heaters group R','GALLEY','main2','AC',29,'galley'),
  entry('LANDING_L','Landing lights outboard L','LIGHTING','transfer1','AC',4,'landing-out-l',['ON','EXTEND']),
  entry('LANDING_R','Landing lights outboard R','LIGHTING','transfer2','AC',4,'landing-out-r',['ON','EXTEND']),
  entry('LANDING_IN_L','Landing light inboard L','LIGHTING','transfer1','AC',4,'landing-in-l'),
  entry('LANDING_IN_R','Landing light inboard R','LIGHTING','transfer2','AC',4,'landing-in-r'),
  entry('TAXI','Taxi light','LIGHTING','transfer1','AC',2.3,'taxi'),
  entry('TURNOFF_L','Runway turnoff L','LIGHTING','transfer1','AC',2,'runway-turnoff-l'),
  entry('TURNOFF_R','Runway turnoff R','LIGHTING','transfer2','AC',2,'runway-turnoff-r'),
  entry('LOGO','Logo lights','LIGHTING','transfer2','AC',2,'logo'),
  entry('STROBE','Strobes','LIGHTING','transfer2','AC',1.2,'strobe'),
  entry('BEACON','Anti-collision beacon','LIGHTING','transfer1','AC',1.4,'anti-collision'),
  entry('WING_LIGHTS','Wing illumination','LIGHTING','transfer1','AC',1.1,'wing-lights'),
  entry('WHEEL_WELL','Wheel-well illumination','LIGHTING','transfer2','AC',1.1,'wheel-well'),
  entry('SIGNS','Passenger signs','LIGHTING','dc1','DC',0.7,'fasten-belts',['ON','CREW']),
  entry('NO_SMOKING','No smoking signs','LIGHTING','dc2','DC',0.6,'no-smoking',['ON','AUTO'])
 ]);
 const WM=Object.freeze({'WIN_L_FWD':'L_FWD','WIN_L_SIDE':'L_SIDE','WIN_R_FWD':'R_FWD','WIN_R_SIDE':'R_SIDE'});
 const copy=v=>JSON.parse(JSON.stringify(v));
 const valid=n=>typeof n==='number'&&Number.isFinite(n);
 const round=n=>Math.round(n*100)/100;
 function project({electrical,toggles={},windowHeat=null,battery=null}={}){
  if(electrical?.schema!=='B737_ELECTRICAL_V7_RESULT')throw Error('Electrical V7 evaluated output required');
  if(!toggles||typeof toggles!=='object'||Array.isArray(toggles))throw Error('Overhead toggle map required');
  const bus=electrical.bus,feed=electrical.feed,source=electrical.source;
  const sourceAmps={GEN1:0,GEN2:0,APU:0,EXT:0},trAmps={TR1:0,TR2:0,TR3:0};
  function pathFor(name){
   if(['generator1','generator2','main1','main2','transfer1','transfer2'].includes(name)){
    const side=name.endsWith('1')?1:2;
    if(name.startsWith('transfer')){
     const parent=feed.transferSource[side];
     if(!parent)return null;
     return source[parent.endsWith('1')?1:2];
    }
    return source[side]||null;
   }
   if(name==='groundService')return source[1]||'EXT';
   if(name==='acStandby')return feed.standbyFeed==='TRANSFER1_DC1'?pathFor('transfer1'):'BATTERY_INVERTER';
   if(name==='dc1'||name==='dc2'){
    const side=name==='dc1'?1:2,primary='TR'+side,other='TR'+(3-side);
    return feed.tr[primary]?pathFor('transfer'+side):
     feed.tie&&feed.tr[other]?pathFor('transfer'+(3-side)):null;
   }
   if(name==='dcStandby')return feed.standbyFeed==='TRANSFER1_DC1'?pathFor('dc1'):'BATTERY';
   if(name==='battery'||name==='hotBattery'||name==='switchedHotBattery')
    return feed.tr.TR3&&feed.standbyFeed!=='BATTERY_SELECTOR'?pathFor('main2'):'BATTERY';
   return null;
  }
  function trFor(name){
   if(name==='dc1'||name==='dc2'){
    const side=name.endsWith('1')?1:2,primary='TR'+side,other='TR'+(3-side);
    return feed.tr[primary]?primary:feed.tie&&feed.tr[other]?other:null;
   }
   if(name==='battery')return feed.tr.TR3?'TR3':null;
   if(name==='dcStandby')return feed.standbyFeed==='TRANSFER1_DC1'?trFor('dc1'):feed.tr.TR3?'TR3':null;
   return null;
  }
  const records=[];
  for(const spec of CATALOG){
   const selection=spec.control===null?true:spec.states.includes(toggles[spec.control]);
   const thermostatic=WM[spec.id]&&windowHeat?.channels?
    windowHeat.channels[WM[spec.id]]?.heaterPower===true:true;
   const commanded=selection&&thermostatic&&!(spec.system==='GALLEY'&&electrical.galleyShed);
   const powered=bus[spec.bus]===true;
   const active=Boolean(commanded&&powered),suppliedFrom=active?pathFor(spec.bus):null;
   // If the V7 network cannot determine a path, DO NOT charge a fictional generator.
   const measured=active&&suppliedFrom!==null;
   const amps=measured?spec.amps:0;
   const tr=measured&&spec.kind==='DC'?trFor(spec.bus):null;
   if(tr)trAmps[tr]+=amps;
   const genEquivalent=spec.kind==='AC'?amps:
    // Three-phase 200V source, PF=0.82, rectification conversion eff=0.90.
    amps*28/(Math.sqrt(3)*200*0.82*0.90);
   if(measured&&Object.hasOwn(sourceAmps,suppliedFrom))sourceAmps[suppliedFrom]+=genEquivalent;
   records.push({id:spec.id,label:spec.label,system:spec.system,bus:spec.bus,
    unit:spec.kind==='AC'?'AC_GEN_EQUIV_A':'DC_28V_A',nominalA:spec.amps,
    commanded,energized:powered,active:measured,currentA:round(amps),
    source:measured?suppliedFrom:null,sourceEvidence:'ASSUMED_EQUIPMENT_BUS_FOR_TRAINING'});
  }
  // The installed battery dynamics engine owns BAT current and actual charge.
  // It already integrates standby, IRS, panel, inverter and APU starter loads.
  // This ledger must not simulate a second independent battery capacity.
  if(battery&&valid(battery.chargerA)&&feed.tr.TR3)trAmps.TR3+=battery.chargerA;
  if(battery&&valid(battery.chargerA)&&feed.tr.TR3){
   const chargingSource=pathFor('main2');
   if(chargingSource&&Object.hasOwn(sourceAmps,chargingSource))
    sourceAmps[chargingSource]+=battery.chargerA*28/(Math.sqrt(3)*200*0.82*0.90);
  }
  for(const key of Object.keys(sourceAmps))sourceAmps[key]=round(sourceAmps[key]);
  for(const key of Object.keys(trAmps))trAmps[key]=round(trAmps[key]);
  const sourceTotals={...sourceAmps};
  const sourceToBus={1:source[1],2:source[2]};
  return {schema:'b737-approx-electrical-demand/1',version:VERSION,loads:records,
   sourceAmps,sourceToBus,trAmps,
   batteryAmps:valid(battery?.ammeterA)?battery.ammeterA:null,
   chargingAmps:valid(battery?.chargerA)?battery.chargerA:null,
   totals:{sourceGenAmps:round(Object.values(sourceTotals).reduce((a,b)=>a+b,0)),
    acLoadCount:records.filter(x=>x.active&&x.unit==='AC_GEN_EQUIV_A').length,
    dcLoadCount:records.filter(x=>x.active&&x.unit==='DC_28V_A').length},
   quality:'APPROXIMATE_TRAINING_LOAD_ESTIMATES_NOT_AIRFRAME_WDM_OR_CERTIFIED_AMPS',
   notes:['No electrical source is created by this model','No assumed equipment feed is promoted to EP-FSI VERIFIED',
    'DC BAT meter remains the coulomb-counted battery measurement',
    'Window heater thermostats/CB faults use observed heaterPower when available',
    'AC values are equivalent three-phase generator ammeter currents, not 115V single-phase circuit current']};
 }
 return Object.freeze({VERSION,CATALOG,project});
});
