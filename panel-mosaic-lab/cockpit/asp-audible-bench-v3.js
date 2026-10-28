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
