/* B737CL CDU standalone engine v3. Training-only: FCOM chapter 11 field layouts contain unverified elements. */
(function(global,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;global.CDU_ENGINE=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const EMPTY={};
const SAMPLE={ORIGIN:'',DEST:'',FLIGHT:'',CRZ_ALT:'',CRZ_SPEED:'',CI:'',FLAPS:'',RUNWAY:'',WPT1:'',WPT2:'',OFFSET:''};
function makeState(start='IDENT') {return {page:start,active:{...SAMPLE},pending:{},scratch:'',message:'',history:[],call:false,fail:false,offsetGuidance:false,brightness:1,lastKey:'',lastLSK:'',subpage:1,events:[]};}
function clean(value){return String(value??'').trim().toUpperCase();}
function validate(type,value){const s=clean(value);switch(type){
case 'ICAO':return /^[A-Z]{4}$/.test(s);
case 'CI_CL':return /^\d{1,3}$/.test(s)&&Number(s)<=200;
case 'FL':return /^(FL\d{2,3}|\d{3,5})$/.test(s);
case 'ALT':return /^\d{3,5}$/.test(s);
case 'IASMACH':return /^(\.\d{2,3}|\d{2,3})$/.test(s);
case 'SPEED':return /^\d{2,3}$/.test(s)&&Number(s)>=40&&Number(s)<=399;
case 'WAYPOINT':return /^[A-Z0-9]{2,7}$/.test(s);
case 'ROUTE':return /^[A-Z0-9._\-]{3,15}$/.test(s);
case 'FLIGHT':return /^[A-Z0-9]{2,9}$/.test(s);
case 'RUNWAY':return /^(0?[1-9]|[12]\d|3[0-6])[LRC]?$/.test(s);
case 'WIND':return /^\d{3}\/\d{1,3}$/.test(s);
case 'OFFSET':return /^[LR]\d{1,2}(\.\d)?$/.test(s);
case 'CONSTRAINT':return /^[A-Z0-9/.\-]{2,16}$/.test(s);
case 'WEIGHT_CG':return /^\d{1,3}(\.\d)?(\/\d{1,2}(\.\d)?)?$/.test(s);
case 'WEIGHT':return /^\d{1,3}(\.\d)?$/.test(s);
case 'CG':return /^\d{1,2}(\.\d)?$/.test(s);
case 'TRIM':return /^\d(\.\d)?$/.test(s);
case 'FLAPS':return /^(1|2|5|10|15|25|30|40)$/.test(s);
case 'QNH':return /^\d{3,4}(\.\d{1,2})?$/.test(s);
case 'TEMP':return /^-?\d{1,3}$/.test(s);
case 'HDG':return /^\d{1,3}$/.test(s)&&Number(s)<=359;
case 'LR':return /^(L|R)$/.test(s);
case 'DIST':return /^\d{1,3}(\.\d)?$/.test(s);
case 'BEARDIST':return /^\d{1,3}\/\d{1,3}(\.\d)?$/.test(s);
case 'LATLON':return /^[NS]\d{2,4}(\.\d+)?[ EW/]+[EW]\d{3,5}(\.\d+)?$/.test(s);
case 'PROCEDURE':return /^[A-Z0-9\- ]{2,12}$/.test(s);
case 'TIME':return /^\d{1,2}(\.\d)?$/.test(s);
case 'FREQ':return /^\d{2,3}(\.\d{1,3})?$/.test(s);
case 'DERATE':return /^(TO|TO-1|TO-2|CLB|CLB-1|CLB-2)$/.test(s);
case 'CLASS':return /^[A-Z]{4}$/.test(s);
case 'AIRWAY':return /^[A-Z0-9]{2,8}$/.test(s);
case 'TEXT':return s.length>0&&s.length<=24;
default:return s.length>0&&s.length<=24;}}
function pendingCount(st){return Object.keys(st.pending).filter(k=>st.pending[k]!==st.active[k]).length;}
function readValue(st,key){return Object.prototype.hasOwnProperty.call(st.pending,key)?st.pending[key]:st.active[key]??'';}
function addMessage(st,msg){st.message=msg;st.history.unshift(msg);st.history=st.history.slice(0,30);}
function clearPending(st){st.pending={};}
function choose(st,pages,page){if(!pages[page]){addMessage(st,'KEY INACTIVE');return;}st.page=page;st.message='';st.subpage=1;}
function field(st,cell){const f=cell.field; if(!f)return;
 if(st.scratch==='DELETE'){
  if(Object.prototype.hasOwnProperty.call(st.pending,f)||st.active[f]){st.pending[f]='';}
  st.scratch='';st.message='';return;
 }
 if(!st.scratch){const existing=readValue(st,f);if(existing){st.scratch=String(existing)}else addMessage(st,'INVALID ENTRY');return;}
 const value=clean(st.scratch);
 if(!validate(cell.format,value)){addMessage(st,'INVALID ENTRY');return;}
 if(st.active[f]===value)delete st.pending[f];else st.pending[f]=value;
 st.scratch='';st.message='';
}
function pressLSK(st,pages,key){st.lastLSK=key;const def=pages[st.page];if(!def)return;
 const [side,number]=[key[0],Number(key[1])];const item=def.rows[number-1]?.[side==='L'?0:1];
 if(!item){addMessage(st,'KEY INACTIVE');return;}
 if(item.field){field(st,item);return;}
 if(item.action?.type==='navigate'){
   if(/ERASE/.test(item.label||'')){clearPending(st);st.scratch='';}
   choose(st,pages,item.action.page);return;
 }
 if(item.action?.type==='erase'){clearPending(st);st.scratch='';st.message='';return;}
 // Display-only field: no invented action.
 addMessage(st,'KEY INACTIVE');
}
function press(st,pages,key,options={}){const k=key.replace(/^CDU_CAPT_/,'');st.lastKey=k;st.events.push({key:k,page:st.page});if(st.events.length>300)st.events.shift();
 if(k.startsWith('LSK_')){pressLSK(st,pages,k.slice(4));return st;}
 if(k==='EXEC'){
   if(pendingCount(st)){
     for(const [f,v] of Object.entries(st.pending)){if(v==='')delete st.active[f];else st.active[f]=v;}
     clearPending(st);st.message='';
   }
   return st;
 }
 if(k==='DIM_BRT'){st.brightness=st.brightness>0.86?0.4:Math.round((st.brightness+0.2)*100)/100;return st;}
 if(k==='KEY_CLR'){
   if(st.message){st.message='';return st;}
   if(options.longPress)st.scratch='';else st.scratch=st.scratch.slice(0,-1);
   return st;
 }
 if(k==='KEY_DEL'){st.scratch='DELETE';st.message='';return st;}
 if(k.startsWith('KEY_')){
   if(st.message)st.message='';
   let chr=k.slice(4);
   const sym={DOT:'.',SP:' ',SLASH:'/'};
   if(chr==='PLUS_MINUS'){
     if(st.scratch.startsWith('-'))st.scratch='+'+st.scratch.slice(1);
     else if(st.scratch.startsWith('+'))st.scratch='-'+st.scratch.slice(1);
     else st.scratch='-'+st.scratch;
     return st;
   }
   chr=sym[chr]??chr;
   if(st.scratch==='DELETE')st.scratch='';
   if(st.scratch.length<24)st.scratch+=chr;
   return st;
 }
 const routes={INIT_REF:'INDEX',RTE:'RTE',CLB:'CLB',CRZ:'CRZ',DES:'DES',MENU:'MENU',LEGS:'LEGS',DEP_ARR:'DEP_ARR',HOLD:'HOLD',PROG:'PROG',N1_LIMIT:'N1_LIMIT',FIX:'FIX'};
 if(routes[k]){choose(st,pages,routes[k]);return st;}
 if(k==='NEXT_PAGE'||k==='PREV_PAGE'){
   const pairs={RTE:['RTE','FLIGHT_PLAN'],FLIGHT_PLAN:['RTE','FLIGHT_PLAN'],PROG:['PROG','PROG2'],PROG2:['PROG','PROG2']};
   if(pairs[st.page]){
     const page=pairs[st.page];choose(st,pages,st.page===page[0]?page[1]:page[0]);
   }else addMessage(st,'END OF PAGES');
   return st;
 }
 addMessage(st,'KEY INACTIVE');return st;
}
function text24(left='',right=''){let l=String(left).slice(0,11),r=String(right).slice(0,11);return l.padEnd(12,' ')+r.padStart(12,' ');}
function shown(st,val){return String(val??'').replace(/\{([A-Z_0-9]+)\}/g,(_,key)=>readValue(st,key)||'----');}
function render(st,pages){const p=pages[st.page];if(!p)return Array(14).fill('');const lines=Array(14).fill('');const tag=pendingCount(st)?'MOD ':'ACT ';
 const title=(['MENU','INDEX','IDENT','POS_INIT','MESSAGES','MSG_RECALL','NAV_DATA','NAV_OPTIONS','SUPP_NAV','POS_REF','FIX','PROG','PROG2','HOLD','DEP_ARR','DEPARTURES','ARRIVALS'].includes(st.page)?'':tag)+p.title;
 lines[0]=title.slice(0,18).padEnd(20,' ')+('1/'+p.page_count).padStart(4,' ');
 for(let i=0;i<6;i++){
   const pair=p.rows[i];const left=pair[0],right=pair[1];
   lines[1+i*2]=text24(left.label,right.label);
   const display=c=>c.field?(readValue(st,c.field)||(c.required?'□□□□':'-----')):shown(st,c.value);
   lines[2+i*2]=text24(display(left),display(right));
 }
 lines[13]=st.message||st.scratch||'';
 return lines.map(l=>String(l).slice(0,24));
}
function lights(st){return {CALL:!!st.call,FAIL:!!st.fail,MSG:!!st.message,OFST:!!st.offsetGuidance,EXEC:pendingCount(st)>0};}
function inspect(st,pages,key){if(!/^([LR][1-6])$/.test(key))return null;const c=pages[st.page]?.rows[Number(key[1])-1]?.[key[0]==='L'?0:1];return c?{page:st.page,lsk:key,...c,reference:pages[st.page].source_ref}:null;}
return {makeState,press,pressLSK,pendingCount,readValue,render,lights,inspect,validate,clearPending,choose};
});