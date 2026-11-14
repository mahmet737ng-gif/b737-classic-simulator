/* B737 Classic ATA24: event-driven electrical delta dispatch; no polling. */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicElectricalEventHubV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='ATA24-EVENT-HUB-0001';
 const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
 const caps=d=>JSON.stringify(d?.capabilities||{});
 const feeds=d=>(d?.feedChannels||[]).map(x=>x.key+':'+x.status+':'+x.cbState).join('|');
 const channels=['bus','device','consumer','capability','system'];
 function createHub(){
  let previous=null,sequence=0;
  const handlers=Object.fromEntries(channels.map(k=>[k,new Map()]));
  const stats={accepted:0,unchanged:0,busChanges:0,deviceChanges:0,consumerChanges:0,capabilityChanges:0,systemChanges:0,callbacks:0};
  const keyFor=(name,purpose)=>JSON.stringify([name,purpose]);
  function value(type,key,snap){
   if(!snap)return null;
   if(type==='bus')return snap.buses[key]||null;
   if(type==='device')return snap.devices[key]||null;
   if(type==='consumer')return snap.consumers[key]||null;
   if(type==='system')return snap.systems[key]||null;
   if(type==='capability'){
    const [name,purpose]=JSON.parse(key),obj=snap.devices[name]?.capabilities;
    return obj&&Object.hasOwn(obj,purpose)?{name,purpose,available:obj[purpose]}:null;
   }
   return null;
  }
  function sendOne(fn,data){
   try{fn(Object.freeze(data));stats.callbacks++;}
   catch(e){if(typeof console!=='undefined')console.warn('ATA24 subscriber callback',e);}
  }
  function emit(type,key,data){
   for(const cb of handlers[type].get(key)||[])sendOne(cb,data);
  }
  function register(type,key,cb,{immediate=true}={}){
   if(typeof cb!=='function'||typeof key!=='string'||!key)
    throw Error('Invalid electrical subscription');
   if(!handlers[type].has(key))handlers[type].set(key,new Set());
   handlers[type].get(key).add(cb);
   if(immediate&&previous){
    const v=value(type,key,previous);
    if(v!==null)sendOne(cb,{type:'INITIAL',target:key,previous:null,
     value:clone(v),sequence,reason:'CURRENT_SNAPSHOT'});
   }
   return ()=>{const set=handlers[type].get(key);if(!set)return;
    set.delete(cb);if(!set.size)handlers[type].delete(key);};
  }
  function publish(snap,{reason='ELECTRICAL_CHANGE'}={}){
   if(!snap?.buses||!snap.devices||!snap.consumers||!snap.systems)
    throw Error('Complete electrical snapshot required');
   if(!previous){
    previous=snap;stats.accepted++;sequence++;
    for(const type of channels)for(const [key,set]of handlers[type]){
     const v=value(type,key,snap);
     if(v!==null)for(const fn of set)sendOne(fn,{type:'INITIAL',
      target:key,previous:null,value:clone(v),sequence,reason});
    }
    return {changed:true,initial:true,buses:[],devices:[],consumers:[],systems:[]};
   }
   const busKeys=Object.keys(snap.buses).filter(k=>
    previous.buses[k]?.powered!==snap.buses[k].powered);
   const devNames=Object.keys(snap.devices).filter(k=>{
    const a=previous.devices[k],b=snap.devices[k];
    return !a||a.state!==b.state||a.topology!==b.topology||
     feeds(a)!==feeds(b)||caps(a)!==caps(b);
   });
   const rowIds=Object.keys(snap.consumers).filter(k=>{
    const a=previous.consumers[k],b=snap.consumers[k];
    return !a||a.powerState!==b.powerState||a.cbState!==b.cbState;
   });
   const sysNames=Object.keys(snap.systems).filter(k=>
    previous.systems[k]?.state!==snap.systems[k].state);
   if(!busKeys.length&&!devNames.length&&!rowIds.length&&!sysNames.length){
    stats.unchanged++;return {changed:false,initial:false,buses:[],devices:[],consumers:[],systems:[]};
   }
   const old=previous;previous=snap;sequence++;stats.accepted++;
   const meta={sequence,reason};
   for(const key of busKeys){
    const powered=snap.buses[key].powered;
    emit('bus',key,{...meta,target:key,type:powered===true?'POWER_RESTORED':
     powered===false?'POWER_LOST':'POWER_UNKNOWN',
     previous:old.buses[key]?.powered??null,value:powered});
   }
   let capabilityChanges=0;
   for(const name of devNames){
    const before=old.devices[name],now=snap.devices[name];
    emit('device',name,{...meta,type:'DEVICE_FEED_CHANGED',target:name,
     previous:clone(before),value:clone(now),changedBusKeys:busKeys});
    const previousCaps=before?.capabilities||{},currentCaps=now.capabilities||{};
    for(const purpose of new Set([...Object.keys(previousCaps),...Object.keys(currentCaps)])){
     if(previousCaps[purpose]===currentCaps[purpose])continue;
     capabilityChanges++;
     emit('capability',keyFor(name,purpose),{...meta,type:'CAPABILITY_CHANGED',
      name,purpose,target:keyFor(name,purpose),
      previous:previousCaps[purpose]??null,value:currentCaps[purpose]??null,changedBusKeys:busKeys});
    }
   }
   for(const id of rowIds)emit('consumer',id,{...meta,type:'CONSUMER_POWER_CHANGED',
    target:id,previous:clone(old.consumers[id]),value:clone(snap.consumers[id]),changedBusKeys:busKeys});
   for(const id of sysNames)emit('system',id,{...meta,type:'SYSTEM_POWER_CHANGED',
    target:id,previous:old.systems[id]?.state??null,value:snap.systems[id].state,changedBusKeys:busKeys});
   stats.busChanges+=busKeys.length;stats.deviceChanges+=devNames.length;
   stats.consumerChanges+=rowIds.length;stats.capabilityChanges+=capabilityChanges;
   stats.systemChanges+=sysNames.length;
   return {changed:true,initial:false,buses:busKeys,devices:devNames,consumers:rowIds,systems:sysNames};
  }
  return Object.freeze({version:VERSION,publish,
   subscribeBus:(key,fn,opts)=>register('bus',key,fn,opts),
   subscribeDevice:(key,fn,opts)=>register('device',key,fn,opts),
   subscribeConsumer:(key,fn,opts)=>register('consumer',key,fn,opts),
   subscribeSystem:(key,fn,opts)=>register('system',key,fn,opts),
   subscribeCapability:(name,purpose,fn,opts)=>register('capability',keyFor(name,purpose),fn,opts),
   getBus:key=>clone(value('bus',key,previous)),
   getDevice:key=>clone(value('device',key,previous)),
   getStats:()=>({...stats,sequence,activeSubscriptions:Object.values(handlers).reduce(
    (n,map)=>n+[...map.values()].reduce((m,set)=>m+set.size,0),0)}),
   get initialized(){return !!previous;}
  });
 }
 return Object.freeze({VERSION,createHub});
});