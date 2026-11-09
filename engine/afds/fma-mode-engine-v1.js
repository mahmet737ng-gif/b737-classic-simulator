/* B737-FMA-ENGINE-0002 — 737 Classic CMD/CWS axis-aware FMA contract.
 * Grounding:
 * Sepehran FCOM 4.10.27, 4.20.4–4.20.11: mode labels, 4 columns, ARM
 * white, CWS yellow, 10 s changed-engaged highlight, conditional captures.
 * Lufthansa LAN ATA22-10/22-12: FCC owns EADI status/engagement.
 * MRG: training cross-check, not a substitute for FCC sensor status.
 *
 * MCP is an input, NOT evidence of AFDS servo engagement or LOC/GS capture.
 * This model projects supported MCP command modes, and uses explicitly
 * qualified simulated FCC observations for further modes. Do not synthesize
 * FLARE, LOC/GS, TO/GA, VNAV submodes from a mode-button click alone.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FmaModeEngineV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const VERSION='B737-FMA-ENGINE-0002-CWS-AXIS';
 const FIELDS=Object.freeze(['at','pitch','roll','afds']);
 const MODES=Object.freeze({
  at:Object.freeze(['','N1','GA','RETARD','FMC SPD','MCP SPD','THR HLD','ARM']),
  pitch:Object.freeze(['','TO/GA','V/S','ALT ACQ','ALT HOLD','VNAV SPD','VNAV PTH','MCP SPD','G/S','FLARE']),
  roll:Object.freeze(['','TO/GA','HDG SEL','VOR/LOC','LNAV']),
  afds:Object.freeze(['','CMD','FD','CWS P','CWS R','1 CH'])
 });
 const ARMED=Object.freeze({
  at:Object.freeze(['']),
  pitch:Object.freeze(['','G/S','V/S','G/S V/S','FLARE']),
  roll:Object.freeze(['','VOR/LOC']),
  afds:Object.freeze([''])
 });
 const ORIGIN=Object.freeze({
  MCP:'MCP_TRAINING_MODE_SELECTED',
  FCC:'SIMULATED_FCC_CONFIRMED',
  UNKNOWN:'POWER_OR_FCC_UNVERIFIED'
 });
 function blank(){
  const state=Object.fromEntries(FIELDS.map(k=>[k,{active:'',armed:'',origin:ORIGIN.UNKNOWN}]));
  // In the 737CL the fourth AFDS status column may carry two separate
  // YELLOW axis states at once: CWS P and CWS R. Neither is a Pitch/Roll
  // command-mode annunciation; those command fields are BLANK in CWS.
  state.afds.secondary='';
  state.afds.tertiary='';
  return state;
 }
 function assertField(field,type,value){
  const table=type==='armed'?ARMED:MODES;
  if(!table[field]?.includes(value))throw Error('Invalid FMA '+field+' '+type+': '+String(value));
  return value;
 }
 function normalized(fma){
  const state=blank();
  for(const [field,data]of Object.entries(fma||{})){
   if(!FIELDS.includes(field)||!data||typeof data!=='object')throw Error('Unknown FMA field '+field);
   for(const k of ['active','armed'])if(Object.hasOwn(data,k))state[field][k]=assertField(field,k,data[k]);
   if(Object.hasOwn(data,'origin'))state[field].origin=String(data.origin);
   if(Object.hasOwn(data,'secondary')){
    if(field!=='afds'||!['','CWS P','CWS R'].includes(data.secondary))
     throw Error('Only AFDS column can show secondary CWS R');
    state.afds.secondary=data.secondary;
   }
   if(Object.hasOwn(data,'tertiary')){
    if(field!=='afds'||!['','CWS R'].includes(data.tertiary))
     throw Error('Only AFDS can show third-line CWS R');
    state.afds.tertiary=data.tertiary;
   }
  }
  if(state.afds.tertiary&&state.afds.secondary!=='CWS P')
   throw Error('Third-line CWS R requires second-line CWS P');
  return state;
 }
 function sourceMode(val,map){
  return typeof val==='string'&&Object.hasOwn(map,val)?map[val]:'';
 }
 function cwsAxes(output){
  // An engaged CMD autopilot has independent pitch/roll axis control.
  // FCOM 4.10.18, 4.20.9/10: absent/deselected CMD mode -> that axis CWS.
  // Do NOT infer CWS from an F/D-only blank FMA or a VNAV command whose
  // subtype is unknown. Prefer the published MCP/AFDS axis-control state.
  const m=output?.modes||{},autopilot=m.autopilot;
  const engaged=/^(?:CMD|CWS)_[AB]$/.test(autopilot||'');
  if(output?.power!==true||!engaged)return {pitch:false,roll:false};
  const manual=autopilot.startsWith('CWS_'),axis=output?.axisControl;
  return {
   pitch:manual||(axis&&['CMD','CWS'].includes(axis.pitch)
    ?axis.pitch==='CWS':m.vertical==null),
   roll:manual||(axis&&['CMD','CWS'].includes(axis.roll)
    ?axis.roll==='CWS':m.lateral==null)
  };
 }
 function applyCwsStatus(state,pitchCws,rollCws){
  if(pitchCws)state.pitch.active='';
  if(rollCws)state.roll.active='';
  // CMD stays active (green). Independent CWS status is yellow beneath it.
  state.afds.secondary=pitchCws?'CWS P':rollCws?'CWS R':'';
  state.afds.tertiary=pitchCws&&rollCws?'CWS R':'';
  return state;
 }
 function fromMcp(output,seat){
  if(seat!=='CAPT'&&seat!=='FO')throw Error('Invalid FMA seat');
  if(!output||output.schema!=='B737_MCP_AFDS_OUTPUT_V1')return null;
  const state=blank();
  if(output.power!==true)return state;
  const m=output.modes||{},ctrl=output.controls||{};
  const at=ctrl.atArm===true;
  const automaticSpeed=['ALT_HLD','VS'].includes(m.vertical);
  state.at.active=at?(automaticSpeed?'MCP SPD':
   sourceMode(m.thrust,{N1:'N1',SPEED:'MCP SPD'})||'ARM'):'';
  state.at.origin=ORIGIN.MCP;
  state.pitch.active=sourceMode(output.capture?.pitch,
   {ALT_ACQ:'ALT ACQ',ALT_HOLD:'ALT HOLD','G/S':'G/S'})||
   sourceMode(m.vertical,{LVL_CHG:'MCP SPD',ALT_HLD:'ALT HOLD',VS:'V/S'});
  state.roll.active=sourceMode(output.capture?.roll,{VOR_LOC:'VOR/LOC'})||
   sourceMode(m.lateral,{HDG_SEL:'HDG SEL',LNAV:'LNAV'});
  state.pitch.armed=output.armed?.pitch==='G/S'?'G/S':
   output.armed?.pitch==='V/S'?'V/S':'';
  state.roll.armed=output.armed?.roll==='VOR/LOC'?'VOR/LOC':'';
  state.pitch.origin=state.roll.origin=ORIGIN.MCP;
  // Specific NAV/vertical capture states require verified FCC observation,
  // not merely illuminated MCP switches.
  const cmd=m.autopilot==='CMD_A'||m.autopilot==='CMD_B';
  const cws=m.autopilot==='CWS_A'||m.autopilot==='CWS_B';
  state.afds.active=cmd?'CMD':
   ctrl.fd?.[seat==='CAPT'?'left':'right']===true?'FD':'';
  state.afds.origin=ORIGIN.MCP;
  if(cmd||cws){
   const axes=cwsAxes(output);
   applyCwsStatus(state,axes.pitch,axes.roll);
  }
  return state;
 }
 // A qualified simulated FCC observation may override a training-selected
 // mode. No inference about capture, autoland, or thrust-servo motion is
 // made from unverified MCP selections.
 function withFcc(base,observation,seat=observation?.seat){
  if(!observation)return normalized(base);
  if(observation.schema!=='B737_FMA_FCC_OBSERVATION_V1'||
   observation.confirmed!==true||observation.seat!==seat)
   throw Error('Qualified seat-specific FCC observation required');
  const state=normalized(base);
  const p=observation.fields||{};
  for(const [field,data]of Object.entries(p)){
   if(!FIELDS.includes(field)||!data||typeof data!=='object')throw Error('Invalid FCC FMA field');
   if(Object.hasOwn(data,'active'))state[field].active=assertField(field,'active',data.active);
   if(Object.hasOwn(data,'armed'))state[field].armed=assertField(field,'armed',data.armed);
   state[field].origin=ORIGIN.FCC;
  }
  // FCOM 4.20.8 FLARE armed requires dual-channel APP, LOC+G/S captured
  // and radio altitude < 1500 ft; engaged requires <= 50 ft and FCC flare
  // engagement. Observation alone must not invent the last condition.
  const flareArmed=state.pitch.armed==='FLARE',flareActive=state.pitch.active==='FLARE';
  if(flareArmed||flareActive){
   const ev=observation.evidence||{};
   if(ev.dualAp!==true||ev.locCaptured!==true||ev.gsCaptured!==true||
    !Number.isFinite(ev.radioAltitudeFt)||ev.radioAltitudeFt>=1500)
    throw Error('FLARE requires verified dual-channel LOC/GS and RA below 1500');
   if(flareActive&&!(ev.radioAltitudeFt<=50&&ev.flareEngaged===true))
    throw Error('FLARE capture requires FCC and radio-altimeter evidence');
  }
  if(state.pitch.active==='G/S'&&observation.evidence?.gsCaptured!==true)
   throw Error('G/S active requires capture observation');
  if(state.roll.active==='VOR/LOC'&&observation.evidence?.navCaptured!==true)
   throw Error('VOR/LOC active requires course capture');
  if(['VNAV SPD','VNAV PTH'].includes(state.pitch.active)&&
   observation.evidence?.fmcVerticalValid!==true)
   throw Error('VNAV submode requires valid FMC profile');
  if(state.pitch.active==='ALT ACQ'&&observation.evidence?.altAcquire!==true)
   throw Error('ALT ACQ requires AFDS acquisition evidence');
  // Qualified FCC changes to command pitch/roll modes replace CWS on that
  // axis. Force-override CWS must be explicitly supported by evidence;
  // unlike a blank F/D field it must not be invented from missing data.
  const m=observation?.evidence||{};
  const ap=observation?.autopilotMode||'';
  if(m.pitchCwsOverride===true||m.rollCwsOverride===true){
   if(!ap){
    // The MCP-only model has no physical force transducers; a declared FCC
    // pitch/roll override is allowed only with a separately authenticated
    // engaged autopilot flag in the observation.
    if(m.autopilotEngaged!==true)throw Error('CWS override needs engaged A/P evidence');
   }
   if(m.dualAp===true&&m.locCaptured===true&&m.gsCaptured===true)
    throw Error('Dual-channel APP manual CWS override disengages autopilot');
  }
  let pitchCws=m.pitchCwsOverride===true;
  let rollCws=m.rollCwsOverride===true;
  // A capture re-engages command on the newly confirmed axis, so it
  // cancels the CWS status for that axis without disturbing the other.
  const confirmedPitch=Object.hasOwn(p.pitch||{},'active')?p.pitch.active:null;
  const confirmedRoll=Object.hasOwn(p.roll||{},'active')?p.roll.active:null;
  if(confirmedPitch!==null&&confirmedPitch!=='')pitchCws=false;
  if(confirmedRoll!==null&&confirmedRoll!=='')rollCws=false;
  if(pitchCws||rollCws){
   applyCwsStatus(state,pitchCws,rollCws);
   state.afds.origin=ORIGIN.FCC;
  }
  return state;
 }
 function project(output,seat,observation){
  const base=fromMcp(output,seat);
  if(base===null)return null;
  if(output.power!==true)return base;
  const state=withFcc(base,observation,seat);
  if(observation){
   // Capturing a selected command cancels only its own CWS axis.
   const pitchCaptured=Object.hasOwn(observation.fields?.pitch||{},'active')&&
    observation.fields.pitch.active!=='';
   const rollCaptured=Object.hasOwn(observation.fields?.roll||{},'active')&&
    observation.fields.roll.active!=='';
   const axes=cwsAxes(output);
   applyCwsStatus(state,
    (axes.pitch&&!pitchCaptured)||(observation.evidence?.pitchCwsOverride===true&&!pitchCaptured),
    (axes.roll&&!rollCaptured)||(observation.evidence?.rollCwsOverride===true&&!rollCaptured));
  }
  return state;
 }
 const color=(field,mode,type='active')=>type==='armed'||(field==='at'&&mode==='ARM')?'white':
  /^(CWS P|CWS R|1 CH)$/.test(mode)?'yellow':'green';
 return Object.freeze({VERSION,FIELDS,MODES,ARMED,ORIGIN,blank,normalized,
  fromMcp,cwsAxes,applyCwsStatus,withFcc,project,color});
});
