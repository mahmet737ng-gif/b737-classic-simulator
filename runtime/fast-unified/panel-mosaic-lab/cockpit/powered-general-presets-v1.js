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
 const check={},optional={};
 const attempt=(id,fn,extra=false)=>{try{(extra?optional:check)[id]=fn()===true;}catch(e){(extra?optional:check)[id]=false;}};
 const once=(id,fn,ms=1200)=>{if(Date.now()-(sent.get(id)||0)<ms)return;fn();sent.set(id,Date.now());};
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
  attempt('APU_READY',()=>{if(phases().apu!=='READY')once('APU_PRESET',()=>eng.engineTrainerAction({instructor:true,type:'APU_PRESET'}));return phases().apu==='READY';},takeoff);
  if(phases().apu==='READY'){set('apu-start','ON');if(!takeoff||elec()?.source?.[1]!=='GEN1')if(elec()?.source?.[1]!=='APU')pulse('apu-gen-1','ON');
   if(!takeoff||elec()?.source?.[2]!=='GEN2')if(elec()?.source?.[2]!=='APU')pulse('apu-gen-2','ON');}
 }
 const readySource=()=>{const e=elec();return [1,2].every(n=>e?.source?.[n]==='APU'||e?.source?.[n]==='GEN'+n);};
 for(const n of [1,2])attempt('ENGINE_'+n,()=>{
  const id='engine'+n;
  if(takeoff){if(phases()[id]!=='RUNNING'&&readySource())once(id,()=>eng.engineTrainerAction({instructor:true,type:'PRESET_RUNNING',engine:id}));return phases()[id]==='RUNNING';}
  if(phases()[id]!=='OFF')once(id,()=>{eng.engineTrainerAction({instructor:true,type:'LEVER',engine:id,position:'CUTOFF'});eng.engineTrainerAction({instructor:true,type:'SHUTDOWN',engine:id});});
  return phases()[id]==='OFF';
 });
 if(takeoff){
  for(const n of [1,2])attempt('GEN_'+n,()=>{if(phases()['engine'+n]==='RUNNING'&&elec()?.source?.[n]!=='GEN'+n)pulse('gen-'+n,'ON');const e=elec(),v=e&&win.B737ElectricalV7?.evaluate(e);return e?.source?.[n]==='GEN'+n&&v?.bus?.['generator'+n]===true;});
  if(check.GEN_1&&check.GEN_2){pulse('apu-gen-1','OFF');pulse('apu-gen-2','OFF');set('apu-start','OFF');}
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
 attempt('FLAPS',()=>{const a=win.B737FlapVisualTest,target=takeoff?5:0;if(!a)return false;if(a.position!==target&&a.ready())a.request(target);const actual=child?.B737LEDevicesTrainer?.flapActuator?.()?.actual;return a.position===target&&Number.isFinite(actual)&&Math.abs(actual-target)<.4;},true);
 attempt('AUTOBRAKE_RTO',()=>{const a=win.B737AutobrakeUnified;if(!a)return false;if(a.getState().selector!=='RTO')a.setSelector('RTO');return a.getState().selector==='RTO';},true);
 attempt('MCP',()=>{const a=win.B737McpAFDSBridgeV1;if(!a)return false;a.refreshElectrical();let o=a.getOutput();if(!o.power)return false;
  if(!sent.has('MCP_RESET')){a.reset();sent.set('MCP_RESET',Date.now());a.refreshElectrical();}
  const mag=win.B737WMM2025V1?.evaluate?.({lat:state.lat,lon:state.lon,altitudeFt:state.altitudeFt});
  if(!mag?.valid)return false;const h=(Math.round(state.runwayHeadingTrueDeg-mag.declinationDeg)%360+360)%360;
  const targets={speed:160,heading:h,courseL:h,courseR:h,altitude:10000};
  if(takeoff)for(const [control,value] of Object.entries(targets))if(a.getOutput().values[control]!==value)win.dispatchEvent(new win.CustomEvent('b737:mcp-value-change',{detail:{control,value,method:'preset'}}));
  for(const id of ['FD_LEFT','FD_RIGHT','AT_ARM'])win.dispatchEvent(new win.CustomEvent('b737:mcp-hardware-change',{detail:{id,value:id==='AT_ARM'?(takeoff?'ARM':'OFF'):'ON',method:'preset'}}));
  o=a.getOutput();return o.power===true&&o.controls?.fd?.left===true&&o.controls?.fd?.right===true&&o.controls?.atArm===takeoff&&(!takeoff||Object.entries(targets).every(([k,v])=>o.values[k]===v));
 },true);
 const coreReady=Object.values(check).every(Boolean),missing=Object.keys(check).filter(k=>!check[k]),pending=Object.keys(optional).filter(k=>!optional[k]);
 const done=coreReady&&pending.length===0,expired=Date.now()-started>=30000;
 status={state:state.preset,complete:done,coreReady,settled:done||expired,timedOut:expired&&!done,missing,pending,checks:{...check,...optional}};
 const node=win.document.getElementById('flightScenarioStatus');
 if(node)node.textContent=state.preset.replaceAll('_',' ')+' · '+(done?'OWNER CHECKS PASSED':expired?'INCOMPLETE — '+[...missing,...pending].join(', '):'CONFIGURING — '+[...missing,...pending].join(', '));
 win.dispatchEvent(new win.CustomEvent('b737:powered-general-preset-status',{detail:status}));
 if(done||expired)stop();
 }
 pass();if(run===serial)timer=win.setInterval(pass,250);
 return status;
}
win.addEventListener('b737:flight-scenario-stopped',stop);
win.B737PoweredGeneralPresetsV1=Object.freeze({applies,apply,stop,getStatus:get});
})(window);
