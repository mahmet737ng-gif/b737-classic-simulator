/* Owner-defined simulator initialization, not an approved aircraft procedure.
 * Commands go through existing hardware/system owners. No permanent visual override.
 * Incomplete owner acknowledgements are reported, not treated as success.
 */
(function(win){
 'use strict';
 const STATE='COLD_DARK';
 const toggles=Object.freeze({
 'yaw-damper':'OFF','vhf-nav':'NORMAL','irs-transfer':'NORMAL','efi-transfer':'NORMAL',
 'fuel-center-l':'OFF','fuel-center-r':'OFF','fuel-1-aft':'OFF','fuel-1-fwd':'OFF','fuel-2-aft':'OFF','fuel-2-fwd':'OFF',
 'galley':'OFF','equip-cooling-supply':'NORMAL','equip-cooling-exhaust':'NORMAL',
 'no-smoking':'OFF','fasten-belts':'OFF','window-l-side':'OFF','window-l-fwd':'OFF','window-r-fwd':'OFF','window-r-side':'OFF','window-power-test':'OFF',
 'pitot-a':'OFF','pitot-b':'OFF','wing-anti-ice':'OFF','engine-anti-ice-1':'OFF','engine-anti-ice-2':'OFF',
 'hyd-eng-1':'ON','hyd-eng-2':'ON','hyd-elec-1':'OFF','hyd-elec-2':'OFF',
 'pack-l':'OFF','pack-r':'OFF','bleed-eng-1':'ON','bleed-eng-2':'ON','bleed-apu':'ON',
 'landing-out-l':'RETRACT','landing-out-r':'RETRACT','landing-in-l':'OFF','landing-in-r':'OFF',
 'runway-turnoff-l':'OFF','runway-turnoff-r':'OFF','taxi':'OFF','logo':'OFF','strobe':'OFF','position-lights':'OFF','anti-collision':'OFF','wing-lights':'OFF','wheel-well':'OFF'
 });
 const guards=Object.freeze({
 'flight-control-a':['ON',true],'flight-control-b':['ON',true],'spoiler-a':['ON',true],'spoiler-b':['ON',true],
 'battery-master':['OFF',false],'emergency-exit-lights':['OFF',false]
 });
 const rotaries=Object.freeze({'engine-start-1':'OFF','engine-start-2':'OFF','ignition-source':'IGN L'});
 const electricalDisconnect=['gen-1','gen-2','apu-gen-1','apu-gen-2','ground-power'];
 let result=null,serial=0,timer=null;
 function publish(checks,complete){
  result={state:STATE,complete,checks:{...checks}};
  win.dispatchEvent(new win.CustomEvent('b737:cold-dark-preset-status',{detail:result}));
  const p=win.document.getElementById('flightScenarioStatus');
  if(p)p.textContent=complete?'COLD & DARK · OWNER CHECKS PASSED':'COLD & DARK · PENDING: '+Object.keys(checks).filter(k=>!checks[k]).join(', ');
  return result;
 }
 function apply(){
  stop();const run=serial;
  const checks={};
  const once=new Set();
  const attempt=(id,fn)=>{try{checks[id]=fn()===true;}catch(_){checks[id]=false;}};
  const pulse=(oh,id,value)=>{if(once.has(id))return true;const ok=oh.setScenarioSwitch(id,value)?.accepted===true;if(ok)once.add(id);return ok;};
  const pass=()=>{
   if(run!==serial)return;
   const child=win.document.getElementById('overheadFrame')?.contentWindow;
   const oh=child?.B737OverheadToggles,rg=child?.B737RotaryGuards,guard=child?.B737GuardOwner18;
   const eng=win.B737ISNCockpitV1;
   for(const [id,value] of Object.entries(toggles))attempt(id,()=>{
    if(!oh)return false;if(oh.getState()[id]!==value)oh.setScenarioSwitch(id,value);
    return oh.getState()[id]===value;
   });
   for(const [id,value] of Object.entries(rotaries))attempt(id,()=>{
    if(!rg)return false;rg.setEngineLabDetent(id,value);
    const s=rg.getState();return (s.rotaries?.[id]??s[id])===value;
   });
   for(const n of [1,2])attempt('engine'+n,()=>{
    if(!eng)return false;const id='engine'+n;
    if(!once.has(id)){eng.engineTrainerAction({instructor:true,type:'LEVER',engine:id,position:'CUTOFF'});eng.engineTrainerAction({instructor:true,type:'SHUTDOWN',engine:id});once.add(id);}
    return eng.getStartState().phase[id]==='OFF';
   });
   attempt('APU',()=>{
    if(!oh||!eng)return false;
    if(!once.has('APU_OFF')){if(!oh.setScenarioSwitch('apu-start','OFF')?.accepted)return false;once.add('APU_OFF');}
    if(eng.getStartState().phase.apu!=='OFF')return false;
    if(oh.getState()['apu-start']!=='ON')oh.setScenarioSwitch('apu-start','ON');
    return oh.getState()['apu-start']==='ON'&&eng.getStartState().phase.apu==='OFF';
   });
   for(const id of electricalDisconnect)attempt(id,()=>!!oh&&pulse(oh,id,'OFF'));
   for(const [id,[value,closed]] of Object.entries(guards))attempt('guard:'+id,()=>{
    if(!guard)return false;let s=guard.inspect()[id];if(!s)return false;
    if(s.value!==value||s.closed!==closed)guard.set(id,value,closed);
    s=guard.inspect()[id];return s.value===value&&s.closed===closed;
   });
   attempt('IRS',()=>{
    const irs=win.B737IRSTrainerUnified,src=win.B737UnifiedEfisSources;
    if(!irs||!src)return false;
    if(!once.has('IRS')){for(const side of ['L','R'])irs.setMode(side,'OFF');irs.stopMotion();irs.setPowerMode('AIRCRAFT');src.setPreset('LIVE');once.add('IRS');}
    return ['L','R'].every(side=>irs.getState().units[side].mode==='OFF'&&!irs.getState().units[side].positionValid)&&src.getPreset()==='LIVE';
   });
   attempt('AUTOBRAKE',()=>{const a=win.B737AutobrakeUnified;if(!a)return false;if(a.getState().selector!=='OFF')a.setSelector('OFF');return a.getState().selector==='OFF';});
   attempt('SPEEDBRAKE',()=>{const a=win.B737SpeedbrakeLever;if(!a?.mounted())return false;a.set('UP');return a.get()==='UP';});
   attempt('FLAP_LEVER',()=>{const a=win.B737FlapVisualTest;if(!a)return false;if(a.position!==0)a.reset();return a.position===0;});
   attempt('FLAP_INDICATOR',()=>{const a=win.B737FlapNeedles;if(!a)return false;a.setCommon(0);const s=a.getState();return s.left===0&&s.right===0;});
   attempt('GEAR',()=>{const a=win.B737LandingGearUnifiedV1;if(!a)return false;let s=a.getState();if(s.lever!=='DN')a.select('DN');s=a.getState();return s.lever==='DN'&&['nose','left','right'].every(x=>s.gear[x]==='DOWN');});
   attempt('THROTTLES',()=>{const a=win.B737ThrottlePositions;if(!a?.mounted())return false;for(const n of [1,2])a.set(n,0);return [1,2].every(n=>a.get(n)===0);});
   attempt('TRIM',()=>{const a=win.B737StabilizerTrim;if(!a)return false;a.set(5,'MANUAL');return a.get()===5;});
   attempt('PARKING_BRAKE',()=>{const a=win.B737UnifiedParkingBrakeV1;if(!a)return false;a.setEngaged(true,'AIRCRAFT_GENERAL_STATE');return a.getState().engaged===true;});
   attempt('MCP',()=>{const a=win.B737McpAFDSBridgeV1;if(!a)return false;if(!once.has('MCP')){a.reset();once.add('MCP');}return a.getOutput().power===false;});
   attempt('POWER',()=>{
    const e=eng?.getElectricalState?.(),v=e&&win.B737ElectricalV7?.evaluate(e);
    if(!v?.bus)return false;
    const keys=['ac1','ac2','dc1','dc2','acStandby','dcStandby'];
    return keys.every(k=>v.bus[k]===false);
   });
   const complete=Object.values(checks).every(Boolean);
   publish(checks,complete);
   if(complete)stop();
  };
  win.dispatchEvent(new win.CustomEvent('b737:aircraft-general-state',{detail:{state:STATE}}));
  pass();
  if(run===serial){timer=win.setInterval(pass,250);win.setTimeout(()=>{if(run===serial)stop();},8000);}
  return result;
 }
 function stop(){serial++;if(timer!==null){win.clearInterval(timer);timer=null;}}
 win.addEventListener('b737:flight-scenario-stopped',stop);
 win.B737ColdDarkGeneralPresetV1=Object.freeze({apply,stop,getStatus:()=>result,definition:Object.freeze({toggles,guards,rotaries})});
})(window);
