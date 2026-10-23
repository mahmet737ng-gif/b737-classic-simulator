/* FCOM source-based CDU preflight training lab. Display-only; no aircraft guidance. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CDU_FCOM_TEST=api;})(typeof window!=='undefined'?window:null,function(){'use strict';
const VARIANTS=['FUEL_N1_LIMIT','PLAN_FUEL_N1_LIMIT_ACARS','FUEL_TAKEOFF'], TOLERANCES=['DEFAULT_30S','OPTION_15S_ACARS'];
const PAGES=['IDENT','POS_INIT','INDEX','RTE','DEP_ARR','DEPARTURES','PERF_INIT','PERF_LIMITS','N1_LIMIT','TAKEOFF'];
function makeState(){return {page:'IDENT',scratch:'',message:'',origin:'',dest:'',runway:'',routePending:false,routeArmed:false,routeActive:false,
variant:VARIANTS[0],toleranceVariant:TOLERANCES[0],performance:{GW:'',FUEL:'',ZFW:'',RESERVES:'',CI:'',CRZ_ALT:'',CRZ_WIND:'',ISA_DEV:'',TC_OAT:'',TRANS_ALT:'18000',SEL_TEMP:'',OAT:''},
limits:{TIME_TOL:'',CLB_MIN:'',CLB_MAX:'',CRZ_MIN:'',CRZ_MAX:'',DES_MIN:'',DES_MAX:''},thrust:{takeoff:'TO',climb:'CLB'},guidanceEnabled:false,lastKey:''};}
function navigate(s,p){if(PAGES.includes(p)){s.page=p;s.scratch='';s.message='';}else s.message='PAGE NOT VERIFIED';}
function validate(f,v,s){if(['origin','dest'].includes(f))return /^[A-Z]{4}$/.test(v);
if(f==='runway')return /^(0?[1-9]|[12]\d|3[0-6])[LRC]?$/.test(v);
if(['GW','FUEL','ZFW','RESERVES'].includes(f))return /^\d{1,3}(\.\d)?$/.test(v);
if(f==='CI')return /^\d{1,3}$/.test(v)&&Number(v)<=200;
if(['CRZ_ALT','TRANS_ALT'].includes(f))return /^(FL)?\d{2,5}$/.test(v);
if(f==='CRZ_WIND')return /^\d{3}\/\d{1,3}$/.test(v);
if(['ISA_DEV','TC_OAT','SEL_TEMP','OAT'].includes(f))return /^[+-]?\d{1,3}(\.\d)?[CF]?$/.test(v);
if(f==='TIME_TOL')return /^\d{1,2}$/.test(v)&&Number(v)>=(s.toleranceVariant==='DEFAULT_30S'?5:6)&&Number(v)<=30;
if(/^(CLB|CRZ|DES)_(MIN|MAX)$/.test(f))return /^(\d{2,3}\/\.\d{2,3}|\d{2,3}|\.\d{2,3})$/.test(v);
return false;}
function enter(s,f){if(!s.scratch){s.scratch=String(s.performance[f]||s.limits[f]||s[f]||'');return;}
const v=s.scratch.trim().toUpperCase();if(!validate(f,v,s)){s.message='INVALID ENTRY';return;}
if(Object.hasOwn(s.performance,f)){s.performance[f]=v;if(f==='ZFW'&&s.performance.FUEL&&!s.performance.GW)s.performance.GW=(Number(v)+Number(s.performance.FUEL)).toFixed(1);
if(f==='GW'&&s.performance.FUEL&&!s.performance.ZFW)s.performance.ZFW=(Number(v)-Number(s.performance.FUEL)).toFixed(1);}
else if(Object.hasOwn(s.limits,f))s.limits[f]=v;else {s[f]=v;s.routePending=true;s.routeArmed=false;}
s.scratch='';s.message='';}
function setVariant(s,v){if(!VARIANTS.includes(v))throw Error('VARIANT_UNKNOWN');s.variant=v;}
function setTolerance(s,v){if(!TOLERANCES.includes(v))throw Error('TOLERANCE_UNKNOWN');s.toleranceVariant=v;s.limits.TIME_TOL='';}
function press(s,id){const k=String(id).replace(/^CDU_CAPT_/,'');s.lastKey=k;s.message='';
if(k.startsWith('KEY_')){const t=k.slice(4);if(t==='CLR'){s.scratch=s.scratch.slice(0,-1);return s;}if(t==='DEL'){s.scratch='';return s;}const ch=({DOT:'.',SP:' ',SLASH:'/',PLUS_MINUS:'-'})[t]||t;if(ch.length===1&&/^[A-Z0-9.\/ -]$/.test(ch)&&s.scratch.length<24)s.scratch+=ch;return s;}
if(k==='EXEC'){if(s.page==='RTE'&&s.routeArmed&&s.routePending){s.routeActive=true;s.routePending=false;s.routeArmed=false;s.message='ROUTE ACTIVE';}else s.message='NOT ACTIVATED';return s;}
if(k==='NEXT_PAGE'||k==='PREV_PAGE'){if(s.page==='PERF_INIT')navigate(s,'PERF_LIMITS');else if(s.page==='PERF_LIMITS')navigate(s,'PERF_INIT');else s.message='END OF PAGES';return s;}
const direct={INIT_REF:'INDEX',RTE:'RTE',DEP_ARR:'DEP_ARR',N1_LIMIT:'N1_LIMIT'};
if(direct[k]){navigate(s,direct[k]);return s;}
if(!/^LSK_[LR][1-6]$/.test(k)){s.message='KEY INACTIVE';return s;}const key=k.slice(4);
if(s.page==='IDENT'){if(key==='R6')navigate(s,'POS_INIT');else if(key==='L6')navigate(s,'INDEX');else s.message='READ ONLY';}
else if(s.page==='POS_INIT'){if(key==='R6')navigate(s,'RTE');else if(key==='L6')navigate(s,'INDEX');else s.message='IRS NOT WIRED';}
else if(s.page==='INDEX'){const nav={L1:'IDENT',L2:'POS_INIT',L3:'PERF_INIT',L4:'TAKEOFF',R1:'DEP_ARR'};if(nav[key])navigate(s,nav[key]);else s.message='KEY INACTIVE';}
else if(s.page==='RTE'){const map={L1:'origin',R1:'dest',L3:'runway'};if(map[key])enter(s,map[key]);else if(key==='R6'){if(/^[A-Z]{4}$/.test(s.origin)&&/^[A-Z]{4}$/.test(s.dest)&&s.routePending){s.routeArmed=true;s.message='EXEC REQUIRED';}else s.message='ENTER ORIGIN DEST';}else if(key==='L6'){s.routePending=false;s.routeArmed=false;s.message='MOD ERASED';}else s.message='NAV DB NOT WIRED';}
else if(s.page==='DEP_ARR'){if(key==='L1')navigate(s,'DEPARTURES');else if(key==='L6')navigate(s,'INDEX');else s.message='PROC DB NOT WIRED';}
else if(s.page==='DEPARTURES'){if(key==='L6')navigate(s,'DEP_ARR');else if(key==='R6')navigate(s,'RTE');else s.message='SID DB NOT CONNECTED';}
else if(s.page==='PERF_INIT'){const plan=s.variant==='PLAN_FUEL_N1_LIMIT_ACARS';const f={L1:'GW',L2:'FUEL',L3:'ZFW',L4:'RESERVES',L5:'CI',L6:'INDEX',R1:'CRZ_ALT',R2:'CRZ_WIND',R3:plan?'TC_OAT':'ISA_DEV',R4:plan?'TRANS_ALT':'TC_OAT',R5:plan?'ACARS':'TRANS_ALT',R6:s.variant==='FUEL_TAKEOFF'?'TAKEOFF':'N1_LIMIT'}[key];if(f in s.performance)enter(s,f);else if(f==='INDEX'||f==='TAKEOFF'||f==='N1_LIMIT')navigate(s,f);else if(f==='ACARS')s.message='ACARS NOT CONNECTED';else s.message='KEY INACTIVE';}
else if(s.page==='PERF_LIMITS'){const f={L1:'TIME_TOL',L2:'CLB_MIN',R2:'CLB_MAX',L3:'CRZ_MIN',R3:'CRZ_MAX',L4:'DES_MIN',R4:'DES_MAX'}[key];if(f)enter(s,f);else if(key==='L6')navigate(s,'INDEX');else if(key==='R6')s.message='RTA NOT WIRED';else if(key==='L5'||key==='R5')s.message=s.toleranceVariant==='OPTION_15S_ACARS'?'ACARS NOT CONNECTED':'KEY INACTIVE';else s.message='KEY INACTIVE';}
else if(s.page==='N1_LIMIT'){if(key==='L1')enter(s,'SEL_TEMP');else if(key==='L2')enter(s,'OAT');else if(key==='L3')s.thrust.takeoff='TO';else if(key==='L4'){s.thrust.takeoff='TO-1';s.thrust.climb='CLB-1';}else if(key==='L5'){s.thrust.takeoff='TO-2';s.thrust.climb='CLB-2';}else if(key==='L6')navigate(s,'PERF_INIT');else if(key==='R2')s.thrust.climb='CLB';else if(key==='R3')s.thrust.climb='CLB-1';else if(key==='R4')s.thrust.climb='CLB-2';else if(key==='R6')navigate(s,'TAKEOFF');else s.message='KEY INACTIVE';}
else if(s.page==='TAKEOFF'){if(key==='L6')navigate(s,'PERF_INIT');else if(key==='R6')navigate(s,'N1_LIMIT');else s.message='TAKEOFF NOT WIRED';}
return s;}
function degrees(v){const n=parseFloat(String(v||''));return Number.isFinite(n)?(String(v).toUpperCase().endsWith('F')?(n-32)*5/9:n):null;}
function estimateN1(s,api){if(!api?.estimate)return null;const oat=degrees(s.performance.OAT),selected=degrees(s.performance.SEL_TEMP);const r=api.estimate({registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000,weatherMode:'ISA',engineBleedMode:'ON',antiIceMode:'OFF',acPacks:'AUTO',phase:'TAKEOFF',pressureAltitudeFt:0,oatC:oat??15});if(r.status!=='SIM_ESTIMATE')return null;const derate=s.thrust.takeoff==='TO-1'?2.5:s.thrust.takeoff==='TO-2'?5:0;const temp=Number.isFinite(selected)?Math.min(3,Math.max(0,selected-15)*.08):0;return Math.round(Math.max(80,r.maxN1Pct-derate-temp)*10)/10;}
function view(s,estimator){const p=s.performance,l=s.limits,v=s.variant;
const rows=Array.from({length:6},()=>['','','','']);let title=s.page.replace(/_/g,' '),count='1/1';
const set=(i,a,b,c,d)=>{rows[i]=[a||'',String(b??''),c||'',String(d??'')]};const pv=k=>p[k]||'□□□□';
if(s.page==='IDENT'){set(0,'MODEL','737-300','ENG RATING','20K');set(1,'NAV DATA','NOT LOADED','ACTIVE','---');set(3,'ENGINE','CFM56-3B-1','OP PROGRAM','SIM');set(5,'<INDEX','','POS INIT>','');}
if(s.page==='POS_INIT'){set(0,'LAST POS','NOT AVAILABLE','','');set(3,'SET IRS POS','NOT WIRED','','');set(5,'<INDEX','','ROUTE>','');}
if(s.page==='INDEX'){title='INIT/REF INDEX';set(0,'<IDENT','','NAV DATA>','');set(1,'<POS','','','');set(2,'<PERF','','','');set(3,'<TAKEOFF','','','');}
if(s.page==='RTE'){title=(s.routePending?'MOD ':s.routeActive?'ACT ':'')+'RTE';set(0,'ORIGIN',s.origin||'□□□□','DEST',s.dest||'□□□□');set(1,'CO ROUTE','NOT WIRED','FLT NO','NOT WIRED');set(2,'RUNWAY',s.runway||'----','','');set(5,'<ERASE','','ACTIVATE>','');}
if(s.page==='DEP_ARR'){title='DEP/ARR INDEX';set(0,'<DEP',s.origin||'----','ARR>',s.origin||'----');set(1,'','','ARR>',s.dest||'----');set(5,'<INDEX','','','');}
if(s.page==='DEPARTURES'){title=(s.origin||'----')+' DEPARTURES';set(0,'SIDS','NO VERIFIED DB','RUNWAYS',s.runway||'----');set(1,'TRANSITIONS','UNAVAILABLE','','');set(5,'<INDEX','','ROUTE>','');}
if(s.page==='PERF_INIT'){title='PERF INIT';count='1/2';const plan=v==='PLAN_FUEL_N1_LIMIT_ACARS';set(0,'GW/CRZ CG',pv('GW')+'/---','TRIP/CRZ ALT',pv('CRZ_ALT'));
set(1,plan?'PLAN/FUEL':'FUEL',pv('FUEL'),'CRZ WIND',p.CRZ_WIND||'----');
set(2,'ZFW',pv('ZFW'),plan?'T/C OAT':'ISA DEV',plan?p.TC_OAT||'ISA':p.ISA_DEV||'+0');
set(3,'RESERVES',pv('RESERVES'),plan?'TRANS ALT':'T/C OAT',plan?p.TRANS_ALT:p.TC_OAT||'ISA');
set(4,'COST INDEX',pv('CI'),plan?'PERF INIT REQ':'TRANS ALT',plan?'ACARS OFF':p.TRANS_ALT);
set(5,'<INDEX','',v==='FUEL_TAKEOFF'?'TAKEOFF>':'N1 LIMIT>','');}
if(s.page==='PERF_LIMITS'){title='PERF LIMITS';count='2/2';set(0,'TIME ERROR TOL',l.TIME_TOL||(s.toleranceVariant==='DEFAULT_30S'?'30 SEC':'15 SEC'),'','');
set(1,'MIN SPD CLB',l.CLB_MIN||'210/.400','MAX SPD',l.CLB_MAX||'340/.820');
set(2,'MIN SPD CRZ',l.CRZ_MIN||'220/.650','MAX SPD',l.CRZ_MAX||'340/.820');
set(3,'MIN SPD DES',l.DES_MIN||'240/.500','MAX SPD',l.DES_MAX||'320/.780');
if(s.toleranceVariant==='OPTION_15S_ACARS')set(4,'<REPORT','','REQUEST>','');set(5,'<INDEX','','RTA>','');}
if(s.page==='N1_LIMIT'){title='N1 LIMIT';const n=estimateN1(s,estimator);set(0,'SEL TEMP',p.SEL_TEMP||'---','20K N1 EST',n===null?'---.-':n.toFixed(1)+'%');
set(1,'OAT',p.OAT||'15C ISA','CLB>',s.thrust.climb==='CLB'?'SEL':'');
set(2,'TO',s.thrust.takeoff==='TO'?'SEL':'','CLB-1>',s.thrust.climb==='CLB-1'?'SEL':'');
set(3,'TO-1',s.thrust.takeoff==='TO-1'?'SEL':'','CLB-2>',s.thrust.climb==='CLB-2'?'SEL':'');
set(4,'TO-2',s.thrust.takeoff==='TO-2'?'SEL':'','','');set(5,'<PERF INIT','','TAKEOFF>','');}
if(s.page==='TAKEOFF'){title='TAKEOFF REF';set(0,'FLAPS','NOT WIRED','V SPEEDS','NOT VERIFIED');set(2,'N1 REF','SIM EST','','');set(5,'<PERF INIT','','N1 LIMIT>','');}
return {title,count,rows,scratch:s.message||s.scratch,exec:s.routeArmed,page:s.page,n1:estimateN1(s,estimator)};}
return Object.freeze({VARIANTS,TOLERANCES,PAGES,makeState,navigate,press,setVariant,setTolerance,validate,view,estimateN1});
});