/* B737CL CDU standalone engine v4. Training-only: FCOM chapter 11 field layouts contain unverified elements. */
(function(global,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;global.CDU_ENGINE=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const EMPTY={};
 const getPromptPolicy=()=>typeof globalThis!=='undefined'?globalThis.CDU_PROMPT_POLICY_V1:null;
const SAMPLE={ORIGIN:'',DEST:'',CO_ROUTE:'',FLIGHT:'',CRZ_ALT:'',CRZ_SPEED:'',CI:'',FLAPS:'',RUNWAY:'',WPT1:'',WPT2:'',OFFSET:'',HDG_SEL:'000',CRS_SEL:'000'};
const ROUTE_FIELDS=new Set(['ORIGIN','DEST','CO_ROUTE','FLIGHT','RUNWAY']);
const ROUTE_PAGES=new Set(['RTE','ACTIVATE','FLIGHT_PLAN','LEGS','DEP_ARR','DEPARTURES','ARRIVALS']);
function makeState(start='IDENT') {return {page:start,active:{...SAMPLE},pending:{},stagedRoute:{},scratch:'',message:'',history:[],call:false,fail:false,offsetGuidance:false,brightness:1,lastKey:'',lastLSK:'',subpage:1,events:[],preflightEvidence:{},ehsi:{mode:'MAP',range:10,heading:0,course:0}};}
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
function getRouteScreens(st){return st.chapter11RoutePages?globalThis.CDU_CH11_ROUTE_PAGES:null;}
function isRouteField(field){return ROUTE_FIELDS.has(field);}
function routeField(st,field){return isRouteField(field)||/^(?:SID|STAR|APP|WPT\d+(?:_CONSTRAINT)?|(?:VIA|TO)\d+|LEG_CONSTRAINT_[A-Z0-9_]+)$/.test(field)||!!getRouteScreens(st)?.isRouteField(field);}
 function routeExecAuthorized(st){return st.routeActivated===true||st.routeActivationArmed===true;}
 function executableKeys(st){return Object.keys(st.pending).filter(k=>st.pending[k]!==st.active[k]&&(!routeField(st,k)||routeExecAuthorized(st)));}
function hasStagedRoute(st){return Object.keys(st.stagedRoute).length>0;}
function pendingCount(st){return Object.keys(st.pending).filter(k=>st.pending[k]!==st.active[k]).length;}
function readValue(st,key,pageName=''){if(Object.prototype.hasOwnProperty.call(st.pending,key))return st.pending[key]??''; if(ROUTE_PAGES.has(pageName||st.page)&&Object.prototype.hasOwnProperty.call(st.stagedRoute,key))return st.stagedRoute[key]??''; return st.active[key]??'';}
function addMessage(st,msg){st.message=msg;st.history.unshift(msg);st.history=st.history.slice(0,30);}
function clearPending(st){st.pending={};}
function clearRoutePending(st){for(const key of Object.keys(st.pending)){if(routeField(st,key)) delete st.pending[key];}}
function choose(st,pages,page){
 if(!pages[page]){addMessage(st,'KEY INACTIVE');return;}
 const from=st.page;st.page=page;st.message='';st.subpage=1;
 // FCOM 11.60.22: advisory airport identifier, never auto-insert ORIGIN.
 if(page==='RTE'&&from!=='RTE'&&!readValue(st,'ORIGIN','RTE')&&!st.scratch&&validate('ICAO',st.active.REF_AIRPORT))st.scratch=st.active.REF_AIRPORT;
}
// Origin change is one new-flight transaction. Keep POS INIT and live
// hardware/installation evidence; discard crew flight data and old route banks.
function clearOriginLocal(st){
 for(const k of ['depArrSelection','cduSgView','holdAt','holdPage','planReviewCenter','stage5Page','stage6Page','stage6View','performanceN1','stage8Monitor','stage10Advisory','lastTrainingFuelWarning'])delete st[k];
}
function resetForOrigin(st,value){
 const active={...SAMPLE};for(const k of ['REF_AIRPORT','GATE','IRS_POS','IRS_HDG','GMT_DATE','LAST_POS'])if(Object.hasOwn(st.active,k))active[k]=st.active[k];
 st.active=active;st.pending={};st.stagedRoute={ORIGIN:value};
 for(const k of ['navFixEvidence','activeNavFixEvidence','verifiedAirwayEntries','verifiedToEntries','navdbActive','navdbPending','navdbStage','stage5Pending','stage5Committed','stage5AwaitingExec','stage6BasePlanId','stage6Selections','stage6PendingPlan','stage6AwaitingExec','fixInfo','lastHoldExit'])delete st[k];
 clearOriginLocal(st);st.routeActivated=false;st.routeActivationArmed=false;
 st.originResetRevision=(st.originResetRevision||0)+1;st.routeRevision=(st.routeRevision||0)+1;
 st.offsetGuidance=false;st.scratch='';st.message='';st.history=[];st.subpage=1;
}
function originEntry(st){
 if(st.page!=='RTE'||st.subpage!==1||!st.scratch||st.scratch==='DELETE')return false;
 const value=clean(st.scratch),previous=readValue(st,'ORIGIN','RTE');
 if(!validate('ICAO',value)){addMessage(st,'INVALID ENTRY');return true;}
 if(value===previous){st.scratch='';st.message='';return true;}
 if(st.routeActivated===true&&st.fmcOnGroundVerified!==true){addMessage(st,'INVALID ENTRY');return true;}
 resetForOrigin(st,value);return true;
}
function stageRouteField(st,cell){const f=cell.field; if(!f) return; if(st.scratch==='DELETE'){st.stagedRoute[f]=''; st.scratch=''; st.message=''; return;} if(!st.scratch){const existing=readValue(st,f,'RTE'); if(existing){st.scratch=String(existing)} else addMessage(st,'INVALID ENTRY'); return;} const value=clean(st.scratch); if(!validate(cell.format,value)){addMessage(st,'INVALID ENTRY');return;} const activeNow=st.active[f]??''; if(value===activeNow) delete st.stagedRoute[f]; else st.stagedRoute[f]=value; st.scratch=''; st.message=''; if(f==='RUNWAY'){const num=parseInt(value,10); if(!Number.isNaN(num)){st.ehsi.course=(num*10)%360;}}
}
function enterPosInitField(st,cell){
 const key=cell.field;
 if(key==='IRS_POS'){addMessage(st,'IRS NOT CONNECTED');return true;}
 if(key==='IRS_HDG'){
  const att=Object.values(st.preflightEvidence?.irs||{}).some(x=>x?.mode==='ATT'&&x?.powered===true);
  if(!att){addMessage(st,'KEY INACTIVE');return true;}
  // FCOM requires a real IRS ATT-mode heading update. CDU-local changes
  // are not a substitute; do not fake an IRS heading write.
  addMessage(st,'IRS HDG NOT LINKED');return true;
 }
 if(!['REF_AIRPORT','GATE','IRS_HDG'].includes(key))return false;
 if(key==='GATE'&&!validate('ICAO',st.active.REF_AIRPORT||'')){
  addMessage(st,'ENTER REF AIRPORT');return true;
 }
 if(st.scratch==='DELETE'){
  if(key==='REF_AIRPORT'){delete st.active.REF_AIRPORT;delete st.active.GATE;}
  else delete st.active[key];
  delete st.pending[key];st.scratch='';st.message='';return true;
 }
 if(!st.scratch){
  const last=st.active[key]||'';
  if(last)st.scratch=last;else addMessage(st,'INVALID ENTRY');
  return true;
 }
 const entered=clean(st.scratch);
 if(!validate(cell.format,entered)){addMessage(st,'INVALID ENTRY');return true;}
 if(key==='REF_AIRPORT'&&entered!==st.active.REF_AIRPORT){
  delete st.active.GATE;delete st.pending.GATE;
 }
 st.active[key]=entered;delete st.pending[key];st.scratch='';st.message='';
 return true;
}

/* FCOM 11.40.37–45, N1 LIMIT equipped training configuration.
 * Preserve punctuation independently of required-entry slots. No synthetic TRIP
 * altitude is displayed without validated predictions; RTA is not implemented. */
const PERF_KEYS=new Set(['GW_CG','FUEL','ZFW','RESERVES','CI','CRZ_ALT','CRZ_WIND','ISA_DEV','TC_OAT','TRANS_ALT','PERF_WEIGHT_SOURCE','PERF_TEMP_SOURCE']);
const perfNum=v=>/^\d{1,3}(?:\.\d)?$/.test(String(v??''))?Number(v):null;
const perfSigned=v=>/^[+-]?\d{1,3}$/.test(String(v??''))?Number(v):null;
const perfValue=(s,k)=>readValue(s,k,'PERF_INIT');
function perfFuel(s){
 const f=s.fmcPageInputs?.fuel;
 if(f?.quality==='VALID'&&Number.isFinite(f.totalKg)&&f.totalKg>=0)return {n:f.totalKg/1000,manual:false};
 const n=perfNum(perfValue(s,'FUEL'));return {n:s.fmcOnGroundVerified===false?n:null,manual:s.fmcOnGroundVerified===false&&n!==null};
}
function perfAlt(v){const x=String(v??'').toUpperCase();if(/^FL\d{2,3}$/.test(x))return Number(x.slice(2))*100;if(/^\d{3,5}$/.test(x))return Number(x);return null;}
const perfFL=n=>n===null?'□□□□□':n>=10000&&n%100===0?'FL'+String(n/100).padStart(3,'0'):String(n);
const signed=n=>n===null?'---':(n>=0?'+':'-')+Math.abs(n);
function perfData(s){
 const raw=String(perfValue(s,'GW_CG')||''),parts=raw.split('/'),gw0=perfNum(parts[0]),z0=perfNum(perfValue(s,'ZFW')),f=perfFuel(s);
 const cg=perfNum(parts[1])??18.5,source=perfValue(s,'PERF_WEIGHT_SOURCE');
 let gw=gw0,z=z0;
 // 11.40.39–40: derived ZFW is the fixed mass, not a moving value.
 if(f.n!==null){if(z0!==null)gw=z0+f.n;else if(gw0!==null&&gw0>=f.n)z=gw0-f.n;}
 else if(z0!==null&&source==='ZFW')gw=null;
 const crz=perfAlt(perfValue(s,'CRZ_ALT')),std=crz===null?null:Math.round(15-1.9812*Math.min(crz,36089)/1000);
 let isa=perfSigned(perfValue(s,'ISA_DEV')),oat=perfSigned(perfValue(s,'TC_OAT'));
 if(std!==null){if(perfValue(s,'PERF_TEMP_SOURCE')==='OAT'||isa===null){if(oat!==null)isa=oat-std;}else oat=std+isa;}
 const pred=s.fmcPageInputs?.predictions,ci=perfValue(s,'CI');
 const origin=readValue(s,'ORIGIN','RTE'),dest=readValue(s,'DEST','RTE');
 // 11.40.41: TRIP is computed minimum-cost altitude, never CRZ or OPT by substitution.
 const tripReady=/^[A-Z]{4}$/.test(origin)&&/^[A-Z]{4}$/.test(dest)&&origin!==dest&&gw!==null&&gw>0&&validate('CI_CL',ci);
 const trip=tripReady&&pred?.quality==='VALID'&&Number.isFinite(pred.tripAltitudeFt)&&pred.tripAltitudeFt>0&&pred.origin===origin&&pred.destination===dest&&pred.costIndex===Number(ci)&&Math.abs(pred.grossWeightKg-gw*1000)<=100?pred.tripAltitudeFt:null;
 const sid=s.cduSgReference?.modified?.geometries??s.cduSgReference?.active?.geometries??{};
 const ta=Object.values(sid).find(g=>g.kind==='SID')?.transitionAltitudeFt;
 const trans=perfAlt(perfValue(s,'TRANS_ALT'))??(Number.isFinite(ta)?ta:18000);
 const wind=String(perfValue(s,'CRZ_WIND')||'').split('/');
 const res=perfNum(perfValue(s,'RESERVES'));
 return {gw,z,cg,f,crz,trip,isa,oat,trans,wind,res,ci,ready:gw!==null&&gw>0&&z!==null&&z>0&&f.n!==null&&crz!==null&&crz>0&&res!==null&&validate('CI_CL',ci),
  forecast:{windFromDeg:wind.length===2?Number(wind[0]):0,windKt:wind.length===2?Number(wind[1]):0,isaDeviationC:isa??0,topOfClimbOatC:oat??std},std};
}
// Called on authoritative fuel updates; resolve a previously entered GW once.
function settlePerfWeight(s){
 const d=perfData(s);
 if(d.f.n===null||d.z===null||d.z<=0)return false;
 // Never silently commit a pending pilot modification.
 if(perfNum(String(s.active.GW_CG||'').split('/')[0])!==null&&perfNum(s.active.ZFW)===null&&!Object.hasOwn(s.pending,'GW_CG')&&!Object.hasOwn(s.pending,'ZFW')&&!Object.hasOwn(s.pending,'FUEL')){
  s.active.ZFW=d.z.toFixed(1);s.active.PERF_WEIGHT_SOURCE='ZFW';return true;
 }
 return false;
}
function perfRows(s){
 const d=perfData(s),w=n=>n===null?'□□□.□':n.toFixed(1),temp=n=>n===null?'---°F ---°C':signed(Math.round(n*9/5))+'°F '+signed(n)+'°C';
 // ISA deviation is a temperature difference; absolute OAT needs the offset.
 const oat=d.oat===null?'---°F ---°C':signed(Math.round(d.oat*9/5+32))+'°F '+signed(d.oat)+'°C';
 const pair=(labelL,valueL,labelR,valueR,extra={})=>({labelL,valueL,labelR,valueR,...extra});
 const dirty=Object.keys(s.pending||{}).some(k=>PERF_KEYS.has(k)&&s.pending[k]!==s.active[k]);
 return {title:(dirty?'MOD ':'')+'PERF INIT',number:1,count:2,rows:[
 pair('GW/CRZ CG',w(d.gw)+'/'+d.cg.toFixed(1)+'%','TRIP/CRZ ALT',(d.trip===null?'':perfFL(d.trip))+'/'+perfFL(d.crz),{smallSuffixL:!String(perfValue(s,'GW_CG')).split('/')[1]?'18.5%':null}),
 pair('FUEL',d.f.n===null?(s.fmcOnGroundVerified===false?'---.-':''):d.f.n.toFixed(1)+(d.f.manual?' MAN':''),'CRZ WIND',d.wind.length===2?d.wind[0]+'°/'+d.wind[1]:'---°/---'),
 pair('ZFW',w(d.z),'ISA DEV',temp(d.isa)),
 pair('RESERVES',d.res===null?'□□.□':d.res.toFixed(1),'T/C OAT',oat),
 pair('COST INDEX',d.ci===''?'□□□':d.ci,'TRANS ALT',String(d.trans),{smallR:!perfValue(s,'TRANS_ALT')}),
 pair('','<INDEX','','N1 LIMIT>',{separator:true})
 ]};
}
const PERF_LIMIT_FIELDS=['CLB_MIN','CLB_MAX','CRZ_MIN','CRZ_MAX','DES_MIN','DES_MAX'];
function perfLimitValue(s,k){return readValue(s,k,'PERF_LIMITS')||(k.endsWith('_MIN')?'210/.400':'340/.820');}
function perfLimitsRows(s){
 const pair=(labelL,valueL,labelR,valueR,extra={})=>({labelL,valueL,labelR,valueR,...extra});
 return {title:'PERF LIMITS',number:2,count:2,rows:[
 pair('','','','',{centerLabel:'TIME ERROR TOLERANCE',centerValue:(readValue(s,'RTA_TOL','PERF_LIMITS')||'30')+' SEC AT RTA WPT',smallCenter:!readValue(s,'RTA_TOL','PERF_LIMITS')}),
 pair('MIN SPD',perfLimitValue(s,'CLB_MIN'),'MAX SPD',perfLimitValue(s,'CLB_MAX'),{centerLabel:'--CLB--',smallL:!readValue(s,'CLB_MIN','PERF_LIMITS'),smallR:!readValue(s,'CLB_MAX','PERF_LIMITS')}),
 pair('',perfLimitValue(s,'CRZ_MIN'),'',perfLimitValue(s,'CRZ_MAX'),{centerLabel:'--CRZ--',smallL:!readValue(s,'CRZ_MIN','PERF_LIMITS'),smallR:!readValue(s,'CRZ_MAX','PERF_LIMITS')}),
 pair('',perfLimitValue(s,'DES_MIN'),'',perfLimitValue(s,'DES_MAX'),{centerLabel:'--DES--',smallL:!readValue(s,'DES_MIN','PERF_LIMITS'),smallR:!readValue(s,'DES_MAX','PERF_LIMITS')}),
 pair('','','',''),
 pair('','<INDEX','','RTA>',{separator:true})]};
}
function perfStore(s,fields){
 // Ground preflight entries initialize the FMC; in-flight edits retain the
 // existing MOD/EXEC transaction boundary. Unknown ground is not ground.
 const bank=s.fmcOnGroundVerified===true?s.active:s.pending;
 for(const [k,v] of Object.entries(fields)){bank[k]=v;if(bank===s.active)delete s.pending[k];else if(s.active[k]===v)delete s.pending[k];}
 s.scratch='';s.message='';
}
function perfEnter(s,cell){
 const k=cell.field,input=clean(s.scratch),d=perfData(s),bad=()=>{addMessage(s,'INVALID ENTRY');return true;};
 if(!input){
  // Scratchpad is canonical, not the decorated screen string.
  const v={GW_CG:d.gw===null?'':d.gw.toFixed(1)+'/'+d.cg.toFixed(1),FUEL:d.f.n===null?'':d.f.n.toFixed(1),ZFW:d.z===null?'':d.z.toFixed(1),RESERVES:d.res===null?'':d.res.toFixed(1),CI:d.ci,CRZ_ALT:d.crz===null?'':perfFL(d.crz),CRZ_WIND:d.wind.length===2?d.wind.join('/'):'',ISA_DEV:d.isa===null?'':String(d.isa),TC_OAT:d.oat===null?'':String(d.oat),TRANS_ALT:String(d.trans)}[k];
  if(v!==undefined&&v!==''){s.scratch=v;s.message='';}else addMessage(s,'INVALID ENTRY');return true;
 }
 if(k==='FUEL'&&(d.f.n!==null&&!d.f.manual||s.fmcOnGroundVerified!==false)){addMessage(s,'KEY INACTIVE');return true;}
 if(input==='DELETE'){
  if(['GW_CG','ZFW','RESERVES','CI','CRZ_ALT'].includes(k)){addMessage(s,'INVALID DELETE');return true;}
  const patch={[k]:''};if(k==='ISA_DEV'||k==='TC_OAT')Object.assign(patch,{ISA_DEV:'',TC_OAT:'',PERF_TEMP_SOURCE:''});
  perfStore(s,patch);return true;
 }
 const patch={};
 if(k==='GW_CG'){
  const a=input.split('/');if(a.length>2)return bad();
  const g=a[0]===''?null:perfNum(a[0]),c=a.length===2?perfNum(a[1].replace(/%$/,'')):null;
  if((a[0]!==''&&(g===null||g<=0))||(a.length===2&&(c===null||c>100))||(g===null&&c===null)||g!==null&&d.f.n!==null&&g<=d.f.n)return bad();
  const old=d.gw===null?'':d.gw.toFixed(1);
  patch.GW_CG=(g===null?old:g.toFixed(1))+'/'+(c??d.cg).toFixed(1);
  if(g!==null){patch.PERF_WEIGHT_SOURCE=d.f.n!==null?'ZFW':'GW';if(d.f.n!==null)patch.ZFW=(g-d.f.n).toFixed(1);else patch.ZFW='';}
 }else if(['ZFW','FUEL','RESERVES'].includes(k)){
  const n=perfNum(input);if(n===null||k==='ZFW'&&n<=0||k==='RESERVES'&&!/^\d{1,2}(?:\.\d)?$/.test(input))return bad();
  patch[k]=n.toFixed(1);if(k==='ZFW'){patch.PERF_WEIGHT_SOURCE='ZFW';patch.GW_CG=(d.f.n===null?'':(n+d.f.n).toFixed(1))+'/'+d.cg.toFixed(1);}
 }else if(k==='CI'){
  if(!validate('CI_CL',input))return bad();patch[k]=String(Number(input));
 }else if(k==='CRZ_ALT'||k==='TRANS_ALT'){
  const n=perfAlt(input);if(n===null||n<0||n>41000||k==='CRZ_ALT'&&n<1000)return bad();patch[k]=k==='CRZ_ALT'?perfFL(n):String(n);
 }else if(k==='CRZ_WIND'){
  const a=input.replace('°','').split('/');if(a.length!==2||!/^\d{1,3}$/.test(a[0])||Number(a[0])>360||!/^\d{1,3}$/.test(a[1]))return bad();
  patch[k]=String(Number(a[0])%360).padStart(3,'0')+'/'+String(Number(a[1]));
 }else if(k==='ISA_DEV'||k==='TC_OAT'){
  const unit=/F$/.test(input)?'F':'C',raw=perfSigned(input.replace(/°?[CF]$/,''));const n=raw===null?null:unit==='F'?Math.round((raw-(k==='TC_OAT'?32:0))*5/9):raw;if(n===null||Math.abs(n)>99)return bad();
  patch[k]=String(n);patch[k==='ISA_DEV'?'TC_OAT':'ISA_DEV']='';patch.PERF_TEMP_SOURCE=k==='ISA_DEV'?'ISA':'OAT';
 }else return false;
 perfStore(s,patch);return true;
}
function perfLimitEnter(s,k){
 const input=clean(s.scratch);if(!input){s.scratch=k==='RTA_TOL'?readValue(s,k,'PERF_LIMITS')||'30':perfLimitValue(s,k);return;}
 if(input==='DELETE'){perfStore(s,{[k]:''});return;}
 if(k==='RTA_TOL'){if(!/^\d{1,2}$/.test(input)||Number(input)<6||Number(input)>30){addMessage(s,'INVALID ENTRY');return;}perfStore(s,{[k]:String(Number(input))});return;}
 const old=perfLimitValue(s,k).split('/'),a=input.split('/');
 let cas=old[0],mach=old[1];if(a.length===1){if(a[0].startsWith('.'))mach=a[0];else cas=a[0];}else if(a.length===2){cas=a[0]||cas;mach=a[1]||mach;}else{addMessage(s,'INVALID ENTRY');return;}
 if(!/^\d{3}$/.test(cas)||Number(cas)<100||Number(cas)>340||!/^\.\d{2,3}$/.test(mach)||Number(mach)<.2||Number(mach)>.82){addMessage(s,'INVALID ENTRY');return;}
 const other=perfLimitValue(s,k.replace(/MIN|MAX$/,x=>x==='MIN'?'MAX':'MIN')).split('/'),sign=k.endsWith('MIN')?1:-1;
 if(sign*(Number(cas)-Number(other[0]))>0||sign*(Number(mach)-Number(other[1]))>0){addMessage(s,'INVALID ENTRY');return;}
 perfStore(s,{[k]:cas+'/'+Number(mach).toFixed(3).slice(1)});
}

function field(st,cell){const f=cell.field; if(!f)return;
 if(st.page==='POS_INIT'&&enterPosInitField(st,cell))return;
 if(st.page==='PERF_INIT'&&perfEnter(st,cell))return;
 if(st.page==='PERF_LIMITS'&&f){perfLimitEnter(st,f);return;}
 if(st.depArrSelection?.referenceOnly&&['DEPARTURES','ARRIVALS'].includes(st.page)){addMessage(st,'NOT ON ROUTE');return;} if(routeField(st,f)&&!routeExecAuthorized(st)){stageRouteField(st,cell);return;}
 if(st.scratch==='DELETE'){ if(Object.prototype.hasOwnProperty.call(st.pending,f)||st.active[f]){st.pending[f]='';} st.scratch='';st.message='';return; }
 if(!st.scratch){const existing=readValue(st,f);if(existing){st.scratch=String(existing)}else addMessage(st,'INVALID ENTRY');return;}
 const value=clean(st.scratch); if(!validate(cell.format,value)){addMessage(st,'INVALID ENTRY');return;} if(st.active[f]===value)delete st.pending[f];else st.pending[f]=value; st.scratch='';st.message=''; }
function activateStagedRoute(st,pages){ if(st.routeActivated===true||st.routeActivationArmed===true||(!hasStagedRoute(st)&&!getRouteScreens(st)?.canActivate(st))){addMessage(st,'KEY INACTIVE'); return false;} for(const [f,v] of Object.entries(st.stagedRoute)){ if((st.active[f]??'')!==v) st.pending[f]=v; }
 st.stagedRoute={}; st.routeActivationArmed=true; choose(st,pages,'ACTIVATE'); return true; }
function eraseRouteChanges(st,pages){ clearRoutePending(st); st.routeActivationArmed=false; st.stagedRoute={}; st.scratch=''; st.message=''; choose(st,pages,'RTE'); }
function selectDepArrAirport(st,pages,key){
 const select={
  L1:{source:'ORIGIN',mode:'DEP',page:'DEPARTURES'},
  R1:{source:'ORIGIN',mode:'ARR',page:'ARRIVALS'},
  R2:{source:'DEST',mode:'ARR',page:'ARRIVALS'},
  L6:{source:'OTHER',mode:'DEP',page:'DEPARTURES'},
  R6:{source:'OTHER',mode:'ARR',page:'ARRIVALS'}
 }[key];
 if(!select){addMessage(st,'KEY INACTIVE');return;}
 const other=select.source==='OTHER';
 const airport=clean(other?st.scratch:readValue(st,select.source,'RTE'));
 if(!validate('ICAO',airport)){addMessage(st,'INVALID ENTRY');return;}
 st.depArrSelection={airport,mode:select.mode,source:select.source,
  referenceOnly:other,sourceFolio:'FCOM 11.40.32-33'};
 if(other)st.scratch='';
 choose(st,pages,select.page);
}
function pressLSK(st,pages,key){st.lastLSK=key;const def=pages[st.page];if(!def)return;
 if(st.page==='INDEX'){
  // FCOM 11.40.6-7: OFFSET is an installed option, while SUPP on R1 is
  // ground-only. Unknown ground state must never be treated as verified ground.
  if(key==='L6'&&st.indexOffsetAvailable!==true){addMessage(st,'KEY INACTIVE');return;}
  if(key==='R1'&&st.scratch==='SUPP'&&st.fmcOnGroundVerified===true){
   st.scratch='';choose(st,pages,'SUPP_NAV');return;
  }
  if(key==='R6'){
   const target=st.fmcOnGroundVerified===false?'NAV_STATUS':'MAINT';
   if(pages[target])choose(st,pages,target);else addMessage(st,'KEY INACTIVE');
   return;
  }
 }
 if(st.page==='DEP_ARR'){selectDepArrAirport(st,pages,key);return;}
 if(st.page==='PERF_LIMITS'&&key==='R6'){choose(st,pages,'PROG2');st.subpage=2;return;}
 const [side,number]=[key[0],Number(key[1])];const item=def.rows[number-1]?.[side==='L'?0:1];
 if(!item){addMessage(st,'KEY INACTIVE');return;}
 if(st.page==='RTE' && key==='L5'){activateStagedRoute(st,pages);return;}
 if(st.page==='ACTIVATE' && key==='L5'){eraseRouteChanges(st,pages);return;}
 if(item.field){field(st,item);return;}
 if(item.action?.type==='navigate'){
   if(/ERASE/.test(item.label||'')){clearPending(st);st.scratch='';}
   choose(st,pages,item.action.page);return;
 }
 if(item.action?.type==='erase'){clearPending(st);st.scratch='';st.message='';return;}
 addMessage(st,'KEY INACTIVE');}
function press(st,pages,key,options={}){const k=key.replace(/^CDU_(?:CAPT|FO)_/,'');st.lastKey=k;st.events.push({key:k,page:st.page});if(st.events.length>300)st.events.shift();
 // INIT REF is context-sensitive; INDEX remains an independent LSK destination.
 if(k==='INIT_REF'){
  // An actual IRS reference (including scenario alignment or ISDU entry) initializes FMC position.
  const entered=/^[NS]\d{4}\.?\d\s*[EW]\d{5}\.?\d$/i.test(String(st.active?.IRS_POS||'').trim());
  choose(st,pages,st.fmcOnGroundVerified===false?'APP_REF':entered&&st.irsPositionRequired!==true?'PERF_INIT':'POS_INIT');
  return st;
 }
 if(k==='LSK_L1'&&originEntry(st))return st;
 const routeScreens=getRouteScreens(st);
 if(routeScreens?.invoke(st,pages,k,{field,stageRouteField,activateStagedRoute,choose,addMessage}))return st;
 if(k.startsWith('LSK_')){pressLSK(st,pages,k.slice(4));return st;}
 if(k==='EXEC'){
  if(routeScreens?.holdExecReady?.(st)===false){addMessage(st,'ENTER INBD CRS');return st;}
  const keys=executableKeys(st);
  if(keys.length||st.routeActivationArmed===true){
   const routeChanged=st.routeActivationArmed===true||st.routeActivated===true&&keys.some(f=>routeField(st,f));
   for(const f of keys){const v=st.pending[f];if(v==='')delete st.active[f];else st.active[f]=v;delete st.pending[f];}
   for(const f of Object.keys(st.pending))if(st.pending[f]===st.active[f])delete st.pending[f];
   st.message='';
   if(routeChanged){
    st.routeActivated=true;st.routeActivationArmed=false;st.routeRevision=(st.routeRevision||0)+1;
    st.activeNavFixEvidence={...st.navFixEvidence};
   }
   if(st.page==='ACTIVATE')choose(st,pages,'RTE');
  }
  return st;
 }
 if(k==='DIM_BRT'){st.brightness=st.brightness>0.86?0.4:Math.round((st.brightness+0.2)*100)/100;return st;}
 if(k==='KEY_CLR'){ if(st.message){st.message='';return st;} if(options.longPress)st.scratch='';else st.scratch=st.scratch.slice(0,-1); return st; }
 if(k==='KEY_DEL'){st.scratch='DELETE';st.message='';return st;}
 if(k.startsWith('KEY_')){ if(st.message)st.message=''; let chr=k.slice(4); const sym={DOT:'.',SP:' ',SLASH:'/'}; if(chr==='PLUS_MINUS'){ if(st.scratch.length>=24&&!/^[+-]/.test(st.scratch))return st; if(st.scratch.startsWith('-'))st.scratch='+'+st.scratch.slice(1); else if(st.scratch.startsWith('+'))st.scratch='-'+st.scratch.slice(1); else st.scratch='-'+st.scratch; return st; } chr=sym[chr]??chr; if(st.scratch==='DELETE')st.scratch=''; if(st.scratch.length<24)st.scratch+=chr; return st; }
 const routes={RTE:'RTE',CLB:'CLB',CRZ:'CRZ',DES:'DES',MENU:'MENU',LEGS:'LEGS',DEP_ARR:'DEP_ARR',HOLD:'HOLD',PROG:'PROG',N1_LIMIT:'N1_LIMIT',FIX:'FIX'};
 if(routes[k]){choose(st,pages,routes[k]);return st;}
 if(k==='NEXT_PAGE'||k==='PREV_PAGE'){ const positions=['POS_INIT','POS_REF','POS_SHIFT']; if(positions.includes(st.page)){const offset=k==='NEXT_PAGE'?1:-1;choose(st,pages,positions[(positions.indexOf(st.page)+offset+positions.length)%positions.length]);return st;} const pairs={PERF_INIT:['PERF_INIT','PERF_LIMITS'],PERF_LIMITS:['PERF_INIT','PERF_LIMITS'],RTE:['RTE','FLIGHT_PLAN'],FLIGHT_PLAN:['RTE','FLIGHT_PLAN'],PROG:['PROG','PROG2'],PROG2:['PROG','PROG2']}; if(pairs[st.page]){ const page=pairs[st.page];choose(st,pages,st.page===page[0]?page[1]:page[0]); }else addMessage(st,'END OF PAGES'); return st; }
 addMessage(st,'KEY INACTIVE');return st;}
function pairLine(left='',right=''){ let l=String(left).slice(0,11); let r=String(right).slice(0,11); return l.padEnd(12,' ')+r.padStart(12,' '); }
function shown(st,val,pageName=''){return String(val??'').replace(/\{([A-Z_0-9]+)\}/g,(_,key)=>readValue(st,key,pageName)||'----');}
function render(st,pages){const p=pages[st.page];if(!p)return Array(14).fill('');const lines=Array(14).fill('');if(['PERF_INIT','PERF_LIMITS'].includes(st.page)){const v=st.page==='PERF_INIT'?perfRows(st):perfLimitsRows(st);lines[0]=v.title.padEnd(20)+' '+v.number+'/'+v.count;v.rows.forEach((r,i)=>{lines[1+i*2]=r.separator?'------------------------':r.centerLabel?r.centerLabel.padStart(Math.ceil((24+r.centerLabel.length)/2)):pairLine(r.labelL,r.labelR);lines[2+i*2]=r.centerValue||pairLine(r.valueL,r.valueR);});lines[13]=st.message||st.scratch||'';return lines;}const tag=(pendingCount(st)>0)?'MOD ':'ACT ';
 const title=(['MENU','INDEX','IDENT','POS_INIT','MESSAGES','MSG_RECALL','NAV_DATA','NAV_OPTIONS','SUPP_NAV','POS_REF','FIX','PROG','PROG2','HOLD','DEP_ARR','DEPARTURES','ARRIVALS'].includes(st.page)?'':tag)+p.title;
 lines[0]=title.slice(0,18).padEnd(20,' ')+((p.page_number||1)+'/'+p.page_count).padStart(4,' ');
 for(let i=0;i<6;i++){
   const pair=p.rows[i];const left=pair[0],right=pair[1];
  const index=st.page==='INDEX';
  lines[1+i*2]=index?'':pairLine(left.label,right.label);
   const display=c=>c.field?(getPromptPolicy()?.placeholder(st.page,c,(field,page)=>readValue(st,field,page))||readValue(st,c.field,st.page)||(c.required?'□□□□':'-----')):shown(st,c.value,st.page);
  lines[2+i*2]=index?pairLine(i===5?(st.indexOffsetAvailable===true?'<OFFSET':''):left.label,
   i===5&&st.fmcOnGroundVerified===false?'NAV STATUS>':right.label):pairLine(display(left),display(right));
 }
 lines[13]=st.message||st.scratch||'';
 return lines.map(l=>String(l).slice(0,24)); }
function lights(st){return {CALL:!!st.call,FAIL:!!st.fail,MSG:!!st.message,OFST:!!st.offsetGuidance,EXEC:st.routeActivationArmed===true||executableKeys(st).length>0};}
function inspect(st,pages,key){if(!/^([LR][1-6])$/.test(key))return null;const c=pages[st.page]?.rows[Number(key[1])-1]?.[key[0]==='L'?0:1];return c?{page:st.page,lsk:key,...c,reference:pages[st.page].source_ref}:null;}
return {clearOriginLocal,perfRows,perfLimitsRows,perfData,settlePerfWeight,makeState,press,pressLSK,pendingCount,readValue,render,lights,inspect,validate,clearPending,choose,hasStagedRoute};
});
