/* B737 Classic U7.1 training CDU. FCOM 11.40.13–18, 11.41.7–9, 11.41.11–23. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CDU_CH11_ROUTE_PAGES=api;
})(typeof globalThis==='undefined'?null:globalThis,function(root){
 'use strict';
 const RTE=new Set(['RTE','FLIGHT_PLAN','ACTIVATE']);
 const SOURCE='PMDG_WORLD_2610_WITH_PROCEDURES_R1';
 const ROUTE_FIELD=/^(?:ORIGIN|DEST|CO_ROUTE|FLIGHT|RUNWAY|SID|STAR|APP|WPT\d+(?:_CONSTRAINT)?|(?:VIA|TO)\d+|LEG_CONSTRAINT_[A-Z0-9_]+|HOLD_(?:[1-5]|PUB_[A-F0-9]{8}))$/;
 const DASH='------------';
 const ROUTE_ROWS=5,MAX_ROUTE_ROWS=250;
 const empty=()=>({labelL:'',valueL:'',labelR:'',valueR:''});
 const pair=(labelL='',valueL='',labelR='',valueR='',extra={})=>({labelL,valueL,labelR,valueR,...extra});
 const limits={ORIGIN:'ICAO',DEST:'ICAO',CO_ROUTE:'ROUTE',FLIGHT:'FLIGHT',RUNWAY:'RUNWAY'};
 const field=(side,name,format,required=false)=>({side,field:name,format,required});
 const isRouteField=name=>ROUTE_FIELD.test(name);
 const modified=s=>s.routeActivationArmed===true||s.stage6AwaitingExec===true||
  (s.routeActivated===true&&(!!s.stage6PendingPlan||Object.keys(s.pending).some(k=>isRouteField(k)&&s.pending[k]!==s.active[k])||Boolean(sourceSnapshot(s)?.modified)));
 const sourcePlan=s=>s.stage6PendingPlan||s.stage5Pending||s.stage5Committed;
 const currentNav=s=>s.navdbPending||s.navdbActive;
 const entered=(s,name)=>s.pending[name]??s.stagedRoute[name]??s.active[name]??'';
 const routeStatus=s=>modified(s)?'MOD ':s.routeActivated===true?'ACT ':'';
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
   .map(m=>Number(m[1])).filter(n=>n<=MAX_ROUTE_ROWS&&(entered(s,'VIA'+n)||entered(s,'TO'+n))));
  return Array.from({length:last},(_,i)=>{
   const via=entered(s,'VIA'+(i+1)),to=entered(s,'TO'+(i+1));
   return {via:via==='DCT'||(!via&&to)?'DIRECT':via,to};
  });
 }
 // Display-only procedures never become FMC flight plan legs.
 function displaySegments(s,native=segments(s)){
  let source=s.cduSgReference;
  if(!source)try{
   if(root?.parent&&root.parent!==root)source=root.parent.B737CduSgRouteV1?.snapshot?.();
  }catch(_){/* Different-origin embed. */}
  const origin=entered(s,'ORIGIN'),dest=entered(s,'DEST');
  const bank=source?.modified||source?.active;
  const valid=source?.connected===true&&source.sourceOnly===true&&
   source.fmcExecutable===false&&source.origin===origin&&source.destination===dest;
  function procedure(kind,airport){
   if(!valid||!airport)return null;
   const key=kind+'@'+airport,sel=bank?.selections?.[key],geo=bank?.geometries?.[key];
   if(!sel||!geo||sel.ident!==geo.ident||sel.sourceOnly!==true||
      geo.renderStyle!=='DASHED_REFERENCE_CHORDS_ONLY')return null;
   const verified=(geo.fixes||[]).filter(f=>typeof f?.ident==='string'&&
    /^[A-Z0-9._-]{2,16}$/.test(f.ident)&&Number.isFinite(f.lat)&&Number.isFinite(f.lon));
   return {via:sel.ident,to:verified.at(-1)?.ident||'-----',sourceOnly:true};
  }
  const rows=[],sid=procedure('SID',origin),star=procedure('STAR',dest);
  if(sid)rows.push(sid);
  native.forEach((line,i)=>{
   const raw=bank?.geometries?.['RTE@'+(i+1)]?.program?.input?.legs;
   const boundaryGap=(i>0&&native[i-1].via&&!native[i-1].to)||Array.isArray(raw)&&raw.some(l=>(l.Type??l.type)==='Discontinuity');
   rows.push({...line,nativeIndex:i+1,boundaryGap});
  });
  const boundary=star&&arrivalBoundary(s,native);
  if(boundary)rows.push({gap:true,via:'---',to:'□□□□□',nativeIndex:boundary.arrivalInsertIndex});
  if(star)rows.push({...star,arrivalInsertIndex:native.length+1});
  if(!boundary&&!sourcePlan(s)&&!currentNav(s)&&native.length<MAX_ROUTE_ROWS)
   rows.push({via:'---',to:'---',nativeIndex:native.length+1});
  return rows;
 }
 function routeCount(s,list){
  return 1+Math.max(1,Math.ceil(displaySegments(s,list).length/ROUTE_ROWS));
 }
 function routeNumber(s,list){
  return s.page==='FLIGHT_PLAN'?Math.min(routeCount(s,list),Math.max(2,s.subpage||2)):1;
 }
 function routeIncomplete(s){return !sourcePlan(s)&&!currentNav(s)&&segments(s).some(row=>row.via&&!row.to);}
 function canActivate(s,list=segments(s)){
  return !s.routeActivated&&!modified(s)&&/^[A-Z]{4}$/.test(entered(s,'ORIGIN'))&&
   /^[A-Z]{4}$/.test(entered(s,'DEST'))&&entered(s,'ORIGIN')!==entered(s,'DEST')&&
   (list.some(x=>x.to)||visibleLegs(s).some(x=>x.ident&&!x.gap))&&list.every(x=>x.to);
 }
 function routeAction(s,list){
  if(modified(s))return {label:'<ERASE',side:'L',command:'erase'};
  if(canActivate(s,list))return {label:'ACTIVATE>',side:'R',command:'activate'};
  if(!s.routeActivated)return null;
  if(s.fmcOnGroundVerified===true){
   const a=s.active;
   const perfReady=root.CDU_ENGINE?.perfData?.({...s,pending:{}})?.ready===true;
   return perfReady?{label:'TAKEOFF>',side:'R',page:'TAKEOFF'}:
    {label:'PERF INIT>',side:'R',page:'PERF_INIT'};
  }
  if(s.fmcOnGroundVerified===false&&s.indexOffsetAvailable===true)
   return {label:'OFFSET>',side:'R',page:'OFFSET'};
  return null;
 }
 function routeRow(list,n,head){
  const entry=list[n-1];
  if(entry?.gap)return pair('ROUTE DISCONTINUITY','---','','□□□□□');
  return pair(entry?.boundaryGap?'ROUTE DISCONTINUITY':head?'VIA':'',entry?.via||'',head?'TO':'',
   entry?.to||(entry?.via?'□□□□□':''));
 }
 function route(s){
  const native=segments(s),list=displaySegments(s,native),number=routeNumber(s,native),rows=[];
  if(number===1){
   rows.push(pair('ORIGIN',entered(s,'ORIGIN')||'□□□□','DEST',entered(s,'DEST')||'□□□□'));
   rows.push(pair('CO ROUTE',entered(s,'CO_ROUTE')||'----------','FLT NO.',entered(s,'FLIGHT')||'--------'));
   rows.push(pair('RUNWAY',entered(s,'RUNWAY')||'-----'),empty(),empty());
  }else{
   const first=1+(number-2)*ROUTE_ROWS;
   for(let i=0;i<ROUTE_ROWS;i++)rows.push(routeRow(list,first+i,i===0));
  }
  const action=routeAction(s,native);
  const needsActivation=!s.routeActivated&&s.stage6PendingPlan&&!s.stage6AwaitingExec;
  rows.push(pair(DASH,action?.side==='L'?action.label:'',DASH,
   needsActivation?'ACTIVATE>':action?.side==='R'?action.label:''));
  return {title:titleWithStatus(s,'RTE'),number,count:routeCount(s,native),rows};
 }
 function routeCell(s,k){
  if(!RTE.has(s.page)||!/^LSK_[LR][1-5]$/.test(k))return null;
  const side=k[4],line=Number(k[5]),native=segments(s),list=displaySegments(s,native),number=routeNumber(s,native);
  if(number===1){
   const name={L1:'ORIGIN',R1:'DEST',L2:'CO_ROUTE',R2:'FLIGHT',L3:'RUNWAY'}[side+line];
   return name?field(side,name,limits[name],line===1):null;
  }
  const entry=list[(number-2)*ROUTE_ROWS+line-1],n=entry?.nativeIndex??(side==='R'?entry?.arrivalInsertIndex:null);
  if(!n||(entry.sourceOnly&&!entry.arrivalInsertIndex)||n>MAX_ROUTE_ROWS||sourcePlan(s)||currentNav(s))return null;
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
  if(nav?.legs)return nav.legs.map(x=>({ident:x.to,gap:x.discontinuity,course:x.trueInitialTrackDeg,distance:x.distanceNm,lat:x.lat,lon:x.lon}));
  const reference=activeReferenceRoute(s);
  if(reference&&!modified(s))return reference.points.slice(1).map((x,i)=>{
   const start=reference.points[i],rad=Math.PI/180;
   const a=start.lat*rad,b=x.lat*rad,longitude=(x.lon-start.lon)*rad;
   const chord=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(longitude/2)**2;
   const bearing=Math.atan2(Math.sin(longitude)*Math.cos(b),
    Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(longitude));
   return {ident:x.name,lat:x.lat,lon:x.lon,distance:3440.065*2*Math.asin(Math.sqrt(Math.min(1,chord))),course:(bearing/rad+360)%360};
  });
  return segments(s).filter(x=>x.to).map(x=>({ident:x.to}));
 }

  // CDU LEGS is a sequenced display of the selected source procedure, not
  // merely the native FMC's unexpanded VIA/TO entries. Reference-only fixes
  // are explicitly kept separate from active flight-director guidance.
  function sourceSnapshot(s){
   let snap=s.cduSgReference;
   if(!snap)try{
    if(root?.parent&&root.parent!==root)snap=root.parent.B737CduSgRouteV1?.snapshot?.();
   }catch(_){return null;}
   return snap?.connected===true&&snap.sourceOnly===true&&snap.fmcExecutable===false&&
    snap.origin===entered(s,'ORIGIN')&&snap.destination===entered(s,'DEST')?
    snap:null;
  }
  function legCourse(from,to){
   if(!from||!to||![from.lat,from.lon,to.lat,to.lon].every(Number.isFinite))return null;
   const rad=Math.PI/180,a=from.lat*rad,b=to.lat*rad,dl=(to.lon-from.lon)*rad;
   return (Math.atan2(Math.sin(dl)*Math.cos(b),
    Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl))/rad+360)%360;
  }
  function legDistance(from,to){
   if(!from||!to||![from.lat,from.lon,to.lat,to.lon].every(Number.isFinite))return null;
   const r=Math.PI/180,a=from.lat*r,b=to.lat*r,d=(to.lon-from.lon)*r;
   const h=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(d/2)**2;
   return 3440.065*2*Math.asin(Math.min(1,Math.sqrt(Math.max(0,h))));
  }

  function pilotGeometryLegs(g,key){
   const p=g?.program,raw=p?.input?.legs;
   if(p?.version!=='IRAN-ROUTE-PREVIEW-V2'||!Array.isArray(raw))return null;
   const api=root.B737PilotWaypointsV1;
   if(!api)return null;
   let prev=null;
   const result=[];
   for(let i=0;i<raw.length;i++){
    const l=raw[i],t=l.Type??l.type,conditional=api.conditional(l);
    if(conditional){const alt=Number(l.Altitude??l.alt),speed=Number(l.Speed??l.speed);result.push({...conditional,geoKey:key,rawIndex:i,constraint:(speed>0?String(speed):'----')+'/'+(alt>0?String(alt)+(t==='ConstHdgtoAlt'?'A':''):'-----')});prev=null;continue;}
    if(t==='Discontinuity'){result.push({gap:true,sourceOnly:true,geoKey:key,rawIndex:i});prev=null;continue;}
    const id=l.Name??l.ident,lat=Number(l.Latitude??l.lat),lon=Number(l.Longitude??l.lon);
    const pub=t==='Hold'?root?.parent?.B737RouteEngine?.publishedHold?.(l,g,i,g.kind==='SID'?g.airport:null,null):null;
    if(!['Normal','Runway'].includes(t)&&!pub||typeof id!=='string'||![lat,lon].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180||lat===0&&lon===0){result.push({gap:true,sourceOnly:true});prev=null;continue;}
    const point={ident:id,lat,lon,pilotType:l.pilotType,sourceOnly:true,geoKey:key,rawIndex:i,
     course:prev?legCourse(prev,{lat,lon}):null,distance:prev?legDistance(prev,{lat,lon}):null,...(pub?{publishedRaw:l,publishedGeometry:g,publishedIndex:i,courseMag:pub.inbound}:{})};
    const alt=Number(l.Altitude??l.alt),speed=Number(l.Speed??l.speed),restriction=l.AltitudeRestriction??l.restriction;
    const suffix=restriction==='above'?'A':restriction==='below'?'B':'';
    point.constraint=(speed>0?String(speed):'----')+'/'+(alt>0?String(alt)+suffix:'-----');
    result.push(point);prev=point;
   }
   return result;
  }

  function sourceProcedureLegs(s,snap,kind,airport){
   const bank=snap?.modified||snap?.active;
   const key=kind+'@'+airport,selected=bank?.selections?.[key],g=bank?.geometries?.[key];
   if(!selected||!g||g.ident!==selected.ident||
      g.renderStyle!=='DASHED_REFERENCE_CHORDS_ONLY')return [];
   const result=[],program=g.program;
   const runway=selected.runway&&bank?.geometries?.['RUNWAY_'+(kind==='SID'?'DEP':'ARR')+'@'+airport];
   let previous=null;
   if(kind==='SID'&&runway?.fixes?.[0]){
    const rw=runway.fixes[0];
    if(Number.isFinite(rw.lat)&&Number.isFinite(rw.lon)){
     previous=rw;
     if(Number.isFinite(program?.altitudeMSLFt))result.push({ident:'('+Math.round(program.altitudeMSLFt)+')',courseMag:program.trackMagneticDeg,constraint:'----/'+Math.round(program.altitudeMSLFt)+'A',conditional:true,sourceOnly:true});
    }
   }
   const typed=pilotGeometryLegs(g,key);
   if(typed)return [...result,...(kind==='SID'?typed.filter((x,i)=>!(i===0&&/^RW\d{2}[LRC]?$/.test(x.ident||''))):typed)];
   // program.fixes carries the exact order from the airport's variant source;
   // the geometry fallback retains only verified FIX_PASSAGE records.
   const fixes=program?.fixes?.length?program.fixes:g.fixes||[];
   for(const fix of fixes){
    if(!fix||typeof fix.ident!=='string'||!Number.isFinite(fix.lat)||
       !Number.isFinite(fix.lon)||!/^[-A-Z0-9._]{2,16}$/.test(fix.ident))continue;
    const current={ident:fix.ident,lat:fix.lat,lon:fix.lon};
    result.push({ident:fix.ident,
     course:previous?.lat!==undefined?legCourse(previous,current):null,
     distance:previous?.lat!==undefined?legDistance(previous,current):null,
     lat:current.lat,lon:current.lon,sourceOnly:true});
    previous=current;
   }
   return result;
  }
  function expandedRouteLegs(s){
   if(sourcePlan(s)||currentNav(s))return navLegs(s);
   const rows=segments(s),expanded=[];
   for(let i=0;i<rows.length;i++){
    const row=rows[i],proof=s.verifiedToEntries?.['TO'+(i+1)];
    if(!row?.to)continue;
    const verified=row.via&&row.via!=='DIRECT'&&row.via!=='DCT'&&
     proof?.airway===row.via&&proof?.to===row.to&&
     proof.source==='OWNER_WPNAVRTE_VERIFIED'&&
     proof.origin===entered(s,'ORIGIN')&&proof.destination===entered(s,'DEST');
    const fixes=verified&&Array.isArray(proof.fixes)&&proof.fixes.at(-1)===row.to&&
     proof.fixes.length<=250&&proof.fixes.every(x=>typeof x==='string'&&
      /^[A-Z0-9._-]{2,16}$/.test(x))?proof.fixes:[row.to];
    for(const ident of fixes){const evidence=(s.navFixEvidence||{})['TO'+(i+1)]||(s.activeNavFixEvidence||{})['TO'+(i+1)];expanded.push({ident,sourceOnly:verified,...(evidence?.ident===ident&&Number.isFinite(evidence.lat)&&Number.isFinite(evidence.lon)?{lat:evidence.lat,lon:evidence.lon}:{})});}
   }
   return expanded;
  }
  // An arrival boundary is connected only at the same verified fixed waypoint.
  // Do not invent a connecting leg, or treat an input placeholder as a gap.
  function arrivalBoundary(s,rows=segments(s)){
   if(sourcePlan(s)||currentNav(s)||rows.length>=MAX_ROUTE_ROWS||rows.some(x=>!x.to))return null;
   const source=sourceSnapshot(s);if(!source)return null;
   const bank=source.modified||source.active;
   const star=sourceProcedureLegs(s,source,'STAR',entered(s,'DEST'));
   const next=star[0];
   if(!next?.ident||next.gap||next.conditional||!validPosition(next))return null;
   let prev;
   if(rows.length){
    const last=rows.at(-1),key='RTE@'+rows.length,g=bank?.geometries?.[key];
    const legs=pilotGeometryLegs(g,key);
    const end=legs?.at(-1);
    const evidence=s.navFixEvidence?.['TO'+rows.length]||s.activeNavFixEvidence?.['TO'+rows.length];
    prev=end?.ident===last.to&&!end.gap&&!end.conditional?end:
     evidence?.ident===last.to?evidence:{ident:last.to};
   }else{
    const sid=sourceProcedureLegs(s,source,'SID',entered(s,'ORIGIN'));
    prev=sid.at(-1);
   }
   if(!prev?.ident||prev.gap||prev.conditional)return null;
   if(prev.ident===next.ident&&(!validPosition(prev)||legDistance(prev,next)<0.05))return null;
   return {gap:true,arrivalBoundary:true,arrivalInsertIndex:rows.length+1,from:prev,to:next};
  }
  function visibleLegs(s){
   let native=expandedRouteLegs(s);const source=sourceSnapshot(s);
   if(!source)return native;
   const origin=entered(s,'ORIGIN'),dest=entered(s,'DEST');
   const sid=sourceProcedureLegs(s,source,'SID',origin);
   const star=sourceProcedureLegs(s,source,'STAR',dest),app=sourceProcedureLegs(s,source,'APP',dest);
   const bank=source.modified||source.active;
   if(!sourcePlan(s)&&!currentNav(s)){
    const typed=[];
    for(const [i,row] of segments(s).entries()){
     if(!row.to){if(row.via&&segments(s).slice(i+1).some(x=>x.to))typed.push({gap:true,sourceOnly:true,pendingRoute:true});continue;}
     const key='RTE@'+(i+1),g=bank?.geometries?.[key];
     const pts=pilotGeometryLegs(g,key);
     if(pts&&pts.at(-1)?.ident===row.to){if(pts.length>1)typed.push(...pts.slice(1));else typed.push(...pts);}
     else {
      const proof=s.verifiedToEntries?.['TO'+(i+1)];
      const verified=proof?.source==='OWNER_WPNAVRTE_VERIFIED'&&proof.airway===row.via&&proof.to===row.to&&proof.origin===origin&&proof.destination===dest&&Array.isArray(proof.fixes)&&proof.fixes.at(-1)===row.to;
      const evidence=(s.navFixEvidence||{})['TO'+(i+1)]||(s.activeNavFixEvidence||{})['TO'+(i+1)];
       typed.push(...(verified?proof.fixes:[row.to]).map(ident=>({ident,sourceOnly:true,...(evidence?.ident===ident&&validPosition(evidence)?{lat:evidence.lat,lon:evidence.lon}:{})})));
     }
    }
    native=typed;
   }
   // Preserve enroute rows, with consecutive source boundary duplicates
   // collapsed. A segment's every sourced intermediate fix remains visible.
   const all=[];
   const boundary=arrivalBoundary(s);
   for(const item of [...sid,...native,...(boundary?[boundary]:[]),...star,...app]){
    if(!item?.ident&&!item?.gap)continue;
    if(item.ident&&all.at(-1)?.ident===item.ident&&!item.gap){
     // The pending source row can carry geometry the native row lacks.
     if(item.publishedRaw||!all.at(-1).sourceOnly&&item.sourceOnly||item.geoKey&&Number.isFinite(item.lat)&&!Number.isFinite(all.at(-1).lat))all[all.length-1]=item;
     continue;
    }
    all.push(item);
   }
   return all;
  }
 const track=n=>Number.isFinite(n)?String(Math.round(n)%360).padStart(3,'0')+'°T':'';
 const nm=n=>Number.isFinite(n)&&n>=0?(n<10?n.toFixed(1):String(Math.round(n)))+'NM':'';
 const validPosition=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
 function ownship(s){const p=s.fmcPageInputs?.position;return p?.quality==='VALID'&&validPosition({lat:p.latitudeDeg,lon:p.longitudeDeg})?{lat:p.latitudeDeg,lon:p.longitudeDeg}:null;}
 function constraintKey(s,leg,index){return 'LEG_CONSTRAINT_'+[entered(s,'ORIGIN'),entered(s,'DEST'),index,leg.ident].join('_').replace(/[^A-Z0-9_]/g,'_');}
 function constraint(s,leg,index){return entered(s,constraintKey(s,leg,index))||leg.constraint||'----/-----';}
 function parseConstraint(input,old){
  const m=/^(?:(\d{2,3}|\.\d{2,3}))?\/(?:(FL\d{2,3}|\d{3,5})([AB])?)?$/.exec(input);
  if(!m||!m[1]&&!m[2])return null;
  if(m[1]&&!m[1].startsWith('.')&&(Number(m[1])<100||Number(m[1])>399))return null;
  if(m[2]&&(m[2].startsWith('FL')?Number(m[2].slice(2))*100:Number(m[2]))>41000)return null;
  const [speed,alt]=String(old||'----/-----').split('/');
  return (m[1]||speed||'----')+'/'+(m[2]?m[2]+(m[3]||''):alt||'-----');
 }
 function planMode(s){return s.planReviewMode===undefined?s.ehsi?.mode==='PLAN':s.planReviewMode===true;}
  function planCandidates(all){return all.map((leg,index)=>({leg,index})).filter(({leg})=>!leg.gap&&!leg.conditional&&validPosition(leg)&&typeof leg.ident==='string');}
  function planCenter(s,all=visibleLegs(s)){
   const candidates=planCandidates(all);if(!candidates.length){delete s.planReviewCenter;return null;}
   const old=s.planReviewCenter;
   const same=x=>old&&x.leg.ident===old.ident&&x.leg.lat===old.lat&&x.leg.lon===old.lon;
   const chosen=candidates.find(x=>x.index===old?.index&&same(x))||candidates.find(same)||candidates.find(x=>x.index>=((s.subpage||1)-1)*5)||candidates[0];
   const {leg,index}=chosen;return s.planReviewCenter={index,ident:leg.ident,lat:leg.lat,lon:leg.lon};
  }
  function planStep(s){
   const all=visibleLegs(s),current=planCenter(s,all),candidates=planCandidates(all);if(!current||!candidates.length)return false;
   const page=Math.max(1,s.subpage||1),start=(page-1)*5,end=start+5;
   const i=candidates.findIndex(x=>x.index===current.index);
   const next=current.index<start||current.index>=end?candidates.find(x=>x.index>=start&&x.index<end)||candidates[(i+1)%candidates.length]:candidates[(i+1)%candidates.length];
   const {leg,index}=next;s.planReviewCenter={index,ident:leg.ident,lat:leg.lat,lon:leg.lon};s.subpage=Math.floor(index/5)+1;s.message='';return true;
  }
  // FCOM SP.11.9 and 11.43.32–35: HOLD AT, RTE HOLD and EXEC transaction.
 const holdKey=i=>String(i).startsWith('HOLD_PUB_')?i:'HOLD_'+i;
 function publishedHolds(s){
  const parser=root?.parent?.B737RouteEngine?.publishedHold;if(!parser)return [];
  const origin=entered(s,'ORIGIN'),dest=entered(s,'DEST');
  return visibleLegs(s).filter(l=>l.publishedRaw).map(l=>parser(l.publishedRaw,l.publishedGeometry,l.publishedIndex,origin,dest)).filter(Boolean);
 }
 function readHold(s,i,activeOnly=false,source=null){
  const k=holdKey(i);let v=null;try{v=JSON.parse(activeOnly?s.active[k]:entered(s,k));}catch(_){}
  if(k.startsWith('HOLD_PUB_')){if(v?.deleted===true)return null;const base=source??publishedHolds(s).find(h=>h.key===k);return base?{...base,...v,key:base.key,ident:base.ident,lat:base.lat,lon:base.lon,origin:base.origin,dest:base.dest,published:true}:null;}
  return v&&validPosition(v)&&typeof v.ident==='string'&&v.origin===entered(s,'ORIGIN')&&v.dest===entered(s,'DEST')?v:null;
 }
 function holdExecReady(s){return holdList(s).every(({h})=>Number.isFinite(h.inbound)&&h.inbound>=0&&h.inbound<360);}
 function holdList(s){return [...[1,2,3,4,5].map(i=>({i,h:readHold(s,i)})),...publishedHolds(s).map(h=>({i:h.key,h:readHold(s,h.key,false,h)}))].filter(x=>x.h);}

 function holdTime(s,h){const alt=s.fmcPageInputs?.airData?.pressureAltitudeFt;return h.time??(Number.isFinite(alt)?alt>14000?1.5:1:null);}
 function holdWrite(s,i,h){const draft=s.routeActivated||s.routeActivationArmed?s.pending:s.stagedRoute,k=holdKey(i),v=h?JSON.stringify(h):k.startsWith('HOLD_PUB_')?JSON.stringify({deleted:true}):'';if(v===(s.active[k]??''))delete draft[k];else draft[k]=v;s.scratch='';s.message='';}
 function holdStart(s,pages,core){s.holdAt=true;s.holdPage=1;core.choose(s,pages,'LEGS');}
 function holdSelect(s,pages,core,ppos){
  if(!s.routeActivated&&!s.routeActivationArmed&&(!entered(s,'ORIGIN')||!entered(s,'DEST'))){core.addMessage(s,'ENTER ROUTE FIRST');return;}
  const i=[1,2,3,4,5].find(i=>!readHold(s,i));if(!i||holdList(s).length>=5){core.addMessage(s,'HOLD LIMIT');return;}
  const all=visibleLegs(s),live=s.fmcPageInputs?.guidance?.activeLeg;
  const matches=all.map((l,i)=>({l,i})).filter(x=>x.l.ident===s.scratch.trim().toUpperCase()&&!x.l.gap&&!x.l.conditional&&validPosition(x.l));
  let point,prev,anchor=null,course=null;
  if(ppos){point=ownship(s);if(s.fmcOnGroundVerified!==false||!point||!live?.ident){core.addMessage(s,'PPOS UNAVAILABLE');return;}const anchors=all.filter(x=>x.ident===live.ident&&!x.gap&&!x.conditional&&validPosition(x));if(anchors.length!==1){core.addMessage(s,'PPOS UNAVAILABLE');return;}anchor=anchors[0];course=s.fmcPageInputs?.motion?.trueTrackDeg;point={...point,ident:'PPOS'};}
  else{if(matches.length!==1){core.addMessage(s,matches.length?'DUPLICATE WAYPOINT':'NOT IN ROUTE');return;}point=matches[0].l;prev=all[matches[0].i-1];course=point.courseMag;if(!Number.isFinite(course)){course=validPosition(prev)?legCourse(prev,point):point.course;}}
  let variation=null;try{variation=root?.parent?.B737CduSgBridgeV1?.magneticVariation?.(point);}catch(_){}
  const inbound=Number.isFinite(point.courseMag)&&!ppos?Math.round(point.courseMag)%360:Number.isFinite(course)&&Number.isFinite(variation)?Math.round((course-variation+360)%360)%360:null;
  if(holdList(s).some(x=>x.h.ident===point.ident&&Math.abs(x.h.lat-point.lat)<.00001&&Math.abs(x.h.lon-point.lon)<.00001)){core.addMessage(s,'HOLD EXISTS');return;}
  holdWrite(s,i,{ident:point.ident,lat:point.lat,lon:point.lon,origin:entered(s,'ORIGIN'),dest:entered(s,'DEST'),dir:'R',inbound,time:null,dist:null,speed:null,efc:null,exit:false,ppos,anchor:anchor?{ident:anchor.ident,lat:anchor.lat,lon:anchor.lon}:null});
  s.holdAt=false;s.holdPage=i;core.choose(s,pages,'HOLD');
 }
 function holdView(s){
  const list=holdList(s),entry=list.find(x=>x.i===s.holdPage)||list[0],h=entry?.h;if(!h)return {title:'RTE HOLD',number:1,count:1,rows:[empty(),empty(),empty(),empty(),empty(),pair('','<NEXT HOLD')]};
  const live=s.fmcPageInputs?.guidance?.hold,active=live?.key===holdKey(entry.i)&&live?.active===true,mod=Object.hasOwn(s.pending,holdKey(entry.i))||Object.hasOwn(s.stagedRoute,holdKey(entry.i));
  const metrics=s.fmcPageInputs?.guidance?.holdMetrics?.[holdKey(entry.i)],best=Number.isFinite(metrics?.bestKt)?Math.round(metrics.bestKt):null,t=h.speed??best,time=holdTime(s,h);
  const minutes=metrics?.availableMinutes,available=Number.isFinite(minutes)?Math.floor(minutes/60)+'+'+String(Math.floor(minutes%60)).padStart(2,'0'):'-+--';
  const right=active?(h.exit?'EXIT ARMED':live?.exitInhibited?'':'EXIT HOLD>'):(!mod&&!modified(s)&&(list.length<5||list.length>1)?'NEXT HOLD>':'');
  return {title:(mod?'MOD ':active?'ACT ':'')+'RTE HOLD',number:list.indexOf(entry)+1,count:list.length,rows:[
   pair('FIX',h.ident,'TGT SPD',Number.isFinite(t)?t+'KT':'---KT',{activeSpeed:active}),
   pair('TURN DIR',h.dir,'FIX ETA',metrics?.eta||'----Z'),
   pair('INBD CRS',h.inbound===null?'□□□':String(h.inbound).padStart(3,'0')+'°','EFC TIME',h.efc?h.efc+'Z':'----Z'),
   pair('LEG TIME',h.dist!==null||time===null?'--.-MIN':time.toFixed(1)+'MIN','HOLD AVAIL',available),
   pair('LEG DIST',h.dist!==null?h.dist.toFixed(1)+'NM':'--.-NM','BEST SPEED',best!==null?best+'KT':'---KT'),
   pair('------------',mod?'<ERASE':'','------------',right)
  ]};
 }
 function holdInvoke(s,pages,key,core){
  if(key==='HOLD'){s.holdAt=false;const list=holdList(s);if(!list.length)holdStart(s,pages,core);else{const current=list.findIndex(x=>x.i===s.holdPage);s.holdPage=s.page==='HOLD'&&current>=0?list[(current+1)%list.length].i:list.find(x=>s.fmcPageInputs?.guidance?.hold?.key===holdKey(x.i))?.i??list[0].i;core.choose(s,pages,'HOLD');}return true;}
  if(s.page==='LEGS'&&s.holdAt){if(/^LSK_L[1-5]$/.test(key)){if(!s.scratch){const l=visibleLegs(s)[((s.subpage||1)-1)*5+Number(key[5])-1];if(l&&!l.gap&&!l.conditional){s.scratch=l.ident;s.message='';}else core.addMessage(s,'INVALID HOLD FIX');return true;}holdSelect(s,pages,core,false);return true;}if(key==='LSK_L6'){if(s.scratch)holdSelect(s,pages,core,false);else core.addMessage(s,'ENTER HOLD FIX');return true;}if(key==='LSK_R6'){holdSelect(s,pages,core,true);return true;}if(!/^LSK_|^(NEXT|PREV)_PAGE$|^KEY_/.test(key))s.holdAt=false;return false;}
  if(s.page!=='HOLD')return false;
  const list=holdList(s),entry=list.find(x=>x.i===s.holdPage)||list[0],h=entry?.h;
  if(key==='NEXT_PAGE'||key==='PREV_PAGE'){if(list.length)s.holdPage=list[(list.indexOf(entry)+(key==='NEXT_PAGE'?1:-1)+list.length)%list.length].i;return true;}
  if(key==='EXEC'&&!holdExecReady(s)){core.addMessage(s,'ENTER INBD CRS');return true;}
  if(!/^LSK_[LR][1-6]$/.test(key))return false;
  if(key==='LSK_L6'){if(entry&&(Object.hasOwn(s.pending,holdKey(entry.i))||Object.hasOwn(s.stagedRoute,holdKey(entry.i)))){delete s.pending[holdKey(entry.i)];delete s.stagedRoute[holdKey(entry.i)];s.scratch='';s.message='';if(!readHold(s,entry.i))core.choose(s,pages,'LEGS');return true;}return true;}
  if(!h){core.addMessage(s,'KEY INACTIVE');return true;}
  const input=s.scratch.trim().toUpperCase(),next={...h};
  if(key==='LSK_R6'){const live=s.fmcPageInputs?.guidance?.hold;if(live?.key===holdKey(entry.i)&&live.active){if(!h.exit&&!live.exitInhibited){next.exit=true;holdWrite(s,entry.i,next);}else if(live.exitInhibited)core.addMessage(s,'WAIT FOR FIX');}else if(!modified(s)){const j=list.indexOf(entry);if(j<list.length-1)s.holdPage=list[j+1].i;else if(list.length<5)holdStart(s,pages,core);else if(list.length>1)s.holdPage=list[0].i;}return true;}
  if(key==='LSK_L1'&&input==='DELETE'){if(s.fmcPageInputs?.guidance?.hold?.key===holdKey(entry.i)&&s.fmcPageInputs.guidance.hold.active){core.addMessage(s,'USE EXIT HOLD');return true;}holdWrite(s,entry.i,null);core.choose(s,pages,'LEGS');return true;}
  if(!input){const v={LSK_L1:h.ident,LSK_L2:h.dir,LSK_L3:h.inbound,LSK_L4:h.dist===null?holdTime(s,h):null,LSK_L5:h.dist,LSK_R1:h.speed,LSK_R3:h.efc}[key];if(v!=null)s.scratch=String(v);return true;}
  const num=Number(input),numeric=/^\d+(?:\.\d)?$/.test(input);
  if(key==='LSK_L2'&&/^[LR]$/.test(input))next.dir=input;
  else if(key==='LSK_L3'&&/^\d{1,3}$/.test(input)&&num<=360)next.inbound=num%360;
  else if(key==='LSK_L4'&&numeric&&num>=.1&&num<=9.9){next.time=num;next.dist=null;}
  else if(key==='LSK_L5'&&numeric&&num>=.1&&num<=99.9){next.dist=num;next.time=null;}
  else if(key==='LSK_R1'&&/^\d{3}$/.test(input)&&num>=100&&num<=350)next.speed=num;
  else if(key==='LSK_R3'&&/^([01]\d|2[0-3])[0-5]\dZ?$/.test(input))next.efc=input.replace(/Z$/,'');
  else if(input==='DELETE'&&['LSK_L4','LSK_L5','LSK_R1','LSK_R3'].includes(key))next[{LSK_L4:'time',LSK_L5:'dist',LSK_R1:'speed',LSK_R3:'efc'}[key]]=null;
  else{core.addMessage(s,'INVALID ENTRY');return true;}
  holdWrite(s,entry.i,next);return true;
 }
 function legs(s){
   const all=visibleLegs(s),center=planMode(s)?planCenter(s,all):null,count=Math.max(1,Math.ceil(all.length/5));
  const number=Math.min(count,Math.max(1,s.subpage||1)),rows=[];
  const at=(number-1)*5;
  for(let i=0;i<5;i++){
   const leg=all[at+i];
   if(!leg){rows.push(empty());continue;}
   if(leg.gap){rows.push(pair('ROUTE DISCONTINUITY','□□□□□'));continue;}
   const index=at+i,previous=all[index-1],prediction=s.fmcPageInputs?.predictions;
   const live=s.fmcPageInputs?.guidance?.activeLeg;
   const activeIdent=s.fmcPageInputs?.guidance?.simulatorCoupled===true?live?.ident:prediction?.quality==='VALID'?prediction.active?.ident:null;
   const activeMatch=activeIdent?all.filter(x=>x.ident===activeIdent).length===1&&leg.ident===activeIdent:index===0;
   const position=activeMatch?ownship(s):null;
   const from=validPosition(position)?position:!previous?.gap&&!previous?.conditional&&validPosition(previous)?previous:null;
   const trueCourse=activeMatch&&live?.ident===leg.ident&&Number.isFinite(live.bearingTrueDeg)?live.bearingTrueDeg:!leg.conditional&&from&&validPosition(leg)?legCourse(from,leg):leg.course;
   const distance=activeMatch&&live?.ident===leg.ident&&Number.isFinite(live.distanceNm)?live.distanceNm:!leg.conditional&&from&&validPosition(leg)?legDistance(from,leg):leg.distance;
   let magnetic=leg.courseMag;
   if(!Number.isFinite(magnetic)&&Number.isFinite(trueCourse)){
    const point=from||leg;
    let variation=null;try{if(Number.isFinite(point?.lat)&&Number.isFinite(point.lon))variation=root?.parent?.B737CduSgBridgeV1?.magneticVariation?.(point);}catch(_){}
    if(Number.isFinite(variation))magnetic=(trueCourse-variation+360)%360;
   }
   const angle=leg.headingLabel?leg.headingLabel.replace(/\s*HDG$|°[MT]$/,'°'):Number.isFinite(magnetic)?String(Math.round(magnetic)%360).padStart(3,'0')+'°':'';
   const hold=holdList(s).some(x=>x.h.ident===leg.ident&&Math.abs(x.h.lat-leg.lat)<.00001&&Math.abs(x.h.lon-leg.lon)<.00001);
   const original=constraint(s,leg,index),perf=s.fmcPageInputs?.trainingPerformance,estimate=perf?.quality==='TRAINING_ESTIMATE'&&!modified(s)?perf.waypoints?.filter(x=>x.ident===leg.ident):[];
   // Preserve every published or pilot altitude constraint. Only fill the missing predicted altitude of an unambiguous cruise fix.
   const q=estimate?.length===1&&estimate[0].phase==='CRUISE'?estimate[0]:null;
   const [sp,al]=original.split('/');const ta=perf?.transitionAltitudeFt??18000;
   const predictedAlt=q&&Number.isFinite(q.altitudeFt)?q.altitudeFt>=ta?'FL'+Math.round(q.altitudeFt/100):String(Math.round(q.altitudeFt)):null;
   const display=predictedAlt&&al==='-----'?sp+'/'+predictedAlt:original;
   rows.push(pair(hold?'HOLD AT '+angle:angle,leg.ident+(center?.index===index?' <CTR>':''),nm(distance),display));
  }
  const action=routeAction(s);
  const right=canActivate(s)||!s.routeActivated&&s.stage6PendingPlan&&!s.stage6AwaitingExec?'ACTIVATE>':
   s.routeActivated||s.navdbActive||s.stage5Committed?'RTE DATA>':'';
  rows.push(s.holdAt?pair('HOLD AT','□□□□□','',s.fmcOnGroundVerified===false?'PPOS>':''):pair('',action?.command==='erase'?'<ERASE':'',planMode(s)?'MAP CTR':'',planMode(s)?'STEP>':right));
  return {title:titleWithStatus(s,'RTE LEGS'),number,count,rows};
 }
 function erase(s){
  for(const key of Object.keys(s.pending))if(isRouteField(key))delete s.pending[key];
  s.stagedRoute={};
  s.navFixEvidence={...s.activeNavFixEvidence};
  s.verifiedAirwayEntries={...s.activeVerifiedAirwayEntries};s.verifiedToEntries={...s.activeVerifiedToEntries};
  s.routeActivationArmed=false;
  s.scratch='';s.message='';
  if(s.stage5Pending){delete s.stage5Pending;s.stage5AwaitingExec=false;}
  if(s.stage6PendingPlan){delete s.stage6PendingPlan;s.stage6AwaitingExec=false;s.stage6Selections={};}
  if(s.navdbPending){delete s.navdbPending;delete s.navdbStage;}
 }
 function invoke(s,pages,key,core){
  if(holdInvoke(s,pages,key,core))return true;
  const rte=RTE.has(s.page),legPage=s.page==='LEGS';
  if(key==='NEXT_PAGE'||key==='PREV_PAGE'){
   const change=key==='NEXT_PAGE'?1:-1;
   if(rte&&s.page!=='ACTIVATE'){
    const list=segments(s),count=routeCount(s,list);
    const number=(routeNumber(s,list)-1+change+count)%count+1;
    core.choose(s,pages,number===1?'RTE':'FLIGHT_PLAN');s.subpage=number;
    return true;
   }
   if(s.page==='FIX'){s.subpage=(s.subpage===2?1:2);s.message='';return true;}
   if(legPage||s.page==='RTE_DATA'){
    const {count,number}=legPage?legs(s):routeData(s);
    s.subpage=(number-1+change+count)%count+1;s.message='';return true;
   }
   if(s.page==='PROG'||s.page==='PROG2'){
    const number=s.page==='PROG'?1:s.subpage===3?3:2;
    const next=(number-1+change+3)%3+1;
    core.choose(s,pages,next===1?'PROG':'PROG2');s.subpage=next;return true;
   }
  }

  if(s.page==='PROG2'&&s.subpage!==3&&/^LSK_[LR][1-6]$/.test(key)){
   const input=String(s.scratch||'').trim(),draft=s.pending,active=s.active;
   if(key==='LSK_L6'){core.choose(s,pages,'PERF_LIMITS');return true;}
   if(key==='LSK_L1'){
    if(!input){s.scratch=entered(s,'RTA_WPT');return true;}
    if(input==='DELETE'){draft.RTA_WPT='';draft.RTA_TIME='';s.scratch='';s.message='';return true;}
    if(!s.routeActivated||visibleLegs(s).filter(l=>l.ident===input&&!l.gap&&!l.conditional).length!==1){core.addMessage(s,'NOT IN FLIGHT PLAN');return true;}
    draft.RTA_WPT=input;const eta=s.fmcPageInputs?.trainingPerformance?.waypoints?.find(l=>l.ident===input)?.eta;
    draft.RTA_TIME=eta?.replace('Z','')||'';s.scratch='';s.message='';return true;
   }
   if(key==='LSK_R1'){
    if(!entered(s,'RTA_WPT')){core.addMessage(s,'ENTER RTA WPT');return true;}
    if(!input){s.scratch=entered(s,'RTA_TIME');return true;}
    const m=/^(\d{2})(\d{2})(?:(\d{2})|\.(\d))?([AB])?$/.exec(input);
    if(!m||+m[1]>23||+m[2]>59||m[3]&&+m[3]>59){core.addMessage(s,'INVALID ENTRY');return true;}
    draft.RTA_TIME=m[1]+m[2]+(m[3]??(m[4]?String(+m[4]*6).padStart(2,'0'):''))+(m[5]||'');s.scratch='';s.message='';return true;
   }
   if(key==='LSK_L5'&&('RTA_WPT'in draft||'RTA_TIME'in draft)){delete draft.RTA_WPT;delete draft.RTA_TIME;s.scratch='';s.message='';return true;}
   core.addMessage(s,'KEY INACTIVE');return true;
  }
  if(s.page==='FIX'&&/^LSK_[LR][1-6]$/.test(key)){
   const n=s.subpage===2?2:1,fix=s.fixInfo?.[n];
   if(key==='LSK_L6'){core.choose(s,pages,'INDEX');return true;}
   if(key==='LSK_L1'&&!s.scratch){if(fix?.ident)s.scratch=fix.ident;return true;}
   if(/^LSK_L[2-4]$/.test(key)&&fix){
    const i=Number(key[5])-2,entries=[...(fix.entries||[])],input=s.scratch.trim();
    if(!input){if(entries[i])s.scratch=entries[i];return true;}
    if(input==='DELETE'){entries[i]='';}else if(/^(?:\d{1,3}|\/\d{1,3}(?:\.\d)?)$/.test(input)&&Number(input.replace('/',''))>0&&Number(input.replace('/',''))<=(input.startsWith('/')?999:360)){entries[i]=input;}else{core.addMessage(s,'INVALID ENTRY');return true;}
    s.fixInfo={...s.fixInfo,[n]:{...fix,entries}};s.scratch='';s.message='';return true;
   }
   if(s.scratch)core.addMessage(s,'INVALID ENTRY');return true;
  }
  if(s.page==='RTE_DATA'&&key==='LSK_L6'){const number=routeData(s).number;core.choose(s,pages,'LEGS');s.subpage=number;return true;}
  if(key==='LSK_R6'&&legPage&&planMode(s)){if(!planStep(s))core.addMessage(s,'KEY INACTIVE');return true;}
   if(key==='LSK_R6'&&(rte||legPage)){
   const command=routeAction(s,segments(s));
   if(command?.command==='activate'){
    const page=s.page,subpage=s.subpage;
    if(core.activateStagedRoute(s,pages)!==true)return true;
    s.page=page==='ACTIVATE'?'RTE':page;s.subpage=subpage;
    s.routeActivationArmed=true;
    return true;
   }
   const target=legPage?(s.routeActivated||s.navdbActive||s.stage5Committed?'RTE_DATA':null):command?.page;
   if(target){const number=legPage?legs(s).number:1;core.choose(s,pages,target);if(target==='RTE_DATA')s.subpage=number;return true;}
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
   if(cell.field.startsWith('VIA')&&s.scratch&&s.scratch!=='DELETE'&&s.scratch!=='DIRECT'){
    const proof=s.verifiedAirwayEntries?.[cell.field],input=String(s.scratch).toUpperCase();
    if(proof?.airway!==input||proof?.origin!==entered(s,'ORIGIN')||
       proof?.destination!==entered(s,'DEST')||
       proof?.source!=='OWNER_WPNAVRTE_VERIFIED'){
     core.addMessage(s,'NOT IN DATABASE');return true;
    }
   }
   if(cell.field.startsWith('TO')&&s.scratch&&s.scratch!=='DELETE'){
    const viaName='VIA'+cell.field.slice(2),via=entered(s,viaName);
    if(via&&via!=='DIRECT'&&via!=='DCT'){
     const proof=s.verifiedToEntries?.[cell.field];
     if(proof?.to!==String(s.scratch).trim().toUpperCase()||
        proof?.airway!==via||proof?.origin!==entered(s,'ORIGIN')||
        proof?.destination!==entered(s,'DEST')||
        proof?.source!=='OWNER_WPNAVRTE_VERIFIED'){
      core.addMessage(s,'NOT IN DATABASE');return true;
     }
    }
   }
   const before=entered(s,cell.field),input=s.scratch;
   if(s.routeActivated||s.routeActivationArmed)core.field(s,cell);
   else core.stageRouteField(s,cell);
   if(input&&s.scratch===''&&cell.field.startsWith('VIA')&&input!==before){
    const to='TO'+cell.field.slice(3),draft=(s.routeActivated||s.routeActivationArmed)?s.pending:s.stagedRoute;
    draft[to]='';
    if(s.verifiedToEntries)delete s.verifiedToEntries[to];
    if(s.navFixEvidence)delete s.navFixEvidence[to];
   }
   if(input&&s.scratch===''&&cell.field==='ORIGIN'&&before&&entered(s,'ORIGIN')!==before){
    const draft=(s.routeActivated||s.routeActivationArmed)?s.pending:s.stagedRoute;
    for(const name of new Set([...Object.keys(s.active),...Object.keys(draft)]))
     if(isRouteField(name)&&name!=='ORIGIN')draft[name]='';
   }
   if(input==='DELETE'&&cell.field.startsWith('TO')&&s.scratch===''){
    const draft=(s.routeActivated||s.routeActivationArmed)?s.pending:s.stagedRoute;
    draft['VIA'+cell.field.slice(2)]='';
   }
   return true;
  }
  if(legPage&&/^LSK_/.test(key)){
   const index=(legs(s).number-1)*5+Number(key[5])-1,leg=visibleLegs(s)[index];
   if(key.startsWith('LSK_R')&&Number(key[5])<=5&&leg&&!leg.gap){
    const field=constraintKey(s,leg,index),old=constraint(s,leg,index);
    if(!s.scratch){s.scratch=old;s.message='';return true;}
    const draft=(s.routeActivated||s.routeActivationArmed)?s.pending:s.stagedRoute;
    if(s.scratch==='DELETE'){draft[field]='';s.scratch='';s.message='';return true;}
    const next=parseConstraint(s.scratch,old);
    if(!next){core.addMessage(s,'INVALID ENTRY');return true;}
    draft[field]=next;s.scratch='';s.message='';return true;
   }
   if(key.startsWith('LSK_L')&&Number(key[5])<=5&&leg&&!leg.gap&&!s.scratch){
    s.scratch=leg.ident;s.message='';
   }else if(s.scratch)core.addMessage(s,'INVALID ENTRY');
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
  const f=s.fmcPageInputs??{},p=f.predictions?.quality==='VALID'?f.predictions:f.trainingPerformance?.quality==='TRAINING_ESTIMATE'?f.trainingPerformance:{};
  const flight=s.active.FLIGHT?'FLT '+s.active.FLIGHT+' ':'';
  const number=s.page==='PROG'?1:s.subpage===3?3:2;
  const rows=Array.from({length:6},empty);
  if(number===2){
   const wpt=entered(s,'RTA_WPT'),time=entered(s,'RTA_TIME'),draft='RTA_WPT'in s.pending||'RTA_TIME'in s.pending,r=draft?null:f.rta;
   rows[0]=pair('RTA WPT',wpt||'-----','RTA',time||'------');
   rows[1]=pair('RTA SPD',Number.isFinite(r?.targetKt)?String(r.targetKt):'---','TIME ERROR',r?.status||'');
   rows[2]=pair('DIST TO '+(wpt||'WPT'),Number.isFinite(r?.distanceNm)?nm(r.distanceNm):'','ETA',r?.eta||'');
   rows[4]=pair('',draft?'<ERASE':'','','');rows[5]=pair(DASH,'<LIMITS',DASH,'');
   return {title:(draft?'MOD ':'')+'RTA PROGRESS',number,count:3,rows};
  }
  if(number===3){
   rows[1]=pair('WIND',wind(f.motion?.windFromDeg,f.motion?.windKt),'SAT/ISA DEV',
    Number.isFinite(f.airData?.satC)?fixed(f.airData.satC)+'°C':'');
   rows[2]=pair('XTK ERROR','','VERT DEV','');
   rows[3]=pair('','','TAS',Number.isFinite(f.airData?.tasKt)?fixed(f.airData.tasKt)+'KT':'');
   return {title:flight+'PROGRESS',number,count:3,rows};
  }
  const live=f.guidance?.simulatorCoupled===true?f.guidance.activeLeg:null;
  const from=p.from??{},active=p.active??(live?{ident:live.ident,distanceNm:live.distanceNm,courseTrueDeg:live.courseTrueDeg}:{}),next=p.next??{},dest=p.destination??{};
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
 function routeData(s){
  const all=visibleLegs(s),count=Math.max(1,Math.ceil(all.length/5)),number=Math.min(count,Math.max(1,s.subpage||1)),rows=[];
  const f=s.fmcPageInputs,pred=f?.predictions?.quality==='VALID'?f.predictions:f?.trainingPerformance;
  const records=!modified(s)&&['VALID','TRAINING_ESTIMATE'].includes(pred?.quality)?(Array.isArray(pred.waypoints)&&pred.waypoints.length?pred.waypoints:[pred.from,pred.active,pred.next,pred.destination].filter(Boolean)):[];
  for(let i=0;i<5;i++){
   const leg=all[(number-1)*5+i],matches=leg?.ident?records.filter(x=>x.ident===leg.ident):[];
   const unique=leg?.ident&&all.filter(x=>x.ident===leg.ident).length===1&&matches.length===1?matches[0]:null;
   const eta=unique?utc(unique.eta):'';
   const perf=root.CDU_ENGINE?.perfData?.(s),cruise=unique?.phase==='CRUISE'||unique?.flightPhase==='CRUISE';
   const forecast=unique?(wind(unique.forecastWindFromDeg,unique.forecastWindKt)||(cruise&&perf?.wind?.length===2?wind(perf.forecast.windFromDeg,perf.forecast.windKt):'')):'';
   rows.push(pair(i===0?'':'',leg?.gap?'□□□□□':leg?.ident||'',i===0?'ETA    WIND':'',[eta,forecast].filter(Boolean).join(' ')));
  }
  rows.push(pair(DASH,'<LEGS',DASH,''));return {title:titleWithStatus(s,'RTE DATA'),number,count,rows};
 }
 function fixInfo(s){
  const number=s.subpage===2?2:1,fix=s.fixInfo?.[number],p=ownship(s),rows=Array.from({length:6},empty);
  let relative='';if(validPosition(fix)&&p){let variation=null;try{variation=root?.parent?.B737CduSgBridgeV1?.magneticVariation?.(fix);}catch(_){}const d=legDistance(fix,p);if(Number.isFinite(variation)&&Number.isFinite(d)){const radial=(legCourse(fix,p)-variation+360)%360;relative=String(Math.round(radial)%360).padStart(3,'0')+'/'+Math.round(d);}}
  rows[0]=pair('FIX',fix?.ident||'□□□□□','RAD/DIS FR',relative);
  for(let i=1;i<=3;i++)rows[i]=pair(i===1?'RAD/DIS':'',fix?.entries?.[i-1]||'---',i===1?'ETA DTG ALT':'','');
  rows[5]=pair(DASH,'<INDEX',DASH,'');return {title:'FIX INFO',number,count:2,rows};
 }
 function view(s){
  if(RTE.has(s.page))return route(s);
  if(s.page==='LEGS')return legs(s);
  if(s.page==='HOLD')return holdView(s);
  if(s.page==='RTE_DATA')return routeData(s);
  if(s.page==='FIX')return fixInfo(s);
  if(s.page==='PROG'||s.page==='PROG2')return progress(s);
  return null;
 }
 return Object.freeze({view,invoke,routeCell,isRouteField,modified,canActivate,routeIncomplete,activeReferenceRoute,visibleLegs,holdExecReady,planMode,planCenter,planStep});
});
