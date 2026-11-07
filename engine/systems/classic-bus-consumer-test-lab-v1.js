/* Independent B737 Classic bus-loss test bench. No shared electrical writes.
 * Every toggle is a laboratory distribution-bus interruption. Cascading
 * bus dependencies are derived from V7 normal source/tie/standby topology.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737BusConsumerTestLabV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='BUS-LAB-0001';
 const BASELINES=Object.freeze(['ALL_ON','NOMINAL_V7']);
 const SOURCE={
  'generator1@115VAC':[],
  'generator2@115VAC':[],
  'main1@115VAC':['generator1@115VAC'],
  'main2@115VAC':['generator2@115VAC'],
  'transfer1@115VAC':['generator1@115VAC','generator2@115VAC'],
  'transfer2@115VAC':['generator1@115VAC','generator2@115VAC'],
  'dc1@28VDC':['transfer1@115VAC','transfer2@115VAC'],
  'dc2@28VDC':['transfer1@115VAC','transfer2@115VAC'],
  'battery@28VDC':[],
  'hotBattery@28VDC':[],
  'switchedHotBattery@28VDC':['hotBattery@28VDC'],

  'groundService@115VAC':['generator1@115VAC','external@115VAC'],
  'external@115VAC':[],
  'electronic1@115VAC':['generator1@115VAC'],
  'electronic2@115VAC':['generator2@115VAC'],
  'electronic1@28VDC':['dc1@28VDC'],
  'electronic2@28VDC':['dc2@28VDC'],
  'transfer1@28VAC':['transfer1@115VAC'],
  'transfer2@28VAC':['transfer2@115VAC'],
  'main1@28VAC':['main1@115VAC'],
  'main2@28VAC':['main2@115VAC'],
  'groundService@28VAC':['groundService@115VAC'],
  'standby@115VAC':['transfer1@115VAC','dc1@28VDC'],
  'standby@28VDC':['transfer1@115VAC','dc1@28VDC']
 };
 const AND=new Set(['standby@115VAC','standby@28VDC']);
 function checkSources(names){
  const declared=Object.keys(SOURCE);
  if(names.length!==declared.length||declared.some(n=>!names.includes(n))||
   names.some(n=>!Object.hasOwn(SOURCE,n)))
   throw Error('Lab bus registry must match the exact functional 24 bus-class nodes');
  for(const [key,parents] of Object.entries(SOURCE))
   for(const parent of parents)if(!Object.hasOwn(SOURCE,parent))
    throw Error('Missing bus dependency '+key+' / '+parent);
  return true;
 }
 function calculatePower(reference,forcedOff=[],baseline='ALL_ON',cascade=false){
  if(!BASELINES.includes(baseline)||typeof cascade!=='boolean')throw Error('Unknown laboratory baseline or cascade mode');
  if(!reference||typeof reference!=='object'||Array.isArray(reference))
   throw Error('Reference bus states required');
  const keys=Object.keys(reference);
  checkSources(keys);
  if(!Array.isArray(forcedOff)||new Set(forcedOff).size!==forcedOff.length)
   throw Error('Invalid or duplicate bus interruptions');
  for(const name of forcedOff)if(!Object.hasOwn(SOURCE,name))
   throw Error('Unknown laboratory bus '+name);
  const cuts=new Set(forcedOff),memo={},visiting=new Set();
  const enabled=id=>{
   if(Object.hasOwn(memo,id))return memo[id];
   if(visiting.has(id))throw Error('Cyclic bus topology '+id);
   if(cuts.has(id))return memo[id]=false;
   visiting.add(id);
   const raw=reference[id]?.powered;
   if(raw!==true&&raw!==false&&raw!==null)throw Error('Invalid source bus value '+id);
   const own=baseline==='ALL_ON'?true:raw===true;
   // A baseline UNKNOWN remains off only in this explicitly binary ON/OFF
   // laboratory view; no observation is asserted in the live simulator.
   const dependencies=SOURCE[id];
   const supply=!cascade||!dependencies.length?true:AND.has(id)?
     dependencies.every(enabled):dependencies.some(enabled);
   visiting.delete(id);
   return memo[id]=own&&supply;
  };
  for(const key of keys)enabled(key);
  return memo;
 }
 function makeSession({Core,Electrical,index,mode='CONVENTIONAL',
  pressurization='DCPCS',aircraftModel='737-300',cbAvailable=null}={}){
  if(!Core?.project||!Core?.defineBuses||!Electrical?.initialState||!Electrical?.evaluate)
   throw Error('Classic consumer model and Electrical V7 are required');
  Core.validate(index);
  const source=Electrical.initialState({coldDark:false});
  const evaluated=Electrical.evaluate(source);
  const reference=Core.defineBuses(evaluated,{electricalState:source});
  checkSources(Object.keys(reference));
  let baseline='ALL_ON',cascade=false,off=new Set(),config={mode,pressurization,aircraftModel};
  const update=()=>Core.project({index,electrical:evaluated,electricalState:source,
    labBusPower:calculatePower(reference,[...off],baseline,cascade),...config,cbAvailable});
  let snapshot=update();
  return Object.freeze({
   get version(){return VERSION;},
   get buses(){return Object.keys(reference);},
   get baseline(){return baseline;},
   get cascade(){return cascade;},
   setCascade(enabled){
    if(typeof enabled!=='boolean')throw Error('Invalid cascade mode');
    cascade=enabled;snapshot=update();return snapshot;
   },
   get disabled(){return [...off];},
   get options(){return {...config};},
   snapshot:()=>snapshot,
   toggle(bus){
    if(!Object.hasOwn(reference,bus))throw Error('Unknown bus '+bus);
    if(off.has(bus))off.delete(bus);else off.add(bus);
    snapshot=update();return snapshot;
   },
   set(bus,energized){
    if(!Object.hasOwn(reference,bus)||typeof energized!=='boolean')
     throw Error('Invalid bus state');
    if(energized)off.delete(bus);else off.add(bus);
    snapshot=update();return snapshot;
   },
   all(energized){
    if(typeof energized!=='boolean')throw Error('Invalid global bus command');
    baseline='ALL_ON';off=new Set(energized?[]:Object.keys(reference));
    snapshot=update();return snapshot;
   },
   restore(){
    baseline='ALL_ON';off.clear();snapshot=update();return snapshot;
   },
   selectBaseline(next){
    if(!BASELINES.includes(next))throw Error('Unknown baseline');
    baseline=next;off.clear();snapshot=update();return snapshot;
   },
   configure(next){
    config={...config,...next};
    snapshot=update();return snapshot;
   },
   get busStates(){return calculatePower(reference,[...off],baseline,cascade);}
  });
 }
 return Object.freeze({VERSION,BASELINES,SOURCE,checkSources,
  calculatePower,makeSession});
});
