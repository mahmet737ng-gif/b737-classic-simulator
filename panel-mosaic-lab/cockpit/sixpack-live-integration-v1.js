/* SIXPACK-LIVE-0006: read-only adapter from existing Unified system outputs.
 * Never creates a second electrical/overhead/fire engine or infers unobserved alarms.
 * Training approximation: uses verified illuminated category-related OH annunciators.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document)api.install(root);
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const groups=Object.freeze({
  'CAPT.FLT CONT':['flight-pressure-a','flight-pressure-b','stby-pressure','stby-quantity','stby-rudder','feel-diff','speed-trim','mach-trim','auto-slat','yaw-damper'],
  'CAPT.ELEC':['standby-power-off','transferBusOff1','transferBusOff2','busOff1','busOff2','gen-off-bus-1','gen-off-bus-2','apu-gen-off-bus'],
  'CAPT.IRS':['irs-l-fault','irs-r-fault','irs-l-dc-fail','irs-r-dc-fail'],
  'CAPT.APU':['apu-low-pressure','apu-high-oil-temp','apu-overspeed','apu-low-oil-quantity'],
  'CAPT.FUEL':['filter-1','filter-2','fuel-center-l','fuel-center-r','fuel-1-aft','fuel-1-fwd','fuel-2-fwd','fuel-2-aft'],
  'CAPT.OVHT/DET':[],
  'FO.ANTI ICE':['window-l-side-overheat','window-l-fwd-overheat','window-r-fwd-overheat','window-r-side-overheat','cowl-anti-ice-1','cowl-anti-ice-2','probe-capt-ps','probe-fo-static','probe-l-elev','probe-l-alpha','probe-fo-ps','probe-capt-static','probe-r-elev','probe-r-alpha'],
  'FO.ENG':['reverser-1','reverser-2','low-idle','drive-1-drive-pressure','drive-2-drive-pressure','drive-1-drive-temperature','drive-2-drive-temperature'],
  'FO.HYD':['hyd-eng-1','hyd-eng-2','hyd-elec-1','hyd-elec-2','hyd-elec-1-overheat','hyd-elec-2-overheat'],
  'FO.OVERHEAD':['equip-supply-off','equip-exhaust-off','flight-recorder-off','emergency-not-armed'],
  'FO.DOORS':['door-fwd-entry','door-aft-entry','door-fwd-service','door-aft-service','door-fwd-cargo','door-aft-cargo','door-air-stair','door-equip'],
  'FO.AIR COND':['duct-overheat-l','duct-overheat-r','pack-trip-l','pack-trip-r','wing-body-overheat-l','wing-body-overheat-r','bleed-trip-l','bleed-trip-r','press-auto-fail','press-off-sched-descent']
 });
 const empty=()=>Object.fromEntries(Object.keys(groups).map(k=>[k,[]]));
 const validOn=v=>v==='ON'||v==='FLASH';
 function overhead(packet){
  if(!packet||typeof packet!=='object'||!packet.frames||packet.lampTest===true)return null;
  const result=empty();
  if(packet.power!==true)return result;
  for(const [name,ids]of Object.entries(groups))result[name]=ids.filter(id=>validOn(packet.frames[id])).map(id=>'OH:'+id);
  // FCOM 12.10.3: one main tank LOW PRESSURE is recall-only,
  // both FWD and AFT LOW PRESSURE on the same tank prompt master caution.
  // Center-tank caution depends on aircraft modifications: keep separate.
  for(const pair of [['fuel-1-fwd','fuel-1-aft'],['fuel-2-fwd','fuel-2-aft']]){
   const affected=pair.filter(id=>validOn(packet.frames[id]));
   if(affected.length===1){
    const id='OH:'+affected[0],idx=result['CAPT.FUEL'].indexOf(id);
    if(idx>=0)result['CAPT.FUEL'][idx]={id,mode:'RECALL_ONLY'};
   }
  }
  return result;
 }
 function electrical(packet){
  const result=empty(),state=packet?.state||packet;
  if(!state||typeof state!=='object'||!state.faults)return result;
  // Only explicit fault outputs; an unpowered bus or stopped generator is not a failure.
  for(const id of ['GEN1_FAILED','GEN2_FAILED','TRANSFER1_RELAY_FAILED','TRANSFER2_RELAY_FAILED','TR1_FAILED','TR2_FAILED','TR3_FAILED','STATIC_INVERTER_FAILED'])
   if(state.faults[id]===true)result['CAPT.ELEC'].push('ELEC:'+id);
  if(state.faults.APU_FAILED===true)result['CAPT.APU'].push('ELEC:APU_FAILED');
  return result;
 }
 function fire(packet){
  const out=empty(), lamps=packet?.indications||packet;
  if(!lamps||typeof lamps!=='object')return out;
  for(const id of ['ENG1_OVERHEAT','ENG2_OVERHEAT','APU_DET_INOP'])
   if(lamps[id]===true)out['CAPT.OVHT/DET'].push('FIRE:'+id);
  return out;
 }

 function irs(packet){
  if(!packet?.units||!['L','R'].every(side=>packet.units[side]))return null;
  const out=empty();
  for(const side of ['L','R']){
   const u=packet.units[side];if(u.powered!==true)continue;
   if(u.faultLamp===true)out['CAPT.IRS'].push('IRS:'+side+':FAULT');
   if(u.alignLampFlashing===true&&u.alignStatusCode!==null&&u.alignStatusCode!==undefined)
    out['CAPT.IRS'].push('IRS:'+side+':ALIGN_BLOCK_'+u.alignStatusCode);
  }
  return out;
 }
 function windowHeat(packet){
  if(packet?.schema!=='B737_WINDOW_HEAT_V1_RESULT'||!packet.channels)return null;
  const out=empty();
  for(const [id,c]of Object.entries(packet.channels))
   if(c?.overheatOn===true&&c.indicationPowered===true)out['FO.ANTI ICE'].push('WH:'+id+':OVERHEAT');
  return out;
 }
 function tatProbe(packet){
  if(!packet||typeof packet!=='object'||!packet.faults||typeof packet.amberOn!=='boolean')return null;
  const out=empty();
  // TEMP PROBE amber with no requested heater is a normal ground indication.
  if(packet.lampPower===true&&packet.heaterRequested===true&&packet.amberOn===true)
   out['FO.ANTI ICE'].push('TAT:HEAT_DEMAND_UNSATISFIED');
  return out;
 }

 // ECU oil-light evidence is used only with a powered live Overhead. The
 // physical OH lamp remains the fallback until ECU telemetry becomes ready.
 // TAT TEMP PROBE is intentionally excluded from generic probe mapping:
 // its separate live adapter prevents normal ground indications becoming faults.
 function apuECU(packet){
  const a=packet?.apu;
  if(!a||typeof a.phase!=='string'||typeof a.oil?.lowPressureLamp!=='boolean')return null;
  const out=empty();
  if(a.phase!=='OFF'&&a.oil.lowPressureLamp===true)
   out['CAPT.APU'].push('ECU:APU:LOW_OIL_PRESSURE');
  return out;
 }
 function pressurization(packet){
  if(!['CPCS','DCPCS'].includes(packet?.system)||!packet.lamps)return null;
  const out=empty();
  if(packet.lamps.autoFail===true)out['FO.AIR COND'].push('PRESS:'+packet.system+':AUTO_FAIL');
  if(packet.lamps.offSchedDescent===true)out['FO.AIR COND'].push('PRESS:'+packet.system+':OFF_SCHED_DESCENT');
  return out;
 }
 function airconZones(packet){
  if(!packet||!['B737-300-500','B737-400'].includes(packet.family)||!packet.zoneFaults)return null;
  const out=empty();
  if(packet.family==='B737-400')for(const id of ['cont-cab','fwd-cab','aft-cab']){
   if(packet.zoneFaults[id]===true)out['FO.AIR COND'].push('AIRCON400:'+id+':ZONE_FAULT');
  }
  return out;
 }
 function airconFcomRecall(packet){
  const out=empty();
  if(packet?.family!=='B737-400')return out;
  for(const side of ['L','R'])if(packet.pack400?.[side]?.recallOnly)
   out['FO.AIR COND'].push({id:'AIRCON400:PACK:'+side+':SINGLE_CONTROLLER',mode:'RECALL_ONLY'});
  for(const zone of ['CONT','FWD','AFT'])if(packet.zones?.[zone]?.recallOnly)
   out['FO.AIR COND'].push({id:'AIRCON400:ZONE:'+zone+':CONTROLLER',mode:'RECALL_ONLY'});
  return out;
 }
 function merge(sourceStates){
  const out=empty();
  for(const [source,snapshot] of Object.entries(sourceStates||{})){
   if(!snapshot)continue;
   for(const k of Object.keys(out)){
    const arr=snapshot[k];
    if(Array.isArray(arr))for(const item of arr){
     const id=typeof item==='string'?item:item?.id;
     if(typeof id!=='string'||!id||id.length>120)continue;
     const mode=typeof item==='string'?'IMMEDIATE':item.mode;
     if(!['IMMEDIATE','RECALL_ONLY'].includes(mode))continue;
     const old=out[k].findIndex(x=>(typeof x==='string'?x:x.id)===id);
     if(old<0)out[k].push(typeof item==='string'?item:{id,mode});
     else if(mode==='IMMEDIATE'&&typeof out[k][old]!=='string')out[k][old]={id,mode};
    }
   }
  }
  return out;
 }
 function install(win){
  const sources={overhead:empty(),electrical:empty(),fire:empty(),irs:empty(),windowHeat:empty(),tatProbe:empty(),pressurization:empty(),airconZones:empty(),airconRecall:empty(),apuECU:empty(),redundancy:empty()};
  let overheadPowered=null;
  let last='',updates=0,activeSource={overhead:false,electrical:false,fire:false,irs:false,windowHeat:false,tatProbe:false,pressurization:false,airconZones:false,airconRecall:false,apuECU:false,redundancy:false};
  function resolved(){
   const filtered=empty();
   for(const [k,v]of Object.entries(sources.overhead))filtered[k]=[...v];
   if(activeSource.irs)filtered['CAPT.IRS']=[];
   if(activeSource.apuECU)filtered['CAPT.APU']=filtered['CAPT.APU'].filter(id=>id!=='OH:apu-low-pressure');
   if(activeSource.windowHeat)filtered['FO.ANTI ICE']=filtered['FO.ANTI ICE'].filter(id=>!id.startsWith('OH:window-'));
   if(activeSource.pressurization)filtered['FO.AIR COND']=filtered['FO.AIR COND']
    .filter(id=>!['OH:press-auto-fail','OH:press-off-sched-descent'].includes(id));
   const inputs={...sources,overhead:filtered};
   if(overheadPowered!==true)inputs.apuECU=empty(); // never energize MC from an unpowered/unknown APU lamp
   return merge(inputs);
  }
  // The new classifier models only the FCOM-supported FCC and auto-slat pairs.
  // It never mutates aircraft systems and listens to explicit channel evidence.
  const redundancy=win.B737ClassicRedundancyCautionV1?.create?.()||null;
  const fireWarningInputs={wheelWell:false,external:false};
  function publishPhysical(){
   if(!redundancy)return;
   const state=redundancy.snapshot();
   const recalled=win.B737SixPack?.getCautionDiagnostics?.().recalled?.includes('CAPT.FLT CONT')===true;
   const indicators=Object.fromEntries(Object.entries(state.indicators).map(([id,v])=>[
    id,{on:v.mode==='IMMEDIATE'||v.mode==='RECALL_ONLY'&&recalled,mode:v.mode}
   ]));
   const frame=win.document.getElementById('overheadFrame');
   if(frame?.contentWindow&&win.location?.origin)
    frame.contentWindow.postMessage?.({type:'b737:cockpit-command',action:'redundancy-physical-lamps',indicators},win.location.origin);
   win.dispatchEvent(new win.CustomEvent('b737:redundancy-indicator-state',{
    detail:{schema:'REDUNDANCY-CAUTION-0001',indicators,recalled,channels:state.channels}
   }));
  }
  function setChannelFailure(system,channel,failed){
   if(!redundancy)return false;
   const snapshot=redundancy.setChannel(system,channel,failed);
   if(!snapshot)return false;
   update('redundancy',snapshot.reasons);
   publishPhysical();updateRedundancyControls();
   return snapshot;
  }
  function setSystemFailures(system,channels){
   if(!redundancy)return false;
   const snapshot=redundancy.setSystem(system,channels);
   if(!snapshot)return false;
   update('redundancy',snapshot.reasons);
   publishPhysical();updateRedundancyControls();
   return snapshot;
  }
  function updateRedundancyControls(){
   if(!redundancy)return;
   const state=redundancy.snapshot();
   const box=win.document.getElementById('b737RedundancyPanel');
   if(!box)return;
   for(const n of box.querySelectorAll('input[data-redundancy-system]')){
    n.checked=state.channels[n.dataset.redundancySystem]?.[n.dataset.redundancyChannel]===true;
   }
  }
  function mountRedundancyControls(){
   if(!redundancy)return;
   const inspector=win.document.getElementById('b737SixpackInspector');
   if(!inspector||win.document.getElementById('b737RedundancyPanel'))return;
   const section=win.document.createElement('section');
   section.id='b737RedundancyPanel';section.dir='ltr';
   section.style.cssText='padding:10px;margin-top:9px;border:1px solid #55616a;border-radius:7px;background:#151f27';
   const h=win.document.createElement('h3');h.textContent='Dual-channel failure · FCOM 9.10';
   h.style.cssText='margin:0 0 7px;font-size:13px';section.append(h);
   const info=win.document.createElement('small');
   info.textContent='Single failure: Recall-only. Both failed: Master Caution + FLT CONT. Training injection; no physical FCC/SMYD fault is assumed.';
   info.style.cssText='display:block;color:#b4c6d1;margin-bottom:8px';section.append(info);
   for(const sys of win.B737ClassicRedundancyCautionV1.KEYS){
    const row=win.document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:9px;margin:6px 0;flex-wrap:wrap';
    const title=win.document.createElement('strong');title.style.cssText='min-width:96px;font-size:11px';title.textContent=sys.replaceAll('_',' ');row.append(title);
    for(const ch of ['A','B']){
     const label=win.document.createElement('label');label.style.cssText='font-size:11px';
     const input=win.document.createElement('input');input.type='checkbox';
     input.dataset.redundancySystem=sys;input.dataset.redundancyChannel=ch;
     input.addEventListener('change',()=>setChannelFailure(sys,ch,!!input.checked));
     label.append(input,win.document.createTextNode(' '+ch));row.append(label);
    }
    section.append(row);
   }
   inspector.append(section);updateRedundancyControls();
  }
  function fireWarningFrom(source,active){
   if(typeof active!=='boolean')return;
   fireWarningInputs[source]=active;
   win.B737SixPack?.setFireWarning?.(Object.values(fireWarningInputs).some(Boolean),'UNIFIED_FIRE_WARNING');
  }
  function publish(){
   const combined=resolved(),signature=JSON.stringify(combined);
   if(signature===last)return;
   last=signature;updates++;
   win.B737SixPack?.setLiveConditions?.(combined,'UNIFIED_SYSTEMS');
   win.dispatchEvent(new win.CustomEvent('b737:sixpack-live-status',{
    detail:{version:'SIXPACK-LIVE-0006',updates,sources:{...activeSource},active:Object.fromEntries(Object.entries(combined).map(([k,v])=>[k,v.length]))}
   }));
  }
  function update(kind,data){
   if(!Object.hasOwn(sources,kind)||!data)return;
   sources[kind]=data;activeSource[kind]=true;publish();
  }
  // Only the actual embedded OH iframe is an allowed source. Ignore test-lab iframes.
  win.addEventListener('message',e=>{
   if(e.origin!==win.location.origin||e.source!==win.document.getElementById('overheadFrame')?.contentWindow)return;
   const d=e.data;
   if(d?.type!=='b737:cockpit-overhead')return;
   if(d.kind==='state'){
   if(d.lampTest!==true&&d.frames&&typeof d.power==='boolean')overheadPowered=d.power;
   update('overhead',overhead(d));
  }
   if(d.kind==='pressurization-live-output')update('pressurization',pressurization(d));
   if(d.kind==='aircon400-zone-status')update('airconZones',airconZones(d));
  });
  win.addEventListener('b737:unified-ecu-observation',e=>update('apuECU',apuECU(e.detail)));
  // Clear retired controller/zone snapshots when switching 300/500 <-> 400 or CPCS <-> DCPCS.
  // Fresh OH live outputs will repopulate them without preserving stale cautions.
  win.addEventListener('b737:aircraft-profile-change',()=>{
   sources.airconZones=empty();activeSource.airconZones=false;
   sources.airconRecall=empty();activeSource.airconRecall=false;
   sources.pressurization=empty();activeSource.pressurization=false;
   publish();
  });
  win.addEventListener('b737:aircon-fcom-status',e=>update('airconRecall',airconFcomRecall(e.detail)));
  win.addEventListener('b737:electrical-v7-state',e=>update('electrical',electrical(e.detail)));
  win.addEventListener('b737:redundancy-channel-state',e=>{
   const d=e.detail;if(d)setChannelFailure(d.system,d.channel,d.failed);
  });
  for(const event of ['b737:sixpack-recall','b737:sixpack-acknowledge','b737:sixpack-system-update']){
   win.addEventListener(event,publishPhysical);
  }
  const frame=win.document.getElementById('overheadFrame');
  frame?.addEventListener?.('load',publishPhysical);
  win.addEventListener('b737:irs-trainer-state',e=>update('irs',irs(e.detail)));
  win.addEventListener('b737:window-heat-annunciations',()=>update('windowHeat',windowHeat(win.B737WindowHeatUnifiedV1?.getOutput?.())));
  win.addEventListener('b737:tat-probe-output',e=>update('tatProbe',tatProbe(e.detail)));
  win.addEventListener('b737:fire-protection-state',e=>{
   update('fire',fire(e.detail));
   fireWarningFrom('wheelWell',e.detail?.indications?.WHEEL_WELL);
  });
  win.addEventListener('b737:unified-fire-indicators-state',e=>{
   update('fire',fire(e.detail));
   fireWarningFrom('wheelWell',e.detail?.indications?.WHEEL_WELL);
  });
  win.addEventListener('b737:unified-fire-lamps-mounted',()=>{
   const lights=win.B737UnifiedFireLights?.systemIndications?.();
   if(lights){update('fire',fire(lights));fireWarningFrom('wheelWell',lights.WHEEL_WELL);}
  });
  // Live FIRE WARN is accepted only from an explicit warning signal, not
  // from the engine OVERHEAT lens, APU bottle indicators, or generic faults.
  win.addEventListener('b737:fire-warning-state',e=>{
   fireWarningFrom('external',e.detail?.active);
  });
  win.B737SixPackLiveV1=Object.freeze({
   version:'SIXPACK-LIVE-0005',deriveOverhead:overhead,deriveElectrical:electrical,deriveFire:fire,
    deriveIRS:irs,deriveWindowHeat:windowHeat,deriveTAT:tatProbe,
    derivePressurization:pressurization,deriveAircon400:airconZones,deriveAPUECU:apuECU,
    setChannelFailure,setSystemFailures,
    getRedundancyState:()=>redundancy?.snapshot?.()||null,
   snapshot:()=>({sources:{...activeSource},reasons:resolved(),overheadPowered,updates}),
   refresh:()=>{
    const power=win.B737UnifiedElectricalLive?.snapshot?.();
    if(power?.faults)update('electrical',electrical(power));
    const i=win.B737IRSTrainerUnified?.getState?.();if(i?.units)update('irs',irs(i));
    const w=win.B737WindowHeatUnifiedV1?.getOutput?.();if(w?.channels)update('windowHeat',windowHeat(w));
    const t=win.B737TATProbeUnifiedV1?.getOutput?.();if(t?.faults)update('tatProbe',tatProbe(t));
    const f=win.B737UnifiedFireLights?.systemIndications?.()||win.B737UnifiedFireLights?.indications?.();
    if(f){update('fire',fire(f));fireWarningFrom('wheelWell',f.WHEEL_WELL);}
    const apu=win.B737ISNCockpitV1?.getECUState?.();
    if(apu?.apu)update('apuECU',apuECU(apu));
    publish();
   }
  });
  win.addEventListener('b737:sixpack-ready',()=>{last='';publish();publishPhysical();mountRedundancyControls();});
  if(redundancy)update('redundancy',redundancy.snapshot().reasons);
  if(win.document.readyState!=='loading')mountRedundancyControls();
  else win.document.addEventListener?.('DOMContentLoaded',mountRedundancyControls);
  win.B737SixPackLiveV1.refresh();
  publishPhysical();
  return win.B737SixPackLiveV1;
 }
 return Object.freeze({groups,empty,overhead,electrical,fire,irs,windowHeat,tatProbe,apuECU,pressurization,airconZones,merge,install});
});
