/* FLT PHASE FINAL_10 — B737 Classic training initialization.
 * Instructor-approved initial state, never a new electrical, engine, flap
 * or autopilot state machine. Uses the existing cockpit owners and physical
 * controls; cannot bypass their bus/CB/guard interlocks.
 * Positions of all frozen OH images and 18 guarded switches stay untouched.
 */
(function(win){
 'use strict';
 const VERSION='FINAL10-INTEGRATED-0004-ACTUAL-READY';
 const docs=win.document,GET=()=>win.B737UnifiedFlightScenarioV1?.getState?.();
 const rad=Math.PI/180,normal=x=>(x%360+360)%360;
 let serial=0,timer=null,check=null,flapPresetSentFor=null,flapPresetLastAt=0;
 const genPulseLastAt={1:0,2:0};
 const STRATEGY={
  OIII:{vor:'TRN',ilsByRunway:{'29L':'ITHL'}},
  OIMM:{vor:'MSD',ilsByRunway:{'31R':'IMSD'}},
  OISS:{vor:'SYZ',ilsByRunway:{'29L':'ISYZ'}}
 };
 function magnetic(trueDeg,state){
  const w=win.B737WMM2025V1;
  const p=w?.evaluate?.({lat:state.lat,lon:state.lon,altitudeFt:state.altitudeFt});
  return p?.valid===true?normal(trueDeg-p.declinationDeg):null;
 }
 function result(key,ok,detail){
  if(!check)return;
  check[key]={ok:ok===true,detail:String(detail??(ok?'READY':'NOT_READY'))};
 }
 function child(){
  const f=docs.getElementById('overheadFrame');
  try{return f?.contentWindow?.B737OverheadToggles?f.contentWindow:null;}catch{return null;}
 }
 // Actuate existing NON-GUARDED OH switches through their approved selector.
 // This intentionally does not programmatically open/modify 18 owner guards.
 function physicalOh(winChild,id,target){
  const api=winChild?.B737OverheadToggles,doc=winChild?.document;
  const defs=api?.getRegistry?.()?.controls;
  const item=defs?.find?.(c=>c.id===id);
  if(!item||!item.states?.includes(target)||item.guarded===true||item.guard===true)return false;
  const before=api.getState?.()?.[id];
  if(before===target)return true;
  if(typeof api.setScenarioSwitch==='function')return api.setScenarioSwitch(id,target)?.accepted===true;
  const switchButton=doc.getElementById('toggle-'+id);
  if(!switchButton)return false;
  switchButton.dispatchEvent(new winChild.MouseEvent('click',{bubbles:true,cancelable:true,detail:0}));
  const choices=[...(doc.getElementById('toggleStates')?.querySelectorAll('button[data-state]')||[])];
  const choice=choices.find(x=>x.dataset.state===target);
  if(!choice)return false;
  choice.click();
  // On a spring-return engine generator selector the ON pulse is enough;
  // its displayed detent is permitted to return to NEUTRAL.
  return target==='ON'&&/^gen-[12]$/.test(id)||
   api.getState?.()?.[id]===target;
 }
 function applyOverhead(){
  const w=child();
  if(!w){result('OVERHEAD',false,'OVERHEAD_FRAME_NOT_READY');return;}
  // Engine start preset is applied BEFORE switching away from APU power.
  const eng=win.B737ISNCockpitV1;
  const phases=eng?.getStartState?.()?.phase||{};
  for(const n of [1,2]){
   const id='engine'+n;
   if(phases[id]==='RUNNING'){result('ENGINE_'+n,true,'RUNNING');continue;}
   try{
    const s=eng.engineTrainerAction({instructor:true,type:'PRESET_RUNNING',engine:id});
    result('ENGINE_'+n,eng.getStartState().phase[id]==='RUNNING',
      eng.getStartState().phase[id]||s?.type);
   }catch(error){result('ENGINE_'+n,false,error?.message);}
  }
  // A command to the spring-return GEN switch is not proof that a bus
  // actually accepted the generator. Verify the Electrical V7 source and
  // evaluated AC bus before treating the FINAL_10 preset as ready.
  for(const [id,target] of [
   ['bleed-apu','OFF'],['bleed-eng-1','ON'],['bleed-eng-2','ON'],
   ['pack-l','AUTO'],['pack-r','AUTO'],['isolation-valve','AUTO']
  ]){
   // Do not repeatedly pulse a spring-return generator selector after its
   // initial successful contactor command; each fresh load has a new check map.
   if(check?.['OH_'+id]?.ok===true)continue;
   const ok=physicalOh(w,id,target);
   result('OH_'+id,ok,ok?target:'SWITCH_NOT_READY_OR_INHIBITED');
  }
  // APU shutdown is a normal pilot selection on the existing OH switch;
  // it is not an APU fault or synthetic hidden ECU change.
  const running=eng?.getStartState?.()?.phase||{};
  const both=running.engine1==='RUNNING'&&running.engine2==='RUNNING';
  const electrical=eng?.getElectricalState?.();
  let evaluated=null;
  try{evaluated=electrical?win.B737ElectricalV7?.evaluate?.(electrical):null;}
  catch(error){result('ELECTRICAL_EVALUATION',false,error?.message);}
  const generator1=electrical?.source?.[1]==='GEN1'&&evaluated?.bus?.generator1===true;
  const generator2=electrical?.source?.[2]==='GEN2'&&evaluated?.bus?.generator2===true;
  for(const n of [1,2]){
   const connected=n===1?generator1:generator2;
   const source='GEN'+n,run=running['engine'+n]==='RUNNING';
   const ready=run&&electrical?.config?.['engine'+n+'Running']===true;
   const failed=electrical?.faults?.[source+'_FAILED']===true;
   const now=Date.now();
   if(!connected&&ready&&!failed&&now-genPulseLastAt[n]>=800){
    const pulsed=physicalOh(w,'gen-'+n,'ON');
    genPulseLastAt[n]=now;
    result('OH_gen-'+n,pulsed,
     pulsed?'GENERATOR_ON_PULSE_WAITING_FOR_BUS':'GENERATOR_PULSE_REJECTED');
   }else if(connected)result('OH_gen-'+n,true,'GENERATOR_CONNECTED_AND_POWERED');
   else result('OH_gen-'+n,false,failed?'GENERATOR_FAILED_OR_DISCONNECTED':
    ready?'WAITING_FOR_ACCEPTED_GENERATOR_CONTACTOR':'ENGINE_GENERATOR_NOT_READY');
   result(source+'_ON_BUS',connected,connected?source+' AC BUS CONNECTED':
    (electrical?.source?.[n]===source?'SOURCE_SELECTED_BUT_BUS_NOT_POWERED':
      failed?'GENERATOR_FAULT':'NOT_CONNECTED'));
  }
  // Removing APU generator contactors before the engine generators
  // connect disconnects DC BUS 2 and can inhibit the very GEN ON commands
  // needed to complete the preset. Keep the APU electrical source available
  // throughout the transfer. Only then command both APU selectors OFF.
  for(const n of [1,2]){
   const id='apu-gen-'+n;
   if(generator1&&generator2){
    const ok=physicalOh(w,id,'OFF');
    result('OH_'+id,ok,ok?'APU_GEN_OFF_AFTER_ENGINE_TRANSFER':
     'APU_GEN_SWITCH_NOT_READY');
   }else result('OH_'+id,false,'KEEP_APU_GENERATOR_WHILE_ENGINE_BUSES_CONNECT');
  }
  // Do not shut down APU until BOTH engine generators are genuinely
  // providing AC bus power. Switch detent ON alone is insufficient proof.
  if(both&&generator1&&generator2){
   const moved=physicalOh(w,'apu-start','OFF');
   const off=eng?.getStartState?.()?.phase?.apu==='OFF';
   result('APU_OFF',moved&&off,off?'APU_PHASE_OFF':
    moved?'APU_SHUTDOWN_IN_PROGRESS':'APU_SWITCH_NOT_ACCEPTED');
  }else result('APU_OFF',false,'WAITING_FOR_BOTH_ENGINE_GENERATORS_ON_BUS');
  const light={
   'landing-out-l':'ON','landing-out-r':'ON','landing-in-l':'ON','landing-in-r':'ON',
   'strobe':'ON','position-lights':'ON','anti-collision':'ON','logo':'ON',
   'wing-lights':'ON','runway-turnoff-l':'OFF','runway-turnoff-r':'OFF','taxi':'OFF'
  };
  for(const [id,state] of Object.entries(light)){
   const ok=physicalOh(w,id,state);result('LIGHT_'+id,ok,ok?state:'LIGHT_SWITCH_UNAVAILABLE');
  }
 }
 function applyNavigation(state){
  const map=STRATEGY[state.icao];
  if(!map){result('NAV',false,'NO_AIRPORT_PROFILE');return;}
  const index=win.B737IranRadioNavaidsV1;
  const capt=index?.byIdent?.(map.vor);
  const ils=index?.byIdent?.(map.ilsByRunway[state.runway]);
  const set=(seat,facility)=>{
   if(!facility)return false;
   const id='nav-'+seat.toLowerCase()+'-manual';
   return win.B737UnifiedVHFDualV1?.setFrequency?.(id,facility.freqKhz)===true&&
    win.B737UnifiedVHFNavControlsV1?.setMode?.(seat,'manual')===true;
  };
  result('NAV1_VOR',set('CAPT',capt),capt?capt.ident+' '+(capt.freqKhz/1000).toFixed(2):'VOR_NOT_FOUND');
  result('NAV2_ILS',set('FO',ils),ils?ils.ident+' '+(ils.freqKhz/1000).toFixed(2):
   'NO_ILS_FOR_SELECTED_RUNWAY');
 }
 function applyConfiguration(){
  const ab=win.B737AutobrakeUnified,lever=win.B737SpeedbrakeLever;
  try{
   // 10 NM final is airborne. Do not select 2 before the actual DC BUS 2,
   // anti-skid and hydraulic/brake prerequisites are available: an early
   // selection latches FAILED and lights AUTO BRAKE DISARM.
   const initial=ab?.getState?.();
   if(initial&&initial.inputs?.onGround!==false)
    ab?.updateSensors?.({onGround:false});
   // Refresh the SAME ATA32 owner against live DC BUS 2 and CB conditions.
   ab?.updateSensors?.({});
   const previous=ab?.getState?.(),input=previous?.inputs;
   const valid=!!input&&input.electricalAvailable===true&&
    input.antiskidOn===true&&input.antiskidFault===false&&
    input.hydraulicBAvailable===true&&input.normalBrakesOperative===true&&
    input.autobrakeFault===false&&input.solenoidPressurePsi<=1000;
   if(valid&&previous?.selector==='2'&&
      (previous.phase==='FAILED'||previous.phase==='DISARMED')){
    // Physically equivalent instructor selection OFF -> 2 clears only the
    // prior selection latch; it never clears an actual fault or bypasses CBs.
    ab.setSelector('OFF');
   }
   if(valid&&ab?.getState?.()?.selector!=='2')ab?.setSelector?.('2');
   const current=ab?.getState?.(),ready=current?.selector==='2'&&
    ['WAITING','ARMED'].includes(current.phase)&&current.disarmLight===false;
   result('AUTOBRAKE_2',ready,ready?'2 / ARMED / DISARM LIGHT OFF':
    valid?(current?.reason||'AUTOBRAKE_REARM_PENDING'):
    'WAITING_FOR_DC_BUS_2_ANTISKID_HYD_B_NORMAL_BRAKES');
  }catch(error){result('AUTOBRAKE_2',false,error?.message);}
  try{
   if(lever?.mounted?.()===true)lever.set('ARMED');
   const armed=docs.querySelector('#b737-speedbrake-groove')!==null&&
    win.B737CockpitLights?.getState?.()?.inputs?.speedBrakeArmedIndication===true;
   result('SPEED_BRAKE_ARMED',armed,armed?'ARMED':'PEDESTAL_LEVER_OR_SENSOR_NOT_READY');
  }catch(error){result('SPEED_BRAKE_ARMED',false,error?.message);}
  // Ensure the existing ATA32 landing gear selector is in DOWN and allow
  // the original hydraulic actuator time to reach all three downlocks.
  const gear=win.B737LandingGearUnifiedV1;
  try{
   const before=gear?.getState?.();
   if(before?.lever!=='DN')gear?.select?.('DN');
   const after=gear?.getState?.();
   const down=after?.lever==='DN'&&
    ['nose','left','right'].every(x=>after.gear?.[x]==='DOWN');
   result('LANDING_GEAR_DOWN',down,down?'THREE_GEAR_DOWN_LOCKED':
    after?'GEAR_DOWN_TRANSIT':'LANDING_GEAR_OWNER_NOT_READY');
  }catch(error){result('LANDING_GEAR_DOWN',false,error?.message);}
  const flap=win.B737FlapVisualTest;
  try{
   if(flap?.position!==30)flap?.presetFinal10?.();
   const physical=flap?.position===30;
   const link=win.B737LEDevicesUnifiedLink?.getState?.();
   const actual=link?.actualTe;
   // Retry if overhead announced READY before its LE trainer mounted.
   const confirmed=link?.projection?.scenario==='FINAL_10_READY'&&
    link?.projection?.lever===30&&link?.projection?.teTarget===30&&
    link?.projection?.teMoving===false;
   if(physical&&link?.overheadReady===true&&
      (!confirmed||!Number.isFinite(actual)||Math.abs(actual-30)>.4)&&
      (flapPresetSentFor!==serial||Date.now()-flapPresetLastAt>=1500)){
    const overhead=docs.getElementById('overheadFrame')?.contentWindow;
    if(overhead){
     try{
      const owner=overhead.B737LEDevicesTrainer;
      if(typeof owner?.presetFinal10ReadyFlaps==='function'){
       owner.presetFinal10ReadyFlaps({originator:'FLIGHT_SCENARIO_FINAL10'});
       result('FLAP_OWNER_PRESET',true,'OWNER_ATOMIC_CONFIG_ACKNOWLEDGED');
      }else{
       // Legacy postMessage path remains safe until the owner registers.
       overhead.postMessage({type:'b737:cockpit-command',
        action:'final10-flight-preset',flaps:30,
        originator:'FLIGHT_SCENARIO_FINAL10'},win.location.origin);
       result('FLAP_OWNER_PRESET',false,'AWAITING_LE_OWNER_REGISTRATION');
      }
      flapPresetSentFor=serial;flapPresetLastAt=Date.now();
     }catch(error){result('FLAP_OWNER_PRESET',false,error?.message);}
    }
   }
   const now=win.B737LEDevicesUnifiedLink?.getState?.();
   const ready=physical&&now?.projection?.scenario==='FINAL_10_READY'&&
    now?.projection?.teTarget===30&&now?.projection?.teMoving===false&&
    Number.isFinite(now.actualTe)&&Math.abs(now.actualTe-30)<.4;
   if(ready)result('FLAP_OWNER_PRESET',true,'OWNER_PROJECTION_CONFIRMED');
   result('FLAP_LEVER_30',physical,physical?'30':'INSTRUCTOR_PRESET_NOT_READY');
   result('FLAP_ACTUAL_30',ready,ready?
    now.actualTe.toFixed(1)+' DEG / STABLE':
    Number.isFinite(now?.actualTe)?now.actualTe.toFixed(1)+' DEG / WAITING_FOR_OWNER':
     'LE_PROJECTION_NOT_READY');
  }catch(error){result('FLAP_LEVER_30',false,error?.message);}
 }
 function applyMcp(state){
  const m=magnetic(state.runwayHeadingTrueDeg,state);
  if(!Number.isFinite(m)){result('MCP',false,'WMM2025_DECLINATION_MISSING');return;}
  try{
   win.B737McpAFDSBridgeV1?.refreshElectrical?.();
   const o=win.B737McpAFDSBridgeV1?.applyFinal10Preset?.({
    speedKt:142,headingMag:m,courseMag:m,altitudeFt:state.altitudeFt});
   result('MCP',o?.accepted===true,o?.accepted?'SPD142 HDG/CRS'+Math.round(m)+' ALT HOLD CMD B AT ARM':
    o?.reason||'MCP_OWNER_NOT_READY');
  }catch(error){result('MCP',false,error?.message);}
 }
 function publish(){
  const map=check?JSON.parse(JSON.stringify(check)):{};
  win.dispatchEvent(new CustomEvent('b737:final10-preset-status',{detail:{
   version:VERSION,serial,checks:map,complete:Object.values(map).length>0&&
    Object.values(map).every(x=>x.ok)}}));
 }
 function apply(state){
  if(!state||state.preset!=='FINAL_10')return null;
  serial++;flapPresetSentFor=null;flapPresetLastAt=0;genPulseLastAt[1]=0;genPulseLastAt[2]=0;const my=serial;
  if(timer!==null){win.clearInterval(timer);timer=null;}
  check={};let count=0;
  const run=()=>{
   if(my!==serial){win.clearInterval(timer);timer=null;return;}
   const live=GET();
   if(live?.preset!=='FINAL_10'||live.icao!==state.icao||live.runway!==state.runway){
    win.clearInterval(timer);timer=null;return;}
   // Avoid reasserting physical controls once the setup is complete.
   if(!check.MCP?.ok||!check.ENGINE_1?.ok||!check.ENGINE_2?.ok||!check.APU_OFF?.ok)
    applyOverhead();
   if(!check.NAV1_VOR?.ok||!check.NAV2_ILS?.ok)applyNavigation(live);
   if(!check.FLAP_LEVER_30?.ok||!check.FLAP_ACTUAL_30?.ok||
      !check.AUTOBRAKE_2?.ok||!check.SPEED_BRAKE_ARMED?.ok||
      !check.LANDING_GEAR_DOWN?.ok)applyConfiguration();
   if(!check.MCP?.ok)applyMcp(live);
   publish();
   if(++count>=180||Object.values(check).length>0&&Object.values(check).every(x=>x.ok)){
    win.clearInterval(timer);timer=null;
   }
  };
  run();timer=win.setInterval(run,350);
  return {serial,started:true,version:VERSION};
 }
 function stop(){serial++;if(timer!==null){win.clearInterval(timer);timer=null;} }
 win.addEventListener('b737:flight-scenario-stopped',stop);
 win.B737Final10ApproachPresetV1=Object.freeze({version:VERSION,apply,stop,
  getStatus:()=>({version:VERSION,serial,checks:check?JSON.parse(JSON.stringify(check)):{}})});
})(window);
