(function(){
 'use strict';
 const script=document.currentScript.src,url=p=>new URL(p,script).href,byId=id=>document.getElementById(id),model=window.B737OverheadLightModel;
 let registry,instanceFaces,readabilityFaces,engine,layer,selected,ready=false,timer,valveTimer,ui,widgets=new Map();const now=()=>performance.now();
 const pressed=new Set(),pointerLamps=new Map(),byLightId=new Map();let lastSnapshot=null;
 // Momentary individual lens test is visual only. Never write a fault, sensor,
 // bus state or annunciator source when a lamp is physically pressed.
 function paintLamp(c){
  const node=widgets.get(c.id);if(!node||!lastSnapshot)return;
  const testing=pressed.has(c.id),v=lastSnapshot.lights[c.id];
  const state=v===null?'UNKNOWN':v?'ON':'OFF';
  const frame=testing?(c.states||['OFF','ON']).at(-1):lastSnapshot.frames[c.id];
  node.dataset.state=state;node.dataset.pushTest=String(testing);node.dataset.frame=frame;
  for(const img of node.querySelectorAll('.light-face'))
   img.classList.toggle('active',img.dataset.frame===(frame==='FLASH'?'ON':frame));
  node.classList.toggle('flashing',!testing&&frame==='FLASH');
  node.setAttribute('aria-label',c.id+' — '+(testing?'PUSH TO TEST':state));
 }
 function clearLampPress(id){
  if(!pressed.delete(id))return;
  const c=byLightId.get(id);if(c)paintLamp(c);
 }
 function releasePointer(e){
  const id=pointerLamps.get(e.pointerId);if(!id)return;
  pointerLamps.delete(e.pointerId);
  if(![...pointerLamps.values()].includes(id))clearLampPress(id);
 }
 function clearPresses(){
  pointerLamps.clear();for(const id of [...pressed])clearLampPress(id);
 }
 function bindLampPress(node,c){
  node.addEventListener('pointerdown',e=>{
   e.stopPropagation();if(e.pointerType==='mouse'&&e.button!==0)return;
   pointerLamps.set(e.pointerId,c.id);pressed.add(c.id);paintLamp(c);
  });
  node.addEventListener('keydown',e=>{
   if((e.key===' '||e.key==='Enter')&&!e.repeat){
    e.preventDefault();e.stopPropagation();pressed.add(c.id);paintLamp(c);
   }
  });
  node.addEventListener('keyup',e=>{
   if(e.key===' '||e.key==='Enter'){e.preventDefault();e.stopPropagation();clearLampPress(c.id);}
  });
  node.addEventListener('blur',()=>clearLampPress(c.id));
 }

 const faultable=new Set(['sensor','fuel-pressure','hyd-pressure','flight-pressure','standby-pressure','yaw','drive-pressure','drive-temperature','equipment','window','probe','dc-fail','fault','irs-align','apu','recorder','anti-ice','pneumatic','press-fault','valve','fuel-valve','ram-door']);
 function snapshots(){
   const toggles=window.B737OverheadToggles.getState(),rotary=window.B737RotaryGuards.getState();
   // Read the protected Owner18 guarded switch values without changing their runtime.
   const owner=window.B737GuardOwner18?.inspect?.();
   if(owner)for(const id of ['flight-control-a','flight-control-b']){
    const value=owner[id]?.value;
    if(['STBY RUD','OFF','ON'].includes(value))rotary.guards[id]={value};
   }
   return [toggles,rotary];
  }
 function faceSource(c,state,face){
  // OH14 retains its original photographed lens; use emissive glass only,
  // never duplicate the picture's bezel or change the other 111 lights.
  if(c.id==='emergency-not-armed')return url('oh14-not-armed-emission-'+(state==='ON'?'on':'off')+'.svg');
  return window.B737LampAppearance.resolve('OH',c.asset,state)||url(face.url);
 }

 function render(result){
  lastSnapshot=result;for(const c of registry.lights)paintLamp(c);
  window.dispatchEvent(new CustomEvent('b737:overhead-light-state'));
  if(!ui)return;
  byId('lightsStatus').textContent=Object.values(result.lights).filter(v=>v===true).length+' / '+registry.lights.length+' روشن'+(result.power?'':' · تغذیهٔ تست خاموش')+(result.lampTest?' · LAMP TEST':'');
  byId('lightsUnknown').textContent=result.unknown.length?'UNKNOWN: '+result.unknown.join(', ')+' — ابهام منبع برق در دیتابیس حفظ شده است.':'';
  if(selected){byId('lightValue').textContent=result.lights[selected.id]===null?'UNKNOWN':result.frames[selected.id];byId('lightFault').checked=result.context.faults[selected.id]===true;}
  for(const input of ui.querySelectorAll('[data-scenario]'))input.checked=result.context[input.dataset.scenario];
 }
 function choose(c){selected=c;byId('lightSelect').value=c.id;byId('lightName').textContent=c.id;byId('lightLinks').textContent=c.controls.length?c.controls.join(' / '):'Sensor: '+c.sensor;byId('lightFault').disabled=!faultable.has(c.rule)&&c.id!=='dual-bleed';byId('lightRule').textContent=(c.rule==='electrical'||c.rule==='standby-power'?'Electrical V7 · FCOM 6.10.7 / 6.10.9':c.rule==='pneumatic'?'Pneumatics V6 · '+c.provenance.status:'SIM_APPROX_ONLY · FCOM chapter '+c.provenance.chapter);render(engine.snapshot());}
 function synchronize(event){if(!ready)return;const [t,r]=snapshots();engine.ingest(t,r,now(),event);settle();}
 function settle(){clearTimeout(timer);clearTimeout(valveTimer);timer=setTimeout(()=>engine.evaluate(now()),750);valveTimer=setTimeout(()=>engine.evaluate(now()),850);}
 function releaseTest(){if(ready)engine.setLampTest(false,now());}
 function inspector(){
  ui=document.createElement('section');ui.className='lights-inspector';ui.id='lightsInspector';
  ui.innerHTML='<strong>۱۱۰ چراغ · ۶۷ نوع · LGT-0003</strong><p id="lightsStatus" role="status" aria-live="polite"></p><button id="lampTest">نگه‌دار: تست چراغ‌ها</button><label><input id="lightVisibility" type="checkbox" checked> نمایش چراغ‌ها</label><label>انتخاب چراغ<select id="lightSelect" dir="ltr"></select></label><h3 id="lightName"></h3><output id="lightValue"></output><p id="lightLinks"></p><label><input id="lightFault" type="checkbox"> تزریق خرابی / بازبودن در / وضعیت حسگر</label><small id="lightRule"></small><details><summary>ورودی‌های سناریوی تست</summary><div id="lightScenarios"></div><button id="pneumaticTripReset">TRIP RESET — پس از رفع علت</button><button id="resetLightScenario">پاک‌کردن خرابی‌ها و بازنشانی سناریو</button><p>خاموش‌کردن موتور در این بخش وضعیت موتور را شبیه‌سازی می‌کند. کلیدهای ENGINE START فقط سلکتور استارت هستند. برای IRS، سلکتورهای بالایی و ورودی تغذیهٔ باتری را به‌کار ببر. اکسیژن مسافر تا بازنشانی سناریو فعال می‌ماند.</p></details><p id="lightsUnknown" role="status"></p><details><summary>منبع و موارد باقی‌مانده</summary><p>منطق برق از مدل مستند V7 و منطق پایهٔ سوخت و کنترل پرواز از تست‌های قبلی آمده است. دیتابیس خصوصی در این نشست قابل بازیابی نبود؛ شرط‌های افزوده و تأخیر ۷۲۰ میلی‌ثانیه‌ای پمپ، تقریب تست شبیه‌ساز هستند.</p><p id="missingLightAssets"></p><a href="../lights-test/">تست جداگانهٔ فایل‌های LIGHTS</a></details>';
  ui.querySelector('strong').textContent=registry.lights.length+' چراغ · '+Object.keys(registry.assets).length+' نوع · '+registry.version;
  byId('toggleInspector').before(ui);const select=byId('lightSelect');for(const c of registry.lights){const o=document.createElement('option');o.value=c.id;o.textContent=c.id;select.append(o);}select.onchange=()=>choose(registry.lights.find(c=>c.id===select.value));
  const scenarios=[['onGround','هواپیما روی زمین'],['engine1FuelValveClosed','Fuel Valve 1 بسته'],['engine2FuelValveClosed','Fuel Valve 2 بسته'],['panelPower','تغذیهٔ عمومی تست'],['engine1Running','موتور ۱ روشن'],['engine2Running','موتور ۲ روشن'],['apuRunning','APU روشن'],['groundPowerAttached','برق زمینی آماده'],['fuelAvailable','سوخت موجود'],['standbyPumpFailed','خرابی پمپ Standby'],['irsBatterySupply','IRS روی تغذیهٔ باتری'],['irsLAlignmentInProgress','IRS L در حال هم‌ترازی'],['irsRAlignmentInProgress','IRS R در حال هم‌ترازی'],['irsLAttitudeAvailable','IRS L اطلاعات ATT آماده'],['irsRAttitudeAvailable','IRS R اطلاعات ATT آماده'],['irsLShutdownInProgress','IRS L در چرخهٔ خاموشی'],['irsRShutdownInProgress','IRS R در چرخهٔ خاموشی'],['equipmentSupplyFailed','خرابی فن عادی Supply'],['equipmentExhaustFailed','خرابی فن عادی Exhaust'],['passengerOxygenDeployed','اکسیژن مسافر فعال']];
  for(const [key,label]of scenarios){const l=document.createElement('label'),i=document.createElement('input');i.type='checkbox';i.dataset.scenario=key;i.onchange=()=>{engine.update({[key]:i.checked},now());settle();};l.append(i,document.createTextNode(' '+label));byId('lightScenarios').append(l);}
  byId('missingLightAssets').textContent=registry.unavailableLegends.length?'فایل موجود نیست؛ جایگاه آن‌ها خالی مانده: '+registry.unavailableLegends.join(' · '):'همهٔ فایل‌های چراغ‌های نصب‌شده موجودند.';
  byId('pneumaticTripReset').onclick=()=>engine.tripReset(now());
  byId('lightFault').onchange=e=>engine.update({faults:{[selected.id]:e.target.checked}},now());
  byId('lightVisibility').onchange=e=>layer.classList.toggle('hidden',!e.target.checked);
  byId('resetLightScenario').onclick=()=>{engine.reset(now());synchronize();};
  const b=byId('lampTest');b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);engine.setLampTest(true,now());});
  for(const type of ['pointerup','pointercancel','lostpointercapture','blur'])b.addEventListener(type,releaseTest);
  b.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();engine.setLampTest(true,now());}});b.addEventListener('keyup',releaseTest);
  window.addEventListener('blur',releaseTest);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseTest();});
 }
 function mount(layout){
  if(ready)return;const [t,r]=snapshots(),plates=new Map(layout.placements.map(p=>[p.id,p]));
  const ids=new Set([...Object.keys(t),...Object.keys(r.rotaries),...Object.keys(r.guards)]);model.validate(registry,layout,window.B737OverheadToggleModel.mapPoint,ids);
  layer=document.createElement('div');layer.id='overheadLightLayer';layer.className='lights-layer';
  for(const c of registry.lights){
   const p=model.rectangle(c,plates.get(c.placementId),window.B737OverheadToggleModel.mapPoint),node=document.createElement('button');node.type='button';node.className='mounted-light';node.dataset.light=c.id;if(c.id==='emergency-not-armed')node.dataset.lensOwner='PHOTO_GLASS_EMISSION_ONLY';node.title=c.id+' · '+c.placementId+' · source ['+c.sourceRect.join(', ')+']';
   Object.assign(node.style,{left:p.x+'px',top:p.y+'px',width:p.w+'px',height:p.h+'px'});
   for(const state of c.states||['OFF','ON']){const img=document.createElement('img');const face=(readabilityFaces?.instances?.[c.id]?.states?.[state]||instanceFaces?.instances?.[c.id]?.states?.[state]||registry.assets[c.asset][state]);const source=faceSource(c,state,face);if(window.B737ImageLoader)window.B737ImageLoader.assign(img,source);else img.src=source;img.alt='';img.draggable=false;img.dataset.frame=state;img.className='light-face';img.onerror=()=>{node.dataset.missing='true';byId('lightsStatus').textContent='خطای بارگذاری فایل چراغ: '+c.asset;};node.append(img);}
   byLightId.set(c.id,c);bindLampPress(node,c);node.addEventListener('click',e=>{e.stopPropagation();choose(c);});if(c.id==='emergency-not-armed')node.dataset.brightness=window.B737LampAppearance.getMode?.()||'BRIGHT';widgets.set(c.id,node);layer.append(node);
  }
  document.addEventListener('pointerup',releasePointer,true);
   document.addEventListener('pointercancel',releasePointer,true);
   window.addEventListener('blur',clearPresses);
   document.addEventListener('visibilitychange',()=>{if(document.hidden)clearPresses();});
   byId('atlasAbsolute').append(layer);engine=model.controller(registry,window.B737ElectricalV7,render,window.B737PneumaticsV6);inspector();ready=true;synchronize();choose(registry.lights.find(c=>c.id==='fuel-center-l'));
  window.addEventListener('b737:cb-state-change',()=>synchronize());
  for(const type of ['b737:switch-change','b737:rotary-change','b737:guarded-change'])window.addEventListener(type,e=>synchronize(e.detail));
   // Owner18 has a distinct guard-change event: re-evaluate the existing annunciator.
   const flightIds=['flight-control-a','flight-control-b'];
   window.addEventListener('b737:guard-changed',e=>{if(flightIds.includes(e.detail?.id))synchronize();});
   // Rehydrate a saved STBY RUD detent if Owner18 mounts after the lamp layer.
   const ownerReady=()=>{const states=window.B737GuardOwner18?.inspect?.();return flightIds.every(id=>states?.[id]);};
   if(document.querySelector('script[src*="guard-owner18-v1.js"]')&&!ownerReady()){
    const observer=new MutationObserver(()=>{if(ownerReady()){observer.disconnect();synchronize();}});
    observer.observe(byId('atlasAbsolute'),{childList:true,subtree:true});
   }
  byId('resetToggles').addEventListener('click',()=>{engine.reset(now());synchronize();});
  window.addEventListener('b737:overhead-scenario',e=>{try{engine.update(e.detail,now());settle();}catch(error){console.warn(error.message);}});
  window.B737OverheadLights=Object.freeze({getState:()=>engine.snapshot(),setAircraftElectricalPower:value=>{const result=engine.setAircraftElectricalPower(value,now());settle();return result;},getRegistry:()=>JSON.parse(JSON.stringify(registry)),setScenario:patch=>{const result=engine.update(patch,now());settle();return result;},setFault:(id,active)=>engine.update({faults:{[id]:active}},now()),tripReset:()=>engine.tripReset(now()),setWingBodyTestHeld:held=>engine.setWingBodyTestHeld(held,now()),setAuthoritativePneumatics:snapshot=>engine.setAuthoritativePneumatics(snapshot,now()),setLampTest:active=>engine.setLampTest(active,now()),setAircraftFamily:family=>engine.setAircraftFamily(family,now()),setAircon400LeftRecirc:value=>engine.setAircon400LeftRecirc(value,now()),reset:()=>{engine.reset(now());synchronize();}});
 }
 async function start(){try{await window.B737LampAppearance.ready;const responses=await Promise.all([fetch(url('lights.json'),{cache:'no-store'}),fetch(url('../all-overhead/atlas-layout.json'),{cache:'no-store'}),fetch(url('instance-faces.json'),{cache:'no-store'}),fetch(url('readability-faces.json'),{cache:'no-store'})]);if(responses.some(r=>!r.ok))throw Error('Lights registry unavailable');registry=await responses[0].json();const layout=await responses[1].json();instanceFaces=await responses[2].json();readabilityFaces=await responses[3].json();if(instanceFaces.schema!=='b737.lamps.instance-face.v1')throw Error('Invalid per-lamp lens mapping');for(const [id,item] of Object.entries(instanceFaces.instances)){const c=registry.lights.find(x=>x.id===id);if(!c||c.asset!==item.asset||JSON.stringify(c.sourceRect)!==JSON.stringify(item.sourceRect)||Object.keys(registry.assets[c.asset]).some(state=>!item.states[state]))throw Error('Per-instance lens registration mismatch: '+id);}if(readabilityFaces.schema!=='b737.lamps.readability-face-overrides.v1')throw Error('Invalid readable-lens registry');for(const [id,item] of Object.entries(readabilityFaces.instances)){const c=registry.lights.find(x=>x.id===id);if(!c||c.asset!==item.asset||JSON.stringify(c.sourceRect)!==JSON.stringify(item.sourceRect))throw Error('Readability lens registration mismatch: '+id);}const check=()=>!!(window.B737OverheadToggles&&window.B737RotaryGuards&&byId('atlasAbsolute').querySelector('.atlas-piece'));
  if(check())mount(layout);else {const obs=new MutationObserver(()=>{if(check()){obs.disconnect();mount(layout);}});obs.observe(byId('atlasAbsolute'),{childList:true,subtree:true});}
 }catch(error){console.error(error);const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='خطا در نصب چراغ‌ها: '+error.message;byId('toggleInspector').before(p);}}
 if(new URLSearchParams(location.search).has('debugLights'))document.documentElement.dataset.lightGeometryDebug='true';
 function relight(){
   if(!ready)return;
   const oh14=widgets.get('emergency-not-armed');
   if(oh14)oh14.dataset.brightness=window.B737LampAppearance.getMode?.()||'BRIGHT';
   for(const c of registry.lights){
     const node=widgets.get(c.id);if(!node)continue;
     for(const img of node.querySelectorAll('.light-face')){
       const state=img.dataset.frame;
       const existing=(readabilityFaces?.instances?.[c.id]?.states?.[state]||instanceFaces?.instances?.[c.id]?.states?.[state]||registry.assets[c.asset][state]);
       const source=faceSource(c,state,existing);
       if(img.src!==source){if(window.B737ImageLoader)window.B737ImageLoader.assign(img,source);else img.src=source;}
     }
   }
 }
 window.addEventListener('b737:lamp-brightness-change',relight);
 start();
})();
