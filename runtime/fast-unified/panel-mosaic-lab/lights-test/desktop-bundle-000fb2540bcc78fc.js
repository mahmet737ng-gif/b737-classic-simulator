(async()=>{
;
/* ../lights-test/asset-model.js?v=LGT-0021 */
try{
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737LightAssets=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const order=['OFF','ON','DIM_BLUE','BRIGHT_BLUE'];
 function parse(name){const m=/^(.*?)_(BRIGHT_BLUE|DIM_BLUE|ON|OFF)\.(PNG|SVG|WEBP|JPE?G)$/i.exec(name);return m?{id:m[1].toUpperCase(),state:m[2].toUpperCase(),ext:m[3].toLowerCase(),name}:null;}
 function discover(list){const found={};for(const f of list){if(f.type!=='file')continue;const a=parse(f.name);if(!a)continue;const previous=found[a.id]?.[a.state],score=x=>({png:4,svg:3,webp:2,jpg:1,jpeg:1}[x.ext]||0);if(!previous||score(a)>score(previous)){found[a.id]??={};found[a.id][a.state]=a;}}return found;}
 function merge(registry,list=[]){const groups=discover(list),all=new Map(registry.lights.map(c=>[c.id,{...c,assets:{...c.assets}}]));for(const [id,files]of Object.entries(groups)){/* One canonical instance per approved legend: legacy/abandoned files must not reappear as duplicate lights. */if(!all.has(id))continue;const c=all.get(id);for(const [s,f]of Object.entries(files))if(!c.assets[s])c.assets[s]=f.name;c.states=order.filter(s=>c.assets[s]);}return [...all.values()];}
 function normalize(c,value){if(typeof value==='boolean')return value?c.states.at(-1):'OFF';return typeof value==='string'&&c.states.includes(value.toUpperCase())?value.toUpperCase():null;}
 return Object.freeze({parse,discover,merge,normalize});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./unified-lights.js?v=LGT-0021 */
try{
(function(){
 'use strict';
 const model=window.B737LightAssets;
 const byId=id=>document.getElementById(id);
 const dialog=byId('unifiedLightsDialog');
 const assetRoot='../assets/locked/2026-10-23/LIGHTS/';
 const states=new Map(),cards=new Map();
 let lights=[],version='LGT-0020',registered=new Set(),loadPromise=null,loaded=false,loadError='';
 const queryKey=value=>String(value).toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');

 function update(c){
  const card=cards.get(c.id);if(!card)return;
  const state=states.get(c.id)||'OFF',file=c.assets[state];
  if(!file){card.health.textContent='MISSING '+state;card.health.classList.add('bad');return;}
  const mountedV2=window.B737LampAppearance?.resolve('OH',c.id,state)||window.B737LampAppearance?.resolve('MP',c.id,state);
  card.image.onload=()=>{
   const w=card.image.naturalWidth,h=card.image.naturalHeight;
   const matches=mountedV2?(w>0&&h>0):(!registered.has(c.id)||(w===c.face.width&&h===c.face.height));
   card.health.textContent=matches?state+' · '+w+'×'+h+(mountedV2?' · '+window.B737LampAppearance.getMode():''):'SIZE MISMATCH · '+w+'×'+h;
   card.health.classList.toggle('bad',!matches);
  };
  card.image.onerror=()=>{card.health.textContent='MISSING '+file;card.health.classList.add('bad');};
  card.image.src=mountedV2||assetRoot+file.split('/').map(encodeURIComponent).join('/')+'?v='+encodeURIComponent(version);
  card.image.alt=c.lines.join(' ')+' '+state;
  card.stage.setAttribute('aria-label',c.id+' · '+state+' · Click for next state');
  for(const button of card.buttons)button.setAttribute('aria-pressed',String(button.dataset.state===state));
 }
 function set(id,value,notify=true){
  const c=lights.find(c=>c.id===String(id).toUpperCase());if(!c)return false;
  const state=model.normalize(c,value);if(!state)return false;
  states.set(c.id,state);update(c);
  if(notify)window.dispatchEvent(new CustomEvent('b737:unified-legend-test',{detail:{asset:c.id,state}}));
  return true;
 }
 function render(){
  const grid=byId('unifiedLightGrid');grid.replaceChildren();cards.clear();
  const query=queryKey(byId('unifiedLightSearch').value);
  const shown=lights.filter(c=>queryKey(c.id+' '+c.lines.join(' ')).includes(query));
  for(const c of shown){
   const card=document.createElement('article');card.className='unified-light-card';card.dataset.light=c.id;
   const heading=document.createElement('h3');heading.textContent=c.lines.join(' / ');
   const id=document.createElement('div');id.className='unified-light-id';id.textContent=c.id;
   const stage=document.createElement('div');stage.className='unified-light-stage';stage.role='button';stage.tabIndex=0;
   const img=document.createElement('img');img.draggable=false;img.loading='lazy';stage.append(img);
   const buttons=document.createElement('div');buttons.className='unified-light-buttons';const bs=[];
   for(const state of c.states){const button=document.createElement('button');button.type='button';button.dataset.state=state;button.textContent=state;button.onclick=()=>set(c.id,state);buttons.append(button);bs.push(button);}
   const advance=()=>set(c.id,c.states[(c.states.indexOf(states.get(c.id)||'OFF')+1)%c.states.length]);
   stage.onclick=advance;stage.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();advance();}};
   const health=document.createElement('div');health.className='unified-light-health';health.setAttribute('role','status');
   card.append(heading,id,stage,buttons,health);grid.append(card);
   cards.set(c.id,{image:img,buttons:bs,stage,health});if(!states.has(c.id))states.set(c.id,'OFF');update(c);
  }
  byId('unifiedLightStats').textContent=lights.length+' lamp types · '+lights.filter(c=>c.states.includes('DIM_BLUE')).length+' three-state blue types · '+shown.length+' displayed · '+version;
 }
 // The single canonical gallery registry is also Unified's library. Do not duplicate
 // 193 SVG files or make a blocking GitHub API call on startup.
 function announceReady(){
  const count=lights.length;
  const open=byId('unifiedLightsOpen');
  open.textContent='Lamp Test ('+count+')';
  open.setAttribute('aria-label','Unified Library · '+count+' lamp types');
  window.dispatchEvent(new CustomEvent('b737:unified-light-library-ready',{
   detail:{version,count,states:lights.reduce((n,c)=>n+c.states.length,0)}
  }));
 }
 function validateRegistry(reg){
  if(!reg||!Array.isArray(reg.lights)||!reg.lights.length)throw Error('No lamps in registry');
  const ids=new Set();
  for(const c of reg.lights){
   if(ids.has(c.id))throw Error('Duplicate ID: '+c.id);
   ids.add(c.id);
   if(!c.assets?.OFF||!c.states?.includes('OFF')||!c.states.some(s=>s!=='OFF'))throw Error('Incomplete State: '+c.id);
   if(!c.face||c.face.width<=0||c.face.height<=0)throw Error('Invalid Dimensions: '+c.id);
   for(const state of c.states){
    const path=c.assets[state];
    if(typeof path!=='string'||!/^[-a-zA-Z0-9_./]+\.svg$/.test(path)||path.includes('..')||path.startsWith('/'))throw Error('Invalid SVG path: '+c.id+' '+state);
   }
  }
 }
 async function sync({renderNow=true,force=true}={}){
  if(loadPromise){
   await loadPromise;
   if(renderNow&&loaded)render();
   return;
  }
  if(loaded&&!force){if(renderNow)render();return;}
  const button=byId('unifiedLightSync');button.disabled=true;
  loadPromise=(async()=>{
   try{
    const response=await fetch('../lights-test/registry.json?ts='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('Lamp registry unavailable');
    const reg=await response.json();
    validateRegistry(reg);
    version=reg.version;registered=new Set(reg.lights.map(c=>c.id));
    lights=model.merge(reg);
    for(const c of lights)if(!c.states.includes(states.get(c.id)))states.set(c.id,'OFF');
    loaded=true;loadError='';announceReady();
   }catch(error){
    loadError=error.message;
    if(!loaded)byId('unifiedLightsOpen').textContent='Lamps · Connection Error';
    byId('unifiedLightStats').textContent='Synchronization Error: '+loadError;
   }finally{button.disabled=false;}
  })();
  try{await loadPromise;}finally{loadPromise=null;}
  if(renderNow&&loaded)render();
 }
 function all(state){for(const c of lights){const s=state==='OFF'?'OFF':c.states.at(-1);states.set(c.id,s);window.dispatchEvent(new CustomEvent('b737:unified-legend-test',{detail:{asset:c.id,state:s}}));}render();}
 byId('unifiedLightsOpen').onclick=()=>{dialog.showModal();if(loaded)render();sync({renderNow:true,force:true});};
 byId('unifiedLightsClose').onclick=()=>dialog.close();
 byId('unifiedLightSearch').oninput=render;
 byId('unifiedLightSync').onclick=sync;
 byId('unifiedLightAllOn').onclick=()=>all('ON');
 byId('unifiedLightAllOff').onclick=()=>all('OFF');
 byId('unifiedLightReset').onclick=()=>{states.clear();window.dispatchEvent(new CustomEvent('b737:unified-legend-clear'));render();};
 // Uniform resolver for future panel mounts. No location or aircraft logic is inferred.
 const find=id=>lights.find(c=>c.id===String(id).toUpperCase())||null;
 const resolve=(id,state='OFF')=>{
  const c=find(id);if(!c)return null;
  const frame=model.normalize(c,state);if(!frame)return null;
  return {id:c.id,state:frame,url:window.B737LampAppearance?.resolve('OH',id,frame)||window.B737LampAppearance?.resolve('MP',id,frame)||new URL(assetRoot+c.assets[frame],location.href).href,
   face:{...c.face},scope:c.scope||'ASSET_TEST_ONLY',
   mountedCockpitInstances:[...(c.mountedCockpitInstances||[])]};
 };
 window.B737UnifiedLights=Object.freeze({
  open:()=>byId('unifiedLightsOpen').click(),
  set,
  getFrame:id=>states.get(String(id).toUpperCase())||'OFF',
  registry:()=>JSON.parse(JSON.stringify(lights)),
  resolve,
  whenReady:()=>loadPromise||Promise.resolve(),
  status:()=>({ready:loaded,version,count:lights.length,error:loadError})
 });
 window.addEventListener('b737:lamp-brightness-change',()=>{if(loaded)render();});
 // Preload metadata only: images stay lazy until the user opens the test library.
 sync({renderNow:false,force:false});
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/electrical-v7.js?v=ATA24-CLASSIC-RECTIFY-0001&amp;cb=CB-UNIFIED-0001 */
try{
/* Source-located B737 Classic Electrical power trainer V7.
 * References: Private Technical Database FCOM chapter 6 folios 6.10.6–9,
 * 6.20.1–4,6.20.8–12. Not a certified load schedule or aircraft wiring map.
 * Avoid conflating source-described bus connectivity with device-specific feeds.
 */
(function(root,factory){'use strict';const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;if(root)root.B737ElectricalV7=a;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const REF=Object.freeze({ac:'FCOM 6.20.1-4 (private DB 1150-1153)',dc:'FCOM 6.20.8-10 (private DB 1157-1159)',standby:'FCOM 6.10.7 / 6.20.11-12 (private DB 1146,1160-1161)',lamps:'FCOM 6.10.8-9 (private DB 1147-1148)',ground:'FCOM 6.20.2 (private DB 1151)'});
 const FAULTS=Object.freeze(['GEN1_FAILED','GEN2_FAILED','APU_FAILED','TR1_FAILED','TR2_FAILED','TR3_FAILED','BATTERY_DEPLETED','STATIC_INVERTER_FAILED','TRANSFER1_RELAY_FAILED','TRANSFER2_RELAY_FAILED']);
 const CONTROL_KEYS=Object.freeze({onGround:'boolean',batterySwitch:'boolean',busTransferAuto:'boolean',groundPowerAttached:'boolean',groundPowerQualityGood:'boolean',groundServiceSelected:'boolean',apuRunning:'boolean',engine1Running:'boolean',engine2Running:'boolean',glideslopeCaptured:'boolean',standbySelector:['AUTO','OFF','BAT']});
 const cpy=s=>JSON.parse(JSON.stringify(s));const trit=b=>b===null?null:Boolean(b);
 function initialState({coldDark=false}={}){
  // The original fully-powered baseline is retained for legacy isolated
  // training benches. Integrated ECU sessions explicitly request coldDark;
  // physical engine observations then own every source-running transition.
  if(typeof coldDark!=='boolean')throw Error('Invalid electrical startup preset');
  return {schema:'b737-electrical/7',rev:0,config:{
   onGround:true,batterySwitch:!coldDark,busTransferAuto:true,
   groundPowerAttached:false,groundPowerQualityGood:true,groundServiceSelected:false,
   apuRunning:false,engine1Running:!coldDark,engine2Running:!coldDark,
   glideslopeCaptured:false,standbySelector:'AUTO'
  },source:coldDark?{1:null,2:null}:{1:'GEN1',2:'GEN2'},
   faults:Object.fromEntries(FAULTS.map(k=>[k,false])),events:[]};
 }
 function apply(s,cmd){if(!s||s.schema!=='b737-electrical/7')throw Error('Invalid Electrical V7 state');if(!cmd||typeof cmd.type!=='string')throw Error('Command required');if(cmd.type==='RESET')return initialState();const n=cpy(s),k=cmd.key,v=cmd.value;
   if(cmd.type==='CONTROL'){if(!Object.hasOwn(CONTROL_KEYS,k))throw Error('Unknown electrical control');const type=CONTROL_KEYS[k];if((type==='boolean'&&typeof v!=='boolean')||(Array.isArray(type)&&!type.includes(v)))throw Error('Invalid electrical control value');n.config[k]=v;
     // FCOM Classic 6.20.2: external contactors drop on BAT OFF,
     // disconnected GPU cable, bad-quality supply or loss of ground status.
     // Restoring any of these conditions must NOT auto-select EXT; a new
     // momentary GRD PWR ON command is needed.
     if((k==='batterySwitch'&&!v)||(k==='groundPowerAttached'&&!v)||
        (k==='groundPowerQualityGood'&&!v)||(k==='onGround'&&!v)){
      for(const side of [1,2])if(n.source[side]==='EXT')n.source[side]=null;
      if(['groundPowerAttached','groundPowerQualityGood','onGround'].includes(k)&&!v)n.config.groundServiceSelected=false;
     }}
   else if(cmd.type==='SELECT_SOURCE'){
     if(!['GEN1','GEN2','APU','EXT','OFF'].includes(cmd.source))throw Error('Unknown source');
     if(![1,2].includes(cmd.side))throw Error('Invalid source side');
     if((cmd.source==='GEN1'&&cmd.side!==1)||(cmd.source==='GEN2'&&cmd.side!==2))throw Error('Generator-side mismatch');
     const cfg=n.config;
     if(cmd.source==='EXT'){
       if(!cfg.onGround||!cfg.batterySwitch||!cfg.groundPowerAttached||!cfg.groundPowerQualityGood)throw Error('External AC connection conditions not met');
       n.source[1]='EXT';n.source[2]='EXT';n.config.groundServiceSelected=false;
     }else if(cmd.source==='APU'){
       if(!cfg.apuRunning||n.faults.APU_FAILED)throw Error('APU source not ready');
       if(!cfg.onGround){const other=cmd.side===1?2:1;if(n.source[other]==='APU')n.source[other]=null;}// Flight: one bus only; selection priority is a trainer policy.
       n.source[cmd.side]='APU';
     }else if(cmd.source==='GEN1'||cmd.source==='GEN2'){
       const num=cmd.source==='GEN1'?1:2;
       if(!cfg['engine'+num+'Running']||n.faults['GEN'+num+'_FAILED'])throw Error('Engine generator not ready');
       n.source[cmd.side]=cmd.source;
     }else n.source[cmd.side]=null;
   }else if(cmd.type==='FAULT'){
     if(!FAULTS.includes(cmd.id)||typeof cmd.active!=='boolean'||cmd.instructor!==true)throw Error('Instructor-only listed fault required');n.faults[cmd.id]=cmd.active;
   }else throw Error('Unknown electrical command');
   n.rev++;n.events.push({rev:n.rev,cmd:cpy(cmd)});if(n.events.length>250)n.events.shift();return n;
 }
 function evaluate(s,{groundAutoPolicy='UNKNOWN'}={}){
  if(!s||s.schema!=='b737-electrical/7')throw Error('Invalid Electrical V7 state');
  if(!['UNKNOWN','INHIBIT_6_20_11','TRANSFER_6_10_7'].includes(groundAutoPolicy))throw Error('Invalid source-conflict policy');
  const c=s.config,f=s.faults;
  const cb=(name,value)=>globalThis.B737UnifiedCB?.gate('electrical.'+name,value)??value;
  const apuOnSystemBus=Object.values(s.source).includes('APU');
  // MRG Classic IV.6 printed p.148: BAT OFF on GND with APU GEN on SYS BUS requests APU auto shutdown.
  // Model AC output loss here; actual APU engine-plant shutdown is a separate integration contract.
  const apuShutdownDemand=Boolean(c.onGround&&!c.batterySwitch&&c.apuRunning&&apuOnSystemBus);
  const ready={GEN1:cb('gen1Control',c.engine1Running&&!f.GEN1_FAILED),GEN2:cb('gen2Control',c.engine2Running&&!f.GEN2_FAILED),APU:cb('apuGenControl',c.apuRunning&&!f.APU_FAILED&&!apuShutdownDemand),EXT:cb('externalPowerControl',c.onGround&&c.batterySwitch&&c.groundPowerAttached&&c.groundPowerQualityGood)};
  const powered={};for(const side of [1,2]){const source=s.source[side];powered[side]=source&&ready[source]?source:null;}
  // No AC paralleling; each generator bus has at most one source.
  const gen={1:powered[1]!==null,2:powered[2]!==null};
  const transfer={};const transferSource={};
  for(const side of [1,2]){
    const other=side===1?2:1;const relayFault=f['TRANSFER'+side+'_RELAY_FAILED']||cb('transfer'+side+'Control',true)===false;
    const feed=gen[side]?side:(c.busTransferAuto&&gen[other]&&!relayFault?other:null);
    transfer[side]=feed!==null;transferSource[side]=feed===null?null:'GENERATOR_BUS_'+feed;
  }
  const main={1:gen[1],2:gen[2]};
  const tr={TR1:cb('tr1',transfer[1]&&!f.TR1_FAILED),TR2:cb('tr2',transfer[2]&&!f.TR2_FAILED),TR3:cb('tr3',main[2]&&!f.TR3_FAILED)};
  const tie=!c.glideslopeCaptured&&c.busTransferAuto;
  const dc1=cb('dc1',tie?(tr.TR1||tr.TR2):tr.TR1);
  const dc2=cb('dc2',tie?(tr.TR1||tr.TR2):tr.TR2);
  const batteryAvailable=!f.BATTERY_DEPLETED&&(!s.battery||
   s.battery.chargeAh>0&&s.battery.available!==false);
  const serviceBus=Boolean((c.onGround&&c.groundServiceSelected&&c.groundPowerAttached&&c.groundPowerQualityGood)||gen[1]);
  // FCOM Classic 6.20.9 / ATA24: the charger is fed by GND SERVICE,
  // with the MAIN 2 alternate path. A depleted battery must NOT remove
  // the hot battery bus while the charger remains AC-powered.
  const chargerSource=cb('charger',serviceBus)?'GROUND_SERVICE':cb('alternateCharger',main[2])?'MAIN_2':null;
  const chargerAvailable=chargerSource!==null;
  const hotBattery=batteryAvailable||chargerAvailable;
  const hotBatterySource=chargerAvailable?'CHARGER':batteryAvailable?'BATTERY':null;
  const switchedHotBattery=hotBattery&&c.batterySwitch;
  // Battery Bus relay is controlled by the BAT switch. With BAT OFF the
  // bus is dead even if TR3 runs; standby BAT overrides this relay.
  const forcedStandbyBattery=c.standbySelector==='BAT';
  const batteryBus=cb('batteryBus',forcedStandbyBattery?hotBattery:
   c.batterySwitch&&(tr.TR3||hotBattery));
  // TR3 is a described backup source; exact automatic backfeed routing is not validated here.
  const dcTr3BackupUnknown=tr.TR3&&!(tr.TR1||tr.TR2);
  let acStandby=false,dcStandby=false,standbyFeed='OFF';
  const inverterAvailable=cb('inverterControl',true)&&cb('inverterPower',hotBattery&&batteryBus&&!f.STATIC_INVERTER_FAILED);
  if(c.standbySelector==='BAT'){
    // BAT manually forces the hot-battery-bus path, regardless of BAT switch
    // or normal AC. The inverter still needs a healthy source of DC power.
    acStandby=inverterAvailable;dcStandby=batteryBus;standbyFeed='BATTERY_SELECTOR';
  }else if(c.standbySelector==='AUTO'){
    if(transfer[1]&&dc1){
      // Normal supply operates independently of BAT switch position.
      acStandby=true;dcStandby=true;standbyFeed='TRANSFER1_DC1';
    }else if(c.onGround){
      // Classic (NOT NG): no automatic standby transfer on ground.
      acStandby=false;dcStandby=false;standbyFeed='GROUND_NO_AUTO_TRANSFER';
    }else{
      acStandby=c.batterySwitch&&inverterAvailable;
      dcStandby=c.batterySwitch&&batteryBus;
      standbyFeed='BATTERY_AUTO_AIR';
    }
  }
  // Essential output status preserves UNKNOWN rather than falsely resolving undocumented routes.
  const bus={generator1:gen[1],generator2:gen[2],transfer1:transfer[1],transfer2:transfer[2],main1:main[1],main2:main[2],dc1:dcTr3BackupUnknown?null:dc1,dc2:dcTr3BackupUnknown?null:dc2,battery:batteryBus,hotBattery,switchedHotBattery,acStandby:trit(acStandby),dcStandby:trit(dcStandby),groundService:serviceBus};
  const lamps={busOff1:!gen[1],busOff2:!gen[2],transferBusOff1:!transfer[1],transferBusOff2:!transfer[2],genOffBus1:c.engine1Running===true&&powered[1]!=='GEN1',genOffBus2:c.engine2Running===true&&powered[2]!=='GEN2',groundPowerAvailable:c.groundPowerAttached&&c.groundPowerQualityGood,standbyPowerOff:acStandby===null?null:!acStandby};
  const distinctSources=new Set(Object.values(powered).filter(Boolean));
  const galleyShed=c.onGround?false:distinctSources.size===1;
  const qa=[];
  if(apuShutdownDemand)qa.push({id:'CLASSIC_MRG_P148_APU_GROUND_BATTERY_OFF',detail:'APU generator SYS BUS deenergized; APU engine auto-shutdown request must be applied to upstream plant',level:'SOURCE_MATCH_PLANT_INTEGRATION_PENDING'});
  if(dcTr3BackupUnknown)qa.push({id:'TR3_BACKUP_ROUTE',detail:'TR3 supply to DC 1/2 needs installation wiring QA',level:'UNKNOWN'});
  if(!c.onGround&&s.source[1]==='APU'&&s.source[2]==='APU')qa.push({id:'APU_FLIGHT_DUAL_FEED',detail:'APU dual flight buses not supported; reconnect by selection',level:'INVALID'});
  return {schema:'B737_ELECTRICAL_V7_RESULT',revision:s.rev,source:{...powered},bus,
   feed:{transferSource,tie,tr,standbyFeed,chargerSource,batteryAvailable,hotBatterySource},
   lamps,galleyShed,apuAutomaticShutdownRequested:apuShutdownDemand,qa,trace:{...REF},
   accuracy:{equipmentBusMap:'NOT_VERIFIED_FOR_EP_FSI',standbyGroundAuto:'CLASSIC_GROUND_NO_TRANSFER',
    tr3AutomaticFeed:'INCOMPLETE',model:'EDUCATIONAL_DISCRETE_ONLY'}};
 }
 function execute(commands){let s=initialState();for(const c of commands)s=apply(s,c);return evaluate(s);}
 return Object.freeze({REF,FAULTS,CONTROL_KEYS,initialState,apply,evaluate,execute});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/unified-bus-failure-injection-v1.js?v=ATA24-INJECT-0009 */
try{
/* Unified BUS INJECTION V1. Training-only, never mutates an aircraft source
 * selector, generator engine, charge controller or Electrical V7 state.
 * Cross-tab localStorage is the source of truth; StorageEvent + BroadcastChannel
 * are notifications. Guarded, explicit injection with manual clear.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedBusFailureInjectionV1=api;
 if(root?.document && root?.B737ElectricalV7 &&
    !root.location?.pathname?.includes('/bus-consumer-test-lab/'))api.install(root);
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const SCHEMA='b737classic.bus-failure-injection/1';
 const KEY='b737classic.bus-failure-injection.v1';
 const CHANNEL='b737classic.bus-failure-injection.notify.v1';
 const BUS_KEYS=Object.freeze([
  'generator1@115VAC','generator2@115VAC','main1@115VAC','main2@115VAC',
  'transfer1@115VAC','transfer2@115VAC','groundService@115VAC','external@115VAC',
  'dc1@28VDC','dc2@28VDC','battery@28VDC','hotBattery@28VDC',
  'switchedHotBattery@28VDC','standby@115VAC','standby@28VDC',
  'electronic1@115VAC','electronic2@115VAC','electronic1@28VDC','electronic2@28VDC',
  'transfer1@28VAC','transfer2@28VAC','main1@28VAC','main2@28VAC',
  'groundService@28VAC'
 ]);
 const DIRECT=Object.freeze({
  'generator1@115VAC':'generator1','generator2@115VAC':'generator2',
  'main1@115VAC':'main1','main2@115VAC':'main2',
  'transfer1@115VAC':'transfer1','transfer2@115VAC':'transfer2',
  'dc1@28VDC':'dc1','dc2@28VDC':'dc2',
  'battery@28VDC':'battery','hotBattery@28VDC':'hotBattery',
  'switchedHotBattery@28VDC':'switchedHotBattery',
  'standby@115VAC':'acStandby','standby@28VDC':'dcStandby',
  'groundService@115VAC':'groundService'
 });
 const ALL=new Set(BUS_KEYS);
 const empty=()=>({schema:SCHEMA,active:false,offBusKeys:[],issuedAt:0,source:'NONE'});
 function normalize(value){
  if(!value||value.schema!==SCHEMA||typeof value.active!=='boolean'||
    !Array.isArray(value.offBusKeys)||value.offBusKeys.length>BUS_KEYS.length ||
    !Number.isSafeInteger(value.issuedAt)||value.issuedAt<0)return null;
  const keys=new Set(value.offBusKeys);
  if(keys.size!==value.offBusKeys.length||[...keys].some(k=>!ALL.has(k)))return null;
  if(!value.active&&keys.size) return null;
  return Object.freeze({schema:SCHEMA,active:value.active,offBusKeys:[...keys],
   issuedAt:value.issuedAt,source:String(value.source||'INSTRUCTOR').slice(0,64)});
 }
 function payload(keys,now=Date.now()){
  if(!Array.isArray(keys)||new Set(keys).size!==keys.length||keys.some(k=>!ALL.has(k)))
   throw Error('Invalid bus-outage scenario');
  return normalize({schema:SCHEMA,active:keys.length>0,offBusKeys:keys,
   issuedAt:now,source:'BUS_CONSUMER_TEST_LAB'});
 }
 function overlay(result,current){
  if(!current?.active||!current.offBusKeys.length||result?.schema!=='B737_ELECTRICAL_V7_RESULT')
   return result;
  const bus={...result.bus},cuts=new Set(current.offBusKeys);
  for(const key of cuts)if(DIRECT[key])bus[DIRECT[key]]=false;
  const lamps={...result.lamps,
   busOff1:bus.generator1===false,
   busOff2:bus.generator2===false,
   transferBusOff1:bus.transfer1===false,
   transferBusOff2:bus.transfer2===false,
   standbyPowerOff:bus.acStandby===false};
  const qa=[...(result.qa||[]),{id:'INSTRUCTOR_BUS_FAILURE_INJECTION',
   detail:current.offBusKeys.join(', '),level:'TRAINING_ONLY'}];
  return {...result,bus,lamps,qa,
   busFailureInjection:{active:true,offBusKeys:current.offBusKeys.slice(),
    source:current.source,issuedAt:current.issuedAt},
   // Synthetic converter/electronics bus cuts are retained here and are
   // read by the consumer and engine-indicator adapter at exact voltage.
   busClassOutages:current.offBusKeys.slice()};
 }
 function install(win){
  if(!win?.B737ElectricalV7?.evaluate||!win?.localStorage) return null;
  if(win.__b737BusInjectionInstalled)return win.__b737BusInjectionInstalled;
  const original=win.B737ElectricalV7;
  let current=empty(),statusNode=null;
  try{current=normalize(JSON.parse(win.localStorage.getItem(KEY)||'null'))||empty();}
  catch(_){current=empty();}
  const evaluate=(state,options)=>overlay(original.evaluate(state,options),current);
  win.B737ElectricalV7=Object.freeze({...original,evaluate,
    execute(commands){let s=original.initialState();for(const action of commands)s=original.apply(s,action);return evaluate(s);}});
  function render(){
   if(!win.document)return;
   const id='unifiedBusInjectionStatusV1';
   statusNode=statusNode||win.document.getElementById(id);
   if(!statusNode){
    const holder=win.document.getElementById('unifiedControlCenter')||
      win.document.querySelector?.('header.unified-minimal-header');
    if(!holder)return;
    statusNode=win.document.createElement('div');statusNode.id=id;statusNode.dir='ltr';
    statusNode.style.cssText='padding:9px;margin:7px 0;border:1px solid #6484a0;border-radius:6px;background:#173348;color:#c2e2f5;font:600 11px/1.6 system-ui,Tahoma,sans-serif';
    statusNode.innerHTML='<span data-injection-status role="status"></span>'+
     ' <button type="button" data-injection-clear style="margin-left:8px;padding:5px 8px;border:1px solid #dc7787;color:#ffb3be;background:#3e2732;border-radius:5px;cursor:pointer">CLEAR INJECTED FAILURES</button>';
    holder.prepend(statusNode);
    statusNode.querySelector('[data-injection-clear]').addEventListener('click',()=>write(empty(),true));
   }
   statusNode.hidden=!current.active;
   const output=statusNode.querySelector('[data-injection-status]');
   if(output)output.textContent=current.active?
    'TRAINING BUS FAILURE ACTIVE · '+current.offBusKeys.length+' bus class(es) OFF':'';
  }
  function accept(raw){
   const next=normalize(raw);if(!next)return false;
   if(current.issuedAt===next.issuedAt&&
     current.active===next.active&&current.offBusKeys.join('|')===next.offBusKeys.join('|'))
    return true;
   current=next;render();
   win.dispatchEvent(new win.CustomEvent('b737:bus-failure-injection-changed',{
    detail:{active:next.active,offBusKeys:next.offBusKeys.slice()}}));
   return true;
  }
  let channel=null;
  if(typeof win.BroadcastChannel==='function'){
   try{channel=new win.BroadcastChannel(CHANNEL);
    channel.onmessage=e=>{if(e?.data?.schema===SCHEMA)accept(e.data);};
   }catch(_){}
  }
  function write(raw,fromCockpit=false){
   const next=normalize(raw);if(!next)throw Error('Invalid bus failure payload');
   win.localStorage.setItem(KEY,JSON.stringify({...next,
    source:fromCockpit?'UNIFIED_CLEAR':next.source}));
   accept(next);channel?.postMessage(next);return next;
  }
  win.addEventListener('storage',e=>{
   if(e.key!==KEY)return;
   try{accept(JSON.parse(e.newValue||'null')||empty());}catch(_){}
  });
  if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',render,{once:true});
  else render();
  const state=Object.freeze({
   get:()=>({...current,offBusKeys:current.offBusKeys.slice()}),
   isUnavailable:(bus,voltage)=>current.active&&current.offBusKeys.includes(bus+'@'+voltage),
   clear:()=>write({...empty(),issuedAt:Date.now()},true),
   write,refresh:render,
   recompute:()=>win.dispatchEvent(new win.CustomEvent('b737:bus-failure-injection-changed',{
    detail:{active:current.active,offBusKeys:current.offBusKeys.slice(),initial:true}}))
  });
  win.__b737BusInjectionInstalled=state;
  api.live=state;
  return state;
 }
 const api={SCHEMA,KEY,CHANNEL,BUS_KEYS,DIRECT,normalize,payload,overlay,install,live:null};
 return api;
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./failures-header-v1.js?v=FAILURES-FUEL-0002&amp;p8=ATA26-0003 */
try{
/* Unified FAILURES header V1.
 * This menu is additive to the live instructor bus-failure protocol.
 * No simulator source selector, overhead switch, ECU or protected artwork is modified.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document)api.install(root);
})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
 const GROUPS=Object.freeze([
  {name:'AC · GENERATOR / MAIN / TRANSFER · 115V',ids:[
   'generator1@115VAC','generator2@115VAC','main1@115VAC','main2@115VAC',
   'transfer1@115VAC','transfer2@115VAC']},
  {name:'AC · EXTERNAL / SERVICE · 115V',ids:[
   'external@115VAC','groundService@115VAC']},
  {name:'DC · DISTRIBUTION · 28V',ids:[
   'dc1@28VDC','dc2@28VDC','battery@28VDC','hotBattery@28VDC',
   'switchedHotBattery@28VDC']},
  {name:'STANDBY',ids:['standby@115VAC','standby@28VDC']},
  {name:'ELECTRONICS · 115V AC / 28V DC',ids:[
   'electronic1@115VAC','electronic2@115VAC',
   'electronic1@28VDC','electronic2@28VDC']},
  {name:'AC CONVERTER OUTPUT · 28V AC',ids:[
   'transfer1@28VAC','transfer2@28VAC','main1@28VAC','main2@28VAC',
   'groundService@28VAC']}
 ]);
 const LABELS=Object.freeze({
  generator1:'GEN BUS 1',generator2:'GEN BUS 2',
  main1:'MAIN BUS 1',main2:'MAIN BUS 2',
  transfer1:'TRANSFER BUS 1',transfer2:'TRANSFER BUS 2',
  dc1:'DC BUS 1',dc2:'DC BUS 2',
  battery:'BATTERY BUS',hotBattery:'HOT BAT BUS',
  switchedHotBattery:'SW HOT BAT BUS',
  groundService:'GROUND SERVICE',external:'EXT POWER BUS',
  electronic1:'ELECTRONIC BUS 1',electronic2:'ELECTRONIC BUS 2'
 });
 function label(id){
  const [bus,voltage]=id.split('@');
  return bus==='standby'?(voltage==='115VAC'?'AC STBY BUS':'DC STBY BUS'):
   LABELS[bus]||id;
 }
 const ids=()=>GROUPS.flatMap(group=>group.ids);
 function validateProtocol(protocol){
  if(!protocol?.live?.get||!protocol?.live?.write||!protocol?.payload)
   throw Error('Shared Unified bus injection engine not ready');
  const expected=protocol.BUS_KEYS||[];
  const listed=ids();
  if(expected.length!==24||listed.length!==24||new Set(listed).size!==24||
    listed.some(key=>!expected.includes(key)))
   throw Error('Electrical FAILURES menu must match the complete 24-bus registry');
  return true;
 }
 function nextOffKeys(current,id,failed,expected){
  if(!expected.includes(id)||typeof failed!=='boolean')throw Error('Invalid electrical bus toggle');
  const set=new Set(current||[]);
  if([...set].some(k=>!expected.includes(k)))throw Error('Unknown existing bus failure');
  if(failed)set.add(id);else set.delete(id);
  return expected.filter(k=>set.has(k));
 }
 function install(win){
  const doc=win.document;
  if(!doc||!doc.getElementById)return null;
  if(win.B737UnifiedFailuresHeaderV1?.installed)return win.B737UnifiedFailuresHeaderV1;
  function init(){
   const trigger=doc.getElementById('failuresHeaderOpen');
   if(!trigger)return null;
   if(trigger.dataset.failuresBound==='true')return win.B737UnifiedFailuresHeaderV1;
   const create=(tag,parent,cls,text)=>{
    const node=doc.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=text;
    if(parent)parent.append(node);
    return node;
   };
   let opened=false;
   const panel=create('section',doc.body,'failures-popover');
   panel.id='failuresHeaderPopover';
   panel.hidden=true;
   panel.dir='ltr';
   panel.setAttribute('role','dialog');
   panel.setAttribute('aria-label','Unified Instructor Failures');
   const top=create('div',panel,'failures-top');
   create('strong',top,'','FAILURES · INSTRUCTOR');
   const closeButton=create('button',top,'failures-close','×');
   closeButton.type='button';
   closeButton.setAttribute('aria-label','Close Failures menu');
   const summaryLine=create('p',panel,'failures-intro',
    'Training faults only · Existing cockpit switches and live engine state are preserved.');
   const electrical=create('details',panel,'failures-electrical');
   electrical.id='failuresElectricalBranch';
   const summary=create('summary',electrical,'failures-section-title');
   const summaryName=create('span',summary,'','ELECTRICAL');
   const counter=create('span',summary,'failures-branch-counter','0 FAILED');
   const content=create('div',electrical,'failures-electrical-content');
   const feedback=create('p',content,'failures-feedback',
    'Tap any bus to inject or remove that bus failure in Unified.');
   feedback.id='failuresFeedback';
   feedback.setAttribute('role','status');
   const grid=create('div',content,'failures-bus-groups');
   const buttons=new Map();
   for(const group of GROUPS){
    const section=create('section',grid,'failures-group');
    create('h3',section,'',group.name);
    const rows=create('div',section,'failures-bus-grid');
    for(const key of group.ids){
     const button=create('button',rows,'failures-bus-toggle');
     button.type='button';button.dataset.bus=key;button.dataset.failed='false';
     button.setAttribute('aria-pressed','false');
     button.setAttribute('aria-label','Inject electrical bus failure: '+key);
     create('span',button,'failures-bus-name',label(key));
     const volts=create('small',button,'failures-bus-voltage',key.split('@')[1]);
     const state=create('span',button,'failures-bus-state','NO FAULT');
     state.dataset.indicator='true';
     buttons.set(key,button);
     button.addEventListener('click',()=>toggle(key));
    }
   }
   const actions=create('div',content,'failures-actions');
   const clear=create('button',actions,'failures-clear','CLEAR ELECTRICAL FAILURES');
   clear.type='button';
   const link=create('a',actions,'failures-lab-link','OPEN FULL BUS TEST LAB');
   link.href='../../bus-consumer-test-lab/v3.html';
   link.target='_blank';link.rel='noopener';
   // Fuel injectors live in an independently mounted ATA28 module. Keep
   // Electrical's immutable 24-bus registry and injection channel isolated.
   const fuelBranch=create('details',panel,'failures-fuel');
   fuelBranch.id='failuresFuelBranch';
   const fuelSummary=create('summary',fuelBranch,'failures-section-title');
   create('span',fuelSummary,'','FUEL');
   const fuelCounter=create('span',fuelSummary,'failures-branch-counter','0 ACTIVE');
   fuelCounter.id='failuresFuelCounter';
   const fuelMount=create('div',fuelBranch,'failures-electrical-content');
   fuelMount.id='failuresFuelMount';
   create('p',fuelMount,'failures-feedback','Fuel ECU instructor controls are initializing.');
   const fireBranch=create('details',panel,'failures-electrical');
   const fireSummary=create('summary',fireBranch,'failures-section-title');
   create('span',fireSummary,'','FIRE PROTECTION');
   const fireCounter=create('span',fireSummary,'failures-branch-counter','0 ACTIVE');
   const fireContent=create('div',fireBranch,'failures-electrical-content');
   const fireInputs=[];
   function addFire(label,read,command){
    const row=create('label',fireContent,'failures-fire-row');
    const input=create('input',row);input.type='checkbox';create('span',row,'',' '+label);
    input.onchange=()=>{win.B737UnifiedFireLights?.dispatch(command(input.checked));refresh();};
    fireInputs.push({input,read});
   }
   for(const unit of ['ENG1','ENG2']){
    addFire(unit+' FIRE',s=>s.engineFire[unit],active=>({type:'SET_FIRE',unit,active}));
    addFire(unit+' OVERHEAT',s=>s.engineOverheat[unit],active=>({type:'SET_OVERHEAT',unit,active}));
    for(const loop of ['A','B'])addFire(unit+' LOOP '+loop+' FAIL',s=>!s.loops[unit][loop],
     failed=>({type:'SET_LOOP',unit,loop,healthy:!failed}));
   }
   addFire('APU FIRE',s=>s.apuFire,active=>({type:'SET_FIRE',unit:'APU',active}));
   addFire('APU DETECTOR FAIL',s=>!s.apuDetector,failed=>({type:'SET_APU_DETECTOR',healthy:!failed}));
   addFire('WHEEL WELL FIRE',s=>s.wheelWellFire,active=>({type:'SET_WHEEL_FIRE',active}));
   for(const bottle of ['L','R','APU']){
    addFire(bottle+' BOTTLE LOW PRESSURE',s=>s.pressureLow[bottle],active=>({type:'SET_BOTTLE_LOW',bottle,active}));
    for(const channel of (bottle==='APU'?[1]:[1,2]))addFire(
     bottle+' BOTTLE '+(bottle==='APU'?'SQUIB':'ENG '+channel+' SQUIB')+' FAIL',
     s=>!s.squibs[bottle][channel],failed=>({type:'SET_CIRCUIT',bottle,channel,healthy:!failed}));
   }
   const service=create('button',fireContent,'failures-close','Service discharged bottles');
   service.type='button';service.onclick=()=>win.B737UnifiedFireLights?.dispatch({type:'SERVICE_BOTTLES'});
   function live(){
    const api=win.B737UnifiedBusFailureInjectionV1;
    validateProtocol(api);
    return api;
   }
   function updateMessage(value,error=false){
    feedback.textContent=value;feedback.dataset.error=String(error);
   }
   function currentKeys(){
    try{
     const protocol=live(),record=protocol.live.get();
     return record.active?record.offBusKeys.slice():[];
    }catch(_){return [];}
   }
   function refresh(){
    const keys=new Set(currentKeys());
    const fuelCount=Number(win.B737UnifiedFuelFailuresV1?.refresh?.()??0);
    const fireState=win.B737UnifiedFireLights?.getState?.();
    let fireCount=0;
    for(const {input,read} of fireInputs){input.disabled=!fireState;input.checked=!!fireState&&read(fireState);if(input.checked)fireCount++;}
    service.disabled=!fireState||Object.values(fireState.handles).some(h=>h.pulled)||
     !Object.values(fireState.bottles).some(Boolean);
    fireCounter.textContent=fireCount+' ACTIVE';
    const total=keys.size+fireCount+(Number.isFinite(fuelCount)?Math.max(0,fuelCount):0);
    trigger.dataset.failureCount=String(total);
    trigger.dataset.failuresActive=String(total>0);
    trigger.textContent=total?'FAILURES ('+total+')':'FAILURES';
    counter.textContent=keys.size+' FAILED';
    fuelCounter.textContent=fuelCount+' ACTIVE';
    for(const [key,button] of buttons){
     const failed=keys.has(key);
     button.dataset.failed=String(failed);
     button.setAttribute('aria-pressed',String(failed));
     const status=button.querySelector('[data-indicator]');
     if(status)status.textContent=failed?'FAILED':'NO FAULT';
    }
    clear.disabled=keys.size===0;
    return keys.size;
   }
   win.addEventListener('b737:ata26-input-change',refresh);
   win.addEventListener('b737:ata26-panel-state',()=>{if(opened)refresh();});
   function write(keys){
    const protocol=live(),record=protocol.payload(keys);
    protocol.live.write(record);
    refresh();
    return record;
   }
   function toggle(key){
    try{
     const keys=currentKeys(),next=nextOffKeys(keys,key,!keys.includes(key),live().BUS_KEYS);
     write(next);
     updateMessage(label(key)+(next.includes(key)?' · FAILURE INJECTED':' · FAILURE CLEARED'));
    }catch(error){updateMessage(error.message,true);}
   }
   function clearAll(){
    try{write([]);updateMessage('All instructor electrical bus failures cleared.');}
    catch(error){updateMessage(error.message,true);}
   }
   function close(){
    opened=false;panel.hidden=true;
    trigger.setAttribute('aria-expanded','false');
   }
   function open(){
    opened=true;panel.hidden=false;
    trigger.setAttribute('aria-expanded','true');
    refresh();
   }
   trigger.dataset.failuresBound='true';
   trigger.setAttribute('aria-controls',panel.id);
   trigger.setAttribute('aria-haspopup','dialog');
   trigger.setAttribute('aria-expanded','false');
   trigger.addEventListener('click',()=>opened?close():open());
   closeButton.addEventListener('click',close);
   clear.addEventListener('click',clearAll);
   doc.addEventListener('keydown',event=>{
    if(opened&&event.key==='Escape'){close();trigger.focus();}
   });
   doc.addEventListener('pointerdown',event=>{
    if(opened&&!panel.contains(event.target)&&!trigger.contains(event.target))close();
   });
   win.addEventListener('b737:bus-failure-injection-changed',refresh);
   win.addEventListener('focus',refresh);
   win.addEventListener('pageshow',refresh);
   const api=Object.freeze({installed:true,open,close,refresh,toggle,clearAll,
    getOpen:()=>opened,getFailedBuses:currentKeys,
    getGroups:()=>GROUPS.map(g=>({name:g.name,ids:g.ids.slice()}))});
   win.B737UnifiedFailuresHeaderV1=api;
   refresh();
   return api;
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});
  else return init();
  return null;
 }
 return Object.freeze({GROUPS,LABELS,label,ids,validateProtocol,nextOffKeys,install});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/mrg-electrical-needle-audit-v1.js?v=MRG-CL-188-B */
try{
/* B737 Classic MRG 142-188: electrical-gauge numeric and generic source-feed QA, NOT needle rotation.
 * Source: Classic-only pages of MRG Electrical; NG rows explicitly excluded.
 * Meter selections describe a bus reading versus TR current, not identical sensor signals.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.B737MrgElectricalNeedleAudit=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const PROVENANCE=Object.freeze({
 source:"B737 MRG (3,4,5,NG) High Quality — IV.6 Electrical, Classic (CL) passages only",
  drive:"printed pp.142-143 / PDF pp.151-152",
  electricalPanel:"printed pp.148-149 / PDF pp.157-158",
  busTransfer:"printed p.151 / PDF p.160",
  classicSchematic:"printed p.152 / PDF p.161",
  faults:"printed pp.144-147 / PDF pp.153-156",
  trFailure:"printed pp.161-162 / PDF pp.170-171",
  standby:"printed pp.159-160 / PDF pp.168-169"
});
const SELECTORS=Object.freeze(["TR1","TR2","TR3","BATTERY","AUX_BATTERY","BAT_BUS","STBY_PWR"]);
const EXPECTED=Object.freeze({
 TR1:Object.freeze({volts:[24,30],amps:[20,25],voltageRepresents:"DC_BUS_1_NOT_RAW_TR_OUTPUT",bus:"dc1",tr:"TR1"}),
 TR2:Object.freeze({volts:[24,30],amps:[20,25],voltageRepresents:"DC_BUS_2_NOT_RAW_TR_OUTPUT",bus:"dc2",tr:"TR2"}),
 TR3:Object.freeze({volts:[24,30],amps:[10,15],voltageRepresents:"RESPECTIVE_DC_BUS_SELECTION_UNCONFIRMED",bus:null,tr:"TR3"}),
 BATTERY:Object.freeze({volts:[22,30],amps:[0,0],voltageRepresents:"BATTERY",bus:"battery",tr:null}),
 AUX_BATTERY:Object.freeze({volts:[22,30],amps:[0,0],voltageRepresents:"OPTIONAL_AUX_BATTERY",bus:null,tr:null}),
 BAT_BUS:Object.freeze({volts:[24,30],amps:null,voltageRepresents:"BATTERY_BUS",bus:"battery",tr:null}),
 STBY_PWR:Object.freeze({volts:[24,30],amps:null,voltageRepresents:"STANDBY_DC_SEPARATE_FROM_AC_WARNING",bus:"dcStandby",tr:null})
});
const OIL_LIMITS=Object.freeze({classicCsdLowPressurePsi:120,classicCsdHighTempC:157,
  oilTempSource:"CSD DRIVE oil temperature, not the coolant or the 54-gauge screenshot measured angle",
  thresholdsStrict:"pressure <120psi; temperature >157degC",ngValuesExcluded:["IDG 165 PSI","IDG 182degC"]});
function finite(v){return typeof v==="number"&&Number.isFinite(v);}
function rangeResult(value,range,eligible=true){
 if(!range)return {status:"NOT_INDICATED",range:null,observed:finite(value)?value:null};
 if(!eligible)return {status:"POWER_PATH_UNRESOLVED",range,observed:finite(value)?value:null};
 if(!finite(value))return {status:"NO_OBSERVATION",range,observed:null};
 return {status:value>=range[0]&&value<=range[1]?"WITHIN_MRG_REFERENCE":"OUTSIDE_MRG_REFERENCE",range,observed:value};
}
function evaluate({selector="TR1",electrical=null,observed={},drive=null,consumerIndex=null,consumerAudit=null,variant="DCPCS"}={}){
 if(!SELECTORS.includes(selector))throw Error("Unsupported Classic meter selector");
 if(electrical&&(electrical.schema!=="B737_ELECTRICAL_V7_RESULT"||!electrical.feed||!electrical.bus))throw Error("Expected Electrical V7 evaluation");
 const exp=EXPECTED[selector];
 const feed=electrical?exp.bus===null?null:electrical.bus[exp.bus]:null;
 const trPowered=electrical&&exp.tr?electrical.feed.tr[exp.tr]:null;
 const eligibleVoltage=feed===true;
 // With source enabled but no observed sensor, NEVER synthesize a center-of-scale numeric value.
 const volts=rangeResult(observed.dcVolts,exp.volts,eligibleVoltage);
 let amps;
 if(!exp.amps)amps=rangeResult(observed.dcAmps,null,false);
 else if(exp.tr&&trPowered===false)amps=rangeResult(observed.dcAmps,[0,0],true);
 else if(exp.tr)amps=rangeResult(observed.dcAmps,exp.amps,trPowered===true);
 else amps=rangeResult(observed.dcAmps,exp.amps,feed===true);
 const needlePowerSourceCandidates=consumerIndex&&consumerAudit?
   consumerAudit.needleSources(consumerIndex,electrical,variant):null;
 const driveState=drive?{
   lowOilPressure:finite(drive.oilPressurePsi)?drive.oilPressurePsi<OIL_LIMITS.classicCsdLowPressurePsi:null,
   highOilTemp:finite(drive.oilTempC)?drive.oilTempC>OIL_LIMITS.classicCsdHighTempC:null,
   rawOilTempC:finite(drive.oilTempC)?drive.oilTempC:null,
   rawOilPressurePsi:finite(drive.oilPressurePsi)?drive.oilPressurePsi:null
 }:null;
 const qa=[];
 if(exp.voltageRepresents.includes("UNCONFIRMED"))qa.push("TR3_DISPLAY_VOLTAGE_BUS_MAPPING_NOT_SOURCE_PROVEN");
 if(electrical?.bus.dc1===null||electrical?.bus.dc2===null)qa.push("DC_BUS_STATE_UNKNOWN_NEEDS_WIRING_QA");
 if(electrical?.apuAutomaticShutdownRequested===true)qa.push("CLASSIC_MRG_P148_APU_BAT_OFF_ON_GROUND_AC_GENERATOR_LOSS; APU_PHYSICAL_SHUTDOWN_ENGINE_LINK_PENDING");
 if(exp.tr&&trPowered===false&&feed===true)qa.push("TR_OPEN_BUT_DC_BUS_BACKFED: DC_VOLTS_MAY_READ_NORMAL_WITH_TR_AMPS_ZERO");
 if(selector==="STBY_PWR"&&electrical?.lamps?.standbyPowerOff===true)
   qa.push("CLASSIC_STANDBY_PWR_OFF_LAMP_PROVES_AC_STANDBY_OFF_ONLY; DC_STANDBY_MUST_BE_MEASURED");
 return {schema:"b737.mrg.electrical-needle-numeric-audit.v1",selector,source:PROVENANCE,
   selectedVoltageSource:exp.voltageRepresents,dcBusVoltageObserved:volts,
   selectedTRAmpsObserved:amps,standbyDcAmpsDisplayed:exp.amps!==null,
   upstreamBus:feed,trSourceAvailable:trPowered,
   drive:driveState,sourceLimits:OIL_LIMITS,needlePowerSourceCandidates,qa,
   targetAngleDeg:null,geometryCertification:"BLOCKED_PENDING_NATIVE_OH10_OH11_OH12_TICK_AND_PIVOT_QA",
   note:"This is an observation/range audit, not an authoritative sensor simulator or an angle map."};
}
const RISK=Object.freeze([
 {id:"OH10_DC_AMPS_PIVOT",overlay:[310,168],photoCandidate:[310,192],status:"CONFLICT_OPEN"},
 {id:"OH10_CPS_PIVOT",overlay:[715,190],photoCandidate:[780,192],status:"CONFLICT_OPEN"},
 {id:"OH10_DC_VOLTS",scale:"no all-major/minor native tick signoff",status:"PIXEL_QA_PENDING"},
 {id:"OH10_AC_VOLTS",scale:"normal output 115 VAC schematic is not meter-angle certification",status:"PIXEL_QA_PENDING"},
 {id:"OH11_DRIVE_OIL_TEMP_1_2",scale:"inlet/rise and thermal CSD constraints, photo ticks unfinished",status:"PIXEL_QA_PENDING"},
 {id:"OH12_AC_AMPS_1_2_APU",scale:"no full measured current scale source",status:"PIXEL_QA_PENDING"}
]);
return Object.freeze({PROVENANCE,EXPECTED,SELECTORS,OIL_LIMITS,RISK,evaluate});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/mrg-classic-consumer-bus-qa-v1.js?v=MRG-CL-188-B */
try{
/* 737 Classic MRG IV.6 pp.182–188 indexed BUS→ITEM reference QA.
 * Accepts explicit MRG index; never certifies aircraft-specific EP-FSI wiring.
 * A documented upstream bus being energized does not prove device power.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.B737MRGClassicBusConsumerAudit=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const BUS_TO_V7=Object.freeze({generator1:"generator1",generator2:"generator2",main1:"main1",main2:"main2",transfer1:"transfer1",transfer2:"transfer2",dc1:"dc1",dc2:"dc2",battery:"battery",hotBattery:"hotBattery",switchedHotBattery:"switchedHotBattery",groundService:"groundService"});
const NEEDLE_REFERENCES=Object.freeze([
 ["oh.drive_oil.1","Engine 1 CSD Oil Temp Indication"],
 ["oh.drive_oil.2","Engine 2 CSD Oil Temp Indication"],
 ["oh.fuel.temperature","Fuel Temperature Indication"],
 ["eng.n1.1","Engines N1 Indication"],
 ["eng.n1.2","Engines N1 Indication"],
 ["eng.n2.1","Engines N2 Indication"],
 ["eng.n2.2","Engines N2 Indication"],
 ["eng.egt.1","Engines EGT Indication"],
 ["eng.egt.2","Engines EGT Indication"],
 ["eng.oil_pressure.1","Engine 1 Oil Pressure Indication"],
 ["eng.oil_pressure.2","Engine 2 Oil Pressure Indication"],
 ["eng.oil_temperature.1","Engine 1 Oil Temp Indication"],
 ["eng.oil_temperature.2","Engine 2 Oil Temp Indication"],
 ["eng.hyd_pressure.a","Hydraulic System A Press. Indication"],
 ["eng.hyd_pressure.b","Hydraulic System B Press Indication"],
 ["fo.hyd_brake_pressure","Brake Pressure Indicator"],
 ["oh.duct.pressure_lr","Pneumatic Duct Pressure Indication"]
].map(([id,item])=>Object.freeze({id,item})));
function validate(index){
 if(index?.schema!=="b737-classic.mrg-iv6.consumer-bus-index.v1"||index.rows?.length!==340)
 throw Error("B737 Classic MRG 340-row indexed evidence required");
 const ids=new Set(),page={};
 for(const row of index.rows){
  if(ids.has(row.id))throw Error("Duplicated source row "+row.id);ids.add(row.id);
  if(!(row.printedPage>=182&&row.printedPage<=188&&row.pdfPage===row.printedPage+9))throw Error("Bad MRG page provenance");
  if(!["28VAC","115VAC","28VDC"].includes(row.feedVoltage))throw Error("Unsupported electrical power class");
  if(row.epFsiWiringConfirmed!==false)throw Error("MRG reference must never imply EP-FSI feeder verification");
  page[row.printedPage]=(page[row.printedPage]||0)+1;
 }
 return {rows:index.rows.length,byPage:page,sourceConfidence:"CLASSIC_GENERAL_REFERENCE_ONLY",epFsiWiringVerified:0};
}
function variantRows(index,variant="DCPCS"){
 validate(index);
 if(!["CPCS","DCPCS"].includes(variant))throw Error("CPCS or DCPCS required");
 return index.rows.filter(x=>x.applicability!=="CPCS"&&x.applicability!=="DCPCS"||x.applicability===variant);
}
function busPath(bus,voltage,electrical){
 if(!electrical||electrical.schema!=="B737_ELECTRICAL_V7_RESULT")throw Error("Electrical V7 result required");
 const keys=bus.split("|");
 const mapped=keys.map(x=>{
  if(x==="standby")return voltage==="115VAC"?"acStandby":voltage==="28VDC"?"dcStandby":null;
  // Electronic bus converters and 28VAC transformer outputs are not modelled in V7.
  if(x.startsWith("electronic")||x==="external")return null;
  if(voltage==="28VAC")return null;
  return BUS_TO_V7[x]||null;
 });
 // Alternate/compound path topology is unverified, so do not fabricate AND/OR source state.
 if(mapped.length!==1||mapped[0]===null)return {v7Bus:null,observedSource:null,sourceStatus:"UNKNOWN_NOT_MODELLED"};
 const on=electrical.bus[mapped[0]];
 return {v7Bus:mapped[0],observedSource:on===true||on===false?on:null,
  sourceStatus:on===false?"REFERENCE_BUS_UNPOWERED":on===true?"REFERENCE_BUS_POWERED_DEVICE_UNKNOWN":"UNKNOWN"};
}
function project({index,electrical,variant="DCPCS",item=null}={}){
 const rows=variantRows(index,variant);
 const subset=item===null?rows:rows.filter(row=>row.item.toUpperCase()===String(item).toUpperCase());
 return {schema:"b737.mrg-classic-340-source-audit.v1",variant,rows:subset.map(row=>{
   const path=busPath(row.feedBus,row.feedVoltage,electrical);
   return {...row,...path,devicePowered:null,deviceStatus:"NOT_DETERMINED_GENERIC_CL_ONLY",noSystemMutation:true};
 }),qa:{sourceRows:rows.length,verifiedEpFsiWires:0,alert:"Do not propagate MRG generic source bus observation into installed-aircraft equipment power"}};
}
function needleSources(index,electrical,variant="DCPCS"){
 const refs=variantRows(index,variant);
 const output={};
 for(const needle of NEEDLE_REFERENCES){
  const matches=refs.filter(row=>row.item.toUpperCase()===needle.item.toUpperCase());
  output[needle.id]={
   needleId:needle.id,mrgLabel:needle.item,evidence:matches.map(row=>({
    id:row.id,printedPage:row.printedPage,feedBus:row.feedBus,feedVoltage:row.feedVoltage,
    ...busPath(row.feedBus,row.feedVoltage,electrical)})),
   gaugePower:null,
   status:matches.length?"CANDIDATE_CL_SOURCE_NOT_INSTALLED_WDM":"MRG_LABEL_NOT_FOUND",
   angleAffected:false
  };
 }
 return output;
}

const V8_ITEM_NAMES=Object.freeze({
 "dcpcs.controller1":"Pressuriz. Control Auto 1 (DCPCS)",
 "dcpcs.controller2":"Pressuriz. Control Auto 2 (DCPCS)",
 "fuel.main1FwdPump":"Fuel Boost Pump - Main Tank 1 Forward",
 "fuel.main1AftPump":"Fuel Boost Pump - Main Tank 1 Aft",
 "fuel.main2FwdPump":"Fuel Boost Pump - Main Tank 2 Forward",
 "fuel.main2AftPump":"Fuel Boost Pump - Main Tank 2 Aft",
 "fuel.centerLeftPump":"Fuel Boost Pump - Center Tank Left",
 "fuel.centerRightPump":"Fuel Boost Pump - Center Tank Right",
 "hyd.electricPumpA":"Electric Hydraulic Pump 2 Sys A",
 "hyd.electricPumpB":"Electric Hydraulic Pump 1 Sys B"
});
function v8CandidateSources(index,electrical,variant="DCPCS"){
 const rows=variantRows(index,variant),out={};
 for(const [id,item] of Object.entries(V8_ITEM_NAMES)){
  if(id.startsWith("dcpcs.")&&variant!=="DCPCS")continue;
  const found=rows.filter(x=>x.item.toUpperCase()===item.toUpperCase());
  out[id]={loadId:id,sourceItemName:item,
   references:found.map(row=>({id:row.id,page:row.printedPage,bus:row.feedBus,electricClass:row.feedVoltage,...busPath(row.feedBus,row.feedVoltage,electrical)})),
   assignedBus:null,powered:null,installedWiringConfirmed:false,
   sourceStatus:found.length?"GENERIC_CLASSIC_MRG_ONLY":"UNMATCHED_SOURCE_LABEL"};
 }
 return out;
}
return Object.freeze({BUS_TO_V7,NEEDLE_REFERENCES,V8_ITEM_NAMES,validate,variantRows,busPath,project,needleSources,v8CandidateSources});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/classic-multifeed-topology-v1.js?v=ATA24-MULTIFEED-0001 */
try{
/* B737 Classic multi-feed electrical topology authority.
 * Training-only functional bus/CB interpretation derived from generic MRG IV.6.
 * This is not a certified aircraft wiring diagram (WDM). A powered bus does
 * not command a device ON, and this layer never moves physical switches.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicMultifeedV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='ATA24-MULTIFEED-0001';
 const REQUIRED='ALL_REQUIRED',ANY='ANY_AVAILABLE',CHANNELS='INDEPENDENT_CHANNELS';
 const P=Object.freeze({
  'Autothrottle':{topology:REQUIRED,keys:['electronic1@115VAC','electronic1@28VDC']},
  'DAA2':{topology:REQUIRED,keys:['electronic2@115VAC','electronic2@28VDC']},
  'DME2':{topology:REQUIRED,keys:['electronic2@115VAC','electronic2@28VDC']},
  'Yaw Damper':{topology:REQUIRED,keys:['electronic1@115VAC','electronic1@28VDC']},
  'Window Heat Control - L1':{topology:REQUIRED,keys:['main1@115VAC','dc1@28VDC']},
  'Window Heat Control - L2 (L3)':{topology:REQUIRED,keys:['main2@115VAC','dc2@28VDC']},
  'Window Heat Control - R1':{topology:REQUIRED,keys:['main2@115VAC','dc2@28VDC']},
  'Window Heat Control - R2 (R3)':{topology:REQUIRED,keys:['main1@115VAC','dc1@28VDC']},
  'FMC':{topology:ANY,keys:['electronic1@115VAC','electronic2@115VAC','standby@115VAC']},
  'Audio Panel - Captain & FO & OBS':{topology:ANY,keys:['electronic2@28VDC','battery@28VDC']},
  'External Power Control':{topology:ANY,keys:['hotBattery@28VDC','battery@28VDC']},
  'Marker Beacons':{topology:ANY,keys:['battery@28VDC','electronic1@28VDC']},
  'Auto Slat Controller 1 / 2':{topology:CHANNELS,keys:['transfer1@28VAC','transfer2@28VAC']},
  'Auto Slat DC Controller 1 / 2':{topology:CHANNELS,keys:['dc1@28VDC','dc2@28VDC']},
  'FCC -A/ B':{topology:CHANNELS,keys:['electronic1@28VDC','electronic2@28VDC']},
  'Alpha Vane AoA - left':{topology:CHANNELS,keys:['main1@115VAC','transfer1@115VAC'],purposes:{
   'main1@115VAC':'ADDITIONAL_AOA_FEED_UNCONFIRMED',
   'transfer1@115VAC':'VANE_HEATER'}},
  'Alpha Vane AoA - right':{topology:CHANNELS,keys:['main2@115VAC','transfer2@115VAC'],purposes:{
   'main2@115VAC':'ADDITIONAL_AOA_FEED_UNCONFIRMED',
   'transfer2@115VAC':'VANE_HEATER'}}
 });
 const PROFILES=Object.freeze(P);
 const TRI=x=>x===true||x===false||x===null;
 const outcome=x=>x===true?'NORMAL':x===false?'OFF':'UNKNOWN';
 function validateIndex(index){
  if(!Array.isArray(index?.rows))throw Error('MRG consumer index rows required');
  const grouped=new Map();
  for(const row of index.rows){
   const set=grouped.get(row.item)||new Set();
   for(const bus of row.feedBus.split('|'))set.add(bus+'@'+row.feedVoltage);
   grouped.set(row.item,set);
  }
  const multi=[...grouped].filter(x=>x[1].size>1);
  if(multi.length!==Object.keys(P).length)throw Error(
   'Unclassified multi-feed devices: expected '+Object.keys(P).length+', found '+multi.length);
  for(const [name,profile] of Object.entries(P)){
   const found=grouped.get(name);
   if(!found||found.size!==profile.keys.length||
      profile.keys.some(key=>!found.has(key)))
    throw Error('MRG multi-feed source drift: '+name);
  }
  return {multifeedDevices:multi.length,required:8,alternate:4,independent:5,
   sourceRows:index.rows.length,logicalDevices:grouped.size};
 }
 function resolveDevice(name,entries,buses){
  const profile=P[name];
  if(!profile)return null;
  if(!Array.isArray(entries)||!entries.length||!buses)
   throw Error('Multi-feed inputs required for '+name);
  const feedMap=new Map();
  for(const entry of entries){
   const keys=entry.busKeys||entry.feedBus.split('|').map(k=>k+'@'+entry.feedVoltage);
   for(const key of keys){
    if(!profile.keys.includes(key))throw Error('Unexpected multi-feed bus: '+name+' / '+key);
    if(feedMap.has(key))throw Error('Duplicate multi-feed channel: '+name+' / '+key);
    if(!Object.hasOwn(buses,key))throw Error('Multi-feed bus not modelled: '+key);
    const raw=buses[key].powered;
    if(!TRI(raw))throw Error('Invalid multi-feed bus state: '+key);
    // OPEN means this row's CB-controlled feed is unavailable.
    // PARTIAL_OPEN is unresolved per-channel without a specific CB->feed map.
    const available=entry.cbState==='OPEN'?false:
     entry.cbState==='PARTIAL_OPEN'||entry.cbState==='UNKNOWN'?null:raw;
    feedMap.set(key,Object.freeze({
     key,sourceRowId:entry.id,powered:available,status:outcome(available),
     busPowered:raw,cbState:entry.cbState,
     purpose:profile.purposes?.[key]||'ELECTRICAL_SUPPLY',
     mappingQuality:profile.purposes?.[key]?.includes('UNCONFIRMED')?
       'FUNCTION_UNCONFIRMED':'MRG_GENERIC_TOPOLOGY'
    }));
   }
  }
  if(feedMap.size!==profile.keys.length||
    profile.keys.some(key=>!feedMap.has(key)))
   throw Error('Incomplete multi-feed topology for '+name);
  const feeds=profile.keys.map(key=>feedMap.get(key));
  const live=feeds.filter(f=>f.powered===true).length;
  const lost=feeds.filter(f=>f.powered===false).length;
  const unknown=feeds.length-live-lost;
  let state;
  if(profile.topology===REQUIRED)
   state=lost?'OFF':unknown?'UNKNOWN':'NORMAL';
  else if(profile.topology===ANY)
   state=live?'NORMAL':lost===feeds.length?'OFF':'UNKNOWN';
  else state=lost===feeds.length?'OFF':
   live===feeds.length?'NORMAL':unknown?'UNKNOWN':'DEGRADED';
  // Independent channels do not magically backfeed one another.
  // The unverified extra AoA feed is NOT a heater fallback.
  const capabilities={};
  for(const f of feeds)capabilities[f.purpose==='ELECTRICAL_SUPPLY'?f.key:f.purpose]=f.powered;
  if(profile.topology===REQUIRED)capabilities.DEVICE_POWER=state==='NORMAL'?true:state==='OFF'?false:null;
  if(profile.topology===ANY)capabilities.DEVICE_POWER=state==='NORMAL'?true:state==='OFF'?false:null;
  if(profile.topology===CHANNELS)capabilities.DEVICE_POWER=state==='OFF'?false:
   state==='NORMAL'?true:null;
  const effect=state==='NORMAL'?'ELECTRICAL_FUNCTION_AVAILABLE':
   state==='UNKNOWN'?'ELECTRICAL_AVAILABILITY_UNRESOLVED':
   state==='DEGRADED'?'INDEPENDENT_CHANNEL_LOSS':
   profile.topology===REQUIRED?'REQUIRED_FEED_LOST':
   profile.topology===ANY?'ALL_ALTERNATE_FEEDS_LOST':'ALL_CHANNELS_LOST';
  return {name,topology:profile.topology,state,effect,
   feedChannels:feeds,capabilities,liveFeeds:live,lostFeeds:lost,unknownFeeds:unknown,
   sourceQuality:name.startsWith('Alpha Vane AoA')?
    'MAIN_AOA_FUNCTION_UNCONFIRMED;HEATER_TRANSFER_FEED':'GENERIC_MRG_IV6_NOT_AIRFRAME_WDM'};
 }
 return Object.freeze({VERSION,ALL_REQUIRED:REQUIRED,ANY_AVAILABLE:ANY,
  INDEPENDENT_CHANNELS:CHANNELS,PROFILES,validateIndex,resolveDevice});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
