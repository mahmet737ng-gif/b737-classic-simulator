'use strict';
// CDU standalone *partial* deterministic core; no actual aircraft coupling.
const FIELD_RE={ORIGIN:/^[A-Z]{4}$/,DEST:/^[A-Z]{4}$/,CI:/^\d{1,3}$/,CRZ_ALT:/^(?:FL\d{2,3}|\d{3,5})$/,WAYPOINT:/^[A-Z0-9]{2,7}$/};
const PAGE_KEYS={INIT_REF:'INDEX',RTE:'RTE',CLB:'CLB',CRZ:'CRZ',DES:'DES',MENU:'MENU',LEGS:'LEGS',DEP_ARR:'DEP_ARR',HOLD:'HOLD',PROG:'PROG',N1_LIMIT:'N1_LIMIT',FIX:'FIX'};
function initial(){return {currentPage:'MENU',scratch:'',scratchMessage:null, pending:{},active:{},brightness:1,mode:'TRAINER_STANDALONE',requestOtherSubsystem:false,selfTestFailure:false,lnavOffsetGuidance:false,history:[]}}
function lights(s){return {CALL:!!s.requestOtherSubsystem,FAIL:!!s.selfTestFailure,MSG:!!s.scratchMessage,OFST:!!s.lnavOffsetGuidance,EXEC:Object.keys(s.pending).length>0}}
function transition(state,event){const s={...state,active:{...state.active},pending:{...state.pending},history:[...state.history]};if(!event||typeof event.type!=='string')throw Error('bad event');s.history.push(event.type);if(s.history.length>100)s.history.shift();switch(event.type){
case 'KEY': {let c=String(event.key||'').toUpperCase();if(c==='CLR'){if(s.scratchMessage){s.scratchMessage=null;return s}if(event.held){s.scratch='';return s}s.scratch=s.scratch.slice(0,-1);return s}if(c==='DEL'){s.scratch='DELETE';s.scratchMessage=null;return s}if(c==='SP')c=' ';if(c==='SLASH')c='/';if(c==='DOT')c='.';if(c==='PLUS_MINUS'){const start=s.scratch[0];s.scratch=(start==='-'?'+':start==='+'?'-':'-')+(start==='-'||start==='+'?s.scratch.slice(1):s.scratch);return s}if(!/^[A-Z0-9 .\/]$/.test(c))return s;s.scratch=(s.scratch==='DELETE'?'':s.scratch)+c;s.scratchMessage=null;return s}
case 'PAGE':if(PAGE_KEYS[event.key]){s.currentPage=PAGE_KEYS[event.key];s.scratchMessage=null}return s;
case 'LSK_ASSIGN': {const k=event.field,v=s.scratch.trim().toUpperCase();if(!FIELD_RE[k]||!FIELD_RE[k].test(v)){s.scratchMessage='INVALID ENTRY';return s}if(s.active[k]!==v)s.pending[k]=v;else delete s.pending[k];s.scratch='';s.scratchMessage=null;return s}
case 'EXEC': if(Object.keys(s.pending).length){Object.assign(s.active,s.pending);s.pending={};s.scratchMessage=null}return s;
case 'MESSAGE':s.scratchMessage=String(event.message||'');return s;
case 'SUBSYSTEM_REQUEST':s.requestOtherSubsystem=!!event.active;return s;
case 'SELF_TEST_FAILURE':s.selfTestFailure=!!event.active;return s;
case 'OFFSET_GUIDANCE':s.lnavOffsetGuidance=!!event.active;return s;
case 'BRIGHTNESS':s.brightness=Math.max(0,Math.min(1,Number(event.value)||0));return s;
default:throw Error('unknown '+event.type)}}
function displayModel(s){return {page:s.currentPage,title:s.currentPage,active:{...s.active},modifications:{...s.pending},scratchpad:s.scratchMessage||s.scratch,message:!!s.scratchMessage,lights:lights(s)}}
module.exports={initial,transition,lights,displayModel,FIELD_RE,PAGE_KEYS};