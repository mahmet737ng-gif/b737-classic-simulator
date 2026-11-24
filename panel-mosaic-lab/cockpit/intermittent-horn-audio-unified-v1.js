/* OWNER HORN 0001 — One physical intermittent horn for two independent cockpit alerts.
 * No generated audio. The approved owner MP3 is packed in the companion asset module.
 * ISN WarningEngine alone decides demand; cabin ALT HORN CUTOUT does not silence T/O.
 * Hardware inputs are sourced from installed cockpit owners, not shadow switches.
 */
(function(root){'use strict';
 if(!root?.document)return;
 const clip=root.B737OwnerIntermittentHornClipV1;
 const $=id=>root.document.getElementById(id);
 const minAudioGain=.76, THRUST_TAKEOFF_PROXY_PERCENT=55;
 // Approximate green-band trim limits: training model, not AFM dispatch data.
 const TRIM_GREEN_MIN=4.5,TRIM_GREEN_MAX=7.5;
 let ctx=null,buffer=null,source=null,gain=null,ready=false,armed=false,loading=false;
 let lastError=null,lastDemand=false,lastSensorFingerprint='',panel=null,lastStatus='';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const owner=()=>root.B737ISNCockpitV1;
 function publishedState(){return owner()?.getWarningSnapshot?.()||owner()?.getState?.()?.state||null;}
 function playerStop(){
   if(!source)return;
   const old=source,g=gain;source=null;gain=null;
   const now=ctx?.currentTime||0;
   try{g.gain.cancelScheduledValues(now);g.gain.setValueAtTime(g.gain.value,now);
       g.gain.linearRampToValueAtTime(0,now+.008);old.stop(now+.010);}catch(_){
     try{old.stop(0);}catch(__){}
   }
   old.onended=()=>{try{old.disconnect();g.disconnect();}catch(_){}};
 }
 function playerStart(){
   if(source||!ready||!armed||ctx?.state!=='running')return;
   const node=ctx.createBufferSource(),amp=ctx.createGain(),now=ctx.currentTime;
   node.buffer=buffer;node.loop=true;node.loopStart=0;node.loopEnd=buffer.duration;
   amp.gain.setValueAtTime(0,now);amp.gain.linearRampToValueAtTime(minAudioGain,now+.006);
   node.connect(amp);amp.connect(ctx.destination);
   source=node;gain=amp;node.start(now+.004);
 }
 function status(){
   if(!panel)return;
   const s=(ready?'OWNER HORN LOADED':'OWNER HORN LOADING')+' | '+
      (armed?'AUDIO ARMED':'TAP COCKPIT TO ENABLE AUDIO')+' | '+
      (lastDemand?'WARNING REQUESTED':'OFF')+' | '+
      (source?'PLAYING':'SILENT')+(lastError?' | '+lastError:'');
   if(s!==lastStatus){lastStatus=s;$('intermittentHornStatus').textContent=s;}
 }
 function sampleDemands(){
   const s=publishedState(),active=s?.warnings?.audio?.active;
   return Array.isArray(active)&&active.some(a=>a.id==='intermittentHorn');
 }
 function syncPlayer(){
   const demand=sampleDemands();
   if(demand!==lastDemand){
     lastDemand=demand;
     root.dispatchEvent(new CustomEvent('b737:intermittent-horn-audio-state',{detail:{
       active:demand,cabin:publishedState()?.warnings?.audio?.lamps?.cabinAltitude===true,
       takeoff:publishedState()?.warnings?.audio?.lamps?.takeoffConfig===true
     }}));
   }
   if(demand)playerStart();else playerStop();
   status();return demand;
 }
 function collectSensors(){
   const readings={};
   const scenario=root.B737UnifiedFlightScenarioV1?.getState?.();
   if(typeof scenario?.airborne==='boolean')readings.onGround=!scenario.airborne;
   else{
     const electrical=root.B737UnifiedElectricalLive?.snapshot?.();
     if(typeof electrical?.controls?.onGround==='boolean')readings.onGround=electrical.controls.onGround;
   }
   const pct1=root.B737ThrottlePositions?.get?.(1),pct2=root.B737ThrottlePositions?.get?.(2);
   if(finite(pct1)&&finite(pct2)){
     readings.takeoffThrust=Math.max(pct1,pct2)>=THRUST_TAKEOFF_PROXY_PERCENT;
   }
   const le=root.B737LEDevicesUnifiedLink?.getState?.();
   if(le&&finite(le.actualTe)){
     readings.flaps=le.actualTe;
     const p=le.projection;
     if(p){
       readings.leadingEdgeTakeoff=Boolean(['EXT','FULL'].includes(p.leStage)&&
         p.center?.extended===true&&p.center?.transit!==true&&!p.mismatch?.length);
     }else readings.leadingEdgeTakeoff=false;
   }
   const brake=root.B737SpeedbrakeLever;
   if(brake?.mounted?.()){
     const down=brake.stops?.find(s=>s.key==='DOWN')?.t;
     const current=brake.get?.();
     if(finite(down)&&finite(current))readings.speedbrakeDown=Math.abs(down-current)<.014;
   }
   const park=root.B737UnifiedParkingBrakeV1?.getState?.();
   if(typeof park?.engaged==='boolean')readings.parkingBrakeSet=park.engaged;
   const trim=root.B737StabilizerTrim?.get?.();
   if(finite(trim))readings.stabilizerTrimTakeoff=trim>=TRIM_GREEN_MIN&&trim<=TRIM_GREEN_MAX;
   return readings;
 }
 function syncHardware(){
   const bridge=owner();
   const current=publishedState()?.sensors;
   if(!current||typeof bridge.instructor!=='function')return;
   const readings=collectSensors();
   const changes=Object.fromEntries(Object.entries(readings).filter(([k,v])=>current[k]!==v));
   if(Object.keys(changes).length){
     try{bridge.instructor({type:'WARNING_SENSORS',values:changes});lastSensorFingerprint=JSON.stringify(changes);}
     catch(e){lastError='WARNING_SENSOR_BRIDGE: '+e.message;}
   }
 }
 function refresh(){syncHardware();syncPlayer();}
 function decodeBase64(encoded){
   const raw=atob(encoded),bytes=new Uint8Array(raw.length);
   for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
   return bytes.buffer;
 }
 async function loadClip(){
   if(loading||ready)return;loading=true;
   try{
     if(!clip?.base64)throw Error('OWNER_AUDIO_ASSET_MISSING');
     const AC=root.AudioContext||root.webkitAudioContext;
     if(!AC)throw Error('WEB_AUDIO_UNAVAILABLE');
     if(!ctx)ctx=new AC();
     buffer=await ctx.decodeAudioData(decodeBase64(clip.base64));
     if(!buffer||buffer.duration<.35||buffer.duration>.9)throw Error('INVALID_OWNER_HORN_CLIP');
     ready=true;lastError=null;
     syncPlayer();
   }catch(e){lastError='HORN_DECODE: '+e.message;root.console?.error?.(lastError);}
   finally{loading=false;status();}
 }
 async function enable(){
   await loadClip();
   if(!ctx)throw Error(lastError||'OWNER_AUDIO_UNAVAILABLE');
   if(ctx.state==='suspended')await ctx.resume();
   armed=ctx.state==='running';
   syncPlayer();return armed;
 }
 function mount(){
   if(panel||!$('inspector'))return;
   panel=root.document.createElement('section');
   panel.id='ownerIntermittentHornAudioV1';
   panel.style.cssText='font:11px/1.45 system-ui;background:#14242b;color:#e4eefa;border:1px solid #47687b;border-radius:8px;padding:9px;margin:8px 0;direction:ltr';
   panel.innerHTML='<b>TAKEOFF CONFIG / CABIN ALTITUDE · OWNER AUDIO</b>'+
    '<p id="intermittentHornStatus" role="status">INITIALIZING AUDIO</p>'+
    '<button type="button" id="intermittentHornEnable">ENABLE HORN AUDIO</button>'+
    '<small style="display:block;margin-top:5px">One shared intermittent horn. Repeats while either ISN warning is active; stops immediately on clear. Aircraft cutout applies only to Cabin Altitude.</small>';
   $('inspector').prepend(panel);
   $('intermittentHornEnable').addEventListener('click',()=>enable().catch(e=>{lastError=e.message;status();}));
   status();
 }
 const promptUnlock=()=>{if(ready&&!armed)enable().catch(e=>{lastError=e.message;status();});};
 root.document.addEventListener('pointerdown',promptUnlock,true);
 root.document.addEventListener('keydown',promptUnlock,true);
 // Overhead controls live inside same-origin iframe, not the parent event tree.
 let boundOverhead=null;
 function bindOverhead(){
   try{
     const doc=$('overheadFrame')?.contentDocument;
     if(!doc||doc===boundOverhead)return;
     boundOverhead=doc;doc.addEventListener('pointerdown',promptUnlock,true);
     doc.addEventListener('keydown',promptUnlock,true);
   }catch(_){}
 }
 const trigger=()=>queueMicrotask(refresh);
 for(const name of ['b737:parking-brake-state','b737:stabilizer-trim-position',
    'b737:flight-scenario-state','b737:pressurization-state',
    'b737:flight-scenario-stopped','b737:cockpit-mounted'])
   root.addEventListener(name,trigger);
 for(const name of ['b737:throttle-position','b737:speedbrake-position',
    'b737:flap-detent-visual-test','b737:flap-ready'])
   root.document.addEventListener(name,trigger);
 // Also observe the existing ALT HORN CUTOUT message after aircraft-settings handles it.
 root.addEventListener('message',trigger);
 root.addEventListener('pagehide',()=>{playerStop();if(ctx)ctx.close().catch(()=>{});});
 function init(){mount();loadClip();bindOverhead();refresh();
   setInterval(()=>{bindOverhead();refresh();},65);
 }
 root.B737UnifiedIntermittentHornAudioV1=Object.freeze({
   enable,refresh,getState:()=>({ready,armed,active:lastDemand,playing:Boolean(source),
     lastError,lastSensorFingerprint,sharedOwner:'B737ISNCockpitV1'})
 });
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window==='object'?window:null);
