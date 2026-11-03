/* REDUNDANCY-CAUTION-0001: B737 Classic 300/400/500 training alert classifier.
 * FCOM V2 9.10.2-3 / 9.10.5-6: single FCC or auto-slat computer
 * failure is recall-only; loss of both channels is an immediate failure.
 * Independent of flight-control/IRS/electrical authority. TRAINER ONLY.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicRedundancyCautionV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const CHANNELS=Object.freeze({
  SPEED_TRIM:Object.freeze({A:'FCC_A',B:'FCC_B',locator:'CAPT.FLT CONT',individualLamp:'speed-trim'}),
  MACH_TRIM:Object.freeze({A:'FCC_A',B:'FCC_B',locator:'CAPT.FLT CONT',individualLamp:'mach-trim'}),
  AUTO_SLAT:Object.freeze({A:'AUTOSLAT_A',B:'AUTOSLAT_B',locator:'CAPT.FLT CONT',individualLamp:'auto-slat'})
 });
 const KEYS=Object.freeze(Object.keys(CHANNELS));
 const initial=()=>Object.fromEntries(KEYS.map(id=>[id,{A:false,B:false}]));
 const validId=id=>Object.hasOwn(CHANNELS,id);
 const copy=s=>Object.fromEntries(KEYS.map(id=>[id,{A:s[id].A,B:s[id].B}]));
 function evaluate(channels){
  if(!channels||KEYS.some(id=>typeof channels[id]?.A!=='boolean'||typeof channels[id]?.B!=='boolean'))
   throw Error('Complete Boolean channel pairs required');
  const reasons={},indicators={};
  for(const id of KEYS){
   const failed=Object.keys(channels[id]).filter(ch=>channels[id][ch]===true);
   const mode=failed.length===0?'NORMAL':failed.length===1?'RECALL_ONLY':'IMMEDIATE';
   const key=CHANNELS[id].locator;
   if(!reasons[key])reasons[key]=[];
   if(failed.length)reasons[key].push({
    id:'REDUNDANCY:'+id+':'+(failed.length===2?'TOTAL':failed[0]),
    mode,
    system:id,
    failedChannels:failed.join('+')
   });
   indicators[CHANNELS[id].individualLamp]={system:id,mode,failedChannels:[...failed],
    illuminatedImmediately:mode==='IMMEDIATE',illuminatedOnRecall:mode!=='NORMAL'};
  }
  return {reasons,indicators,channels:copy(channels),version:'REDUNDANCY-CAUTION-0001'};
 }
 function create(){
  let channels=initial(),revision=0;
  function snapshot(){return {...evaluate(channels),revision};}
  function setChannel(system,channel,failed){
   if(!validId(system)||!['A','B'].includes(channel)||typeof failed!=='boolean')return false;
   if(channels[system][channel]!==failed){
    channels[system][channel]=failed;revision++;
   }
   return snapshot();
  }
  function setSystem(system,pair){
   if(!validId(system)||!pair||typeof pair.A!=='boolean'||typeof pair.B!=='boolean')return false;
   if(channels[system].A!==pair.A||channels[system].B!==pair.B){
    channels[system]={A:pair.A,B:pair.B};revision++;
   }
   return snapshot();
  }
  function reset(){channels=initial();revision++;return snapshot();}
  return Object.freeze({snapshot,setChannel,setSystem,reset});
 }
 return Object.freeze({CHANNELS,KEYS,initial,evaluate,create});
});
