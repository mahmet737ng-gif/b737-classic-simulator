/* Unified BUS INJECTION V1. Training-only, never mutates an aircraft source
 * selector, generator engine, charge controller or Electrical V7 state.
 * Cross-tab localStorage is the source of truth; StorageEvent + BroadcastChannel
 * are notifications. Guarded, explicit injection with manual clear.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedBusFailureInjectionV1=api;
 if(root?.document && root?.B737ElectricalV7)api.install(root);
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const SCHEMA='b737classic.bus-failure-injection/1';
 const KEY='b737classic.bus-failure-injection.v1';
 const CHANNEL='b737classic.bus-failure-injection.notify.v1';
 const BUS_KEYS=Object.freeze([
  'generator1@115VAC','generator2@115VAC','main1@115VAC','main2@115VAC',
  'transfer1@115VAC','transfer2@115VAC','groundService@115VAC','external@115VAC',
  'dc1@28VDC','dc2@28VDC','battery@28VDC','hotBattery@28VDC',
  'switchedHotBattery@28VDC','standby@115VAC','standby@28VDC',
  'electronic1@115VAC','electronic2@115VAC','electronic1@28VDC','electronic2@28VDC',
  'transfer1@28VAC','transfer2@28VAC','main1@28VAC','main2@28VAC',
  'groundService@28VAC'
 ]);
 const DIRECT=Object.freeze({
  'generator1@115VAC':'generator1','generator2@115VAC':'generator2',
  'main1@115VAC':'main1','main2@115VAC':'main2',
  'transfer1@115VAC':'transfer1','transfer2@115VAC':'transfer2',
  'dc1@28VDC':'dc1','dc2@28VDC':'dc2',
  'battery@28VDC':'battery','hotBattery@28VDC':'hotBattery',
  'switchedHotBattery@28VDC':'switchedHotBattery',
  'standby@115VAC':'acStandby','standby@28VDC':'dcStandby',
  'groundService@115VAC':'groundService'
 });
 const ALL=new Set(BUS_KEYS);
 const empty=()=>({schema:SCHEMA,active:false,offBusKeys:[],issuedAt:0,source:'NONE'});
 function normalize(value){
  if(!value||value.schema!==SCHEMA||typeof value.active!=='boolean'||
    !Array.isArray(value.offBusKeys)||value.offBusKeys.length>BUS_KEYS.length ||
    !Number.isSafeInteger(value.issuedAt)||value.issuedAt<0)return null;
  const keys=new Set(value.offBusKeys);
  if(keys.size!==value.offBusKeys.length||[...keys].some(k=>!ALL.has(k)))return null;
  if(!value.active&&keys.size) return null;
  return Object.freeze({schema:SCHEMA,active:value.active,offBusKeys:[...keys],
   issuedAt:value.issuedAt,source:String(value.source||'INSTRUCTOR').slice(0,64)});
 }
 function payload(keys,now=Date.now()){
  if(!Array.isArray(keys)||new Set(keys).size!==keys.length||keys.some(k=>!ALL.has(k)))
   throw Error('Invalid bus-outage scenario');
  return normalize({schema:SCHEMA,active:keys.length>0,offBusKeys:keys,
   issuedAt:now,source:'BUS_CONSUMER_TEST_LAB'});
 }
 function overlay(result,current){
  if(!current?.active||!current.offBusKeys.length||result?.schema!=='B737_ELECTRICAL_V7_RESULT')
   return result;
  const bus={...result.bus},cuts=new Set(current.offBusKeys);
  for(const key of cuts)if(DIRECT[key])bus[DIRECT[key]]=false;
  const lamps={...result.lamps,
   busOff1:bus.generator1===false,
   busOff2:bus.generator2===false,
   transferBusOff1:bus.transfer1===false,
   transferBusOff2:bus.transfer2===false,
   standbyPowerOff:bus.acStandby===false};
  const qa=[...(result.qa||[]),{id:'INSTRUCTOR_BUS_FAILURE_INJECTION',
   detail:current.offBusKeys.join(', '),level:'TRAINING_ONLY'}];
  return {...result,bus,lamps,qa,
   busFailureInjection:{active:true,offBusKeys:current.offBusKeys.slice(),
    source:current.source,issuedAt:current.issuedAt},
   // Synthetic converter/electronics bus cuts are retained here and are
   // read by the consumer and engine-indicator adapter at exact voltage.
   busClassOutages:current.offBusKeys.slice()};
 }
 function install(win){
  if(!win?.B737ElectricalV7?.evaluate||!win?.localStorage) return null;
  if(win.__b737BusInjectionInstalled)return win.__b737BusInjectionInstalled;
  const original=win.B737ElectricalV7;
  let current=empty(),statusNode=null;
  try{current=normalize(JSON.parse(win.localStorage.getItem(KEY)||'null'))||empty();}
  catch(_){current=empty();}
  const evaluate=(state,options)=>overlay(original.evaluate(state,options),current);
  win.B737ElectricalV7=Object.freeze({...original,evaluate,
    execute(commands){let s=original.initialState();for(const action of commands)s=original.apply(s,action);return evaluate(s);}});
  function render(){
   if(!win.document)return;
   const id='unifiedBusInjectionStatusV1';
   statusNode=statusNode||win.document.getElementById(id);
   if(!statusNode){
    const holder=win.document.getElementById('unifiedControlCenter')||
      win.document.querySelector?.('header.unified-minimal-header');
    if(!holder)return;
    statusNode=win.document.createElement('div');statusNode.id=id;statusNode.dir='ltr';
    statusNode.style.cssText='padding:9px;margin:7px 0;border:1px solid #6484a0;border-radius:6px;background:#173348;color:#c2e2f5;font:600 11px/1.6 system-ui,Tahoma,sans-serif';
    statusNode.innerHTML='<span data-injection-status role="status"></span>'+
     ' <button type="button" data-injection-clear style="margin-left:8px;padding:5px 8px;border:1px solid #dc7787;color:#ffb3be;background:#3e2732;border-radius:5px;cursor:pointer">CLEAR INJECTED FAILURES</button>';
    holder.prepend(statusNode);
    statusNode.querySelector('[data-injection-clear]').addEventListener('click',()=>write(empty(),true));
   }
   statusNode.hidden=!current.active;
   const output=statusNode.querySelector('[data-injection-status]');
   if(output)output.textContent=current.active?
    'TRAINING BUS FAILURE ACTIVE · '+current.offBusKeys.length+' bus class(es) OFF':'';
  }
  function accept(raw){
   const next=normalize(raw);if(!next)return false;
   if(current.issuedAt===next.issuedAt&&
     current.active===next.active&&current.offBusKeys.join('|')===next.offBusKeys.join('|'))
    return true;
   current=next;render();
   win.dispatchEvent(new win.CustomEvent('b737:bus-failure-injection-changed',{
    detail:{active:next.active,offBusKeys:next.offBusKeys.slice()}}));
   return true;
  }
  let channel=null;
  if(typeof win.BroadcastChannel==='function'){
   try{channel=new win.BroadcastChannel(CHANNEL);
    channel.onmessage=e=>{if(e?.data?.schema===SCHEMA)accept(e.data);};
   }catch(_){}
  }
  function write(raw,fromCockpit=false){
   const next=normalize(raw);if(!next)throw Error('Invalid bus failure payload');
   win.localStorage.setItem(KEY,JSON.stringify({...next,
    source:fromCockpit?'UNIFIED_CLEAR':next.source}));
   accept(next);channel?.postMessage(next);return next;
  }
  win.addEventListener('storage',e=>{
   if(e.key!==KEY)return;
   try{accept(JSON.parse(e.newValue||'null')||empty());}catch(_){}
  });
  if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',render,{once:true});
  else render();
  const state=Object.freeze({
   get:()=>({...current,offBusKeys:current.offBusKeys.slice()}),
   isUnavailable:(bus,voltage)=>current.active&&current.offBusKeys.includes(bus+'@'+voltage),
   clear:()=>write({...empty(),issuedAt:Date.now()},true),
   write,refresh:render,
   recompute:()=>win.dispatchEvent(new win.CustomEvent('b737:bus-failure-injection-changed',{
    detail:{active:current.active,offBusKeys:current.offBusKeys.slice(),initial:true}}))
  });
  win.__b737BusInjectionInstalled=state;
  api.live=state;
  return state;
 }
 const api={SCHEMA,KEY,CHANNEL,BUS_KEYS,DIRECT,normalize,payload,overlay,install,live:null};
 return api;
});
