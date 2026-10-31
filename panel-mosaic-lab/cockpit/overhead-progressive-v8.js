/* PERF-0008 incremental local measurement. No modifications to owner panels.
 * C uses B737ElectricalV7, D adds training kernels, E adds iframe postMessage
 * in a newly isolated test page. This is NOT a certified aircraft ECU.
 */
(function(){
 'use strict';
 const activeEngine=location.pathname.includes('overhead-engine-v8')||location.pathname.includes('overhead-messaging-v8');
 const activeMessaging=location.pathname.includes('overhead-messaging-v8');
 const core=window.B737ElectricalV7;
 if(!core)throw Error('Real Electrical V7 trainer module absent');
 let state=core.initialState({coldDark:true}),last=performance.now(),frames=0;
 const root=document.createElement('section');root.className='ab-live';root.id='perf8Inspector';
 const title=document.createElement('h3');title.textContent='PERF-0008 '+(activeMessaging?'E':activeEngine?'D':'C')+' · Actual systems';
 const text=document.createElement('pre');text.id='perf8Readout';
 const btn=document.createElement('button');btn.textContent='Ground power attached: OFF';
 let attached=false,ready=false,pings=0,pongs=0,seq=0;
 btn.addEventListener('click',()=>{attached=!attached;btn.textContent='Ground power attached: '+(attached?'ON':'OFF');
  state=core.apply(state,{type:'CONTROL',key:'groundPowerAttached',value:attached});
  state=core.apply(state,{type:'CONTROL',key:'groundPowerQualityGood',value:true});
  if(attached){try{state=core.apply(state,{type:'SELECT_SOURCE',source:'EXT',side:1});}catch(error){console.warn(error.message);}}
  else {for(const side of [1,2])if(state.source[side]==='EXT')state=core.apply(state,{type:'SELECT_SOURCE',source:'OFF',side});}
  update();
 });
 const btnTest=document.createElement('button');btnTest.textContent='Run 6s FPS test';
 const report=document.createElement('pre');report.textContent='Measurement not started';
 root.append(title,btn,document.createTextNode(' '),btnTest,text,report);document.body.append(root);
 const clocks={tickCount:0,electricalEvaluations:0,dynamicsSteps:0,messagesSent:0,messagesReceived:0};
 const gains=[],measurements=[];
 let apu=null,engine=null;
 if(activeEngine){
  if(!window.B737ISNEngineStartDynamicsV1||!window.B737ISNAPULoadDynamicsV1)throw Error('Existing engine training kernels absent');
  engine=window.B737ISNEngineStartDynamicsV1.initialRunning();
  apu=window.B737ISNAPULoadDynamicsV1.initial();
 }
 function batteryFromPanel(){
  const node=document.querySelector('.guard[data-name="battery-master"]');
  const checked=node?.querySelector('input:checked');
  return checked?.value?.toUpperCase()==='ON';
 }
 function update(){
  const battery=batteryFromPanel();
  if(state.config.batterySwitch!==battery)state=core.apply(state,{type:'CONTROL',key:'batterySwitch',value:battery});
  const result=core.evaluate(state);
  clocks.electricalEvaluations++;
  const textLines=['Battery switch: '+(battery?'ON':'OFF'),
   'AC 1 / 2: '+(result.source[1]||'OFF')+' / '+(result.source[2]||'OFF'),
   'Electrical V7 evaluated: '+clocks.electricalEvaluations];
  if(activeEngine)textLines.push('Engine N2: '+engine.n2Percent.toFixed(1)+'%, APU EGT: '+apu.egtC.toFixed(0)+' °C',
   'Training dynamics steps: '+clocks.dynamicsSteps);
  if(activeMessaging)textLines.push('iframe ping/pong: '+pings+' / '+pongs);
  text.textContent=textLines.join('\n');
 }
 document.addEventListener('change',event=>{
  if(event.target.matches('.guard[data-name="battery-master"] input'))update();
 },{passive:true});
 let activeMeasure=null,flag=false;
 function rAF(time){
  if(last&&time>last){const delta=time-last;if(delta<2000){gains.push(delta);if(gains.length>180)gains.shift();frames++;}}
  last=time;requestAnimationFrame(rAF);
 }
 requestAnimationFrame(rAF);
 function tick(){
  clocks.tickCount++;
  update();
  if(activeEngine){
   // Training interpolation kernels from the existing simulator, with an
   // explicit 100ms classroom step, not a running engine or a fake sensor.
   engine=window.B737ISNEngineStartDynamicsV1.stepRunning(engine,{
    deltaMs:100,throttle:.34,onGround:true,pressureAltitudeFt:0,iasKt:0});
   const load=window.B737ISNAPULoadDynamicsV1.demand({
    selectedSources:{1:'APU'},switches:{AVIONICS:true,CABIN_LIGHTS:true},bleedValveOpen:false});
   apu=window.B737ISNAPULoadDynamicsV1.step(apu,load,100);
   clocks.dynamicsSteps++;
  }
  if(activeMessaging&&ready){
   document.getElementById('abEchoFrame')?.contentWindow?.postMessage({kind:'perf8-ping',seq:++seq},location.origin);
   pings++;clocks.messagesSent++;
  }
 }
 setInterval(tick,100);
 if(activeMessaging){
  window.addEventListener('message',event=>{
   const frame=document.getElementById('abEchoFrame');
   if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
   if(event.data?.kind==='perf8-ready'){ready=true;return;}
   if(event.data?.kind==='perf8-pong'){pongs++;clocks.messagesReceived++;}
  });
 }
 async function measure(){
  if(flag)return;flag=true;btnTest.disabled=true;report.textContent='Measuring 6 seconds...';
  const entries=[],start=performance.now(),seen={...clocks};
  const observer=typeof PerformanceObserver==='function'?new PerformanceObserver(list=>{
   for(const e of list.getEntries())if(e.entryType==='longtask')entries.push(e.duration);
  }):null;
  try{observer?.observe({entryTypes:['longtask']});}catch{}
  const gap=[];
  let previous=0,run=true;
  function sampled(t){if(!run)return;if(previous){const d=t-previous;if(d>0&&d<2000)gap.push(d);}previous=t;requestAnimationFrame(sampled);}
  requestAnimationFrame(sampled);
  await new Promise(resolve=>setTimeout(resolve,6000));run=false;observer?.disconnect();
  const duration=performance.now()-start,total=gap.reduce((s,v)=>s+v,0),sorted=gap.slice().sort((a,b)=>a-b);
  activeMeasure={version:'PERF-0008',stage:activeMessaging?'E':activeEngine?'D':'C',
   durationMs:Math.round(duration),fps:total?Math.round(gap.length*10000/total)/10:null,
   p95FrameMs:sorted.length?Math.round(sorted[Math.floor(sorted.length*.95)]*10)/10:null,
   slowFrames:gap.filter(d=>d>34).length,longTasks:entries.length,
   longTaskMs:Math.round(entries.reduce((a,b)=>a+b,0)),
   workloads:Object.fromEntries(Object.keys(clocks).map(k=>[k,clocks[k]-seen[k]]))};
  report.textContent=JSON.stringify(activeMeasure,null,2);
  btnTest.disabled=false;flag=false;
 }
 btnTest.addEventListener('click',measure);
 window.B737Perf8=Object.freeze({get:()=>activeMeasure,snapshot:()=>({...clocks})});
 update();
})();
