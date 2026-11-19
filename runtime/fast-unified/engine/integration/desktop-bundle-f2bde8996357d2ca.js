(async()=>{
;
/* ../../engine/integration/asp-cb-trace-v3.js?v=ASP-TRAIN-0003 */
try{
/* ASP CB-EVIDENCE-0003
 * Dynamic photo-label discovery and safe isolation; NEVER overrides the current CB system.
 * No EP-FSI WDM available: actual ASP feed remains unverified and disconnected.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.B737ASPCBTraceV3=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const TARGETS=Object.freeze(['VHF-1','VHF-2','VHF-3','INTERPHONE BAT','INTERPHONE NO.2 BUS','INTERPHONE CAPT & OBS','INTERPHONE OBS AUDIO']);
function parse(catalog){
 const r=[];
 if(!Array.isArray(catalog?.panels))return r;
 for(const panel of catalog.panels){
  for(const entry of String(panel.breakers||'').split(';')){
   const m=entry.trim().match(/^([A-Z]+\d+):([\d.]+)\|(.+)$/);
   if(m)r.push({key:panel.id+'|ALL|'+m[1],panel:panel.id,position:m[1],amps:Number(m[2]),label:m[3].trim()});
  }
 }
 return r;
}
function inspect(catalog,network){
 const all=parse(catalog);
 const labels={};
 for(const label of TARGETS){
  const candidates=all.filter(e=>e.label===label);
  labels[label]={count:candidates.length,status:candidates.length===1?'PHOTO_LABEL_ONLY':candidates.length===0?'NOT_IN_CATALOG':'AMBIGUOUS',
   matches:candidates.map(c=>({...c,breaker:typeof network?.state==='function'?safeState(network,c.key):null}))};
 }
 const bySeat={CAPT:{audioCB:'P6-2|ALL|D23',photoLabel:'EXT BOTTLES RIGHT'},
 FO:{audioCB:'P6-2|ALL|D22',photoLabel:'AURAL WARN'},
 OBS:{audioCB:'P6-2|ALL|D24',photoLabel:'EXT BOTTLES LEFT'}};
 return {schema:'B737_ASP_CB_TRACE_V3',labels,bySeat,activeConnections:0,
  actualASPDevicePower:null,mayConnect:false,
  reason:'MRG P6-2 D22/D23/D24 conflicts with project photo catalogue; EP-FSI effectivity-specific WDM not supplied',
  electricalPolicy:'READ_ONLY_PHOTO_EVIDENCE'};
}
function safeState(n,key){try{const x=n.state(key);return x?{pulled:Boolean(x.pulled),tripped:Boolean(x.tripped)}:null;}catch(_){return null;}}
return Object.freeze({TARGETS,parse,inspect});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/asp-audio-mix-v3.js?v=ASP-TRAIN-0003 */
try{
/* ASP-AUDIO-MIX-0003 — deterministic procedure trainer mixing plan.
 * Does NOT decode cockpit radio media or assert aircraft audio power.
 * FCOM Vol2 5.10/5.20 and MRG communications; BENCH source generator only.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.B737ASPMixPlanV3=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const SEATS=Object.freeze(['CAPT','FO','OBS']);
const OUTPUTS=Object.freeze(['HEADSET','SPEAKER']);
function make(route,{seat='CAPT',output='HEADSET'}={}){
 if(!SEATS.includes(seat)||!OUTPUTS.includes(output))throw Error('Invalid ASP monitor seat/output');
 if(route?.schema!=='B737_ASP_AUDIO_ROUTING_V2')throw Error('ASP route V2 required');
 const s=route.stations[seat];
 const bench=route.powerMode==='BENCH';
 const allowed=bench&&(output==='HEADSET'?s.headset.enabled:s.speaker.enabled);
 const channels=s.headset.channels.filter(v=>v.rendered===true&&v.sourceStatus==='AVAILABLE');
 const audible=allowed?channels.map(ch=>({
  channel:ch.channel,
  volume:ch.volume==='PRESET'?65:Math.max(0,Math.min(100,Number(ch.volume)||0)),
  gain:(ch.volume==='PRESET'?.65:Math.max(0,Math.min(100,Number(ch.volume)||0))/100)**1.35*.28,
  toneType:/^VHF|^HF| INT|^PA/.test(ch.channel)?'RADIO_NOISE':/^MKR/.test(ch.channel)?'MARKER':/^NAV|^ADF/.test(ch.channel)?'NAV_ID':'RADIO_NOISE',
  destination:output
 })):[];
 return {schema:'B737_ASP_MIX_PLAN_V3',seat,output,bench,
  audible,muted:!bench||!allowed||audible.length===0,
  reason:!bench?'AIRCRAFT_POWER_UNVERIFIED':!allowed?'OUTPUT_NOT_AVAILABLE':audible.length===0?'NO_ACTIVE_SELECTED_SOURCE':'TRAINER_AUDIO_ONLY'};
}
function sharedTx(route){
 if(route?.schema!=='B737_ASP_AUDIO_ROUTING_V2')throw Error('ASP route V2 required');
 const groups=new Map();
 for(const seat of SEATS){const t=route.stations[seat].transmitter;if(t.enabled!==true||!t.channel)continue;
  if(!groups.has(t.channel))groups.set(t.channel,[]);groups.get(t.channel).push(seat);}
 const channels={};for(const [channel,users] of groups){
  channels[channel]={transmitters:[...users],collision:users.length>1,onAir:users.length===1?users[0]:null,
   diagnostic:users.length>1?'SIMULATED_SHARED_RADIO_CONTENTION':'BENCH_PTT_KEYED'};
 }
 return {schema:'B737_ASP_SHARED_TX_V3',channels,canTransmitActualRadio:false};
}
return Object.freeze({SEATS,OUTPUTS,make,sharedTx});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./asp-pixel-audit-v3.js?v=ASP-TRAIN-0003 */
try{
/* ASP-AUDIT-0003 — non-invasive live 72-socket center audit.
 * 20 photo controls + 3 physical + VBR on each of CPT FO OBS.
 * The owner must still approve the actual pixels before freezing artwork.
 */
(function(root){'use strict';
 const G=root.B737ASPSocketRegistrationV2,Photo=root.B737ASPControlsModel,
  Physical=root.B737ASPPhysicalCommandsV1,VBR=root.B737ASPVBRModel;
 if(!G||!Photo||!Physical||!VBR)return;
 const expected=[...Photo.sockets.map(s=>({kind:s.kind,channel:s.channel,x:s.x,y:s.y})),
  ...Object.entries(Physical.CONTROLS).map(([kind,v])=>({kind:'physical',channel:kind,x:v.x,y:v.y})),
  {kind:'vbr',channel:'VBR',x:VBR.socket.x,y:VBR.socket.y}];
 function faceIn(d,seat){
  const f=seat==='OBS'?d.querySelector('#atlasAbsolute > .asp-bare-mounted[data-seat="OBS"]'):
   d.querySelector('.asp-bare-mounted[data-seat="'+seat+'"]');
  return f&&f.isConnected?f:null;
 }
 function inspectSeat(host,seat){
  const face=host.querySelector(':scope > img')||host;
  const r=face.getBoundingClientRect(),frame=G.viewport(r.width,r.height);
  const controls=expected.map(s=>{
   const selector=s.kind==='physical'?'[data-asp-physical-kind="'+s.channel+'"]':
    s.kind==='vbr'?'.asp-vbr-selector':
    '.asp-photo-control[data-kind="'+s.kind+'"][data-channel="'+s.channel+'"]';
   const el=host.querySelector(selector);
   const point=frame.point(s.x,s.y),target=[r.left+point.x,r.top+point.y];
   if(!el)return {kind:s.kind,channel:s.channel,found:false,errorCssPx:null};
   const b=el.getBoundingClientRect();
   const actual=[b.left+b.width/2,b.top+b.height/2];
   return {kind:s.kind,channel:s.channel,found:true,target,actual,
    errorCssPx:Math.hypot(target[0]-actual[0],target[1]-actual[1])};
  });
  const missing=controls.filter(c=>!c.found).map(c=>c.channel);
  const error=Math.max(0,...controls.map(c=>c.errorCssPx||0));
  return {seat,mounted:true,controls:controls.length,found:controls.length-missing.length,
   maxCenterErrorCssPx:error,missing,pass:missing.length===0&&error<=.5,details:controls};
 }
 function inspect(){
  const local=['CAPT','FO'].map(s=>{const host=faceIn(document,s);return host?inspectSeat(host,s):{seat:s,mounted:false,pass:false};});
  const ifr=document.getElementById('overheadFrame'),frame=ifr?.contentDocument;
  const obs=frame&&faceIn(frame,'OBS')?inspectSeat(faceIn(frame,'OBS'),'OBS'):{seat:'OBS',mounted:false,pass:false,reason:'AFT OH-04 iframe unavailable'};
  const stations=[...local,obs];
  return {schema:'B737_ASP_PIXEL_AUDIT_V3',expectedCount:72,foundCount:stations.reduce((n,s)=>n+(s.found||0),0),
   stations,pass:stations.every(s=>s.pass),thresholdCssPx:0.5,
   limitations:'Registration is geometric; visible sprite silhouettes and human photo QA required before final lock'};
 }
 function boot(){
  const host=document.getElementById('inspector');if(!host)return;
  const section=document.createElement('section');section.id='aspPixelAuditV3';
  section.style.cssText='border:1px solid #688190;border-radius:8px;padding:9px;background:#142834;color:#dfecf2;font:11px/1.5 system-ui;margin:8px 0';
  const btn=document.createElement('button');btn.textContent='RUN ASP 72-CENTER PIXEL AUDIT';
  btn.style.cssText='width:100%;padding:6px;background:#26506a;color:white;border:1px solid #718aa1;border-radius:5px';
  const result=document.createElement('pre');result.style.cssText='white-space:pre-wrap;max-height:160px;overflow:auto;margin:6px 0';
  result.textContent='Checks 20 photo + 3 toggle + 1 VBR per station. No auto freeze.';
  btn.onclick=()=>{const v=inspect();result.textContent=v.stations.map(s=>s.seat+': '+(s.found||0)+'/24, max '+(s.maxCenterErrorCssPx??'n/a')+' CSS px, '+(s.pass?'PASS':'REVIEW')+'\n'+(s.missing?.join(', ')||'')).join('\n')+'\n'+(v.pass?'GEOMETRIC PASS — photo approval still required':'DO NOT LOCK OR ACCEPT');};
  section.append(btn,result);host.prepend(section);
 }
 root.B737ASPPixelAuditV3=Object.freeze({inspect});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./asp-audible-bench-v3.js?v=ASP-TRAIN-0003 */
try{
/* ASP-WEBAUDIO-0003 — user-activated original synthetic radio test sources.
 * Physical routing and selection are taken from the existing unified ASP backend.
 * No real ATC transmissions, microphone capture, stored recordings or asserted aircraft power.
 */
(function(root){'use strict';
 const Mix=root.B737ASPMixPlanV3,Live=root.B737ASPAudioRoutingLiveV2,Runtime=root.B737ASPAudioRuntimeV1;
 const Trace=root.B737ASPCBTraceV3;
 if(!Mix||!Live||!Runtime||!Trace){root.console?.warn?.('ASP audio bench dependencies not ready');return;}
 const SOURCES=['VHF-1','VHF-2','VHF-3','HF-1','NAV-1','NAV-2','ADF-1','ADF-2','MKR','SERV INT','FLT INT','PA'];
 let ctx=null,master=null,nodes=new Map(),enabled=false,seat='CAPT',output='HEADSET',status=null,inspector=null;
 const AudioContextClass=root.AudioContext||root.webkitAudioContext;
 const sourceMap=new Map(SOURCES.map((name,i)=>[name,i]));
 function testBuffer(context){
  const length=Math.round(context.sampleRate*1.3),buf=context.createBuffer(1,length,context.sampleRate);
  const data=buf.getChannelData(0);let seed=1751;
  for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=((seed/4294967296)*2-1)*.62;}
  return buf;
 }
 function makeNode(channel){
  const idx=sourceMap.get(channel)??11;
  const g=ctx.createGain();g.gain.value=0;g.connect(master);
  let voice;
  if(/^(VHF|HF)| INT$|^PA$/.test(channel)){
   const noise=ctx.createBufferSource();noise.buffer=testBuffer(ctx);noise.loop=true;
   const filt=ctx.createBiquadFilter();filt.type='bandpass';filt.frequency.value=900+idx*68;filt.Q.value=.85;
   noise.connect(filt);filt.connect(g);noise.start();voice=noise;
  }else{
   const osc=ctx.createOscillator();osc.type=channel==='MKR'?'sine':'triangle';
   osc.frequency.value=channel==='MKR'?1300:420+idx*59;
   osc.connect(g);osc.start();voice=osc;
  }
  const row={gain:g,source:voice};nodes.set(channel,row);return row;
 }
 function routing(){return Live.getRouting();}
 function plan(){return Mix.make(routing(),{seat,output});}
 function updateSound(){
  if(!enabled||!ctx)return;
  const next=plan(),wanted=new Map(next.audible.map(x=>[x.channel,x.gain]));
  for(const [channel,gain] of wanted){const n=nodes.get(channel)||makeNode(channel);
   n.gain.gain.setTargetAtTime(gain,ctx.currentTime,.035);}
  for(const [channel,n] of nodes)if(!wanted.has(channel))n.gain.gain.setTargetAtTime(0,ctx.currentTime,.035);
  if(status){
   const tx=Mix.sharedTx(routing());
   const coll=Object.entries(tx.channels).filter(([,x])=>x.collision).map(([name,x])=>name+': '+x.transmitters.join('+'));
   status.textContent=(next.audible.length?'HEARD '+next.audible.map(x=>x.channel+' '+x.volume+'%').join(', '):'SILENT '+next.reason)
    +(coll.length?' | SIMULATED TX CONTENTION '+coll.join(', '):'')
    +' | '+(ctx.state==='running'?'AUDIO ON':'AUDIO SUSPENDED');
  }
 }
 async function start(){
  if(!AudioContextClass){if(status)status.textContent='Web Audio unavailable in this browser';return false;}
  if(!ctx){ctx=new AudioContextClass();master=ctx.createGain();master.gain.value=.38;master.connect(ctx.destination);}
  await ctx.resume();enabled=true;updateSound();return true;
 }
 async function stop(){
  enabled=false;
  if(ctx){for(const n of nodes.values()){try{n.source.stop();}catch(_){ }try{n.source.disconnect();n.gain.disconnect();}catch(_){ }}
   nodes.clear();await ctx.close();ctx=null;master=null;}
  if(status)status.textContent='AUDIO OFF (BENCH)';
 }
 function labeled(text,value){const label=document.createElement('label');label.textContent=text+' ';
  const select=document.createElement('select');select.setAttribute('aria-label',text);
  for(const name of value){const op=document.createElement('option');op.value=name;op.textContent=name;select.append(op);}
  label.append(select);return {label,select};}
 function boot(){
  const host=document.getElementById('inspector');if(!host)return;
  inspector=document.createElement('section');inspector.id='aspAudioBenchV3';inspector.dir='ltr';
  inspector.style.cssText='border:1px solid #70818b;border-radius:8px;padding:9px;margin:8px 0;display:grid;gap:7px;background:#172833;color:#e1eef5;font:11px/1.5 system-ui';
  const h=document.createElement('b');h.textContent='ASP V3 · AUDIBLE AUDIO TEST + CB SOURCE AUDIT';inspector.append(h);
  const disclaimer=document.createElement('small');disclaimer.textContent='Original synthetic radio identification tones only. BENCH power; not ATC audio or live cockpit RF. Click to enable speaker.';inspector.append(disclaimer);
  const controls=document.createElement('div');
  const monitor=labeled('Station',Mix.SEATS),dest=labeled('Output',Mix.OUTPUTS);
  monitor.select.value=seat;dest.select.value=output;
  monitor.select.onchange=()=>{seat=monitor.select.value;updateSound();};
  dest.select.onchange=()=>{output=dest.select.value;updateSound();};
  controls.append(monitor.label,dest.label);inspector.append(controls);
  const sources=labeled('Test signal',SOURCES);inspector.append(sources.label);
  const actions=document.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:5px';
  function btn(label,func){const button=document.createElement('button');button.type='button';button.textContent=label;
   button.style.cssText='padding:5px 7px;min-height:25px;background:#234758;color:#fff;border:1px solid #688398;border-radius:4px;cursor:pointer';
   button.onclick=func;actions.append(button);return button;}
  btn('ENABLE BENCH AUDIO',async()=>{
    // Intentional explicit training mode only; no aircraft feed guessed.
    Runtime.setPowerMode('BENCH');
    const ch=sources.select.value;
    Live.setInputSignal(ch,true);
    const st=Runtime.getState().stations[seat];
    if(!st.mic&&['VHF-1','VHF-2','VHF-3','HF-1','SERV INT','FLT INT','PA'].includes(ch))
      Runtime.dispatch(seat,'SELECT_MIC',{channel:ch});
    else if(!st.receivers[ch]&&ch!=='SPKR')Runtime.dispatch(seat,'RECEIVER',{channel:ch,selected:true});
    await start();updateSound();
  });
  btn('SOURCE ON',()=>{Live.setInputSignal(sources.select.value,true);updateSound();});
  btn('SOURCE OFF',()=>{Live.setInputSignal(sources.select.value,false);updateSound();});
  btn('SILENCE / STOP',()=>{void stop();});
  inspector.append(actions);
  status=document.createElement('div');status.setAttribute('role','status');status.textContent='AUDIO OFF (BENCH)';inspector.append(status);
  const cbTitle=document.createElement('small');cbTitle.textContent='CB source verification (read-only): ';inspector.append(cbTitle);
  const cbStatus=document.createElement('div');cbStatus.style.cssText='font:10px/1.5 monospace;white-space:pre-wrap';inspector.append(cbStatus);
  function refreshCB(){
   const evidence=Trace.inspect(root.CB_CATALOG||null,root.B737_CB_Electrical?.network||null);
   cbStatus.textContent=['P6-2 D22/D23/D24 AUDIO = QUARANTINED — PHOTO LABEL CONFLICT',
    ...Object.entries(evidence.labels).filter(([,v])=>v.matches.length).map(([n,v])=>n+': '+v.matches.map(x=>x.panel+' '+x.position).join(', ')+' [PHOTO LABEL ONLY]'),
    'ASP circuit feed: UNVERIFIED · LIVE CB connections: 0'].join('\n');
  }
  btn('REFRESH CB AUDIT',refreshCB);refreshCB();
  host.prepend(inspector);
  root.addEventListener('b737:asp-audio-state',updateSound);
  const interval=root.setInterval(()=>{if(enabled)updateSound();},280);
  root.addEventListener('pagehide',()=>{root.clearInterval(interval);void stop();});
 }
 root.B737ASPAudioBenchV3=Object.freeze({
  getPlan:plan,getSharedTransmitters:()=>Mix.sharedTx(routing()),
  getCBTrace:()=>Trace.inspect(root.CB_CATALOG||null,root.B737_CB_Electrical?.network||null),
  getStatus:()=>({enabled,seat,output,audioContext:ctx?.state||'closed'}),
  setMonitor(station,out){if(!Mix.SEATS.includes(station)||!Mix.OUTPUTS.includes(out))throw Error('Invalid ASP monitor');seat=station;output=out;updateSound();},
  stop
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
