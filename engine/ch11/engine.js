/* B737CL FCOM Vol.2 Chapter 11 training foundation.
 * FCOM-linked behavior is identified by printed folio and PDF page in requirements.v1.json.
 * This is NOT a certified FMC, nav database, performance computer or avionics model.
 * Public code contains original implementation, not Boeing manual text.
 */
(function(root,factory){'use strict';const x=factory();if(typeof module==='object'&&module.exports)module.exports=x;if(root)root.CH11Engine=x;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const COLS=24,ROWS=14;
 const SOURCE={lsks:'11.10.3',annunciators:'11.10.4',execute:'11.10.6',alpha:'11.10.7',format:'11.10.8–11.10.9',dataEntry:'11.31.50–11.31.51',message:'11.60.1–11.60.17'};
 const PAGES={
 MENU:{title:'MENU',source:'11.40.70',links:{L1:'INDEX',L2:'ACARS_UNAVAILABLE'}},
 INDEX:{title:'INIT/REF INDEX',source:'11.40.4',links:{L1:'IDENT',R1:'POS_INIT',L2:'RTE',R2:'PERF_INIT',L3:'TAKEOFF',R3:'N1_LIMIT',L4:'APP_REF',L6:'MENU'}},
 IDENT:{title:'IDENT',source:'11.40.8',links:{L6:'INDEX',R6:'POS_INIT'},fields:{L1:{readOnly:true,value:'737-CLASSIC'},R2:{readOnly:true,value:'NAV DATA N/A'}}},
 POS_INIT:{title:'POS INIT',source:'11.40.11',pages:3,links:{L6:'INDEX',R6:'RTE'},fields:{L2:{name:'REF_AIRPORT',kind:'icao'},L3:{name:'GATE',kind:'gate'},R4:{name:'IRS_POS',kind:'coordinate',enableInStandalone:true}}},
 RTE:{title:'RTE',source:'11.40.22',pages:2,links:{L6:'INDEX',R6:'LEGS'},fields:{L1:{name:'ORIGIN',kind:'icao',required:true},R1:{name:'DEST',kind:'icao',required:true},R2:{name:'FLIGHT',kind:'flight'},L2:{name:'CO_ROUTE',kind:'free'},L3:{name:'RUNWAY',kind:'runway'}}},
 DEP_ARR:{title:'DEP/ARR INDEX',source:'11.40.32',links:{L6:'RTE'}},
 LEGS:{title:'RTE LEGS',source:'11.41.9',pages:2,links:{L6:'RTE',R6:'PROG'},fields:{L1:{name:'WPT1',kind:'waypoint'},L2:{name:'WPT2',kind:'waypoint'},L4:{name:'OFFSET',kind:'offset'}}},
 PERF_INIT:{title:'PERF INIT',source:'11.40.37',links:{L6:'INDEX',R6:'N1_LIMIT'},fields:{L3:{name:'CI',kind:'ci'},R3:{name:'CRZ_ALT',kind:'altitude'},L2:{name:'ZFW',kind:'decimal_weight'}}},
 N1_LIMIT:{title:'N1 LIMIT',source:'11.40.46',links:{L6:'INDEX',R6:'TAKEOFF'},fields:{L1:{name:'N1',kind:'percent'}}},
 TAKEOFF:{title:'TAKEOFF REF',source:'11.40.51',pages:2,links:{L6:'INDEX'},fields:{L1:{name:'FLAPS',kind:'flaps'},R1:{name:'V1',kind:'airspeed'},R2:{name:'VR',kind:'airspeed'},R3:{name:'V2',kind:'airspeed'}}},
 CLB:{title:'CLB',source:'11.41.3',links:{L6:'INDEX'},fields:{L1:{name:'CLB_SPEED',kind:'airspeed'},R2:{name:'CRZ_ALT',kind:'altitude'}}},
 CRZ:{title:'CRZ',source:'11.42.29',links:{L6:'INDEX',R6:'PROG'},fields:{L1:{name:'CRZ_ALT',kind:'altitude'},L2:{name:'CRZ_SPEED',kind:'airspeed'}}},
 DES:{title:'DES',source:'11.43.2',links:{L6:'INDEX'},fields:{L1:{name:'DES_SPEED',kind:'airspeed'}}},
 PROG:{title:'PROGRESS',source:'11.41.15',links:{L6:'LEGS'}},
 HOLD:{title:'HOLD',source:'11.43.31',links:{L6:'LEGS'},fields:{L1:{name:'HOLD_FIX',kind:'waypoint'},L2:{name:'INBD_BRG',kind:'bearing'}}},
 FIX:{title:'FIX INFO',source:'11.42.77',links:{L6:'LEGS'},fields:{L1:{name:'FIX',kind:'waypoint'},R1:{name:'RADIAL',kind:'bearing'}}},
 APP_REF:{title:'APPROACH REF',source:'11.43.27',links:{L6:'INDEX'}},
 MESSAGES:{title:'FMC MESSAGES',source:'11.60.1',links:{L6:'MENU'}}
 };
 const SEVERITY={alert:0,entry_error:1,advisory:2};
 const KEYS={INIT_REF:'INDEX',RTE:'RTE',CLB:'CLB',CRZ:'CRZ',DES:'DES',MENU:'MENU',LEGS:'LEGS',DEP_ARR:'DEP_ARR',HOLD:'HOLD',PROG:'PROG',N1_LIMIT:'N1_LIMIT',FIX:'FIX'};
 function createState(options={}){return {schema:'ch11-cdu-training-state/1',standalone:options.standalone!==false,aircraftVariant:options.aircraftVariant||'737CL_UNSPECIFIED',page:'MENU',subpage:1,cdU:'CAPT',scratch:'',savedScratch:'',messages:[],active:{ORIGIN:'',DEST:'',CRZ_ALT:'',CRZ_SPEED:'',POS:'',FLIGHT:'',WPT1:'',WPT2:'',OFFSET:''},pending:{},requiredUnfilled:[],status:{call:false,fail:false,lnavOffsetGuidance:false,externalFmcAlert:false},brightness:1,events:[],sequence:0};}
 function clone(s){return {...s,active:{...s.active},pending:{...s.pending},status:{...s.status},messages:s.messages.map(m=>({...m})),events:s.events.slice()};}
 function hasPending(s){return Object.keys(s.pending).length>0}
 function displayedMessage(s){if(s.scratch && s.scratch!=='DELETE')return null;const msgs=s.messages.filter(m=>!m.suppressed).sort((a,b)=>SEVERITY[a.severity]-SEVERITY[b.severity]||a.id-b.id);return msgs[0]||null;}
 function annunciators(s){const msg=displayedMessage(s);return {CALL:!!s.status.call,FAIL:!!s.status.fail,MSG:!!msg,OFST:!!s.status.lnavOffsetGuidance,EXEC:hasPending(s),FMC_ALERT:s.messages.some(x=>x.severity==='alert'&&!x.cleared)};}
 function navigate(s,page){if(!PAGES[page]){notify(s,'PAGE UNAVAILABLE','entry_error');return} s.page=page;s.subpage=1;}
 function notify(s,text,severity='entry_error',scope='CAPT'){const m={id:s.sequence+1,text:String(text).slice(0,24).toUpperCase(),severity,scope};if(severity==='entry_error'){s.savedScratch=s.scratch;s.scratch='';s.messages=s.messages.filter(x=>x.severity!=='entry_error')}s.messages.push(m);return m;}
 function clearKey(s,all=false){const msg=displayedMessage(s);if(msg){s.messages=s.messages.filter(m=>m.id!==msg.id);if(msg.severity==='entry_error')s.scratch=s.savedScratch;s.savedScratch='';return}
  if(all){s.scratch='';return} if(s.scratch==='DELETE')s.scratch='';else s.scratch=s.scratch.slice(0,-1);}
 function append(s,ch){if(s.scratch==='DELETE')s.scratch=''; if(s.messages.some(m=>m.severity==='entry_error')){s.messages=s.messages.filter(m=>m.severity!=='entry_error');s.scratch='';s.savedScratch='';} if(s.scratch.length<24)s.scratch+=ch;}
 function isDigit(s){return /^\d+$/.test(s)}
 function validate(kind,input){const val=String(input).trim().toUpperCase();if(!val)return {valid:false,error:'INVALID ENTRY'};
  switch(kind){
   case 'icao':return /^[A-Z]{4}$/.test(val)?{valid:true,value:val}:{valid:false,error:'INVALID ENTRY'};
   case 'bearing':return /^\d{3}$/.test(val)&&Number(val)<=360?{valid:true,value:val==='360'?'000':val}:{valid:false,error:'INVALID ENTRY'};
   case 'altitude':{
     const v=val.replace(/^FL/,'');const fl=val.startsWith('FL');if(!/^\d{3,5}$/.test(v))return {valid:false,error:'INVALID ENTRY'};
     if(fl && v.length!==3)return {valid:false,error:'INVALID ENTRY'};
     if(v.length===3)return {valid:true,value:fl?'FL'+v:v};
     const feet=Number(v);if(feet>50000||feet<-1000)return {valid:false,error:'INVALID ENTRY'};
     if(v.length===4&&feet>9994)return {valid:false,error:'INVALID ENTRY'};
     return {valid:true,value:String(Math.round(feet/10)*10)};
    }
   case 'airspeed': return (/^\d{3}$/.test(val)&&Number(val)>=100&&Number(val)<=399) || (/^\.\d{1,3}$/.test(val)&&Number(val)>0&&Number(val)<1)?{valid:true,value:val}:{valid:false,error:'INVALID ENTRY'};
   case 'ci':return /^\d{1,3}$/.test(val)?{valid:true,value:String(Number(val))}:{valid:false,error:'INVALID ENTRY'};
   case 'offset':{
    const m=/^([LR])(\d{1,2}(?:\.\d)?)$/.exec(val);
    return m && Number(m[2])>0 && Number(m[2])<=99.9 ?{valid:true,value:m[1]+m[2]}:{valid:false,error:'INVALID ENTRY'};
   }
   case 'waypoint':return /^[A-Z0-9]{2,7}$/.test(val)?{valid:true,value:val}:{valid:false,error:'INVALID ENTRY'};
   case 'runway':return /^(?:0?[1-9]|[12]\d|3[0-6])[LRC]?$/.test(val)?{valid:true,value:val}:{valid:false,error:'INVALID ENTRY'};
   case 'flight':return /^[A-Z0-9]{2,10}$/.test(val)?{valid:true,value:val}:{valid:false,error:'INVALID ENTRY'};
   case 'flaps':return /^(1|2|5|10|15|25|30|40)$/.test(val)?{valid:true,value:val}:{valid:false,error:'INVALID ENTRY'};
   case 'percent':return /^\d{1,3}(?:\.\d)?$/.test(val)&&Number(val)<=110?{valid:true,value:val}:{valid:false,error:'INVALID ENTRY'};
   case 'decimal_weight':return /^\d{1,3}(?:\.\d)?$/.test(val)?{valid:true,value:val}:{valid:false,error:'INVALID ENTRY'};
   case 'coordinate':return /^[NS]\d{2}\d{2}(?:\.\d)?[EW]\d{3}\d{2}(?:\.\d)?$/.test(val)?{valid:true,value:val}:{valid:false,error:'INVALID ENTRY'};
   case 'gate':case 'free':return val.length<=24?{valid:true,value:val}:{valid:false,error:'INVALID ENTRY'};
   default:return {valid:false,error:'UNSUPPORTED FIELD'};
  }
 }
 function fieldValue(s,name){if(Object.prototype.hasOwnProperty.call(s.pending,name))return s.pending[name];return s.active[name]||''}
 function interactLsk(s,loc){const page=PAGES[s.page];if(!page)return;
  const slot=page.fields?.[loc];if(slot){
   if(slot.readOnly){notify(s,'KEY INACTIVE','entry_error');return}
   if(!s.scratch){const v=fieldValue(s,slot.name);if(v)s.scratch=v;else notify(s,'INVALID ENTRY','entry_error');return}
   if(s.scratch==='DELETE'){if(slot.required){notify(s,'INVALID DELETE','entry_error');return} s.pending[slot.name]='';s.scratch='';return}
   const result=validate(slot.kind,s.scratch);
   if(!result.valid){notify(s,result.error,'entry_error');return}
   if(fieldValue(s,slot.name)!==result.value){s.pending[slot.name]=result.value;}s.scratch='';s.savedScratch='';return;
  }
  const link=page.links?.[loc];if(link){if(link==='ACARS_UNAVAILABLE')notify(s,'NOT AVAILABLE','advisory');else navigate(s,link);return}
  notify(s,'KEY INACTIVE','entry_error');
 }
 function keyPress(s,raw){let k=String(raw||'').replace(/^CDU_(CAPT|FO)_/,'');
  if(k.startsWith('LSK_')){interactLsk(s,k.slice(4));return}
  if(k==='EXEC'){if(hasPending(s)){for(const [key,value] of Object.entries(s.pending)){if(value==='')delete s.active[key];else s.active[key]=value;}s.pending={};s.messages=s.messages.filter(m=>m.severity==='alert');}return}
  if(k==='DIM_BRT'){s.brightness=s.brightness<=0.4?1:Math.round((s.brightness-.15)*100)/100;return}
  if(k==='KEY_CLR'){clearKey(s);return}
  if(k==='KEY_CLR_LONG'){clearKey(s,true);return}
  if(k==='KEY_DEL'){s.scratch='DELETE';return}
  if(k.startsWith('KEY_')){let val=k.slice(4);const special={SP:' ',DOT:'.',SLASH:'/'};if(val==='PLUS_MINUS'){const c=s.scratch[0];s.scratch=(c==='-'?'+':'-')+(c==='-'||c==='+'?s.scratch.slice(1):s.scratch);return}let ch= special[val]||val;if(ch.length===1)append(s,ch);return}
  if(k==='NEXT_PAGE'||k==='PREV_PAGE'){let total=PAGES[s.page]?.pages||1;if(total>1)s.subpage=((s.subpage-1+(k==='NEXT_PAGE'?1:total-1))%total)+1;return}
  if(KEYS[k])navigate(s,KEYS[k]);
 }
 function dispatch(input,event){if(!input||input.schema!=='ch11-cdu-training-state/1')throw new Error('invalid state');if(!event||!event.type)throw new Error('invalid event');const s=clone(input);s.sequence++;
  switch(event.type){
   case 'KEY':keyPress(s,event.key);break;
   case 'CLEAR_LONG':clearKey(s,true);break;
   case 'NAVIGATE':navigate(s,event.page);break;
   case 'MESSAGE':notify(s,event.text,event.severity||'advisory',event.scope||'CAPT');break;
   case 'SET_CALL':s.status.call=!!event.value;break;
   case 'SELF_TEST_FAIL':s.status.fail=!!event.value;break;
   case 'LNAV_OFFSET_GUIDANCE':s.status.lnavOffsetGuidance=!!event.value;break;
   case 'LOAD_DEMO':s.active={...s.active,...event.values};break;
   case 'RESET':return createState({standalone:s.standalone,aircraftVariant:s.aircraftVariant});
   default:throw new Error('unknown event '+event.type);
  }
  s.events.push({seq:s.sequence,type:event.type,key:event.key||null,page:s.page,source_folio:PAGES[s.page]?.source||null});if(s.events.length>500)s.events.shift();return s;
 }
 function line(a='',b=''){let l=String(a),r=String(b);if(l.length+r.length>COLS){l=l.slice(0,COLS);r=r.slice(0,Math.max(0,COLS-l.length));}return (l+' '.repeat(Math.max(0,COLS-l.length-r.length))+r).slice(0,COLS)}
 function display(s){let p=PAGES[s.page]||PAGES.MENU;const rows=Array.from({length:ROWS},()=>''.padEnd(COLS,' '));
  rows[0]=line((hasPending(s)?'MOD ':'')+p.title, s.subpage+'/'+(p.pages||1));
  if(s.page==='MENU'){rows[2]=line('<FMC','');rows[4]=line('<ACARS N/A','');}
  else if(s.page==='INDEX'){rows[2]=line('<IDENT','POS INIT>');rows[4]=line('<RTE','PERF INIT>');rows[6]=line('<TAKEOFF','N1 LIMIT>');rows[8]=line('<APPROACH','');rows[12]=line('<MENU','');}
  else if(s.page==='IDENT'){rows[2]=line('MODEL','NAV DATA');rows[3]=line('737-CL','NOT INSTALLED');rows[12]=line('<INDEX','POS INIT>');}
  else if(s.page==='RTE'){rows[1]=line('ORIGIN','DEST');rows[2]=line(fieldValue(s,'ORIGIN')||'□□□□',fieldValue(s,'DEST')||'□□□□');rows[3]=line('CO ROUTE','FLT NO');rows[4]=line(fieldValue(s,'CO_ROUTE')||'--------',fieldValue(s,'FLIGHT')||'--------');rows[5]=line('RUNWAY','');rows[6]=line(fieldValue(s,'RUNWAY')||'-----');rows[12]=line('<INDEX','LEGS>');}
  else if(s.page==='POS_INIT'){rows[1]=line('REF AIRPORT','');rows[2]=line(fieldValue(s,'REF_AIRPORT')||'□□□□');rows[3]=line('GATE','');rows[4]=line(fieldValue(s,'GATE')||'-----');rows[7]=line('SET IRS POS','');rows[8]=line(fieldValue(s,'IRS_POS')||'TRAINER ONLY');rows[12]=line('<INDEX','ROUTE>');}
  else if(s.page==='LEGS'){rows[1]=line('VIA','TO');rows[2]=line('DIRECT',fieldValue(s,'WPT1')||'-----');rows[4]=line('DIRECT',fieldValue(s,'WPT2')||'-----');rows[7]=line('OFFSET','');rows[8]=line(fieldValue(s,'OFFSET')||'OFF');rows[12]=line('<RTE','PROG>');}
  else if(s.page==='PERF_INIT'){rows[1]=line('ZFW','CRZ ALT');rows[2]=line(fieldValue(s,'ZFW')||'---.-',fieldValue(s,'CRZ_ALT')||'-----');rows[5]=line('COST INDEX','');rows[6]=line(fieldValue(s,'CI')||'---');rows[12]=line('<INDEX','N1 LIMIT>');}
  else if(s.page==='TAKEOFF'){rows[1]=line('FLAPS','V1');rows[2]=line(fieldValue(s,'FLAPS')||'---',fieldValue(s,'V1')||'---');rows[3]=line('VR','V2');rows[4]=line(fieldValue(s,'VR')||'---',fieldValue(s,'V2')||'---');rows[12]=line('<INDEX','');}
  else if(s.page==='CRZ'){rows[1]=line('CRZ ALT','TGT SPD');rows[2]=line(fieldValue(s,'CRZ_ALT')||'-----',fieldValue(s,'CRZ_SPEED')||'---');rows[12]=line('<INDEX','PROG>');}
  else if(s.page==='HOLD'){rows[1]=line('HOLD AT','');rows[2]=line(fieldValue(s,'HOLD_FIX')||'-----');rows[3]=line('INBD CRS','');rows[4]=line(fieldValue(s,'INBD_BRG')||'---');rows[12]=line('<LEGS','');}
  else if(s.page==='FIX'){rows[1]=line('FIX','RAD/DIS');rows[2]=line(fieldValue(s,'FIX')||'-----',fieldValue(s,'RADIAL')||'---');rows[12]=line('<LEGS','');}
  else if(s.page==='CLB'||s.page==='DES'){rows[1]=line('SPEED','');rows[2]=line(fieldValue(s,s.page==='CLB'?'CLB_SPEED':'DES_SPEED')||'---');rows[12]=line('<INDEX','');}
  else if(s.page==='N1_LIMIT'){rows[1]=line('N1 LIMIT','');rows[2]=line(fieldValue(s,'N1')||'---');rows[12]=line('<INDEX','TAKEOFF>');}
  else {rows[2]=line('TRAINER PAGE','');rows[4]=line('NO ENGINE DATA','');rows[12]=line('<INDEX','');}
  const message=displayedMessage(s);rows[13]=line(message?.text||s.scratch||'');
  if(rows.some(r=>r.length!==COLS))throw Error('display layout invariant');
  return {rows,columns:COLS,rowsCount:ROWS,page:s.page,printedFcomPage:p.source,subpage:s.subpage,sourceStatus:'TRAINING_APPROXIMATION_NOT_PIXEL_IDENTICAL',annunciators:annunciators(s),scratchpadMessage:message};
 }
 return Object.freeze({createState,dispatch,display,annunciators,validate,SEVERITY,PAGES,SOURCE,COLS,ROWS});
});