/* Owner-defined B737 Classic simulator presets; not operational checklists.
 * Ground state only. Resolve and verify actual system owners before enabling Welcome.
 */
(function(root){
 'use strict';
 const mainPumps=['fuel-1-aft','fuel-1-fwd','fuel-2-aft','fuel-2-fwd'];
 const centerPumps=['fuel-center-l','fuel-center-r'];
 const lights=['landing-out-l','landing-out-r','landing-in-l','landing-in-r','runway-turnoff-l','runway-turnoff-r','taxi','strobe','position-lights','anti-collision','wing-lights'];
 const setAll=(keys,value)=>Object.fromEntries(keys.map(k=>[k,value]));
 const beforeStart={
  toggles:{'yaw-damper':'ON','galley':'OFF','window-l-side':'ON','window-l-fwd':'ON','window-r-fwd':'ON','window-r-side':'ON','pitot-a':'ON','pitot-b':'ON','hyd-elec-1':'ON','hyd-elec-2':'ON','hyd-eng-1':'ON','hyd-eng-2':'ON','pack-l':'OFF','pack-r':'OFF','bleed-eng-1':'ON','bleed-eng-2':'ON','bleed-apu':'ON',...setAll(mainPumps,'ON')},
  guards:{'battery-master':['ON',true],'emergency-exit-lights':['ARM',true]},
  irs:{left:'NAV',right:'NAV',aligned:true,positionValid:true},
  electrical:{groundConnected:true,source1:'GROUND',source2:'GROUND',apuRunning:true,apuOnBus:false,engine1Running:false,engine2Running:false},
  wipers:'OFF',autobrake:'RTO',flaps:0,gear:'DOWN',speedbrake:'DOWN',parkingBrake:true,engineLevers:'CUTOFF',
  mcp:{heading:'RUNWAY_MAGNETIC',fdLeft:true,fdRight:true,fdMaster:'FO'}
 };
 const beforeTakeoff={...beforeStart,
  toggles:{...beforeStart.toggles,'pack-l':'AUTO','pack-r':'AUTO',...setAll(lights,'ON'),'logo':'OFF','wheel-well':'OFF'},
  electrical:{groundConnected:false,source1:'GEN1',source2:'GEN2',apuRunning:false,apuOnBus:false,engine1Running:true,engine2Running:true},
  rotaries:{'engine-start-1':'CONT','engine-start-2':'CONT'},
  flaps:5,engineLevers:'IDLE',cpcsAirGround:'AIR',
  mcp:{...beforeStart.mcp,atArm:true,iasKt:160,courseL:'RUNWAY_MAGNETIC',courseR:'RUNWAY_MAGNETIC',altitudeFt:10000,autopilot:'OFF'}
 };
 const deepFreeze=o=>{for(const v of Object.values(o))if(v&&typeof v==='object')deepFreeze(v);return Object.freeze(o);};
 deepFreeze(beforeStart);deepFreeze(beforeTakeoff);
 const vorByAirport={OIII:'TRN',OIMM:'MSD',OISS:'SYZ',OIIE:'IKA'};
 function build(state,{centerKg,headingMag,onGround}={}){
  if(onGround!==true)throw Error('GROUND_PRESET_REQUIRES_GROUND');
  if(state==='COLD_DARK')return {state,owner:'B737ColdDarkGeneralPresetV1',speedbrake:'DOWN',efis:'OFF',hotBattery:true};
  const template=state==='READY_FOR_START'?beforeStart:state==='READY_FOR_TAKEOFF'?beforeTakeoff:null;
  if(!template)throw Error('UNKNOWN_GENERAL_STATE');
  if(!Number.isFinite(centerKg)||centerKg<0)throw Error('CENTER_FUEL_QUANTITY_REQUIRED');
  if(!Number.isFinite(headingMag))throw Error('RUNWAY_MAGNETIC_HEADING_REQUIRED');
  const mag=(Math.round(headingMag)%360+360)%360;
  const mcp={...template.mcp,heading:mag};
  if(state==='READY_FOR_TAKEOFF')Object.assign(mcp,{courseL:mag,courseR:mag});
  return {...template,state,mcp,toggles:{...template.toggles,...setAll(centerPumps,centerKg>453?'ON':'OFF')}};
 }
 function resolveNav(index,icao,runway){
  const vor=index?.byIdent?.(vorByAirport[icao]);
  const ils=index?.STATIONS?.filter(s=>s.airport===icao&&s.runway===runway&&s.type==='ILS_DME')??[];
  if(!vor||vor.type!=='VOR_DME'||!Number.isInteger(vor.freqKhz))return {ok:false,reason:'AIRPORT_VOR_NOT_IN_DATABASE'};
  if(ils.length!==1||!Number.isInteger(ils[0].freqKhz))return {ok:false,reason:'SELECTED_RUNWAY_ILS_NOT_UNIQUE_OR_MISSING',vor};
  return {ok:true,vor,ils:ils[0],capt:{mode:'auto',manual:ils[0].freqKhz,auto:vor.freqKhz},fo:{mode:'manual',manual:vor.freqKhz}};
 }
 function applyNav(root,index,icao,runway){
  const p=resolveNav(index,icao,runway);if(!p.ok)return p;
  const tuner=root.B737UnifiedVHFDualV1,mechanical=root.B737UnifiedMechanicalFrequencyV1,controls=root.B737UnifiedVHFNavControlsV1;
  if(!tuner?.setFrequency||!mechanical?.setNavAuto||!controls?.setMode||!controls?.getState)return {ok:false,reason:'NAV_OWNERS_NOT_READY'};
  try{
   const accepted=tuner.setFrequency('nav-capt-manual',p.capt.manual)===true&&
    tuner.setFrequency('nav-fo-manual',p.fo.manual)===true&&
    mechanical.setNavAuto('CAPT',p.capt.auto)===true&&
    controls.setMode('CAPT','auto')===true&&controls.setMode('FO','manual')===true;
   const c=controls.getState('CAPT'),f=controls.getState('FO');
   return {...p,ok:accepted&&c?.mode==='auto'&&c?.activeFrequencyKhz===p.capt.auto&&c?.manualFrequencyKhz===p.capt.manual&&f?.mode==='manual'&&f?.activeFrequencyKhz===p.fo.manual};
  }catch(e){return {...p,ok:false,reason:String(e.message||e)};}
 }
 const api=Object.freeze({build,resolveNav,applyNav});
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.B737AircraftGeneralStatePlanV1=api;
})(typeof window==='object'?window:globalThis);
