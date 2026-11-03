/* SIXPACK-LIVE-0001: read-only adapter from existing Unified system outputs.
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
  'CAPT.FLT CONT':['flight-pressure-a','flight-pressure-b','stby-pressure','stby-quantity','feel-diff','speed-trim','mach-trim','auto-slat','yaw-damper'],
  'CAPT.ELEC':['standby-power-off','transferBusOff1','transferBusOff2','busOff1','busOff2','gen-off-bus-1','gen-off-bus-2','apu-gen-off-bus'],
  'CAPT.IRS':['irs-l-on-dc','irs-r-on-dc','irs-l-fault','irs-r-fault','irs-l-dc-fail','irs-r-dc-fail'],
  'CAPT.APU':['apu-high-oil-temp','apu-overspeed','apu-low-oil-quantity'],
  'CAPT.FUEL':['filter-1','filter-2','fuel-center-l','fuel-center-r','fuel-1-aft','fuel-1-fwd','fuel-2-fwd','fuel-2-aft'],
  'CAPT.OVHT/DET':[],
  'FO.ANTI ICE':['window-l-side-overheat','window-l-fwd-overheat','window-r-fwd-overheat','window-r-side-overheat','cowl-anti-ice-1','cowl-anti-ice-2'],
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
  return result;
 }
 function electrical(packet){
  const result=empty(),state=packet?.state||packet;
  if(!state||typeof state!=='object'||!state.faults)return result;
  // Only explicit fault outputs; an unpowered bus or stopped generator is not a failure.
  for(const id of ['GEN1_FAILED','GEN2_FAILED','TRANSFER_BUS_1_FAILED','TRANSFER_BUS_2_FAILED','TR1_FAILED','TR2_FAILED','TR3_FAILED'])
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
 function merge(sourceStates){
  const out=empty();
  for(const [source,snapshot] of Object.entries(sourceStates||{})){
   if(!snapshot)continue;
   for(const k of Object.keys(out)){
    const arr=snapshot[k];
    if(Array.isArray(arr))for(const id of arr)if(typeof id==='string'&&id.length<120&&!out[k].includes(id))out[k].push(id);
   }
  }
  return out;
 }
 function install(win){
  const sources={overhead:empty(),electrical:empty(),fire:empty()};
  let last='',updates=0,activeSource={overhead:false,electrical:false,fire:false};
  function publish(){
   const combined=merge(sources),signature=JSON.stringify(combined);
   if(signature===last)return;
   last=signature;updates++;
   win.B737SixPack?.setLiveConditions?.(combined,'UNIFIED_SYSTEMS');
   win.dispatchEvent(new win.CustomEvent('b737:sixpack-live-status',{
    detail:{version:'SIXPACK-LIVE-0001',updates,sources:{...activeSource},active:Object.fromEntries(Object.entries(combined).map(([k,v])=>[k,v.length]))}
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
   if(d?.type==='b737:cockpit-overhead'&&d.kind==='state')update('overhead',overhead(d));
  });
  win.addEventListener('b737:electrical-v7-state',e=>update('electrical',electrical(e.detail)));
  win.addEventListener('b737:fire-protection-state',e=>update('fire',fire(e.detail)));
  win.addEventListener('b737:unified-fire-lamps-mounted',()=>update('fire',fire(win.B737UnifiedFireLights?.indications?.())));
  // Live FIRE WARN is accepted only from an explicit warning signal, not
  // from the engine OVERHEAT lens, APU bottle indicators, or generic faults.
  win.addEventListener('b737:fire-warning-state',e=>{
   if(typeof e.detail?.active==='boolean')win.B737SixPack?.setFireWarning?.(e.detail.active,'UNIFIED_FIRE_WARNING');
  });
  win.B737SixPackLiveV1=Object.freeze({
   version:'SIXPACK-LIVE-0001',deriveOverhead:overhead,deriveElectrical:electrical,deriveFire:fire,
   snapshot:()=>({sources:{...activeSource},reasons:merge(sources),updates}),
   refresh:()=>{
    const power=win.B737UnifiedElectricalLive?.snapshot?.();
    if(power?.faults)update('electrical',electrical(power));
    const f=win.B737UnifiedFireLights?.indications?.();
    if(f)update('fire',fire(f));
    publish();
   }
  });
  win.addEventListener('b737:sixpack-ready',()=>{last='';publish();});
  win.B737SixPackLiveV1.refresh();
  return win.B737SixPackLiveV1;
 }
 return Object.freeze({groups,empty,overhead,electrical,fire,merge,install});
});
