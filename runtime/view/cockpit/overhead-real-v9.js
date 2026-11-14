/* PERF-0009 physical-lamp and approved-frontend diagnostic.
 * No source panel, guarded artwork or original avionics logic is altered.
 * F deliberately does no periodic simulation or visual state updates.
 * G responds to original real control change events (VISUAL ONLY).
 * H adds existing Electrical V7 + educational dynamics, not the ECU.
 */
(function(){
 'use strict';
 const current=document.currentScript.src;
 const stage=document.documentElement.dataset.perf9Stage;
 if(!['F','G','H'].includes(stage))return;
 const reference=new URL('../interactive-overhead/lights.js',current);
 const file=p=>new URL(p,reference).href;
 const elapsed=()=>performance.now();
 const count={mountedLamps:0,renderPasses:0,changedFaces:0,controlEvents:0,
  electricalEvaluations:0,trainingSteps:0};
 let registry=null,renderLamps=[],state=null,engine=null,apu=null,ready=false,blink=false;
 const ui=document.createElement('aside');ui.id='perf9Status';
 ui.innerHTML='<h3>PERF-0009 '+stage+' · REAL OVERHEAD</h3>'+
 '<p id="perf9Summary">Loading original physical controls and lamps...</p>'+
 '<button id="perf9Run" type="button">Run 6s FPS</button>'+
 '<button id="perf9Copy" type="button" disabled>Copy report</button>'+
 '<pre id="perf9Report"></pre>'+
 '<a href="./overhead-real-f-v9.html">F</a> · <a href="./overhead-real-g-v9.html">G</a> · '+
 '<a href="./overhead-real-h-v9.html">H</a> · <a href="./unified-diagnostic-v6.html">I (Full)</a>';
 document.body.append(ui);
 const summary=ui.querySelector('#perf9Summary'),pre=ui.querySelector('#perf9Report'),run=ui.querySelector('#perf9Run'),copy=ui.querySelector('#perf9Copy');
 let report=null;
 function controls(){
  try{
   return {t:window.B737OverheadToggles?.getState?.()||{},
    r:window.B737RotaryGuards?.getState?.()?.rotaries||{},
    g:window.B737GuardOwner18?.inspect?.()||{}};
  }catch{return {t:{},r:{},g:{}};}
 }
 function currentPower(){
  if(stage!=='H')return true;
  const e=window.B737ElectricalV7;
  const cs=controls(),value=cs.g['battery-master']?.value;
  if(value==='ON'||value==='OFF'){
   const on=value==='ON';
   if(state.config.batterySwitch!==on)state=e.apply(state,{type:'CONTROL',key:'batterySwitch',value:on});
  }
  const output=e.evaluate(state);
  count.electricalEvaluations++;
  // This is an investigative global lamp gate, not actual lamp bus wiring.
  return !!(output.bus?.battery||output.bus?.hotBattery||output.bus?.dcStandby);
 }
 function showLamps(){
  if(!ready||stage==='F')return;
  const snapshots=controls(),power=currentPower();
  count.renderPasses++;
  for(const item of renderLamps){
   // A deliberately simplified *display-only* mapping for CPU isolation;
   // do not claim any Boeing light rule or engine indication from this test.
   const connected=item.def.controls||[];
   const active=connected.some(id=>{
    const value=snapshots.t[id]??snapshots.r[id]??snapshots.g[id]?.value;
    return typeof value==='string'&&!/^(OFF|CENTER|NORM|AUTO|CLOSED|0)$/i.test(value);
   });
   const next=active&&power?'ON':'OFF';
   if(item.value===next)continue;
   item.value=next;
   for(const image of item.images)image.classList.toggle('active',image.dataset.state===next);
   count.changedFaces++;
  }
 }
 function gaugeNumber(){return document.querySelectorAll('#overheadToggleLayer .mounted-toggle').length;}
 async function mount(){
  const [lightResp,layoutResp,instanceResp,readableResp]=await Promise.all([
   fetch(file('lights.json')),fetch(file('../all-overhead/atlas-layout.json')),
   fetch(file('instance-faces.json')),fetch(file('readability-faces.json'))]);
  if([lightResp,layoutResp,instanceResp,readableResp].some(r=>!r.ok))throw Error('Original lamp metadata missing');
  const [lights,layout,instance,readability]=await Promise.all([lightResp.json(),layoutResp.json(),instanceResp.json(),readableResp.json()]);
  registry=lights;const placements=new Map(layout.placements.map(p=>[p.id,p]));
  const mapper=window.B737OverheadToggleModel?.mapPoint;
  if(!mapper)throw Error('Original physical geometry mapper not mounted');
  const layer=document.createElement('div');layer.className='perf9-lamp-layer';
  for(const lamp of lights.lights){
   const p=placements.get(lamp.placementId),rect=lamp.sourceRect;
   const a=mapper({id:lamp.id,sourcePoint:[rect[0],rect[1]],bezelSourceDiameter:0},p);
   const b=mapper({id:lamp.id,sourcePoint:[rect[0]+rect[2],rect[1]+rect[3]],bezelSourceDiameter:0},p);
   const node=document.createElement('span');node.className='perf9-lamp';node.dataset.lamp=lamp.id;
   node.style.cssText='left:'+a.x+'px;top:'+a.y+'px;width:'+(b.x-a.x)+'px;height:'+(b.y-a.y)+'px';
   const images=[];
   for(const mode of ['OFF','ON']){
    const asset=readability.instances?.[lamp.id]?.states?.[mode]||
      instance.instances?.[lamp.id]?.states?.[mode]||lights.assets?.[lamp.asset]?.[mode];
    if(!asset?.url)continue;
    const img=document.createElement('img');img.dataset.state=mode;img.alt='';img.decoding='async';
    img.src=new URL(asset.url,reference).href;
    if(mode==='OFF')img.classList.add('active');
    node.append(img);images.push(img);
   }
   if(!images.length)continue;
   layer.append(node);renderLamps.push({def:lamp,images,value:'OFF'});
  }
  document.getElementById('atlasAbsolute').append(layer);
  count.mountedLamps=renderLamps.length;ready=true;
  if(stage!=='F')showLamps();
 }
 function tickH(){
  const electrical=window.B737ElectricalV7,engineDynamics=window.B737ISNEngineStartDynamicsV1,apuDynamics=window.B737ISNAPULoadDynamicsV1;
  if(!electrical||!engineDynamics||!apuDynamics)throw Error('Source-backed V7 and training kernels unavailable');
  state=electrical.initialState({coldDark:true});
  engine=engineDynamics.initialRunning();apu=apuDynamics.initial();
  setInterval(()=>{
   const data=engineDynamics.stepRunning(engine,{deltaMs:200,throttle:.3,onGround:true,pressureAltitudeFt:0,iasKt:0});
   engine=data;
   const load=apuDynamics.demand({selectedSources:{1:'APU'},switches:{AVIONICS:true},bleedValveOpen:false});
   apu=apuDynamics.step(apu,load,200);count.trainingSteps++;
   showLamps();summary.textContent='Original controls '+gaugeNumber()+
    ' · lamps '+count.mountedLamps+' · electrical '+count.electricalEvaluations+
    ' · training steps '+count.trainingSteps;
  },200);
 }
 async function measure(){
  if(run.disabled)return;run.disabled=true;copy.disabled=true;pre.textContent='Measuring browser frames...';
  const delays=[],longs=[],old={...count},start=performance.now();
  let running=true,last=0;
  function sample(t){if(!running)return;if(last){const d=t-last;if(d>0&&d<2000)delays.push(d);}last=t;requestAnimationFrame(sample);}
  let obs=null;
  try{obs=new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.entryType==='longtask')longs.push(e.duration);});obs.observe({entryTypes:['longtask']});}catch{}
  requestAnimationFrame(sample);
  await new Promise(resolve=>setTimeout(resolve,6000));running=false;obs?.disconnect();
  const total=delays.reduce((a,b)=>a+b,0),ordered=delays.slice().sort((a,b)=>a-b);
  report={schema:'PERF-0009',stage,elapsedMs:Math.round(performance.now()-start),
   fps:total?Math.round(delays.length*10000/total)/10:null,
   p95FrameMs:ordered.length?Math.round(ordered[Math.floor((ordered.length-1)*.95)]*10)/10:null,
   slowFrames:delays.filter(d=>d>34).length,
   longTasks:longs.length,longTaskMs:Math.round(longs.reduce((a,b)=>a+b,0)),
   counts:{toggles:gaugeNumber(),rotaries:document.querySelectorAll('.mounted-rotary').length,
    ownerGuards:document.querySelectorAll('.owner18-guard-control').length,lamps:count.mountedLamps},
   operations:Object.fromEntries(Object.entries(count).map(([k,v])=>[k,v-(old[k]||0)])),
   note:'F/G visual state isolation; H source-backed trainer kernels, not full ECU. Browser RAF samples are not CPU percentages.'};
  pre.textContent=JSON.stringify(report,null,2);run.disabled=false;copy.disabled=false;
 }
 run.onclick=measure;copy.onclick=async()=>{if(!report)return;try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));copy.textContent='Copied';}catch{pre.select?.();}};
 async function start(){
  try{
   const start=elapsed();while(elapsed()-start<16000){
    if(window.B737OverheadToggles?.getState&&window.B737RotaryGuards?.getState&&
      document.querySelectorAll('#atlasAbsolute .atlas-piece').length>=19)break;
    await new Promise(resolve=>setTimeout(resolve,80));
   }
   if(!window.B737RotaryGuards?.getState)throw Error('Original real Overhead controls did not initialize');
   if(stage==='H')tickH();
   await mount();
   for(const event of ['b737:switch-change','b737:rotary-change','b737:guard-changed','b737:guarded-change'])
    addEventListener(event,()=>{count.controlEvents++;if(stage!=='F')showLamps();});
   summary.textContent='Original 58 toggles + 20 rotaries + owner guards; '+count.mountedLamps+' photo lamps; stage '+stage;
   document.documentElement.dataset.perf9Ready='true';
   window.B737Perf9=Object.freeze({snapshot:()=>({...count,stage,ready:true}),measure});
  }catch(error){summary.textContent='Diagnostic error: '+error.message;document.documentElement.dataset.perf9Ready='error';console.error('PERF-0009',error);}
 }
 start();
})();
