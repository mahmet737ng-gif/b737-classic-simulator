/* B737-FMA-ENGINE-0001 — 737-300/400/500 training FMA contract.
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
 const VERSION='B737-FMA-ENGINE-0001';
 const FIELDS=Object.freeze(['at','pitch','roll','afds']);
 const MODES=Object.freeze({
  at:Object.freeze(['','N1','GA','RETARD','FMC SPD','MCP SPD','THR HLD','ARM']),
  pitch:Object.freeze(['','TO/GA','V/S','ALT ACQ','ALT HOLD','VNAV SPD','VNAV PTH','MCP SPD','G/S','FLARE','CWS P']),
  roll:Object.freeze(['','TO/GA','HDG SEL','VOR/LOC','LNAV','CWS R']),
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
 function blank(){return Object.fromEntries(FIELDS.map(k=>[k,{active:'',armed:'',origin:ORIGIN.UNKNOWN}]));}
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
  }
  return state;
 }
 function sourceMode(val,map){
  return typeof val==='string'&&Object.hasOwn(map,val)?map[val]:'';
 }
 function fromMcp(output,seat){
  if(seat!=='CAPT'&&seat!=='FO')throw Error('Invalid FMA seat');
  if(!output||output.schema!=='B737_MCP_AFDS_OUTPUT_V1')return null;
  const state=blank();
  if(output.power!==true)return state;
  const m=output.modes||{},ctrl=output.controls||{};
  const at=ctrl.atArm===true;
  state.at.active=at?sourceMode(m.thrust,{N1:'N1',SPEED:'MCP SPD'})||'ARM':'';
  // A/T ARM is a WHITE engaged annunciation per FCOM 4.10.27.
  state.at.origin=ORIGIN.MCP;
  state.pitch.active=sourceMode(m.vertical,
   {LVL_CHG:'MCP SPD',ALT_HLD:'ALT HOLD',VS:'V/S'});
  // VNAV requires actual FMC climb/descent/altitude logic to discriminate
  // VNAV SPD from VNAV PTH; the generic VNAV button is not a legal FMA label.
  state.roll.active=sourceMode(m.lateral,{HDG_SEL:'HDG SEL',LNAV:'LNAV'});
  state.pitch.origin=state.roll.origin=ORIGIN.MCP;
  const cws=m.autopilot==='CWS_A'||m.autopilot==='CWS_B';
  if(cws){state.pitch.active='CWS P';state.roll.active='CWS R';}
  const cmd=m.autopilot==='CMD_A'||m.autopilot==='CMD_B';
  state.afds.active=cmd?'CMD':cws?'FD':
   ctrl.fd?.[seat==='CAPT'?'left':'right']===true?'FD':'';
  state.afds.origin=ORIGIN.MCP;
  return state;
 }
 // A qualified simulated FCC observation may override a training-selected
 // mode. No inference about capture, autoland, or thrust-servo motion is
 // made from unverified MCP selections.
 function withFcc(base,observation,seat){
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
  return state;
 }
 function project(output,seat,observation){
  const base=fromMcp(output,seat);
  if(base===null)return null;
  if(output.power!==true)return base;
  return withFcc(base,observation,seat);
 }
 const color=(field,mode,type='active')=>type==='armed'||(field==='at'&&mode==='ARM')?'white':
  /^(CWS P|CWS R|1 CH)$/.test(mode)?'yellow':'green';
 return Object.freeze({VERSION,FIELDS,MODES,ARMED,ORIGIN,blank,normalized,
  fromMcp,withFcc,project,color});
});
