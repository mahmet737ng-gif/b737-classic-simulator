/* B737 Classic U7.1 training CDU. FCOM 11.40.13–18, 11.41.7–9, 11.41.11–23. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CDU_CH11_ROUTE_PAGES=api;
})(typeof globalThis==='undefined'?null:globalThis,function(root){
 'use strict';
 const RTE=new Set(['RTE','FLIGHT_PLAN','ACTIVATE']);
 const SOURCE='PMDG_WORLD_2610_WITH_PROCEDURES_R1';
 const ROUTE_FIELD=/^(?:ORIGIN|DEST|CO_ROUTE|FLIGHT|RUNWAY|(?:VIA|TO)\d+)$/;
 const DASH='------------';
 const empty=()=>({labelL:'',valueL:'',labelR:'',valueR:''});
 const pair=(labelL='',valueL='',labelR='',valueR='',extra={})=>({labelL,valueL,labelR,valueR,...extra});
 const limits={ORIGIN:'ICAO',DEST:'ICAO',CO_ROUTE:'ROUTE',FLIGHT:'FLIGHT',RUNWAY:'RUNWAY'};
 const field=(side,name,format,required=false)=>({side,field:name,format,required});
 const isRouteField=name=>ROUTE_FIELD.test(name);
 const modified=s=>s.routeActivationArmed===true||s.stage6AwaitingExec===true||
  !!s.stage6PendingPlan||(s.routeActivated===true&&Object.keys(s.pending).some(isRouteField));
 const sourcePlan=s=>s.stage6PendingPlan||s.stage5Pending||s.stage5Committed;
 const currentNav=s=>s.navdbPending||s.navdbActive;
 const entered=(s,name)=>s.pending[name]??s.stagedRoute[name]??s.active[name]??'';
 const routeStatus=s=>modified(s)?'MOD ':s.routeActivated||s.stage5Committed||s.navdbActive?'ACT ':'';
 const titleWithStatus=(s,title)=>(routeStatus(s)+title);
 function segments(s){
  const plan=sourcePlan(s);
  if(plan&&root?.NPE_STAGE5_MODEL){
   return root.NPE_STAGE5_MODEL.rows(plan,'RTE').map(x=>({via:x.via==='DCT'?'DIRECT':x.via,to:x.to}));
  }
  const nav=currentNav(s);
  if(nav?.legs?.length){
   const result=[];
   for(const leg of nav.legs){
    const via=leg.via==='DCT'?'DIRECT':String(leg.via||'DIRECT');
    const previous=result.at(-1);
    if(previous&&via!=='DIRECT'&&previous.via===via)previous.to=leg.to;
    else result.push({via,to:leg.to});
   }
   return result;
  }
  const keys=new Set([...Object.keys(s.active),...Object.keys(s.pending),...Object.keys(s.stagedRoute)]);
  const last=Math.max(0,...[...keys].map(k=>/^(?:VIA|TO)(\d+)$/.exec(k)).filter(Boolean)
   .map(m=>Number(m[1])).filter(n=>n<=250&&(entered(s,'VIA'+n)||entered(s,'TO'+n))));
  return Array.from({length:last},(_,i)=>{
   const via=entered(s,'VIA'+(i+1)),to=entered(s,'TO'+(i+1));
   return {via:via==='DCT'||(!via&&to)?'DIRECT':via,to};
  });
 }
 function routeCount(list){
  return list.length<2?1:1+Math.ceil((list.length-1)/5);
 }
 function routeNumber(s,list){
  return s.page==='FLIGHT_PLAN'?Math.min(routeCount(list),Math.max(2,s.subpage||2)):1;
 }
 function canActivate(s,list=segments(s)){
  return !s.routeActivated&&!modified(s)&&/^[A-Z]{4}$/.test(entered(s,'ORIGIN'))&&
   /^[A-Z]{4}$/.test(entered(s,'DEST'))&&entered(s,'ORIGIN')!==entered(s,'DEST')&&
   list.some(x=>x.to)&&list.every(x=>x.to);
 }
 function routeAction(s,list){
  if(modified(s))return {label:'<ERASE',side:'L',command:'erase'};
  if(canActivate(s,list))return {label:'ACTIVATE>',side:'R',command:'activate'};
  if(!s.routeActivated)return null;
  if(s.fmcOnGroundVerified===true){
   const a=s.active;
   const perfReady=Boolean((a.GW_CG||a.ZFW)&&a.RESERVES&&a.CI&&a.CRZ_ALT);
   return perfReady?{label:'TAKEOFF>',side:'R',page:'TAKEOFF'}:
    {label:'PERF INIT>',side:'R',page:'PERF_INIT'};
  }
  if(s.fmcOnGroundVerified===false&&s.indexOffsetAvailable===true)
   return {label:'OFFSET>',side:'R',page:'OFFSET'};
  return null;
 }
 function routeRow(list,n,head){
  const entry=list[n-1],next=n===list.length+1;
  return pair(head?'VIA':'',entry?.via||(next?'---':''),head?'TO':'',
   entry?.to||(entry?.via?'□□□□□':next?'---':''));
 }
 function route(s){
  const list=segments(s),number=routeNumber(s,list),rows=[];
  if(number===1){
   rows.push(pair('ORIGIN',entered(s,'ORIGIN')||'□□□□','DEST',entered(s,'DEST')||'□□□□'));
   rows.push(pair('CO ROUTE',entered(s,'CO_ROUTE')||'----------','FLT NO.',entered(s,'FLIGHT')||'--------'));
   rows.push(pair('RUNWAY',entered(s,'RUNWAY')||'-----'));
  }
  const first=number===1?1:3+(number-2)*5;
  const count=number===1?2:5;
  for(let i=0;i<count;i++)rows.push(routeRow(list,first+i,i===0));
  const action=routeAction(s,list);
  const needsActivation=s.stage6PendingPlan&&!s.stage6AwaitingExec;
  rows.push(pair(DASH,action?.side==='L'?action.label:'',DASH,
   needsActivation?'ACTIVATE>':action?.side==='R'?action.label:''));
  return {title:titleWithStatus(s,'RTE'),number,count:routeCount(list),rows};
 }
 function routeCell(s,k){
  if(!RTE.has(s.page)||!/^LSK_[LR][1-5]$/.test(k))return null;
  const side=k[4],line=Number(k[5]),list=segments(s),number=routeNumber(s,list);
  if(number===1&&line<=3){
   const name={L1:'ORIGIN',R1:'DEST',L2:'CO_ROUTE',R2:'FLIGHT',L3:'RUNWAY'}[side+line];
   return name?field(side,name,limits[name],line===1):null;
  }
  const n=number===1?line-3:3+(number-2)*5+line-1;
  if(n>list.length+1||sourcePlan(s)||currentNav(s))return null;
  return side==='L'?field(side,'VIA'+n,'AIRWAY'):field(side,'TO'+n,'WAYPOINT');
 }
 function activeReferenceRoute(s){
  if(!s.routeActivated)return null;
  const evidence=s.activeNavFixEvidence||{};
  const point=(field)=>{
   const fix=evidence[field];
   if(fix?.ident!==s.active[field]||!Number.isFinite(fix?.lat)||!Number.isFinite(fix.lon)||
    Math.abs(fix.lat)>90||Math.abs(fix.lon)>180)return null;
   return {name:fix.ident,lat:fix.lat,lon:fix.lon,leg:'REFERENCE'};
  };
  const origin=point('ORIGIN'),dest=point('DEST');
  if(!origin||!dest)return null;
  const fixes=[];
  const to=Object.keys(s.active).map(key=>/^TO(\d+)$/.exec(key)).filter(Boolean)
   .map(m=>Number(m[1])).sort((a,b)=>a-b);
  for(const n of to){
   const via=s.active['VIA'+n],fix=point('TO'+n);
   if(!fix||via&&!['DIRECT','DCT'].includes(via))return null;
   fixes.push(fix);
  }
  if(!fixes.length)return null;
  if(fixes.at(-1).name!==dest.name)fixes.push(dest);
  return {source:SOURCE,points:[origin,...fixes]};
 }
 function navLegs(s){
  const plan=sourcePlan(s),nav=currentNav(s);
  if(plan?.items){
   return plan.items.filter(x=>x.type==='FIX'||x.type==='DISCONTINUITY')
    .map(x=>({ident:x.label,gap:x.type==='DISCONTINUITY',course:x.reference_course_true_deg,
     distance:x.reference_leg_distance_nm}));
  }
  if(nav?.legs)return nav.legs.map(x=>({ident:x.to,gap:x.discontinuity,course:x.trueInitialTrackDeg,distance:x.distanceNm}));
  const reference=activeReferenceRoute(s);
  if(reference&&!modified(s))return reference.points.slice(1).map((x,i)=>{
   const start=reference.points[i],rad=Math.PI/180;
   const a=start.lat*rad,b=x.lat*rad,longitude=(x.lon-start.lon)*rad;
   const chord=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(longitude/2)**2;
   const bearing=Math.atan2(Math.sin(longitude)*Math.cos(b),
    Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(longitude));
   return {ident:x.name,distance:3440.065*2*Math.asin(Math.sqrt(Math.min(1,chord))),course:(bearing/rad+360)%360};
  });
  return segments(s).filter(x=>x.to).map(x=>({ident:x.to}));
 }
 const track=n=>Number.isFinite(n)?String(Math.round(n)%360).padStart(3,'0')+'°T':'';
 const nm=n=>Number.isFinite(n)&&n>=0?String(Math.round(n))+'NM':'';
 function legs(s){
  const all=navLegs(s),count=Math.max(1,Math.ceil((all.length+1)/5));
  const number=Math.min(count,Math.max(1,s.subpage||1)),rows=[];
  const at=(number-1)*5;
  for(let i=0;i<5;i++){
   const leg=all[at+i];
   if(!leg){rows.push(pair('',at+i===all.length?'-----':''));continue;}
   if(leg.gap){rows.push(pair('ROUTE DISCONTINUITY','□□□□□'));continue;}
   rows.push(pair(track(leg.course),leg.ident,nm(leg.distance),s.active['LEG_CONSTRAINT_'+(at+i)]||''));
  }
  const action=routeAction(s);
  const right=canActivate(s)||s.stage6PendingPlan&&!s.stage6AwaitingExec?'ACTIVATE>':
   s.routeActivated||s.navdbActive||s.stage5Committed?'RTE DATA>':'';
  rows.push(pair(DASH,action?.command==='erase'?'<ERASE':'',DASH,right));
  return {title:titleWithStatus(s,'RTE LEGS'),number,count,rows};
 }
 function erase(s){
  for(const key of Object.keys(s.pending))if(isRouteField(key))delete s.pending[key];
  s.stagedRoute={};
  s.navFixEvidence={...s.activeNavFixEvidence};
  s.routeActivationArmed=false;
  s.scratch='';s.message='';
  if(s.stage5Pending){delete s.stage5Pending;s.stage5AwaitingExec=false;}
  if(s.stage6PendingPlan){delete s.stage6PendingPlan;s.stage6AwaitingExec=false;s.stage6Selections={};}
  if(s.navdbPending){delete s.navdbPending;delete s.navdbStage;}
 }
 function invoke(s,pages,key,core){
  const rte=RTE.has(s.page),legPage=s.page==='LEGS';
  if(key==='NEXT_PAGE'||key==='PREV_PAGE'){
   const change=key==='NEXT_PAGE'?1:-1;
   if(rte&&s.page!=='ACTIVATE'){
    const list=segments(s),count=routeCount(list);
    const number=(routeNumber(s,list)-1+change+count)%count+1;
    core.choose(s,pages,number===1?'RTE':'FLIGHT_PLAN');s.subpage=number;
    return true;
   }
   if(legPage){
    const {count,number}=legs(s);
    s.subpage=(number-1+change+count)%count+1;s.message='';return true;
   }
   if(s.page==='PROG'||s.page==='PROG2'){
    const number=s.page==='PROG'?1:s.subpage===3?3:2;
    const next=(number-1+change+3)%3+1;
    core.choose(s,pages,next===1?'PROG':'PROG2');s.subpage=next;return true;
   }
  }
  if(key==='LSK_R6'&&(rte||legPage)){
   const command=routeAction(s,segments(s));
   if(command?.command==='activate'){
    const page=s.page,subpage=s.subpage;
    core.activateStagedRoute(s,pages);
    s.page=page==='ACTIVATE'?'RTE':page;s.subpage=subpage;
    s.routeActivationArmed=true;
    return true;
   }
   const target=legPage?(s.routeActivated||s.navdbActive||s.stage5Committed?'RTE_DATA':null):command?.page;
   if(target){core.choose(s,pages,target);return true;}
  }
  if(key==='LSK_L6'&&(rte||legPage)&&modified(s)){erase(s);return true;}
  if(rte&&/^LSK_/.test(key)){
   const cell=routeCell(s,key);
   if(!cell){core.addMessage(s,'KEY INACTIVE');return true;}
   if((cell.field==='ORIGIN'||cell.field==='CO_ROUTE')&&s.routeActivated&&s.fmcOnGroundVerified===false&&s.scratch){
    core.addMessage(s,'INVALID ENTRY');return true;
   }
   if(s.routeActivated&&cell.required&&s.scratch==='DELETE'){
    core.addMessage(s,'INVALID DELETE');return true;
   }
   if(cell.field==='CO_ROUTE'&&s.scratch&&s.scratch!=='DELETE'){
    core.addMessage(s,'NOT IN DATABASE');return true;
   }
   if(cell.field==='FLIGHT'&&s.scratch!=='DELETE'&&s.scratch.length>8){
    core.addMessage(s,'INVALID ENTRY');return true;
   }
   if(cell.field.startsWith('VIA')&&['DCT','DIRECT'].includes(s.scratch))s.scratch='DIRECT';
   const before=entered(s,cell.field),input=s.scratch;
   if(s.routeActivated)core.field(s,cell);
   else core.stageRouteField(s,cell);
   if(input&&s.scratch===''&&cell.field==='ORIGIN'&&before&&entered(s,'ORIGIN')!==before){
    const draft=s.routeActivated?s.pending:s.stagedRoute;
    for(const name of new Set([...Object.keys(s.active),...Object.keys(draft)]))
     if(isRouteField(name)&&name!=='ORIGIN')draft[name]='';
   }
   if(input==='DELETE'&&cell.field.startsWith('TO')&&s.scratch===''){
    const draft=s.routeActivated?s.pending:s.stagedRoute;
    draft['VIA'+cell.field.slice(2)]='';
   }
   return true;
  }
  if(legPage&&/^LSK_/.test(key)){
   const index=(legs(s).number-1)*5+Number(key[5])-1,leg=navLegs(s)[index];
   if(key.startsWith('LSK_L')&&Number(key[5])<=5&&leg&&!leg.gap&&!s.scratch){
    s.scratch=leg.ident;s.message='';
   }else core.addMessage(s,'KEY INACTIVE');
   return true;
  }
  return false;
 }
 const utc=value=>typeof value==='string'&&/^\d{4}Z$/.test(value)?value:'';
 const fixed=(value,n=0)=>Number.isFinite(value)?value.toFixed(n):'';
 const mass=kg=>Number.isFinite(kg)&&kg>=0?fixed(kg/1000,1):'';
 const wind=(direction,speed)=>Number.isFinite(direction)&&Number.isFinite(speed)?
  String(Math.round(direction)%360).padStart(3,'0')+'°/'+Math.round(speed)+'KT':'';
 function progress(s){
  const f=s.fmcPageInputs??{},p=f.predictions?.quality==='VALID'?f.predictions:{};
  const flight=s.active.FLIGHT?'FLT '+s.active.FLIGHT+' ':'';
  const number=s.page==='PROG'?1:s.subpage===3?3:2;
  const rows=Array.from({length:6},empty);
  if(number===2){
   rows[0]=pair('RTA WPT','-----');
   return {title:'RTA PROGRESS',number,count:3,rows};
  }
  if(number===3){
   rows[1]=pair('WIND',wind(f.motion?.windFromDeg,f.motion?.windKt),'SAT/ISA DEV',
    Number.isFinite(f.airData?.satC)?fixed(f.airData.satC)+'°C':'');
   rows[2]=pair('XTK ERROR','','VERT DEV','');
   rows[3]=pair('','','TAS',Number.isFinite(f.airData?.tasKt)?fixed(f.airData.tasKt)+'KT':'');
   return {title:flight+'PROGRESS',number,count:3,rows};
  }
  const from=p.from??{},active=p.active??{},next=p.next??{},dest=p.destination??{};
  const metrics=(x,time)=>[fixed(x.distanceNm),utc(time),mass(x.fuelKg)].filter(Boolean).join(' ');
  rows[0]=pair('FROM',from.ident||'','ALT  ATA  FUEL',
   [Number.isFinite(from.altitudeFt)?'FL'+Math.round(from.altitudeFt/100):'',utc(from.ata),mass(from.fuelKg)].filter(Boolean).join(' '));
  rows[1]=pair(track(active.courseTrueDeg),active.ident||'','DTG  ETA  FUEL',metrics(active,active.eta));
  rows[2]=pair(track(next.courseTrueDeg),next.ident||'','',metrics(next,next.eta));
  rows[3]=pair(modified(s)?'MOD':'',dest.ident||s.active.DEST||'','',metrics(dest,dest.eta));
  rows[4]=pair(p.altitudeChange?.label||'',p.altitudeChange?metrics(p.altitudeChange,p.altitudeChange.eta):'',
   'FUEL QTY',f.fuel?.quality==='VALID'?mass(f.fuel.totalKg):'');
  rows[5]=pair('WIND',wind(f.motion?.windFromDeg,f.motion?.windKt));
  return {title:flight+'PROGRESS',number,count:3,rows};
 }
 function view(s){
  if(RTE.has(s.page))return route(s);
  if(s.page==='LEGS')return legs(s);
  if(s.page==='PROG'||s.page==='PROG2')return progress(s);
  return null;
 }
 return Object.freeze({view,invoke,routeCell,isRouteField,modified,canActivate,activeReferenceRoute});
});
