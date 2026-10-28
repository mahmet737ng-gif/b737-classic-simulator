/* B737 Classic LE DEVICES trainer, simplified and deterministic.
 * FCOM Sepehran B737-300/400/500: 9.10.13-14, 9.20.15-19, 6.20.9.
 * MRG Classic: IV.6 pp.163,166,184; IV.9 pp.249,254-255.
 * Simplified bus surrogates only: overhead TRANSFER BUS 1, center DC BUS 1.
 * No lamp-level wiring, certification, exact sensor or movement rates.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737LEDevicesClassicV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const SLATS=Object.freeze(['SLAT_1','SLAT_2','SLAT_3','SLAT_4','SLAT_5','SLAT_6']);
 const FLAPS=Object.freeze(['FLAP_1','FLAP_2','FLAP_3','FLAP_4']);
 const DEVICES=Object.freeze([...SLATS,...FLAPS]);
 const DETENTS=Object.freeze([0,1,2,5,10,15,25,30,40]);
 const MODES=Object.freeze(['NORMAL','NON_NORMAL','EMERGENCY']);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const device=id=>DEVICES.includes(id);
 const trit=v=>v===null?null:!!v;
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function initialState(mode='NORMAL'){
  if(!MODES.includes(mode))throw Error('Unknown LE scenario');
  return {schema:'b737-le-classic/1',revision:0,mode,lever:0,onGround:true,
   hydraulic:{A:true,B:mode==='NORMAL',standby:mode==='EMERGENCY'},
   power:{transfer1:true,dc1:true},ptuAvailable:true,autoslatsRequested:false,alternateExtend:false,
   position:Object.fromEntries(DEVICES.map(id=>[id,0])),
   jams:Object.fromEntries(DEVICES.map(id=>[id,false])),
   sensor:Object.fromEntries(DEVICES.map(id=>[id,null])),
   lampFailures:[],testPressed:false,elapsedSeconds:0};
 }
 function target(s,id){
  if(s.alternateExtend)return id.startsWith('SLAT_')?2:1;
  if(!s.lever)return 0;
  if(id.startsWith('FLAP_'))return 1;
  return s.lever>=10||(s.autoslatsRequested&&!s.onGround)?2:1;
 }
 function driveAvailable(s){
  return s.hydraulic.B||(s.alternateExtend&&s.hydraulic.standby)||
   (!s.onGround&&s.autoslatsRequested&&s.hydraulic.A&&s.ptuAvailable);
 }
 function apply(prev,action){
  if(!prev||prev.schema!=='b737-le-classic/1')throw Error('Invalid LE state');
  if(!action||typeof action.type!=='string')throw Error('LE action required');
  if(action.type==='RESET')return initialState(action.mode||'NORMAL');
  const s=copy(prev),val=action.value;
  switch(action.type){
   case 'FLAP_LEVER':
    if(!DETENTS.includes(val))throw Error('Invalid trailing-edge flap detent');
    s.lever=val;break;
   case 'GROUND':
    if(typeof val!=='boolean')throw Error('GROUND must be boolean');
    s.onGround=val;break;
   case 'HYDRAULIC':
    if(!['A','B','standby'].includes(action.system)||typeof val!=='boolean')throw Error('Invalid hydraulic input');
    s.hydraulic[action.system]=val;break;
   case 'POWER':
    if(!['transfer1','dc1'].includes(action.bus)||![true,false,null].includes(val))throw Error('Invalid bus input');
    s.power[action.bus]=val;break;
   case 'PTU':
    if(typeof val!=='boolean')throw Error('PTU must be boolean');
    s.ptuAvailable=val;break;
   case 'AUTOSLAT':
    if(typeof val!=='boolean')throw Error('AUTOSLAT must be boolean');
    s.autoslatsRequested=val;break;
   case 'ALTERNATE_EXTEND':
    if(typeof val!=='boolean')throw Error('ALTERNATE_EXTEND must be boolean');
    if(val&&!s.hydraulic.standby)throw Error('Standby hydraulic pressure required');
    s.alternateExtend=val;break;
   case 'JAM':
    if(!device(action.device)||typeof val!=='boolean')throw Error('Invalid jam');
    s.jams[action.device]=val;break;
   case 'SENSOR':
    if(!device(action.device)||![null,'RETRACTED','TRANSIT','EXT','FULL_EXT'].includes(val))
     throw Error('Invalid indication fault');
    if(action.device.startsWith('FLAP_')&&val==='EXT')throw Error('Flap has no EXT-only indication');
    s.sensor[action.device]=val;break;
   case 'LAMP_FAILURE':
    if(!device(action.device)||!['TRANSIT','EXT','FULL_EXT'].includes(action.level)||typeof val!=='boolean')throw Error('Invalid lamp fault');
    if(action.device.startsWith('FLAP_')&&action.level==='EXT')throw Error('Flap has no EXT lamp');
    {const key=action.device+'|'+action.level;
     s.lampFailures=s.lampFailures.filter(x=>x!==key);
     if(val)s.lampFailures.push(key);}
    break;
   case 'TEST':
    if(typeof val!=='boolean')throw Error('Invalid TEST action');
    s.testPressed=val;break;
   case 'TICK':{
    const dt=action.seconds;
    if(!finite(dt)||dt<0||dt>60)throw Error('TICK seconds must be between 0 and 60');
    // Only the live physical handle uses the slower configurable trainer profile.
    // Existing instructor TICK tests keep their original 5 s/level behavior.
    const timed=action.motionProfile==='TIMED';
    if(action.motionProfile!==undefined&&!['TIMED'].includes(action.motionProfile))throw Error('Unknown LE motion profile');
    const pf=action.pressureFactor===undefined?1:action.pressureFactor;
    if(typeof pf!=='number'||!Number.isFinite(pf)||pf<0||pf>1.1)throw Error('Invalid pressure factor');
    for(const id of DEVICES){
     if(s.jams[id]||!driveAvailable(s))continue;
     const desired=target(s,id),cur=s.position[id];
     // A standby LE command is extend-only. Hyd A/PTU backs only autoslat extension, not general retract.
     if(!s.hydraulic.B&&desired<cur)continue;
     if(!s.hydraulic.B&&desired>cur&&!(s.alternateExtend&&s.hydraulic.standby)&&
        !(id.startsWith('SLAT_')&&s.autoslatsRequested&&!s.onGround&&s.hydraulic.A&&s.ptuAvailable&&desired===2))continue;
     const phase=cur>1.000001||(Math.abs(cur-1)<.000001&&desired>1)?1/16:1/20;
     const speed=timed?phase*pf:.20;
     const step=Math.min(Math.abs(desired-cur),speed*dt);
     s.position[id]=Number((cur+Math.sign(desired-cur)*step).toFixed(6));
    }
    s.elapsedSeconds+=dt;break;
   }
   default:throw Error('Unknown LE command '+action.type);
  }
  s.revision++;return s;
 }
 function sensed(s,id){
  if(s.sensor[id])return s.sensor[id];
  const p=s.position[id],epsilon=.00001;
  if(p<=epsilon)return 'RETRACTED';
  if(id.startsWith('FLAP_'))return Math.abs(p-1)<epsilon?'FULL_EXT':'TRANSIT';
  if(Math.abs(p-1)<epsilon)return 'EXT';
  if(Math.abs(p-2)<epsilon)return 'FULL_EXT';
  return 'TRANSIT';
 }
 function evaluate(s){
  if(!s||s.schema!=='b737-le-classic/1')throw Error('Invalid LE state');
  const indication=Object.fromEntries(DEVICES.map(id=>[id,sensed(s,id)]));
  const expected=Object.fromEntries(DEVICES.map(id=>[id,target(s,id)]));
  const mismatched=DEVICES.filter(id=>Math.abs(s.position[id]-expected[id])>.00001);
  const actualTransit=DEVICES.some(id=>indication[id]==='TRANSIT');
  const improper=DEVICES.filter(id=>{
   if(s.sensor[id]===null)return false;
   const want=expected[id]===0?'RETRACTED':id.startsWith('FLAP_')||expected[id]===2?'FULL_EXT':'EXT';
   return indication[id]!==want;
  });
  const autoslatInhibit=!s.onGround&&s.autoslatsRequested&&[1,2,5].includes(s.lever);
  const allExpected=s.lever!==0&&mismatched.length===0&&improper.length===0;
  // The observed sensor position and the indicated lamp are intentionally different
  // when a LE device disagrees with the commanded flap configuration.
  // A jammed slat remaining at EXT after FLAPS 5 -> 15 therefore loses EXT green
  // and keeps TRANSIT amber, even if it is physically stationary.
  const mismatchedSet=new Set(mismatched);
  const improperSet=new Set(improper);
  const annunciation=Object.fromEntries(DEVICES.map(id=>[
   id,(mismatchedSet.has(id)||improperSet.has(id))?'TRANSIT':indication[id]
  ]));
  const overhead={power:trit(s.power.transfer1),windows:{},indication:annunciation,observed:indication};
  for(const id of DEVICES)for(const level of (id.startsWith('FLAP_')?['TRANSIT','FULL_EXT']:['TRANSIT','EXT','FULL_EXT'])){
   const key=id+'|'+level,lit=s.testPressed||annunciation[id]===level;
   overhead.windows[key]=s.power.transfer1===null?null:
    s.power.transfer1===false?false:
    s.lampFailures.includes(key)?false:lit;
  }
  const centerPowered=trit(s.power.dc1);
  const center={
   power:centerPowered,
   transit:centerPowered===null?null:centerPowered&&(actualTransit||mismatched.length>0||improper.length>0)&&!autoslatInhibit,
   extended:centerPowered===null?null:centerPowered&&allExpected
  };
  return {schema:'b737-le-classic-result/1',revision:s.revision,scenario:s.mode,lever:s.lever,
   onGround:s.onGround,hydraulic:copy(s.hydraulic),power:copy(s.power),
   position:copy(s.position),expected,indication,overhead,center,
   faults:{jams:DEVICES.filter(id=>s.jams[id]),sensorFaults:DEVICES.filter(id=>s.sensor[id]!==null),lampFailures:[...s.lampFailures]},
   mismatch:mismatched,improperIndications:improper,autoslatInhibit,alternateExtend:s.alternateExtend,
   constraints:['NO_REAL_WIRING_MAP','TRAINING_RATE_ONLY','NO_HYDRAULIC_PLANT_CONNECTED','MRG_CLASSIC_BUS_SURROGATES']};
 }
 function execute(commands,mode='NORMAL'){let s=initialState(mode);for(const cmd of commands)s=apply(s,cmd);return evaluate(s);}
 return Object.freeze({DEVICES,FLAPS,SLATS,DETENTS,MODES,initialState,apply,evaluate,execute});
});