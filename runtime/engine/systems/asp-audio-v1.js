/* ASP AUDIO-LOGIC-0001 — Boeing 737 Classic FCOM 5.10.5-6, 5.20.1-3.
 * MRG IV.5 printed p123: alternate audio and candidate audio CBs.
 * Pure logic, classroom trainer; NOT certified aircraft wiring.
 */
(function(host,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(host)host.B737ASPAudioLogicV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const SEATS=Object.freeze(['CAPT','FO','OBS']);
const TRANSMITTERS=Object.freeze(['VHF-1','VHF-2','VHF-3','HF-1','SERV INT','FLT INT','PA']);
const RECEIVERS=Object.freeze([...TRANSMITTERS,'NAV-1','NAV-2','ADF-1','ADF-2','MKR','SPKR']);
const FIXED=Object.freeze({CAPT:'VHF-1',FO:'VHF-2',OBS:'VHF-1'});
// The MRG printed IV.6 p139 candidates clash with the actual CB photo catalogue
// at P6-2 D22/D23/D24. DO NOT auto-connect these candidates or overwrite the catalogue.
const CB_CANDIDATES=Object.freeze({CAPT:'P6-2|ALL|D23',FO:'P6-2|ALL|D22',OBS:'P6-2|ALL|D24'});
const copy=x=>JSON.parse(JSON.stringify(x));
const checkSeat=s=>{if(!SEATS.includes(s))throw Error('Invalid ASP crew seat');};
const check=(v,list,label)=>{if(!list.includes(v))throw Error('Invalid '+label);};
function initialState(){
 return {schema:'b737-asp-audio-v1',revision:0,stations:Object.fromEntries(SEATS.map(seat=>[seat,{
 mode:'NORM',mic:null,receivers:Object.fromEntries(RECEIVERS.map(ch=>[ch,false])),
 volumes:Object.fromEntries(RECEIVERS.map(ch=>[ch,50])),microphone:'BOOM',ptt:null,normalControlFault:false,alternateFault:false
 }]))};
}
function apply(src,cmd){
 if(src?.schema!=='b737-asp-audio-v1')throw Error('Invalid ASP state');
 if(!cmd||typeof cmd.type!=='string')throw Error('Invalid ASP command');
 checkSeat(cmd.seat);
 const out=copy(src),s=out.stations[cmd.seat];
 switch(cmd.type){
 case 'MODE':check(cmd.value,['NORM','ALT'],'mode');s.mode=cmd.value;break;
 case 'SELECT_MIC':
  check(cmd.channel,TRANSMITTERS,'MIC channel');
  if(s.mode==='NORM'&&!s.normalControlFault)s.mic=cmd.channel;
  break;
 case 'RECEIVER':
  check(cmd.channel,RECEIVERS,'receiver channel');
  if(typeof cmd.selected!=='boolean')throw Error('receiver selected must be boolean');
  if(s.mode==='NORM'&&!s.normalControlFault)s.receivers[cmd.channel]=cmd.selected;
  break;
 case 'VOLUME':
  check(cmd.channel,RECEIVERS,'volume channel');
  if(!Number.isFinite(cmd.value)||cmd.value<0||cmd.value>100)throw Error('Invalid receiver volume');
  if(s.mode==='NORM'&&!s.normalControlFault)s.volumes[cmd.channel]=cmd.value;
  break;
 case 'MIC_SOURCE':check(cmd.value,['BOOM','MASK'],'microphone source');s.microphone=cmd.value;break;
 case 'PTT':check(cmd.value,[null,'ASP_RT','ASP_IC','WHEEL_MIC','WHEEL_INT','HAND'],'PTT');s.ptt=cmd.value;break;
 case 'FAULT':
  check(cmd.fault,['normalControlFault','alternateFault'],'fault');
  if(cmd.instructor!==true||typeof cmd.active!=='boolean')throw Error('Instructor-only fault');
  s[cmd.fault]=cmd.active;break;
 default:throw Error('Unknown ASP command');
 }
 out.revision++;return out;
}
function powerEvidence(electrical){
 const bus=electrical?.bus;
 if(!bus)return {state:'UNKNOWN',source:'NO_ELECTRICAL_V7_READ',cb:'UNVERIFIED_CONFLICT'};
 const dc2=bus.dc2,battery=bus.battery;
 // MRG bus summary is multi-configuration. No EP-FSI WDM for exact terminal feed.
 return {state:'UNKNOWN',source:'ELECTRICAL_V7_BUS_EVIDENCE_ONLY',bus:{dc2:dc2??null,battery:battery??null},cb:'UNVERIFIED_CONFLICT',
  reason:'MRG multi-model Electronic Bus 2 / Battery Bus cannot establish exact ASP downstream supply'};
}
function stationProjection(src,seat,{powerMode='AIRCRAFT',electrical=null}={}){
 checkSeat(seat);check(powerMode,['AIRCRAFT','BENCH'],'powerMode');
 const s=src.stations[seat],alt=s.mode==='ALT',radio=alt?FIXED[seat]:s.mic;
 const available=!s[alt?'alternateFault':'normalControlFault'];
 const receivers=alt?[FIXED[seat]]:RECEIVERS.filter(ch=>s.receivers[ch]||ch===s.mic);
 const transmitting=alt?['ASP_RT','WHEEL_MIC'].includes(s.ptt):['ASP_RT','WHEEL_MIC','HAND','ASP_IC','WHEEL_INT'].includes(s.ptt);
 const isInterphone=['ASP_IC','WHEEL_INT'].includes(s.ptt);
 const tx=transmitting&&available&&(alt?['ASP_RT','WHEEL_MIC'].includes(s.ptt):true)?
  (alt?FIXED[seat]:isInterphone?'FLT INT':s.mic):null;
 const evidence=powerEvidence(electrical),isBench=powerMode==='BENCH';
 return {seat,mode:s.mode,powerMode,power:{...evidence,logicalBenchPower:isBench},
  functional:available,micSelection:radio,
  whiteMicLamp:available?radio:null,receiverSelectorsFunctional:!alt&&available,
  receiverVolumeFunctional:!alt&&available,receiverMonitor:available?receivers:[],
  receiverVolume:alt?'PRESET':copy(s.volumes),
  headsetAvailable:available,
  overheadSpeakerAvailable:!alt&&seat!=='OBS'&&available&&s.receivers.SPKR,
  warningsViaStation:!alt&&available,flightInterphone:!alt&&available,
  serviceInterphone:!alt&&available,paViaAsp:!alt&&available,
  handMicAvailable:!alt&&available,maskBoomSelectorFunctional:available,
  microphone:s.microphone,ptt:s.ptt,transmitRadio:tx,
  transmitPermission:tx===null?false:isBench?true:null,
  receiverPermission:!available?false:isBench?true:null,
  radioPreset:FIXED[seat],cbCandidate:CB_CANDIDATES[seat],
  cbStatus:'QUARANTINED_CATALOG_MISMATCH',
  limitation:isBench?'EXPLICIT_BENCH_POWER_NOT_AIRCRAFT':'UNKNOWN_REAL_AUDIO_EQUIPMENT_FEED'
 };
}
function project(src,options={}){if(src?.schema!=='b737-asp-audio-v1')throw Error('Invalid ASP state');
 return {schema:'B737_ASP_AUDIO_PROJECTION_V1',revision:src.revision,stations:Object.fromEntries(SEATS.map(seat=>[seat,stationProjection(src,seat,options)])),
  docs:['FCOM Vol2 5.10.5-6','FCOM Vol2 5.20.1-3','MRG IV.5 p123','MRG IV.6 p139 CB candidate; photo conflict'],
  circuitStatus:'EVIDENCE_ONLY_PENDING_EFFECTIVITY_AND_CATALOG_RECONCILIATION'};
}
return Object.freeze({SEATS,TRANSMITTERS,RECEIVERS,FIXED,CB_CANDIDATES,initialState,apply,project,powerEvidence});
});
