/* Interactive MRG IV.6 source/contactor test network.
 * A lab-only electrical distribution model: no physical cockpit writes.
 * 24 existing bus classes remain authoritative for consumer projection.
 * A/B source switching and TR3 backup are explicitly TRAINING assumptions,
 * not proof of EP-FSI serial-number-specific relay logic. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737MRGContactNetworkV3=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const VERSION='MRG-SOURCE-RELAY-0001';
const INITIAL_SOURCES=Object.freeze({GEN1:true,GEN2:true,APU:false,EXTERNAL:true});
const INITIAL_RELAYS=Object.freeze({
 GB1:true,GB2:true,GEN1_EXTERNAL:false,GEN2_EXTERNAL:false,
 GEN1_APU:false,GEN2_APU:false,GROUND_SVC:true,R3:true,R4:true,
 BUS_XFR:true,TR1:true,TR2:true,TR3:true,R9:true,
 R37_AC:true,R37_DC:true,R1:true,R2:true,R41:true,
 APU_BAT_CHARGER:true,R89:true
});
const RELAY_FEEDS=Object.freeze({
 GB1:['generator1@115VAC'],GB2:['generator2@115VAC'],
 GEN1_EXTERNAL:['generator1@115VAC'],GEN2_EXTERNAL:['generator2@115VAC'],
 GEN1_APU:['generator1@115VAC'],GEN2_APU:['generator2@115VAC'],
 GROUND_SVC:['groundService@115VAC'],R3:['transfer1@115VAC','transfer2@115VAC'],
 R4:['transfer2@115VAC','transfer1@115VAC'],
 BUS_XFR:['transfer1@115VAC','transfer2@115VAC'],
 TR1:['dc1@28VDC'],TR2:['dc2@28VDC'],TR3:['dc1@28VDC','dc2@28VDC'],
 R9:['dc1@28VDC','dc2@28VDC'],
 R37_AC:['standby@115VAC'],R37_DC:['standby@28VDC'],
 R1:['hotBattery@28VDC'],R2:['battery@28VDC'],
 R41:['switchedHotBattery@28VDC'],APU_BAT_CHARGER:[],R89:[]
});
function networkPower({reference,forcedOff=[],baseline='ALL_ON',cascade=true,sources=INITIAL_SOURCES,relays=INITIAL_RELAYS}={}){
 if(!reference||typeof reference!=='object')throw Error('MRG reference power classes required');
 const all=Object.keys(reference),memo={},visiting=new Set(),cuts=new Set(forcedOff);
 if(all.length!==24)throw Error('MRG expects 24 power classes');
 const allowed=new Set(all);
 for(const id of forcedOff)if(!allowed.has(id))throw Error('Unknown MRG cut '+id);
 function available(id){
  if(Object.hasOwn(memo,id))return memo[id];
  if(visiting.has(id))throw Error('MRG distribution cycle '+id);
  if(!allowed.has(id))throw Error('Missing MRG node '+id);
  if(cuts.has(id))return memo[id]=false;
  if(baseline==='NOMINAL_V7'&&reference[id]?.powered!==true)return memo[id]=false;
  visiting.add(id);
  const p=available;
  const r=id=>relays[id]===true;
  let result;
  switch(id){
   case 'external@115VAC':result=!!sources.EXTERNAL;break;
   case 'generator1@115VAC':
    result=(!!sources.GEN1&&r('GB1'))||
      (!!sources.APU&&r('GEN1_APU'))||
      (!!sources.EXTERNAL&&r('GEN1_EXTERNAL'));break;
   case 'generator2@115VAC':
    result=(!!sources.GEN2&&r('GB2'))||
      (!!sources.APU&&r('GEN2_APU'))||
      (!!sources.EXTERNAL&&r('GEN2_EXTERNAL'));break;
   case 'main1@115VAC':result=p('generator1@115VAC');break;
   case 'main2@115VAC':result=p('generator2@115VAC');break;
   case 'transfer1@115VAC':
    result=(p('generator1@115VAC')&&r('R3'))||
      (p('generator2@115VAC')&&r('R4')&&r('BUS_XFR'));break;
   case 'transfer2@115VAC':
    result=(p('generator2@115VAC')&&r('R4'))||
      (p('generator1@115VAC')&&r('R3')&&r('BUS_XFR'));break;
   case 'electronic1@115VAC':result=p('generator1@115VAC');break;
   case 'electronic2@115VAC':result=p('generator2@115VAC');break;
   case 'groundService@115VAC':
    result=r('GROUND_SVC')&&(p('generator1@115VAC')||p('external@115VAC'));break;
   case 'dc1@28VDC':
    result=(p('transfer1@115VAC')&&r('TR1'))||
      (p('transfer2@115VAC')&&r('TR3')&&r('R9'));break;
   case 'dc2@28VDC':
    result=(p('transfer2@115VAC')&&r('TR2'))||
      (p('transfer1@115VAC')&&r('TR3')&&r('R9'));break;
   case 'battery@28VDC':
    result=(p('dc2@28VDC')&&r('R9'))||(r('R2')&&!!sources.BATTERY!==false);break;
   case 'hotBattery@28VDC':
    result=p('battery@28VDC')&&r('R1');break;
   case 'switchedHotBattery@28VDC':
    result=p('hotBattery@28VDC')&&r('R41');break;
   case 'electronic1@28VDC':result=p('dc1@28VDC');break;
   case 'electronic2@28VDC':result=p('dc2@28VDC');break;
   case 'main1@28VAC':result=p('main1@115VAC');break;
   case 'main2@28VAC':result=p('main2@115VAC');break;
   case 'transfer1@28VAC':result=p('transfer1@115VAC');break;
   case 'transfer2@28VAC':result=p('transfer2@115VAC');break;
   case 'groundService@28VAC':result=p('groundService@115VAC');break;
   case 'standby@115VAC':
    result=(p('transfer1@115VAC')&&r('R37_AC'))||
      (p('dc1@28VDC')&&r('R37_DC'));break;
   case 'standby@28VDC':
    result=(p('dc1@28VDC')&&r('R37_DC'))||
      (p('battery@28VDC')&&r('R2'));break;
   default:throw Error('Unmapped MRG electrical node '+id);
  }
  visiting.delete(id);
  return memo[id]=!!result;
 }
 for(const id of all)available(id);
 return memo;
}
function createControls(){
 let sources={...INITIAL_SOURCES,BATTERY:true},relays={...INITIAL_RELAYS};
 let lastReference=null,lastForced=[],lastBaseline='ALL_ON',lastCascade=true;
 const copy=()=>({sources:{...sources},relays:{...relays}});
 const compute=({reference,forcedOff=[],baseline='ALL_ON',cascade=true}={})=>{
  lastReference=reference;lastForced=[...forcedOff];lastBaseline=baseline;lastCascade=cascade;
  return networkPower({reference,forcedOff,baseline,cascade,sources,relays});
 };
 const outputs=()=>lastReference?
   networkPower({reference:lastReference,forcedOff:lastForced,baseline:lastBaseline,cascade:lastCascade,sources,relays}):null;
 const changeSource=(name)=>{
  if(!Object.hasOwn(INITIAL_SOURCES,name))throw Error('Unknown generator source '+name);
  sources[name]=!sources[name];
  if(name==='GEN1'&&sources[name]){
   relays.GB1=true;relays.GEN1_APU=false;relays.GEN1_EXTERNAL=false;
  }else if(name==='GEN2'&&sources[name]){
   relays.GB2=true;relays.GEN2_APU=false;relays.GEN2_EXTERNAL=false;
  }else if(name==='APU'&&sources[name]){
   // APU supplies only an unpowered generator channel; it never parallels
   // an already connected engine generator.
   const current=outputs();
   if(current){
    if(!current['generator1@115VAC']){relays.GEN1_APU=true;relays.GB1=false;relays.GEN1_EXTERNAL=false;}
    if(!current['generator2@115VAC']){relays.GEN2_APU=true;relays.GB2=false;relays.GEN2_EXTERNAL=false;}
   }
  }else if(name==='EXTERNAL'&&sources[name]){
   // Receptacle presence alone does not connect it to an operating generator.
  }
  return sources[name];
 };
 const changeRelay=(id)=>{
  if(!Object.hasOwn(relays,id))throw Error('Unknown MRG contact '+id);
  relays[id]=!relays[id];
  // Make source selector lanes mutually exclusive to avoid parallel sources.
  const group=id.startsWith('GEN1_')||id==='GB1'?1:id.startsWith('GEN2_')||id==='GB2'?2:0;
  if(group&&relays[id]){
   for(const other of ['GB'+group,'GEN'+group+'_APU','GEN'+group+'_EXTERNAL'])
    if(other!==id)relays[other]=false;
  }
  return relays[id];
 };
 const reset=()=>{sources={...INITIAL_SOURCES,BATTERY:true};relays={...INITIAL_RELAYS};return copy();};
 const derivedContacts=()=>{
  const p=outputs()||{},r=id=>relays[id]===true;
  return {
   GB1:r('GB1')&&!!sources.GEN1,GB2:r('GB2')&&!!sources.GEN2,
   GEN1_APU:r('GEN1_APU')&&!!sources.APU,GEN2_APU:r('GEN2_APU')&&!!sources.APU,
   GEN1_EXTERNAL:r('GEN1_EXTERNAL')&&!!sources.EXTERNAL,
   GEN2_EXTERNAL:r('GEN2_EXTERNAL')&&!!sources.EXTERNAL,
   GROUND_SVC:r('GROUND_SVC')&&!!p['groundService@115VAC'],
   R3:r('R3'),R4:r('R4'),BUS_XFR:r('BUS_XFR'),
   R9:r('R9'),TR1:r('TR1'),TR2:r('TR2'),TR3:r('TR3'),
   R37_AC:r('R37_AC'),R37_DC:r('R37_DC'),R2:r('R2'),R1:r('R1'),R41:r('R41'),
   APU_BAT_CHARGER:r('APU_BAT_CHARGER'),R89:r('R89')
  };
 };
 const dirty=()=>Object.keys(INITIAL_SOURCES).some(k=>sources[k]!==INITIAL_SOURCES[k])||
  Object.keys(INITIAL_RELAYS).some(k=>relays[k]!==INITIAL_RELAYS[k]);
 return Object.freeze({version:VERSION,compute,outputs,changeSource,changeRelay,reset,copy,derivedContacts,dirty});
}
return Object.freeze({VERSION,INITIAL_SOURCES,INITIAL_RELAYS,RELAY_FEEDS,networkPower,createControls});
});
