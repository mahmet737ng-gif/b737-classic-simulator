/* Training initialization only. Existing physical owners remain authoritative.
   READY FOR START is a provisional setup pending the owner's full switch-by-switch SOP. */
(function(win){
'use strict';
const names=['READY_FOR_START','READY_FOR_TAKEOFF'];
let timer=null,serial=0,status=null;
const stop=()=>{serial++;if(timer!==null){win.clearInterval(timer);timer=null;}};
const applies=s=>names.includes(s);
const get=()=>status;
function apply(state){
 stop();if(!applies(state?.preset))return false;
 const run=serial,takeoff=state.preset==='READY_FOR_TAKEOFF',started=Date.now(),sent=new Map();
 const check={},optional={},reasons={};
 const attempt=(id,fn,extra=false)=>{try{const ok=fn()===true;(extra?optional:check)[id]=ok;if(ok)delete reasons[id];}catch(e){(extra?optional:check)[id]=false;reasons[id]=String(e?.message||e);}};
 const once=(id,fn,ms=1200)=>{if(Date.now()-(sent.get(id)||0)<ms)return;sent.set(id,Date.now());return fn();};
 function pass(){
 if(run!==serial)return;
 const child=win.document.getElementById('overheadFrame')?.contentWindow,oh=child?.B737OverheadToggles,rg=child?.B737RotaryGuards,guard=child?.B737GuardOwner18;
 const eng=win.B737ISNCockpitV1,elec=()=>eng?.getElectricalState?.();
 const phases=()=>eng?.getStartState?.()?.phase||{};
 const set=(id,value)=>{if(!oh)return false;if(oh.getState()[id]!==value)oh.setScenarioSwitch(id,value);return oh.getState()[id]===value;};
 const pulse=(id,value)=>once(id,()=>oh?.setScenarioSwitch(id,value));
 const guardSet=(id,value,closed)=>{let s=guard?.inspect()?.[id];if(!s)return false;if(s.value!==value||s.closed!==closed)guard.set(id,value,closed);s=guard.inspect()[id];return s.value===value&&s.closed===closed;};
 attempt('BATTERY',()=>guardSet('battery-master','ON',true)&&elec()?.config?.batterySwitch===true);
 const common={'yaw-damper':'ON','galley':'OFF','pitot-a':'ON','pitot-b':'ON','vhf-nav':'NORMAL','irs-transfer':'NORMAL','efi-transfer':'NORMAL','equip-cooling-supply':'NORMAL','equip-cooling-exhaust':'NORMAL','no-smoking':'ON','fasten-belts':'ON','window-l-side':'ON','window-l-fwd':'ON','window-r-fwd':'ON','window-r-side':'ON','hyd-eng-1':'ON','hyd-eng-2':'ON','hyd-elec-1':'ON','hyd-elec-2':'ON','fuel-1-aft':'ON','fuel-1-fwd':'ON','fuel-2-aft':'ON','fuel-2-fwd':'ON','wing-anti-ice':'OFF','engine-anti-ice-1':'OFF','engine-anti-ice-2':'OFF','bleed-eng-1':'ON','bleed-eng-2':'ON','isolation-valve':'AUTO'};
 for(const [id,v] of Object.entries(common))attempt(id,()=>set(id,v),!['galley','pitot-a','pitot-b'].includes(id));
 for(const id of ['flight-control-a','flight-control-b','spoiler-a','spoiler-b'])attempt(id,()=>guardSet(id,'ON',true),true);
 const fuel=eng?.getFuelQuantityIndications?.()?.tanksKg;
 const center=Number(fuel?.center);
 for(const id of ['fuel-center-l','fuel-center-r'])attempt(id,()=>Number.isFinite(center)&&set(id,center>453?'ON':'OFF'),true);
 // Start from an actual APU-backed electrical state before transferring.
 if(!takeoff||elec()?.source?.[1]!=='GEN1'||elec()?.source?.[2]!=='GEN2'){
  attempt('APU_READY',()=>{
   if(!check.BATTERY)throw Error('Waiting for battery owner');
   const phase=phases().apu;
   if(phase==='OFF')once('APU_PRESET',()=>eng.engineTrainerAction({instructor:true,type:'APU_PRESET'}));
   else if(['BLOCKED','PROTECTIVE_SHUTDOWN'].includes(phase))once('APU_RESET',()=>set('apu-start','OFF'));
   if(phases().apu!=='READY')throw Error(eng?.getStartState?.()?.lastError||'APU '+phases().apu);
   return true;
  },takeoff);
  if(phases().apu==='READY'){set('apu-start','ON');if(!takeoff||elec()?.source?.[1]!=='GEN1')if(elec()?.source?.[1]!=='APU')pulse('apu-gen-1','ON');
   if(!takeoff||elec()?.source?.[2]!=='GEN2')if(elec()?.source?.[2]!=='APU')pulse('apu-gen-2','ON');}
 }
 const readySource=()=>{const e=elec();return [1,2].every(n=>e?.source?.[n]==='APU'||e?.source?.[n]==='GEN'+n);};
 for(const n of [1,2])attempt('ENGINE_'+n,()=>{
  const id='engine'+n;
  if(takeoff){
   if(phases()[id]==='RUNNING')return true;
   // Match FINAL_10: the existing instructor running preset is an initial
   // condition, not a pneumatic start. Do not require APU dual contactors.
   // Keep the true battery/fuel/fire prerequisites and final generator gate.
   if(!check.BATTERY)throw Error('Waiting for BATTERY ON acknowledgement');
   if(!eng?.engineTrainerAction)throw Error('ISN18 ECU owner not loaded');
   once(id,()=>eng.engineTrainerAction({instructor:true,type:'PRESET_RUNNING',engine:id}));
   if(phases()[id]!=='RUNNING')throw Error(eng.getStartState()?.lastError||id+' phase '+phases()[id]);
   return true;
  }
  if(phases()[id]!=='OFF')once(id,()=>{eng.engineTrainerAction({instructor:true,type:'LEVER',engine:id,position:'CUTOFF'});eng.engineTrainerAction({instructor:true,type:'SHUTDOWN',engine:id});});
  return phases()[id]==='OFF';
 });
 if(takeoff){
  for(const n of [1,2])attempt('GEN_'+n,()=>{const e=elec(),v=e&&win.B737ElectricalV7?.evaluate(e);if(e?.faults?.['GEN'+n+'_FAILED'])throw Error('GEN'+n+' fault / drive disconnected');if(phases()['engine'+n]==='RUNNING'&&e?.config?.['engine'+n+'Running']===true&&e?.source?.[n]!=='GEN'+n)pulse('gen-'+n,'ON');if(e?.source?.[n]==='GEN'+n&&v?.bus?.['generator'+n]===true)return true;throw Error('GEN'+n+' not on bus; source='+String(e?.source?.[n]??'NONE')+'; engine='+String(phases()['engine'+n]??'UNKNOWN'));});
  if(check.GEN_1&&check.GEN_2){optional.APU_READY=true;delete reasons.APU_READY;for(const n of [1,2])if(elec()?.source?.[n]==='APU')pulse('apu-gen-'+n,'OFF');set('apu-start','OFF');}
  attempt('APU_OFF',()=>phases().apu==='OFF'&&check.GEN_1&&check.GEN_2);
  attempt('GPU_DISCONNECTED',()=>{if(elec()?.config?.groundPowerAttached)once('gpu',()=>eng.instructor({type:'ELECTRICAL',action:{type:'CONTROL',key:'groundPowerAttached',value:false}}));return elec()?.config?.groundPowerAttached===false;},true);
 }else attempt('APU_ON_BOTH_BUSES',()=>{const e=elec(),v=e&&win.B737ElectricalV7?.evaluate(e);return phases().apu==='READY'&&e?.source?.[1]==='APU'&&e?.source?.[2]==='APU'&&v?.bus?.transfer1===true&&v?.bus?.transfer2===true;});
 for(const id of ['pack-l','pack-r'])attempt(id,()=>set(id,takeoff?'AUTO':'OFF'),true);
 attempt('APU_BLEED',()=>set('bleed-apu',takeoff?'OFF':'ON'),true);
 for(const id of ['engine-start-1','engine-start-2'])attempt(id,()=>{if(!rg)return false;const v=takeoff?'CONT':'OFF';let s=rg.getState();if((s.rotaries?.[id]??s[id])!==v)rg.setEngineLabDetent(id,v);s=rg.getState();return (s.rotaries?.[id]??s[id])===v;},true);
 for(const id of ['landing-out-l','landing-out-r','landing-in-l','landing-in-r','strobe','position-lights','anti-collision','wing-lights','runway-turnoff-l','runway-turnoff-r','taxi','logo','wheel-well'])attempt(id,()=>set(id,takeoff&&!['logo','wheel-well'].includes(id)?'ON':id.startsWith('landing-out')?'RETRACT':id==='position-lights'||id==='anti-collision'?'ON':'OFF'),true);
 attempt('IRS_ALIGNED',()=>{
  const irs=win.B737IRSTrainerUnified,core=win.B737IRSTrainerCoreV1,src=win.B737UnifiedEfisSources;
  if(!irs||!core||!src||!readySource())return false;
  if(!['L','R'].every(k=>irs.getState().units[k].mode==='NAV'&&irs.getState().units[k].positionValid)){
   once('irs-align',()=>{
    const fmt=(v,w,p,n)=>{const a=Math.round(Math.abs(v)*600);return (v<0?n:p)+String(Math.floor(a/600)).padStart(w,'0')+String(a%600).padStart(3,'0');};
    const pos=fmt(state.lat,2,'N','S')+' '+fmt(state.lon,3,'E','W');
    irs.setPowerMode('AIRCRAFT');
    for(const k of ['L','R']){if(irs.getState().units[k].mode!=='OFF')irs.setMode(k,'OFF');irs.setMode(k,'NAV');}
    irs.setFmcPosition(pos,core.trainingAlignmentReference(core.parseFmcPosition(pos),state.trueHeadingDeg));
   },4000);
  }
  src.setPreset('LIVE');
  return ['L','R'].every(k=>irs.getState().units[k].mode==='NAV'&&irs.getState().units[k].positionValid);
 },true);
 attempt('NAV',()=>{const nav=win.B737IranRadioNavaidsV1,tuner=win.B737UnifiedVHFNavControlsV1,dual=win.B737UnifiedVHFDualV1;
  const vor=nav?.byIdent?.(({OIII:'TRN',OIMM:'MSD',OISS:'SYZ',OIFM:'IFN'})[state.icao]);
  const ils=nav?.STATIONS?.find(s=>s.type==='ILS_DME'&&s.airport===state.icao&&s.runway===state.runway);
  if(!vor||!ils||!tuner||!dual)return false;
  const a=dual.setFrequency('nav-fo-manual',vor.freqKhz),b=dual.setFrequency('nav-capt-manual',ils.freqKhz);
  return a===true&&b===true&&tuner.setMode('FO','manual')===true&&tuner.setMode('CAPT','auto')===true;
 },true);
 attempt('PARKING_BRAKE',()=>{const a=win.B737UnifiedParkingBrakeV1;if(!a)return false;if(!a.getState().engaged)a.setEngaged(true,'AIRCRAFT_GENERAL_STATE');return a.getState().engaged===true;});
 attempt('SPEEDBRAKE_DOWN',()=>{const a=win.B737SpeedbrakeLever;if(!a?.mounted())return false;if(a.get()!==0)a.set('DOWN');return a.get()===0;});
 attempt('THROTTLES_IDLE',()=>{const a=win.B737ThrottlePositions;if(!a?.mounted())return false;for(const n of [1,2])if(a.get(n)!==0)a.set(n,0);return [1,2].every(n=>a.get(n)===0);});
 attempt('GEAR_DOWN',()=>{const a=win.B737LandingGearUnifiedV1;if(!a)return false;let s=a.getState();if(s.lever!=='DN')a.select('DN');s=a.getState();return s.lever==='DN'&&['nose','left','right'].every(k=>s.gear[k]==='DOWN');});
 attempt('FLAPS',()=>{
  const target=takeoff?5:0,a=win.B737FlapVisualTest,owner=child?.B737LEDevicesTrainer;
  if(!a?.presetDetent||!owner?.flapActuator||!owner?.advance)throw Error('Flap lever or LE/TE owner unavailable');
  if(takeoff&&(!check.GEN_1||!check.GEN_2))throw Error('Waiting for both generators');
  if(!takeoff&&!check.APU_ON_BOTH_BUSES)throw Error('Waiting for APU buses');
  let actuator=owner.flapActuator(),le=owner.snapshot?.();
  // Initial aircraft configuration, not a pilot move through the 1/15 gates.
  if(a.position!==target&&!a.presetDetent(target))throw Error('Physical lever preset not accepted');
  if(actuator.command!==target||le?.lever!==target){
   once('FLAP_OWNER_COMMAND',()=>{
    win.B737LEDevicesUnifiedLink?.syncLever(target);
    child.postMessage({type:'b737:cockpit-command',action:'le-devices',originator:'physical-flap-lever',command:{type:'FLAP_LEVER',value:target}},win.location.origin);
   },500);
   throw Error('Waiting for flap '+target+' command acknowledgement; actual '+actuator.actual);
  }
  if(Math.abs(actuator.actual-target)>.01||actuator.moving||le?.leStage!==(takeoff?'EXT':'RETRACTED')){
   if(!(actuator.pressureFactor>0))throw Error('Hydraulic B unavailable: '+actuator.pressurePsi+' psi');
   // Replay the existing timed actuator/LE laws only during initialization.
   // No direct writes to position, hydraulic pressure or electrical power.
   for(let n=0;n<60;n++){
    owner.advance(1);actuator=owner.flapActuator();le=owner.snapshot?.();
    if(Math.abs(actuator.actual-target)<.01&&!actuator.moving&&le?.leStage===(takeoff?'EXT':'RETRACTED'))break;
   }
  }
  if(a.position!==target||actuator.command!==target||Math.abs(actuator.actual-target)>.01||actuator.moving||le?.leStage!==(takeoff?'EXT':'RETRACTED'))throw Error('Flap readback: lever '+a.position+' TE '+actuator.actual+' target '+actuator.command+' LE '+le?.leStage+' HYD '+actuator.pressurePsi+' psi');
  return true;
 },!takeoff);
 attempt('AUTOBRAKE_RTO',()=>{const a=win.B737AutobrakeUnified;if(!a)return false;if(a.getState().selector!=='RTO')a.setSelector('RTO');return a.getState().selector==='RTO';},true);
 attempt('MCP',()=>{
  const a=win.B737McpAFDSBridgeV1;
  if(!a?.applyGroundPreset)throw Error('MCP owner API not available');
  if(takeoff&&(!check.GEN_1||!check.GEN_2))throw Error('Waiting for both generators');
  if(!takeoff&&!check.APU_ON_BOTH_BUSES)throw Error('Waiting for APU buses');
  a.refreshElectrical();let o=a.getOutput();
  if(o.power!==true)throw Error('MCP power '+o.power+' / '+JSON.stringify(o.feedStatus));
  if(!sent.has('MCP_RESET')){a.reset();sent.set('MCP_RESET',Date.now());}
  const mag=win.B737WMM2025V1?.evaluate?.({lat:state.lat,lon:state.lon,altitudeFt:state.altitudeFt});
  if(!mag?.valid)throw Error('WMM runway magnetic heading unavailable');
  const r=a.applyGroundPreset({speedKt:160,headingMag:state.runwayHeadingTrueDeg-mag.declinationDeg,altitudeFt:10000,atArm:takeoff});
  if(!r?.accepted)throw Error((r?.step||'MCP')+': '+(r?.reason||'not acknowledged'));
  return true;
 },!takeoff);
 const coreReady=Object.values(check).every(Boolean),missing=Object.keys(check).filter(k=>!check[k]),pending=Object.keys(optional).filter(k=>!optional[k]);
 const done=coreReady&&pending.length===0,expired=Date.now()-started>=30000;
 status={state:state.preset,complete:done,coreReady,settled:done||expired,timedOut:expired&&!done,missing,pending,checks:{...check,...optional},reasons:{...reasons},observed:{phase:{...phases()},source:{...elec()?.source},battery:elec()?.config?.batterySwitch}};
 const node=win.document.getElementById('flightScenarioStatus');
 if(node)node.textContent=state.preset.replaceAll('_',' ')+' · '+(done?'OWNER CHECKS PASSED':(expired?'INCOMPLETE — ':'CONFIGURING — ')+[...missing,...pending].map(k=>k+(reasons[k]?': '+reasons[k]:'')).join(', '));
 win.dispatchEvent(new win.CustomEvent('b737:powered-general-preset-status',{detail:status}));
 if(done||expired)stop();
 }
 pass();if(run===serial)timer=win.setInterval(pass,250);
 return status;
}
win.addEventListener('b737:flight-scenario-stopped',stop);
win.B737PoweredGeneralPresetsV1=Object.freeze({applies,apply,stop,getStatus:get});
})(window);
