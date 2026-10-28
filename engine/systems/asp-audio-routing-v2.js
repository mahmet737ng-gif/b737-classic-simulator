/* ASP Audio Routing V2 — FCOM 5.10.5-6 / 5.20.1-3, MRG IV.5 p123.
 * Computes transmission, monitor, speaker/handset paths and failure effects.
 * No actual radio broadcast, sound playback, aircraft-bus inference, or guarded assets.
 */
(function(root,factory){'use strict';const api=factory(typeof module==='object'&&module.exports?require('./asp-audio-v1.js'):root.B737ASPAudioLogicV1);
if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ASPAudioRoutingV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A){'use strict';
if(!A?.project||!A?.SEATS)throw Error('ASP Audio V1 required');
const ALLOWED=new Set([...A.TRANSMITTERS,...A.RECEIVERS]);
const RADIO_STATUSES=Object.freeze(['AVAILABLE','FAILED','UNKNOWN']);
const WARNINGS=Object.freeze(['GPWS','WINDSHEAR','ALTITUDE_ALERT']);
function validStatus(s){if(!RADIO_STATUSES.includes(s))throw Error('Invalid radio status');return s;}
function validateSignals(signal){if(!signal||typeof signal!=='object'||Array.isArray(signal))throw Error('Signals map required');
for(const [name,value] of Object.entries(signal)){if(!ALLOWED.has(name))throw Error('Unknown signal '+name);
 if(value!==true&&value!==false&&value!==null)throw Error('Signal must be boolean or null');}}
function compute(state,{powerMode='AIRCRAFT',electrical=null,radioStatus={},signals={},speakerInhibitOnTransmit=false,cbEvidence=null}={}){
 if(!['AIRCRAFT','BENCH'].includes(powerMode))throw Error('Invalid power mode');
 if(!radioStatus||typeof radioStatus!=='object'||Array.isArray(radioStatus))throw Error('Invalid radio status map');
 for(const [name,value] of Object.entries(radioStatus)){if(!ALLOWED.has(name))throw Error('Unknown radio '+name);validStatus(value);}
 validateSignals(signals);
 if(typeof speakerInhibitOnTransmit!=='boolean')throw Error('Invalid speaker-inhibit policy');
 const base=A.project(state,{powerMode,electrical});
 const txRequests=A.SEATS.map(seat=>{
  const p=base.stations[seat],t=state.stations[seat],channel=p.transmitRadio;
  let microphone=t.ptt==='HAND'?'HAND':t.microphone;
  const status=channel?(radioStatus[channel]|| (powerMode==='BENCH'?'AVAILABLE':'UNKNOWN')):null;
  const protectedFailure=channel&&status==='FAILED';
  const route=channel&&!protectedFailure?(powerMode==='BENCH'&&status==='AVAILABLE'?'TRAINER_ACTIVE':'UNVERIFIED_REAL_TX'):
              (protectedFailure?'RADIO_FAILED':'NO_TX_REQUEST');
  return {seat,mode:p.mode,channel,ptt:t.ptt,microphone,radioStatus:status,
   enabled:route==='TRAINER_ACTIVE'?true:route==='UNVERIFIED_REAL_TX'?null:false,
   routeStatus:route};
 });
 const transmittingBench=txRequests.some(t=>t.enabled===true);
 const stations={};
 for(const seat of A.SEATS){
  const p=base.stations[seat],tx=txRequests.find(t=>t.seat===seat),s=state.stations[seat];
  const audio=p.receiverMonitor.filter(ch=>ch!=='SPKR').map(ch=>{
   const sourceStatus=radioStatus[ch]||(powerMode==='BENCH'?'AVAILABLE':'UNKNOWN');
   const signal=Object.hasOwn(signals,ch)?signals[ch]:null;
   const volume=p.mode==='ALT'?'PRESET':s.volumes[ch]??null;
   const active=p.functional&&sourceStatus!=='FAILED'&&(powerMode==='BENCH'&&sourceStatus==='AVAILABLE'&&signal===true);
   return {channel:ch,sourceStatus,signal,volume,headset:p.functional&&sourceStatus!=='FAILED',
    rendered:active?true:!p.functional||sourceStatus==='FAILED'||signal===false?false:null,
    qualification:powerMode==='BENCH'?'TRAINER_ONLY':'ACTUAL_RADIO_FEED_UNVERIFIED'};
  });
  const speakerConfigured=p.overheadSpeakerAvailable;
  const inhibit=speakerInhibitOnTransmit&&transmittingBench;
  const speakerActive=speakerConfigured&&!inhibit;
  const received=audio.filter(a=>a.rendered===true).map(a=>a.channel);
  stations[seat]={seat,mode:p.mode,transmitter:tx,headset:{
    enabled:p.headsetAvailable,channels:audio,heardBench:received,
    volumePolicy:p.mode==='ALT'?'PRESET':'RECEIVER_SELECTORS'},
   speaker:{installed:seat!=='OBS',configured:speakerConfigured,enabled:speakerActive,
    channels:speakerActive?received:[],inhibitedByOtherTransmit:inhibit&&speakerConfigured,
    installationCaveat:'MRG optional speaker mute during any transmit (as installed)'},
   warnings:Object.fromEntries(WARNINGS.map(x=>[x,{viaThisAudioStation:p.warningsViaStation,
     independentlyOperative:null,claim:'GPWS/windshear/altitude alert system not globally disabled by ASP ALT'}])),
   interphone:{flight:p.flightInterphone,service:p.serviceInterphone},
   passengerAddress:{viaAsp:p.paViaAsp,controlStandHandsetSeparate:true},
   electrical:{...p.power,cb:cbEvidence?.stations?.[seat]||null},
   cbEffectApplied:false,radioPreset:p.radioPreset};
 }
 return {schema:'B737_ASP_AUDIO_ROUTING_V2',model:'PROCEDURE_QRH_TRAINER',electricalRouting:'EVIDENCE_ONLY',
  powerMode,stations,sharedRf:{radioStatus:{...radioStatus}},speakerInhibitAsInstalled:speakerInhibitOnTransmit,
  caveats:['NO_REAL_TRANSMISSION_OR_SPEAKER_PLAYBACK','CB_MAP_QUARANTINED',
           'AIRCRAFT_SOURCE_WIRING_UNVERIFIED','AURAL_WARNINGS_NOT_GLOBALLY_SUPPRESSED']};
}
return Object.freeze({compute,WARNINGS,RADIO_STATUSES});
});