/* B737 Classic multi-feed electrical topology authority.
 * Training-only functional bus/CB interpretation derived from generic MRG IV.6.
 * This is not a certified aircraft wiring diagram (WDM). A powered bus does
 * not command a device ON, and this layer never moves physical switches.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicMultifeedV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='ATA24-MULTIFEED-0001';
 const REQUIRED='ALL_REQUIRED',ANY='ANY_AVAILABLE',CHANNELS='INDEPENDENT_CHANNELS';
 const P=Object.freeze({
  'Autothrottle':{topology:REQUIRED,keys:['electronic1@115VAC','electronic1@28VDC']},
  'DAA2':{topology:REQUIRED,keys:['electronic2@115VAC','electronic2@28VDC']},
  'DME2':{topology:REQUIRED,keys:['electronic2@115VAC','electronic2@28VDC']},
  'Yaw Damper':{topology:REQUIRED,keys:['electronic1@115VAC','electronic1@28VDC']},
  'Window Heat Control - L1':{topology:REQUIRED,keys:['main1@115VAC','dc1@28VDC']},
  'Window Heat Control - L2 (L3)':{topology:REQUIRED,keys:['main2@115VAC','dc2@28VDC']},
  'Window Heat Control - R1':{topology:REQUIRED,keys:['main2@115VAC','dc2@28VDC']},
  'Window Heat Control - R2 (R3)':{topology:REQUIRED,keys:['main1@115VAC','dc1@28VDC']},
  'FMC':{topology:ANY,keys:['electronic1@115VAC','electronic2@115VAC','standby@115VAC']},
  'Audio Panel - Captain & FO & OBS':{topology:ANY,keys:['electronic2@28VDC','battery@28VDC']},
  'External Power Control':{topology:ANY,keys:['hotBattery@28VDC','battery@28VDC']},
  'Marker Beacons':{topology:ANY,keys:['battery@28VDC','electronic1@28VDC']},
  'Auto Slat Controller 1 / 2':{topology:CHANNELS,keys:['transfer1@28VAC','transfer2@28VAC']},
  'Auto Slat DC Controller 1 / 2':{topology:CHANNELS,keys:['dc1@28VDC','dc2@28VDC']},
  'FCC -A/ B':{topology:CHANNELS,keys:['electronic1@28VDC','electronic2@28VDC']},
  'Alpha Vane AoA - left':{topology:CHANNELS,keys:['main1@115VAC','transfer1@115VAC'],purposes:{
   'main1@115VAC':'ADDITIONAL_AOA_FEED_UNCONFIRMED',
   'transfer1@115VAC':'VANE_HEATER'}},
  'Alpha Vane AoA - right':{topology:CHANNELS,keys:['main2@115VAC','transfer2@115VAC'],purposes:{
   'main2@115VAC':'ADDITIONAL_AOA_FEED_UNCONFIRMED',
   'transfer2@115VAC':'VANE_HEATER'}}
 });
 const PROFILES=Object.freeze(P);
 const TRI=x=>x===true||x===false||x===null;
 const outcome=x=>x===true?'NORMAL':x===false?'OFF':'UNKNOWN';
 function validateIndex(index){
  if(!Array.isArray(index?.rows))throw Error('MRG consumer index rows required');
  const grouped=new Map();
  for(const row of index.rows){
   const set=grouped.get(row.item)||new Set();
   for(const bus of row.feedBus.split('|'))set.add(bus+'@'+row.feedVoltage);
   grouped.set(row.item,set);
  }
  const multi=[...grouped].filter(x=>x[1].size>1);
  if(multi.length!==Object.keys(P).length)throw Error(
   'Unclassified multi-feed devices: expected '+Object.keys(P).length+', found '+multi.length);
  for(const [name,profile] of Object.entries(P)){
   const found=grouped.get(name);
   if(!found||found.size!==profile.keys.length||
      profile.keys.some(key=>!found.has(key)))
    throw Error('MRG multi-feed source drift: '+name);
  }
  return {multifeedDevices:multi.length,required:8,alternate:4,independent:5,
   sourceRows:index.rows.length,logicalDevices:grouped.size};
 }
 function resolveDevice(name,entries,buses){
  const profile=P[name];
  if(!profile)return null;
  if(!Array.isArray(entries)||!entries.length||!buses)
   throw Error('Multi-feed inputs required for '+name);
  const feedMap=new Map();
  for(const entry of entries){
   const keys=entry.busKeys||entry.feedBus.split('|').map(k=>k+'@'+entry.feedVoltage);
   for(const key of keys){
    if(!profile.keys.includes(key))throw Error('Unexpected multi-feed bus: '+name+' / '+key);
    if(feedMap.has(key))throw Error('Duplicate multi-feed channel: '+name+' / '+key);
    if(!Object.hasOwn(buses,key))throw Error('Multi-feed bus not modelled: '+key);
    const raw=buses[key].powered;
    if(!TRI(raw))throw Error('Invalid multi-feed bus state: '+key);
    // OPEN means this row's CB-controlled feed is unavailable.
    // PARTIAL_OPEN is unresolved per-channel without a specific CB->feed map.
    const available=entry.cbState==='OPEN'?false:
     entry.cbState==='PARTIAL_OPEN'||entry.cbState==='UNKNOWN'?null:raw;
    feedMap.set(key,Object.freeze({
     key,sourceRowId:entry.id,powered:available,status:outcome(available),
     busPowered:raw,cbState:entry.cbState,
     purpose:profile.purposes?.[key]||'ELECTRICAL_SUPPLY',
     mappingQuality:profile.purposes?.[key]?.includes('UNCONFIRMED')?
       'FUNCTION_UNCONFIRMED':'MRG_GENERIC_TOPOLOGY'
    }));
   }
  }
  if(feedMap.size!==profile.keys.length||
    profile.keys.some(key=>!feedMap.has(key)))
   throw Error('Incomplete multi-feed topology for '+name);
  const feeds=profile.keys.map(key=>feedMap.get(key));
  const live=feeds.filter(f=>f.powered===true).length;
  const lost=feeds.filter(f=>f.powered===false).length;
  const unknown=feeds.length-live-lost;
  let state;
  if(profile.topology===REQUIRED)
   state=lost?'OFF':unknown?'UNKNOWN':'NORMAL';
  else if(profile.topology===ANY)
   state=live?'NORMAL':lost===feeds.length?'OFF':'UNKNOWN';
  else state=lost===feeds.length?'OFF':
   live===feeds.length?'NORMAL':unknown?'UNKNOWN':'DEGRADED';
  // Independent channels do not magically backfeed one another.
  // The unverified extra AoA feed is NOT a heater fallback.
  const capabilities={};
  for(const f of feeds)capabilities[f.purpose==='ELECTRICAL_SUPPLY'?f.key:f.purpose]=f.powered;
  if(profile.topology===REQUIRED)capabilities.DEVICE_POWER=state==='NORMAL'?true:state==='OFF'?false:null;
  if(profile.topology===ANY)capabilities.DEVICE_POWER=state==='NORMAL'?true:state==='OFF'?false:null;
  if(profile.topology===CHANNELS)capabilities.DEVICE_POWER=state==='OFF'?false:
   state==='NORMAL'?true:null;
  const effect=state==='NORMAL'?'ELECTRICAL_FUNCTION_AVAILABLE':
   state==='UNKNOWN'?'ELECTRICAL_AVAILABILITY_UNRESOLVED':
   state==='DEGRADED'?'INDEPENDENT_CHANNEL_LOSS':
   profile.topology===REQUIRED?'REQUIRED_FEED_LOST':
   profile.topology===ANY?'ALL_ALTERNATE_FEEDS_LOST':'ALL_CHANNELS_LOST';
  return {name,topology:profile.topology,state,effect,
   feedChannels:feeds,capabilities,liveFeeds:live,lostFeeds:lost,unknownFeeds:unknown,
   sourceQuality:name.startsWith('Alpha Vane AoA')?
    'MAIN_AOA_FUNCTION_UNCONFIRMED;HEATER_TRANSFER_FEED':'GENERIC_MRG_IV6_NOT_AIRFRAME_WDM'};
 }
 return Object.freeze({VERSION,ALL_REQUIRED:REQUIRED,ANY_AVAILABLE:ANY,
  INDEPENDENT_CHANNELS:CHANNELS,PROFILES,validateIndex,resolveDevice});
});