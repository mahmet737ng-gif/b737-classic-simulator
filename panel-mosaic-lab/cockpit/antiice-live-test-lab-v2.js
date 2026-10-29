/* ANTIICE-EMBED-0002
 * Live original Unified OH15 stage: one separate same-origin overhead-stage
 * iframe cropped to its registered OH15 atlas tile. All 7 metal toggle
 * sprites, 17 light sockets, the original momentary recessed TAT switch and
 * locked blanking plate come from the real stage; no HTML imitations.
 * Lab physics are isolated and run through the same Window Heat/TAT cores.
 */
(function(){'use strict';
const WH=window.B737WindowHeatV1,TAT=window.B737TATProbeV1,TATLive=window.B737TATProbeUnifiedV1;
if(!WH||!TAT)return;
const TILE={x:1231,y:1031,w:493,h:508},FRAME={w:2220,h:3312};
const WH_IDS=Object.keys(WH.CHANNELS),LAMP_IDS=[
 'probe-capt-ps','probe-fo-static','probe-l-elev','probe-l-alpha',
 'probe-fo-ps','probe-capt-static','probe-r-elev','probe-r-alpha'];
const PITOT={
 'probe-capt-ps':'pitot-a','probe-fo-static':'pitot-a',
 'probe-l-elev':'pitot-a','probe-l-alpha':'pitot-a',
 'probe-fo-ps':'pitot-b','probe-capt-static':'pitot-b',
 'probe-r-elev':'pitot-b','probe-r-alpha':'pitot-b'
};
const CHANNELS=Object.fromEntries(WH_IDS.map(id=>[id,WH.CHANNELS[id]]));
const KEY='b737classic.cb.v1';
const DEFAULT_BUS=()=>({generator1:true,generator2:true,main1:true,main2:true,dc1:true,dc2:true});
const scenarioList=[
 {id:'normal',name:'All systems healthy',note:'Switch the original controls freely; CB and supplied buses are available'},
 {id:'cold',name:'Cold & Dark',bus:'all',note:'No AC or DC; no heat or powered indications'},
 {id:'main1',name:'MAIN BUS 1 loss',bus:'main1',note:'Channel controllers tied to MAIN1 have no supply'},
 {id:'main2',name:'MAIN BUS 2 loss',bus:'main2',note:'MAIN2 controllers and the TAT heater lose AC'},
 {id:'gen1',name:'GENERATOR BUS 1 loss',bus:'generator1'},
 {id:'gen2',name:'GENERATOR BUS 2 loss',bus:'generator2'},
 {id:'dc1',name:'DC 1 loss',bus:'dc1',note:'L FWD / R SIDE controller DC and indicator A unavailable'},
 {id:'dc2',name:'DC 2 loss',bus:'dc2',note:'L SIDE / R FWD controller DC and indicator B unavailable'},
 {id:'window-power',name:'WINDOW PWR TEST',action:'PWR TEST',windowAll:'OFF',note:'All four green ON annunciations tested with the window switches OFF'},
 {id:'window-ovht',name:'WINDOW OVHT TEST',action:'OVHT',windowAll:'ON',note:'60-second amber test; individual OFF clears only that channel'},
 {id:'wh-heater',name:'Window heater open',channel:'L_FWD',whFault:'HEATER_FAIL'},
 {id:'wh-controller',name:'Window controller fail',channel:'L_FWD',whFault:'CONTROLLER_FAIL'},
 {id:'wh-sensor',name:'Window sensor fail',channel:'L_FWD',whFault:'SENSOR_FAIL'},
 {id:'wh-overheat',name:'Real window overheat',channel:'L_FWD',whFault:'STUCK_OVERHEAT'},
 {id:'wh-pwr-fail',name:'Window PWR TEST fail',channel:'L_FWD',whFault:'POWER_TEST_FAIL',action:'PWR TEST'},
 {id:'wh-heater-cb',name:'Window heater CB open',channel:'L_FWD',cbType:'heater'},
 {id:'wh-control-cb',name:'Window control CB open',channel:'L_FWD',cbType:'controller'},
 {id:'wh-aux-l',name:'Left L4/L5 CB open',aux:'L45'},
 {id:'wh-aux-r',name:'Right R4/R5 CB open',aux:'R45'},
 {id:'tat-ground',name:'TAT · ground normal',onGround:true},
 {id:'tat-press',name:'TAT TEST healthy',onGround:true,action:'TAT TEST'},
 {id:'tat-heater',name:'TAT heater fail',tatFault:'HEATER_FAIL',action:'TAT TEST'},
 {id:'tat-detector',name:'TAT current sensor fail',tatFault:'CURRENT_SENSE_FAIL',action:'TAT TEST'},
 {id:'tat-lamp-on',name:'TEMP PROBE stuck ON',tatFault:'INDICATOR_STUCK_ON'},
 {id:'tat-lamp-off',name:'TEMP PROBE stuck OFF',tatFault:'INDICATOR_STUCK_OFF'},
 {id:'tat-lamp-off',name:'TEMP PROBE stuck OFF',tatFault:'INDICATOR_STUCK_OFF'},
 {id:'tat-cb',name:'TAT C5 CB open',virtualTatCB:true,action:'TAT TEST'},
 {id:'pitot-a-fail',name:'PITOT A indication fault',pitotFault:'probe-capt-ps'},
 {id:'pitot-b-fail',name:'PITOT B indication fault',pitotFault:'probe-fo-ps'},
 {id:'flight',name:'Airborne pitot heat',onGround:false,pitotOn:true}
];
const scenarios=new Map(scenarioList.map(x=>[x.id,x]));
let dialog=null,stage=null,embedded=null,sourceDoc=null,ready=false,ticker=null,whState=WH.initialState();
let current='normal',scenario={},faults={},testHeld=false,lastAt=0,frameDetector=null,gesture=null,hitCount=0,lastHit=0,session=0;
const query=id=>dialog?.querySelector('#'+id);
const cbSnapshot=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}};
const realCbOpen=(key)=>!!cbSnapshot()?.breakers?.some(x=>x.id===key&&(x.pulled||x.tripped));
const physSwitches=()=>{try{return embedded?.contentWindow?.B737OverheadToggles?.getState?.()||{};}catch{return {};}};
const overlays={};
function infoLine(message){const el=query('anti-status');if(el)el.textContent=message;}
function post(action,lamps){
 if(!ready||!embedded?.contentWindow)return;
 embedded.contentWindow.postMessage({type:'b737:cockpit-command',action,lamps},location.origin);
}
function resetSimulation(){whState=WH.initialState();lastAt=performance.now();}
function getState(){
 const bus=DEFAULT_BUS();if(scenario.bus==='all')for(const k of Object.keys(bus))bus[k]=false;
 else if(scenario.bus&&Object.prototype.hasOwnProperty.call(bus,scenario.bus))bus[scenario.bus]=false;
 const sw={...physSwitches()};
 const breakers={};
 for(const key of WH.ALL_CBS)if(realCbOpen(key))breakers[key]=false;
 if(realCbOpen(TAT.CB_ID))breakers[TAT.CB_ID]=false;
 if(scenario.cbType&&WH.CHANNELS[scenario.channel]){
  breakers[WH.CHANNELS[scenario.channel][scenario.cbType==='controller'?'controllerCB':'heaterCB']]=false;
 }
 if(scenario.aux)breakers[WH.AUX[scenario.aux].breaker]=false;
 if(scenario.virtualTatCB)breakers[TAT.CB_ID]=false;
 for(const [id,d] of Object.entries(WH.CHANNELS))for(const fault of WH.FAULTS)
  if(scenario.channel===id&&scenario.whFault===fault)faults[id+'|'+fault]=true;
 const pitotFaults=LAMP_IDS.filter(id=>id===scenario.pitotFault||!!faults['pitot|'+id]);
 const onGround=scenario.onGround!==false;
 return {bus,sw,breakers,pitotFaults,onGround};
}
function evaluate(elapsed=0){
 const ctx=getState();let w=whState;
 for(const id of WH_IDS)for(const fault of WH.FAULTS){
  const active=!!faults[id+'|'+fault];
  if(!!w.faults[id]?.[fault]!==active)w=WH.injectFault(w,id,fault,active);
 }
 const step=WH.step(w,{buses:ctx.bus,switches:ctx.sw,breakers:ctx.breakers},Math.max(0,Math.min(300,elapsed)));
 whState=step.state;
 const tatState=scenario.tatFault?TAT.injectFault(TAT.initialState(),scenario.tatFault,true):TAT.initialState();
 const tat=TAT.evaluate(tatState,{buses:ctx.bus,breakers:ctx.breakers,
  onGround:ctx.onGround,testPressed:testHeld,
  switches:ctx.sw,trainingPower:false});
 const wh={};
 for(const ch of Object.values(step.output.channels)){
  const d=WH.CHANNELS[ch.id];wh[d.onId]=ch.greenOn;wh[d.ovhtId]=ch.overheatOn;
 }
 const probes={};
 for(const id of LAMP_IDS){
  const sw=ctx.sw[PITOT[id]]==='ON',power=ctx.bus[PITOT[id]==='pitot-a'?'dc1':'dc2'];
  // Pitot A/B and individual probe failure are GENERIC trainer logic; no
  // unverified aircraft WDM/individual CB wiring is claimed.
  probes[id]=!!power&&(!sw||ctx.pitotFaults.includes(id));
 }
 post('isn-projection',probes);
 post('window-heat-projection',wh);
 post('tat-probe-projection',{'probe-temp':tat.amberOn});
 const output={window:step.output,tat,probes,buses:ctx.bus,breakers:ctx.breakers,switches:ctx.sw,mode:current,
  note:'PITOT probe failures: generic simulator approximations; TAT & Window Heat use the actual verified cores.'};
 const metrics=query('anti-metrics');
 if(metrics){
  const heated=Object.values(step.output.channels).filter(x=>x.heaterPower).length;
  const amber=Object.values(step.output.channels).filter(x=>x.overheatOn).length;
  metrics.textContent='WINDOW HEAT '+heated+'/4 heaters · '+amber+' OVERHEAT · TAT '+(tat.heaterPower?'HEATING':'OFF')+
   ' · TEMP PROBE '+(tat.amberOn?'AMBER':'OFF')+' · CB P18-3 C5 '+(ctx.breakers[TAT.CB_ID]===false?'OPEN':'CLOSED');
 }
 return output;
}
function tick(){
 if(!ready)return;
 const now=performance.now(),dt=Math.min(300,Math.max(0,(now-lastAt)/1000));lastAt=now;
 const out=evaluate(dt);
 if(query('anti-debug'))query('anti-debug').textContent=out.tat.status;
}
function nativeSwitch(id,value){
 const win=embedded?.contentWindow,btn=win?.document?.getElementById('toggle-'+id);
 if(!btn)return false;
 const states=win.B737OverheadToggles?.getRegistry?.()?.controls?.find(x=>x.id===id)?.states||[];
 if(states.length!==2)return false;
 if(win.B737OverheadToggles.getState()[id]!==value)btn.click();
 return win.B737OverheadToggles.getState()[id]===value;
}
function nativeMomentary(id,direction,ms=240){
 const win=embedded?.contentWindow,btn=win?.document?.getElementById('toggle-'+id);
 if(!btn)return false;
 const k=direction==='OVHT'?'Home':direction==='PWR TEST'?'End':null;
 if(!k)return false;
 btn.dispatchEvent(new win.KeyboardEvent('keydown',{key:k,bubbles:true}));
 setTimeout(()=>btn.dispatchEvent(new win.KeyboardEvent('keyup',{key:k,bubbles:true})),ms);
 return true;
}
function nativeTat(ms=450){
 const win=embedded?.contentWindow,btn=win?.document?.querySelector('.b737-recess-unit[data-recessed-id="pitot-static-tat-test"] .b737-recess-unit__cap');
 if(!btn)return false;
 btn.dispatchEvent(new win.KeyboardEvent('keydown',{key:' ',bubbles:true}));
 setTimeout(()=>btn.dispatchEvent(new win.KeyboardEvent('keyup',{key:' ',bubbles:true})),ms);
 return true;
}
function onLiveEvent(){
 if(!ready)return;
 tick();
}
function connect(){
 const w=embedded?.contentWindow,doc=w?.document;
 if(!w||!doc||!w.B737OverheadToggles?.getState||!w.B737OverheadLights?.getState||
  !doc.querySelector('#atlasAbsolute .atlas-piece[data-key="OH15"]'))return false;
 if(sourceDoc===doc&&ready)return true;
 sourceDoc=doc;ready=true;testHeld=false;resetSimulation();
 w.addEventListener('b737:switch-change',e=>{
  if(e.detail?.id==='window-power-test')evaluate(0);
  else onLiveEvent();
 });
 w.addEventListener('b737:recessed-button',e=>{
  if(e.detail?.id==='pitot-static-tat-test'){testHeld=e.detail.pressed===true;evaluate(0);}
 });
 w.addEventListener('b737:overhead-light-state',()=>{ /* tick owns scenario lamps */ });
 infoLine('LIVE OH15 READY · All switches and lamps are from the original Unified overhead renderer');
 // The embedded original stage initializes asynchronously. Apply any
 // scenario selected before it mounted its real controls.
 if(current!=='normal')applyScenario(current);
 else for(const id of [...Object.values(WH.CHANNELS).map(d=>d.switchId),'pitot-a','pitot-b'])nativeSwitch(id,'OFF');
 tick();return true;
}
function applyScenario(id){
 const s=scenarios.get(id);if(!s)return false;
 current=id;scenario={...s};faults={};testHeld=false;resetSimulation();
 const el=query('anti-scenarios');
 if(el)for(const b of el.querySelectorAll('button[data-scenario]'))
  b.setAttribute('aria-pressed',String(b.dataset.scenario===id));
 if(ready){
  if(id==='normal'){
   for(const key of [...Object.values(WH.CHANNELS).map(d=>d.switchId),'pitot-a','pitot-b'])nativeSwitch(key,'OFF');
  }
  if(s.windowAll)for(const d of Object.values(WH.CHANNELS))nativeSwitch(d.switchId,s.windowAll);
  if(s.pitotOn){nativeSwitch('pitot-a','ON');nativeSwitch('pitot-b','ON');}
  if(s.channel)nativeSwitch(WH.CHANNELS[s.channel].switchId,'ON');
  if(s.action==='OVHT'||s.action==='PWR TEST')setTimeout(()=>nativeMomentary('window-power-test',s.action),100);
  if(s.action==='TAT TEST')setTimeout(()=>nativeTat(),150);
 }
 const description=query('anti-scenario-desc');
 if(description)description.textContent=s.note||('Selected: '+s.name+' · use the original live metal controls to test the fault.');
 tick();return true;
}
function chooseFault(){
 const channel=query('anti-wh-channel')?.value,fault=query('anti-wh-fault')?.value;
 if(!WH.CHANNELS[channel]||!WH.FAULTS.includes(fault))return;
 current='manual';scenario={channel,whFault:fault,note:'Manually injected Window Heat fault. Other systems remain unchanged.'};
 const k=channel+'|'+fault;faults[k]=!faults[k];resetSimulation();nativeSwitch(WH.CHANNELS[channel].switchId,'ON');
 query('anti-scenario-desc').textContent=scenario.note+' · '+(faults[k]?'FAULT ACTIVE: ':'FAULT CLEARED: ')+k;
 const buttons=query('anti-scenarios');if(buttons)for(const b of buttons.querySelectorAll('button[data-scenario]'))b.setAttribute('aria-pressed','false');
 tick();
}
function simulateCb(){
 const channel=query('anti-wh-channel')?.value,type=query('anti-cb-type')?.value;
 if(!WH.CHANNELS[channel]||!['heater','controller'].includes(type))return false;
 current='manual';scenario={channel,cbType:type};
 faults={};nativeSwitch(WH.CHANNELS[channel].switchId,'ON');
 const key=WH.CHANNELS[channel][type==='heater'?'heaterCB':'controllerCB'];
 query('anti-scenario-desc').textContent='SIMULATED CB OPEN: '+key+' (lab only, real CB unchanged).';
 tick();return true;
}
function injectPitot(){
 const id=query('anti-pitot-id')?.value;
 if(!LAMP_IDS.includes(id))return false;
 current='manual';faults['pitot|'+id]=!faults['pitot|'+id];scenario={onGround:true};
 nativeSwitch(PITOT[id],'ON');
 query('anti-scenario-desc').textContent=id+(faults['pitot|'+id]?' FAILURE INJECTED':' FAILURE CLEARED')+' · GENERIC probe trainer';
 tick();return true;
}
function injectTat(){
 const fault=query('anti-tat-fault')?.value;
 if(!TAT.FAULTS.includes(fault))return false;
 current='manual';scenario={onGround:true,tatFault:fault};
 query('anti-scenario-desc').textContent='TAT '+fault+' · use original TAT TEST to verify indication';
 tick();return true;
}
function crop(){
 const box=query('anti-live-crop'),canvas=query('anti-live-canvas');
 if(!box||!canvas)return;
 const width=Math.min(650,box.clientWidth),heightMax=Math.max(250,Math.min(window.innerHeight*.70,705));
 const scale=Math.min(width/TILE.w,heightMax/TILE.h);
 const w=TILE.w*scale,h=TILE.h*scale;
 box.style.height=h+'px';
 canvas.style.transform='scale('+scale+')';
 canvas.style.width=TILE.w+'px';canvas.style.height=TILE.h+'px';
}
function build(){
 dialog=document.createElement('dialog');dialog.id='antiIceLiveLab';dialog.className='antiice-dialog';dialog.dir='ltr';
 const buttons=scenarioList.map(s=>'<button type="button" data-scenario="'+s.id+'" aria-pressed="false">'+s.name+'</button>').join('');
 const channelOptions=WH_IDS.map(id=>'<option value="'+id+'">'+id+'</option>').join('');
 const faultOptions=WH.FAULTS.map(id=>'<option value="'+id+'">'+id+'</option>').join('');
 const pitotOptions=LAMP_IDS.map(id=>'<option value="'+id+'">'+id+'</option>').join('');
 const tatFaultOptions=TAT.FAULTS.map(id=>'<option value="'+id+'">'+id+'</option>').join('');
 dialog.innerHTML='<header class="antiice-header"><div><strong>ANTI ICE · LIVE PANEL TEST LAB</strong><small>Exact Unified OH15 tile · same bitmap, original interactive switches, original light faces</small></div><button type="button" id="anti-close" aria-label="Close test lab">×</button></header>'+
 '<div class="antiice-main"><section class="antiice-visual"><div class="antiice-crop" id="anti-live-crop">'+
 '<div class="antiice-canvas" id="anti-live-canvas"><iframe id="anti-live-stage" title="Original live Unified ANTI ICE panel OH15" loading="eager"></iframe></div></div>'+
 '<p class="antiice-note">The panel above is the original interactive Unified Overhead embedded as an independent training instance. Its lights, artwork and controls are NOT recreated.</p>'+
 '<p id="anti-metrics" role="status"></p><p id="anti-debug"></p>'+
 '<div class="antiice-buttons"><button type="button" id="anti-ovht">OVHT TEST · 60s</button><button type="button" id="anti-power">PWR TEST</button><button type="button" id="anti-tat">TAT TEST</button></div>'+
 '</section><aside class="antiice-right"><h3>TRAINING SCENARIOS AND FAILURES</h3><div class="antiice-scenarios" id="anti-scenarios">'+buttons+'</div>'+
 '<p id="anti-scenario-desc" class="antiice-desc"></p>'+
 '<h3>WINDOW HEAT · MANUAL FAULT</h3><div class="antiice-selects"><select id="anti-wh-channel">'+channelOptions+'</select><select id="anti-wh-fault">'+faultOptions+'</select><button type="button" id="anti-inject">INJECT</button></div>'+
 '<h3>WINDOW HEAT · VIRTUAL CB OPEN</h3><div class="antiice-selects"><select id="anti-cb-type"><option value="heater">HEATER CB</option><option value="controller">CONTROLLER CB</option></select><button type="button" id="anti-cb-fail">OPEN SELECTED CHANNEL CB</button></div>'+
 '<h3>PITOT STATIC · INDIVIDUAL PROBE FAILURES</h3><div class="antiice-selects"><select id="anti-pitot-id">'+pitotOptions+'</select><button type="button" id="anti-probe-fail">TOGGLE PROBE FAULT</button></div>'+
 '<h3>TAT · ALL MODELED FAULTS</h3><div class="antiice-selects"><select id="anti-tat-fault">'+tatFaultOptions+'</select><button type="button" id="anti-tat-fail">INJECT TAT FAULT</button></div>'+
 '<h3>REAL CB / VIRTUAL CB</h3><p class="antiice-note">P18-3 C5 is the actual TEMP PROBE CB. Preset open-CB scenarios are isolated: they do not change aircraft CB state.</p>'+
 '<div class="antiice-buttons"><button type="button" id="anti-real-cb">PULL REAL TAT C5</button><button type="button" id="anti-cb-view">FIND IN CB PANEL</button></div>'+
 '<button type="button" id="anti-reset">RESET LAB · CLEAR FAULTS</button><p id="anti-status" role="status"></p>'+
 '<p class="antiice-note">Pitot/static probe-failure scenarios use generic simulation behavior; no unverified aircraft-specific wiring is asserted.</p></aside></div>';
 document.body.append(dialog);embedded=query('anti-live-stage');
 const main=document.getElementById('overheadFrame');
 const source=main?.getAttribute('src')||'./overhead-stage.html';
 embedded.src=new URL(source,document.baseURI).href+(source.includes('?')?'&':'?')+'antiiceLab=1';
 embedded.style.cssText='position:absolute;left:-'+TILE.x+'px;top:-'+TILE.y+'px;width:'+FRAME.w+'px;height:'+FRAME.h+'px;border:0;max-width:none;max-height:none;display:block';
 embedded.addEventListener('load',()=>{ready=false;sourceDoc=null;connect();});
 query('anti-close').onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{testHeld=false;});
 query('anti-scenarios').addEventListener('click',e=>{const id=e.target.closest('[data-scenario]')?.dataset.scenario;if(id)applyScenario(id);});
 query('anti-inject').onclick=chooseFault;
 query('anti-cb-fail').onclick=simulateCb;
 query('anti-probe-fail').onclick=injectPitot;
 query('anti-tat-fail').onclick=injectTat;
 query('anti-reset').onclick=()=>{for(const d of Object.values(WH.CHANNELS))nativeSwitch(d.switchId,'OFF');nativeSwitch('pitot-a','OFF');nativeSwitch('pitot-b','OFF');applyScenario('normal');};
 query('anti-ovht').onclick=()=>{for(const d of Object.values(WH.CHANNELS))nativeSwitch(d.switchId,'ON');nativeMomentary('window-power-test','OVHT');};
 query('anti-power').onclick=()=>nativeMomentary('window-power-test','PWR TEST',650);
 query('anti-tat').onclick=()=>nativeTat(650);
 query('anti-real-cb').onclick=()=>{
  const pulled=!!TATLive?.getCbState?.()?.pulled;const out=TATLive?.setCbPulled?.(!pulled);
  if(!out?.ok)infoLine('CB command rejected: '+(out?.reason||'Unavailable'));else tick();
 };
 query('anti-cb-view').onclick=()=>{
  dialog.close();document.getElementById('cbPanelOpen')?.click();
  const frame=document.getElementById('cbPanelFrame');const focus=()=>{try{return frame?.contentWindow?.B737_CB_MRG_VIEWER?.focusByKey(TAT.CB_ID);}catch{return false;}};
  if(!focus())frame?.addEventListener('load',()=>setTimeout(focus,200),{once:true});
 };
 const observer=new ResizeObserver(crop);observer.observe(query('anti-live-crop'));
 window.addEventListener('resize',crop);crop();
 ticker=setInterval(()=>{if(!dialog.open)return;if(!ready)connect();if(ready)tick();
  const btn=query('anti-real-cb');if(btn){btn.textContent=TATLive?.getCbState?.()?.pulled?'PUSH REAL TAT C5':'PULL REAL TAT C5';}
 },140);
 applyScenario('normal');
}
function open(){
 if(!dialog)build();
 if(!dialog.open)dialog.showModal();
 crop();connect();
}
function installTripleTap(){
 const frame=document.getElementById('overheadFrame');
 let bound=null,gesture=null,count=0,at=0,pointers=new Set();
 function bind(){
  let doc;try{doc=frame?.contentDocument;}catch{return;}
  if(!doc||doc===bound)return;
  bound=doc;count=0;gesture=null;pointers=new Set();
  const inTile=e=>{
   const r=doc.querySelector('#atlasAbsolute .atlas-piece[data-key="OH15"]')?.getBoundingClientRect();
   return !!r&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
  };
  doc.addEventListener('pointerdown',e=>{
   if(e.pointerType==='touch')pointers.add(e.pointerId);
   if(e.pointerType==='mouse'&&e.button!==0||pointers.size>1){gesture=null;count=0;return;}
   gesture=inTile(e)?{id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now()}:null;
  },true);
  doc.addEventListener('pointerup',e=>{
   if(e.pointerType==='touch')pointers.delete(e.pointerId);
   if(!gesture||gesture.id!==e.pointerId){gesture=null;return;}
   const valid=performance.now()-gesture.at<420&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<12&&inTile(e)&&pointers.size===0;
   gesture=null;if(!valid){count=0;return;}
   const now=performance.now();count=now-at<650?count+1:1;at=now;
   if(count===3){count=0;open();}
  },true);
  doc.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gesture=null;count=0;},true);
 }
 bind();frame?.addEventListener('load',bind);
 setInterval(bind,500);
}
function boot(){installTripleTap();}
// Events from the isolated overhead iframe must not pan/zoom or select
// controls on the main Unified Cockpit view.
window.addEventListener('message',e=>{
 if(embedded&&e.source===embedded.contentWindow&&e.data?.type==='b737:cockpit-overhead')e.stopImmediatePropagation();
},true);
window.B737AntiIceTestLabV2=Object.freeze({open,applyScenario,evaluate,scenarioIds:scenarioList.map(x=>x.id),getTile:()=>({...TILE}),isReady:()=>ready});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
