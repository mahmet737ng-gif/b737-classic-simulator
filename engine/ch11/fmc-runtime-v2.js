/* Boeing 737 Classic - Chapter 11 standalone SIMULATOR FMS state model.
 * Source-indexed engineering implementation. NOT a Boeing software clone.
 * Explicitly refuses flight director/autopilot authority and unverified nav legs.
 * Reference: Sepehran B737CL FCOM Vol.2 Ch.11 (see functional-contract.v2.json).
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CH11_FMC_RUNTIME_V2=api;})(typeof window==='undefined'?null:window,function(){'use strict';
const SCHEMA='b737-ch11-fmc-state/2';
const AIRAC_MARKER='//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1';
const PHASES=Object.freeze(['PREFLIGHT','TAKEOFF','CLIMB','CRUISE','DESCENT','APPROACH','FLIGHT_COMPLETE']);
const STANDALONE='INTERNAL_B737_AIRCRAFT_STATE_BUS';
const KINDS=Object.freeze(['ALERT','ENTRY_ERROR','ADVISORY']);
const SEVERITY=Object.freeze({ALERT:0,ENTRY_ERROR:1,ADVISORY:2});
const ROUTE_FIELDS=Object.freeze(['ORIGIN','DEST','RUNWAY','CO_ROUTE','FLIGHT']);
function clone(x){return JSON.parse(JSON.stringify(x));}
function invariant(x,message){if(!x)throw Error(message);}
function airport(x){return typeof x==='string'&&/^[A-Z]{4}$/.test(x);}
function createState(config={}){
 invariant(config===null||typeof config==='object','CONFIG_INVALID');
 const aircraft=config?.aircraft||'EP-FSI';
 invariant(aircraft==='EP-FSI','AIRCRAFT_EFFECTIVITY_UNVERIFIED');
 return {schema:SCHEMA,aircraft,source:'SEPEHRAN_737CL_FCOM_VOL2_CH11',standalone:true,
  external_simulator_required:false,mode:'TRAINER_NO_GUIDANCE_AUTHORITY',
  aircraft_config:{variant:'737_CLASSIC_EP-FSI',fmc_installation:'UNVERIFIED',software_option:'UNVERIFIED'},
  page:'INDEX',phase:'PREFLIGHT',scratch:'',saved_scratch:'',messages:[],message_seq:0,
  route:{active:{ORIGIN:'',DEST:'',RUNWAY:'',CO_ROUTE:'',FLIGHT:''},draft:{},pending:{},activation_requested:false,discontinuities:[],source_procedure_status:'UNVERIFIED'},
  preflight:{position_verified:false,route_active:false,performance_verified:false,takeoff_verified:false},
  navdb:{airac:null,marker:null,source_status:'UNAVAILABLE',licensed_private:true},
  sensors:{frame:null,source_status:'UNAVAILABLE'},
  lights:{MSG:false,EXEC:false,CALL:false,FAIL:false,OFST:false,FMC_ALERT:false},
  guidance:{LNAV:false,VNAV:false,FD_AUTHORITY:false,AFDS_AUTHORITY:false,actuator_commands:[]},
  last_error:null,events:[]};
}
function presentationValue(s,k){const r=s.route; if(Object.prototype.hasOwnProperty.call(r.draft,k))return r.draft[k];if(Object.prototype.hasOwnProperty.call(r.pending,k))return r.pending[k];return r.active[k]??'';}
function topMessage(s){if(s.scratch&&s.scratch!=='DELETE')return null;
 return s.messages.filter(x=>!x.dismissed).sort((a,b)=>SEVERITY[a.kind]-SEVERITY[b.kind]||a.id-b.id)[0]||null;}
function recompute(s){const msg=topMessage(s);s.lights.MSG=!!msg;
 s.lights.EXEC=Object.keys(s.route.pending).length>0&&s.route.activation_requested;
 s.lights.FMC_ALERT=s.messages.some(x=>x.kind==='ALERT'&&!x.dismissed);
 // ALERT annunciator is distinct from the MSG light; no avionics bus is driven.
 s.lights.OFST=false; s.guidance.LNAV=false;s.guidance.VNAV=false;s.guidance.FD_AUTHORITY=false;s.guidance.AFDS_AUTHORITY=false;s.guidance.actuator_commands=[];}
function signal(s,name,reason){s.last_error=reason;s.events.push({name,reason});if(s.events.length>100)s.events.shift();}
function addMessage(s,msg){invariant(KINDS.includes(msg.kind),'MESSAGE_KIND_INVALID');invariant(typeof msg.text==='string'&&msg.text.length>0&&msg.text.length<=60,'MESSAGE_TEXT_INVALID');
 const id=++s.message_seq;
 if(msg.kind==='ENTRY_ERROR'){s.saved_scratch=s.scratch;s.scratch='';s.messages=s.messages.filter(x=>x.kind!=='ENTRY_ERROR');}
 s.messages.push({id,kind:msg.kind,text:msg.text,scope:msg.scope||'BOTH',dismissed:false,condition_active:msg.condition_active===true,source_rule:msg.source_rule||'REQUIRES_CAUSE_BINDING'});
 return id;}
function canPhase(s,event){if(event.bus_source!==STANDALONE||event.sensor_integrity!=='VALID'||event.confirmed!==true)return null;
 const tr={PREFLIGHT:{TOGA:'TAKEOFF'},TAKEOFF:{CLIMB_THRUST_SELECTED:'CLIMB'},CLIMB:{TOP_OF_CLIMB:'CRUISE'},CRUISE:{TOP_OF_DESCENT:'DESCENT'},DESCENT:{APPROACH_PHASE_ENTRY:'APPROACH'},APPROACH:{LANDED:'FLIGHT_COMPLETE',GO_AROUND:'CRUISE'}};
 return tr[s.phase]?.[event.name]||null;}
function dispatch(previous,event){invariant(previous?.schema===SCHEMA,'STATE_SCHEMA_INVALID');invariant(event&&typeof event.type==='string','EVENT_INVALID');
 const s=clone(previous);const effects=[];s.last_error=null;
 switch(event.type){
 case 'PAGE':invariant(typeof event.page==='string'&&/^[A-Z_]+$/.test(event.page),'PAGE_INVALID');s.page=event.page;break;
 case 'KEY_CHAR':{
  invariant(typeof event.character==='string'&&event.character.length===1&&/^[A-Z0-9.\/ ]$/i.test(event.character),'SCRATCH_CHAR_INVALID');
  if(s.scratch==='DELETE')s.scratch='';if(s.scratch.length<24)s.scratch+=event.character.toUpperCase();break;}
 case 'KEY_SIGN':{
  if(s.scratch[0]==='-')s.scratch='+'+s.scratch.slice(1);else if(s.scratch[0]==='+')s.scratch='-'+s.scratch.slice(1);else s.scratch='-'+s.scratch;break;}
 case 'KEY_DEL':s.scratch='DELETE';break;
 case 'KEY_CLR':{
  const m=topMessage(s);
  if(m){m.dismissed=true;if(m.kind==='ENTRY_ERROR'){s.scratch=s.saved_scratch;s.saved_scratch='';}break;}
  if(event.long_press===true){s.scratch='';break;}
  s.scratch=s.scratch==='DELETE'?'':s.scratch.slice(0,-1);break;}
 case 'RAISE_MESSAGE':addMessage(s,event);break;
 case 'CLEAR_MESSAGE_CONDITION':{
  const matches=s.messages.filter(m=>m.source_rule===event.source_rule);for(const m of matches){m.condition_active=false;m.dismissed=true;}break;}
 case 'STAGE_ROUTE_FIELD':{
  invariant(ROUTE_FIELDS.includes(event.field),'ROUTE_FIELD_UNKNOWN');
  invariant(typeof event.value==='string','ROUTE_FIELD_INVALID');const val=event.value.trim().toUpperCase();
  if(event.field==='ORIGIN'||event.field==='DEST')invariant(airport(val),'ICAO_INVALID');
  if(event.field==='RUNWAY')invariant(/^(0?[1-9]|[12]\d|3[0-6])[LRC]?$/.test(val),'RUNWAY_INVALID');
  if(event.field==='FLIGHT')invariant(/^[A-Z0-9]{2,9}$/.test(val),'FLIGHT_INVALID');
  if(event.field==='CO_ROUTE')invariant(!val||/^[A-Z0-9._-]{3,15}$/.test(val),'CO_ROUTE_INVALID');
  s.route.draft[event.field]=val;s.route.activation_requested=false;s.route.pending={};break;}
 case 'ACTIVATE_ROUTE':{
  const candidate={...s.route.active,...s.route.draft};
  invariant(airport(candidate.ORIGIN)&&airport(candidate.DEST),'RTE_ORIGIN_DEST_REQUIRED');
  invariant(candidate.ORIGIN!==candidate.DEST,'RTE_SAME_AIRPORT');
  invariant(Object.keys(s.route.draft).length>0,'NO_ROUTE_MODIFICATION');
  s.route.pending=clone(s.route.draft);s.route.activation_requested=true;break;}
 case 'EXECUTE':{
  if(!s.route.activation_requested||!Object.keys(s.route.pending).length){signal(s,'EXEC_REJECTED','NOT_ACTIVATED');break;}
  s.route.active={...s.route.active,...s.route.pending};s.route.draft={};s.route.pending={};s.route.activation_requested=false;
  s.preflight.route_active=true;effects.push({type:'FLIGHT_PLAN_REFERENCE_CHANGED',source:'CH11_STANDALONE',activate_flight_director:false});break;}
 case 'ERASE_MOD':s.route.draft={};s.route.pending={};s.route.activation_requested=false;break;
 case 'SET_DISCONTINUITIES':{
  invariant(Array.isArray(event.entries),'DISCONTINUITY_LIST_REQUIRED');
  invariant(event.entries.every(x=>Number.isInteger(x.index)&&x.index>=0&&typeof x.reason==='string'),'DISCONTINUITY_SCHEMA_INVALID');
  s.route.discontinuities=clone(event.entries);break;}
 case 'LOAD_PRIVATE_NAVDB':{
  invariant(event.airac==='2610'&&event.marker===AIRAC_MARKER&&event.source_provenance==='PRIVATE_VERIFIED_IMPORT','NAVDB_SOURCE_UNVERIFIED');
  s.navdb={airac:'2610',marker:AIRAC_MARKER,source_status:'PRIVATE_SOURCE_VERIFIED_NOT_ACTIVE_GUIDANCE',licensed_private:true};break;}
 case 'AIRCRAFT_SENSOR_FRAME':{
  invariant(event.bus_source===STANDALONE&&event.integrity==='VALID'&&Number.isFinite(event.lat)&&Number.isFinite(event.lon)&&Math.abs(event.lat)<=90&&Math.abs(event.lon)<=180,'SENSOR_SOURCE_OR_POSITION_INVALID');
  s.sensors={frame:{lat:event.lat,lon:event.lon,sim_time_s:event.sim_time_s??null},source_status:'INTERNAL_SIMULATOR_VALID_FOR_DISPLAY_ONLY'};break;}
 case 'NAV_SOURCE_FAILED':s.sensors={frame:null,source_status:'FAILED'};s.guidance.LNAV=false;s.guidance.VNAV=false;effects.push({type:'NAV_REFERENCE_STOP',reason:'SENSOR_INVALID'});break;
 case 'AIRCRAFT_PHASE_EVENT':{
  const target=canPhase(s,event);if(!target){signal(s,'PHASE_BLOCKED','MISSING_CONFIRMED_INTERNAL_AIRCRAFT_EVENT');break;}
  s.phase=target;if(target==='FLIGHT_COMPLETE'){s.route.active={ORIGIN:'',DEST:'',RUNWAY:'',CO_ROUTE:'',FLIGHT:''};s.route.draft={};s.route.pending={};s.preflight.route_active=false;}break;}
 case 'REQUEST_GUIDANCE':signal(s,'GUIDANCE_BLOCKED','EP_FSI_AFDS_AND_PROCEDURE_PATH_TERMINATORS_UNVERIFIED');break;
 default:invariant(false,'EVENT_NOT_SUPPORTED:'+event.type);
 }
 recompute(s);return {state:s,effects};
}
function view(s,page){invariant(s?.schema===SCHEMA,'STATE_SCHEMA_INVALID');
 const p=page||s.page;const val=k=>presentationValue(s,k)||'----';
 const common={page:p,title:p,phase:s.phase,source:'FCOM_CH11_SOURCE_INDEXED',active_route:s.route.active,
  display_message:topMessage(s)?.text||null,annunciators:clone(s.lights),afds_authority:false};
 if(p==='RTE')return {...common,ORIGIN:val('ORIGIN'),DEST:val('DEST'),RUNWAY:val('RUNWAY'),route_state:s.route.activation_requested?'MOD_READY_FOR_EXEC':Object.keys(s.route.draft).length?'DRAFT':'ACT'};
 if(p==='DEP_ARR')return {...common,ORIGIN:val('ORIGIN'),DEST:val('DEST')};
 if(p==='DEPARTURES')return {...common,airport:val('ORIGIN'),runway:val('RUNWAY'),procs:'PRIVATE_NAVDB_REQUIRED'};
 if(p==='ARRIVALS')return {...common,airport:val('DEST'),procs:'PRIVATE_NAVDB_REQUIRED'};
 if(p==='LEGS')return {...common,discontinuities:clone(s.route.discontinuities),status:'REFERENCE_ONLY_NOT_FLYABLE'};
 return common;
}
return Object.freeze({SCHEMA,AIRAC_MARKER,PHASES,createState,dispatch,view,topMessage,presentationValue});
});