/* B737 Classic architecture checkpoint: a transaction-safe host for existing system engines.
 * No cockpit artwork or aircraft wiring is changed here. Training only.
 * Adapters must be deterministic/pure: initialState(), apply(state,envelope), project(state,dependencies),
 * optional tick(state,dtMs,dependencies); owns[] and dependsOn[] are explicit.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AircraftSessionV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};
 const fail=m=>{throw Error(m);};
 function sort(adapters){
  const ids=new Set(), owners=new Set();
  for(const a of adapters){
   if(!a||typeof a.id!=='string'||!a.id||ids.has(a.id))fail('Duplicate or invalid system ID');
   if(!Array.isArray(a.owns)||!a.owns.length||!Array.isArray(a.dependsOn)||
      !['initialState','apply','project'].every(k=>typeof a[k]==='function'))fail('Invalid adapter '+a.id);
   ids.add(a.id);
   for(const p of a.owns){if(typeof p!=='string'||!p||owners.has(p))fail('Duplicate or invalid state owner '+p);owners.add(p);}
  }
  for(const a of adapters)for(const d of a.dependsOn)if(!ids.has(d)||d===a.id)fail('Missing or self dependency '+d);
  const remaining=[...adapters],ordered=[];
  while(remaining.length){const n=remaining.findIndex(a=>a.dependsOn.every(id=>ordered.some(b=>b.id===id)));
   if(n<0)fail('Cyclic system dependency');ordered.push(remaining.splice(n,1)[0]);}
  return ordered;
 }
 function envelope(c){
  if(!plain(c)||typeof c.id!=='string'||!c.id||c.id.length>128||
     !['COCKPIT','SCENARIO','INSTRUCTOR'].includes(c.actor)||
     typeof c.target!=='string'||!plain(c.action)||typeof c.action.type!=='string')
    fail('Invalid aircraft command envelope');
  return copy(c);
 }
 class Session{
  constructor({adapters=[],profile='B737-300',scenario='COLD_DARK'}={}){
   if(!['B737-300','B737-400','B737-500'].includes(profile)||typeof scenario!=='string'||!scenario)fail('Invalid profile or scenario');
   this.adapters=sort(adapters);this.byId=new Map(this.adapters.map(a=>[a.id,a]));
   this.profile=profile;this.scenario=scenario;this.reset();
  }
  _initial(){
   const state={};for(const a of this.adapters){const v=a.initialState({profile:this.profile,scenario:this.scenario});
    if(!plain(v))fail('Invalid initial state for '+a.id);state[a.id]=copy(v);}
   return state;
  }
  _project(states,timeMs,revision){
   const projected={};
   for(const a of this.adapters){
    const deps=Object.fromEntries(a.dependsOn.map(id=>[id,copy(projected[id])]));
    const result=a.project(freeze(copy(states[a.id])),freeze(deps),{profile:this.profile,scenario:this.scenario,timeMs});
    if(!plain(result))fail('Invalid projection for '+a.id);
    projected[a.id]=copy(result);
   }
   return freeze({schema:'b737-aircraft-snapshot/1',profile:this.profile,scenario:this.scenario,
    revision,timeMs,systems:projected});
  }
  reset(){
   const states=this._initial(),snapshot=this._project(states,0,0);
   this.states=states;this.current=snapshot;this.timeMs=0;this.revision=0;
   this.events=[];this.seen=new Map();return this.snapshot();
  }
  snapshot(){return copy(this.current);}
  audit(){return {owners:this.adapters.flatMap(a=>a.owns.map(path=>({path,owner:a.id}))),
   order:this.adapters.map(a=>a.id),events:this.events.length,revision:this.revision,
   commandsSeen:this.seen.size};}
  _runBatch(commands,{record=true}={}){
   if(!Array.isArray(commands)||!commands.length)fail('Nonempty command batch required');
   const states=copy(this.states),seen=new Map(this.seen),events=this.events.map(copy);
   let rev=this.revision;let applied=0;
   for(const raw of commands){
    const c=envelope(raw);const serialized=JSON.stringify(c);
    if(seen.has(c.id)){
     if(seen.get(c.id)!==serialized)fail('Command ID collision '+c.id);
     continue; // Idempotent retry, no side effects.
    }
    if(seen.size>=10000)fail('Command ID capacity exceeded; reset session');
    const adapter=this.byId.get(c.target);if(!adapter)fail('Unknown system '+c.target);
    const next=adapter.apply(freeze(copy(states[adapter.id])),freeze(copy(c)),{profile:this.profile,scenario:this.scenario,timeMs:this.timeMs});
    if(!plain(next))fail('Invalid next state for '+adapter.id);
    states[adapter.id]=copy(next);seen.set(c.id,serialized);rev++;applied++;
    if(record)events.push({revision:rev,timeMs:this.timeMs,command:c});
   }
   const snapshot=this._project(states,this.timeMs,rev); // projection failure rolls back the whole batch
   this.states=states;this.current=snapshot;this.revision=rev;this.seen=seen;
   this.events=events.slice(-1000);return {applied,duplicate:commands.length-applied,snapshot:this.snapshot()};
  }
  dispatch(command){return this._runBatch([command]);}
  dispatchBatch(commands){return this._runBatch(commands);}
  advance(ms){
   if(!Number.isSafeInteger(ms)||ms<0||ms>1000)fail('Clock step must be 0..1000 integer milliseconds');
   if(ms===0)return this.snapshot(); // no phantom revision/event
   const states=copy(this.states),timeMs=this.timeMs+ms;
   if(!Number.isSafeInteger(timeMs))fail('Simulation clock overflow');
   const projected={};
   for(const a of this.adapters){
    const deps=Object.fromEntries(a.dependsOn.map(id=>[id,copy(projected[id])]));
    if(typeof a.tick==='function'){
     const next=a.tick(freeze(copy(states[a.id])),ms,freeze(deps),{profile:this.profile,scenario:this.scenario,timeMs});
     if(!plain(next))fail('Invalid tick state '+a.id);states[a.id]=copy(next);
    }
    const p=a.project(freeze(copy(states[a.id])),freeze(deps),{profile:this.profile,scenario:this.scenario,timeMs});
    if(!plain(p))fail('Invalid tick projection '+a.id);projected[a.id]=copy(p);
   }
   const snapshot=freeze({schema:'b737-aircraft-snapshot/1',profile:this.profile,scenario:this.scenario,
    revision:this.revision+1,timeMs,systems:projected});
   this.states=states;this.timeMs=timeMs;this.revision++;this.current=snapshot;
   this.events.push({kind:'TICK',revision:this.revision,timeMs,dtMs:ms});
   this.events=this.events.slice(-1000);return this.snapshot();
  }
  replay(commands){
   if(!Array.isArray(commands))fail('Replay command list required');
   const fresh=new Session({adapters:this.adapters,profile:this.profile,scenario:this.scenario});
   // Replay is atomic relative to the original session.
   for(const item of commands){if(plain(item)&&'command'in item){
    if(!Number.isSafeInteger(item.timeMs)||item.timeMs<fresh.timeMs)fail('Invalid replay clock');
    while(fresh.timeMs<item.timeMs)fresh.advance(Math.min(1000,item.timeMs-fresh.timeMs));
    fresh.dispatch(item.command);
   }else fresh.dispatch(item);}
   this.states=fresh.states;this.current=fresh.current;this.timeMs=fresh.timeMs;
   this.revision=fresh.revision;this.seen=fresh.seen;this.events=fresh.events;
   return this.snapshot();
  }
 }
 return Object.freeze({Session,sort});
});
