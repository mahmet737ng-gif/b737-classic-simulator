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