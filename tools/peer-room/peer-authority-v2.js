'use strict';
(function(root){
const STORED_CONTROL_TYPES = new Set([
  'toggle','rotary','guard','mcpValue','mcpHardware','efis','frequency',
  'commTransfer','navMode','autobrake','trim','flap','gear',
  'speedbrake','startLever','throttle','cb','clock','engineFailure'
]);
const SCENARIO_REPORT_KEYS = /^[a-zA-Z0-9_:-]{1,72}$/;
const INVALIDATED_BY_SCENARIO = new Set([
  'flap','gear','autobrake','speedbrake','throttle','startLever',
  'mcpMode','mcpValue','mcpHardware','trim','frequency','navMode','commTransfer','engineFailure'
]);
const FINAL10_OVERHEAD_IDS = new Set([
  'bleed-apu','bleed-eng-1','bleed-eng-2','pack-l','pack-r',
  'isolation-valve','gen-1','gen-2','apu-gen-1','apu-gen-2','apu-start',
  'landing-out-l','landing-out-r','landing-in-l','landing-in-r',
  'strobe','position-lights','anti-collision','logo','wing-lights',
  'runway-turnoff-l','runway-turnoff-r','taxi'
]);
function invalidatedByScenario(command,scenario) {
  if (!scenario || command.sequence >= scenario.generation) return false;
  return INVALIDATED_BY_SCENARIO.has(command.type) ||
    (scenario.config.preset === 'FINAL_10' &&
     ['toggle','rotary'].includes(command.type) &&
     FINAL10_OVERHEAD_IDS.has(command.id));
}
function sharedState(room) {
  const base = room.snapshot?.overhead;
  const overhead = {
    toggles: {...(base?.toggles ?? {})},
    rotaries: {...(base?.rotaries ?? {})},
    guards: {...(base?.guards ?? {})}
  };
  const controls = [];
  for (const entry of room.sharedControls.values()) {
    if (entry.type === 'toggle') overhead.toggles[entry.id] = entry.value;
    else if (entry.type === 'rotary') overhead.rotaries[entry.id] = entry.value;
    else if (entry.type === 'guard') overhead.guards[entry.id] = {
      guard: entry.value.open ? 'open' : 'closed', value: entry.value.value
    };
    else controls.push(entry);
  }
  controls.sort((a,b) => a.sequence-b.sequence);
  return {sequence:room.sequence, overhead, controls, snapshotSequence:room.snapshot?.sequence ?? 0};
}
function publicScenario(room) {
  const scenario = room.scenario;
  if (!scenario) return {active:false};
  return {active:true,generation:scenario.generation,config:scenario.config,
    ready:scenario.ready, reports:scenario.reports};
}
const CONTROL_ID = /^[a-zA-Z0-9_.|:-]{1,72}$/;
const CONTROL_TYPES = new Set([
  'toggle', 'rotary', 'guard', 'mcpValue', 'mcpHardware', 'mcpMode',
  'gear', 'throttle', 'flap', 'speedbrake', 'startLever', 'toga',
  'loadFlight', 'flightTargets', 'pauseFlight', 'stopFlight',
  'failure', 'failureScenario', 'engineFailure', 'profile', 'efis', 'cdu',
  'frequency', 'commTransfer', 'navMode', 'autobrake', 'trim', 'firePanel', 'cb', 'clock', 'sixpack'
]);

function controlValue(value) {
  return typeof value === 'boolean' || Number.isFinite(value) ||
    typeof value === 'string' && value.length <= 72;
}

function crewCommand(data) {
  const {type, id, value} = data ?? {};
  if (!CONTROL_TYPES.has(type) || typeof id !== 'string' || !CONTROL_ID.test(id)) {
    throw new RequestError(400, 'Unknown cockpit command.');
  }
  if(type==='engineFailure'){
    if(!['engine1','engine2'].includes(id)||!['FLAME_OUT','FIRE','SEVERE_DAMAGE','SEPARATION'].includes(value))throw new RequestError(400,'Invalid engine failure.');
    return {type,id,value};
  }
  if (type === 'clock') {
    const nums=['at','utc','et','ch','dateAge','setAge','resetAge','resetFrom'];
    if (!['captain','firstOfficer'].includes(id) || !value || typeof value !== 'object' ||
        !['RUN','HLD','RESET'].includes(value.es) || !['RUN','HLD','RESET'].includes(value.cs) ||
        !['RUN','HLD','MS','HS'].includes(value.gs) || typeof value.dateMode !== 'boolean' ||
        !nums.every(k=>Number.isFinite(value[k])) || value.et<0 || value.ch<0 ||
        value.dateAge<0 || value.setAge<0 || value.resetAge<0)
      throw new RequestError(400,'Invalid shared clock state.');
    return {type,id,value:Object.fromEntries([...nums,'es','cs','gs','dateMode'].map(k=>[k,value[k]]))};
  }
  if (type === 'sixpack') {
    if (!['ack','fireAck','recall','hold','release'].includes(id) ||
        !['CAPT','FO'].includes(value)) throw new RequestError(400,'Invalid caution command.');
    return {type,id,value};
  }
  if (controlValue(value)) return {type, id, value};
  if (type === 'guard' && typeof value?.open === 'boolean' && controlValue(value.value)) {
    return {type, id, value: {open: value.open, value: value.value}};
  }
  if (['loadFlight', 'flightTargets', 'failureScenario', 'profile', 'firePanel'].includes(type) &&
      value && !Array.isArray(value) && typeof value === 'object' &&
      Object.keys(value).length <= 12 && Object.entries(value).every(([key, item]) =>
        CONTROL_ID.test(key) && controlValue(item))) return {type, id, value};
  throw new RequestError(400, 'Invalid cockpit value.');
}

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}


const copy=x=>JSON.parse(JSON.stringify(x));
function createAuthority(roomId,emit,now=Date.now){
 const room={sequence:0,snapshot:null,flight:null,scenario:null,sharedControls:new Map(),receipts:new Map(),clients:new Map()};
 function roster(role){return {roomId,role,manager:role==='captain',controller:'captain',flying:'captain',counts:{captain:1,firstOfficer:1,instructor:0,observer:0}};}
 function get(role){return {...roster(role),shared:copy(sharedState(room)),scenario:copy(publicScenario(room)),flight:room.flight?copy(room.flight):null,serverAt:now()};}
 function request(role,action,data){
  if(!['captain','firstOfficer'].includes(role)||data.roomId!==roomId||typeof data.client!=='string'||!/^[a-zA-Z0-9_-]{12,64}$/.test(data.client))throw Error('Invalid peer session');
  if(action==='cockpit'){const existing=room.clients.get(role);if(existing&&existing!==data.client)throw Error('Seat already occupied');room.clients.set(role,data.client);return get(role);}
  if(room.clients.get(role)!==data.client)throw Error('Seat not registered');
  if(action==='snapshot'){
   if(role!=='captain')throw Error('Only Captain can publish snapshot');
   const oh=data.overhead;if(!oh||!['toggles','rotaries','guards'].every(k=>oh[k]&&typeof oh[k]==='object'&&!Array.isArray(oh[k])))throw Error('Invalid overhead state');
   room.snapshot={sequence:room.sequence,client:data.client,overhead:copy(oh)};
   room.snapshot.overhead=sharedState(room).overhead;
   emit('snapshot',copy(room.snapshot));return {sequence:room.sequence};
  }
  if(action==='flight'){
   if(role!=='captain'||!data.state||!Number.isFinite(data.state.altitudeFt)||!Number.isFinite(data.state.iasKt)||typeof data.paused!=='boolean')throw Error('Invalid flight authority');
   room.flight={client:data.client,state:copy(data.state),paused:data.paused,serverAt:now(),generation:room.scenario?.generation??0,flightSerial:(room.flight?.flightSerial??0)+1};
   emit('flight',copy(room.flight));return {};
  }
  if(action==='applied')return {sequence:data.sequence,status:data.status};
  if(action==='scenarioStatus'){
   if(!room.scenario||room.scenario.generation!==data.generation)throw Error('The flight scenario has changed.');
   if(!Array.isArray(data.missing)||data.missing.length>64)throw Error('Invalid readiness report');
   const missing=data.missing.filter(v=>typeof v==='string').slice(0,64);
   room.scenario.reports[role]={complete:data.complete===true&&!missing.length,missing};
   room.scenario.ready=['captain','firstOfficer'].every(r=>room.scenario.reports[r]?.complete===true);
   emit('scenario',copy(publicScenario(room)));return {generation:data.generation,ready:room.scenario.ready};
  }
  if(action!=='command'||!Array.isArray(data.commands)||!data.commands.length||data.commands.length>24)throw Error('Invalid peer command batch');
  const results=[];
  for(const item of data.commands){
   try{
    if(!item||typeof item.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,88}$/.test(item.requestId))throw Error('Invalid command ID');
    const command=crewCommand(item.command),key=data.client+':'+item.requestId,old=room.receipts.get(key);
    if(old){if(JSON.stringify(old.command)!==JSON.stringify(command))throw Error('Duplicate command ID conflict');results.push({sequence:old.sequence,duplicate:true});continue;}
    if(['failure','failureScenario'].includes(command.type))throw Error('Instructor role is not available in this trial');
    if(command.type==='profile'&&role!=='captain')throw Error('Only Captain can set aircraft profile');
    if(command.type==='pauseFlight'&&command.value===false&&room.scenario?.config.preset==='FINAL_10'&&!room.scenario.ready)throw Error('Both pilots must be ready for FINAL 10');
    const entry={...copy(command),client:data.client,requestId:item.requestId,sequence:++room.sequence,serverAt:now()};
    if(STORED_CONTROL_TYPES.has(entry.type))room.sharedControls.set(entry.type+':'+entry.id,entry);
    if(entry.type==='loadFlight'){
     room.scenario={generation:entry.sequence,config:entry.value,reports:{},ready:false};room.snapshot=null;room.flight=null;
     for(const [key,value] of room.sharedControls)if(invalidatedByScenario(value,room.scenario))room.sharedControls.delete(key);
    }else if(entry.type==='stopFlight'){room.scenario=null;room.flight=null;}
    room.receipts.set(key,{command,sequence:entry.sequence});
    if(room.receipts.size>3500)room.receipts.delete(room.receipts.keys().next().value);
    emit('command',copy(entry));
    if(['loadFlight','stopFlight'].includes(entry.type))emit('scenario',copy(publicScenario(room)));
    results.push({sequence:entry.sequence});
   }catch(e){results.push({error:e.message});}
  }
  return {results};
 }
 return {request,get,room};
}
const api=Object.freeze({createAuthority});
if(typeof module==='object'&&module.exports)module.exports=api;
else root.B737PeerAuthorityV2=api;
})(typeof globalThis==='object'?globalThis:this);
