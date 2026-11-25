/* Shared CDU/SG terminal selection and Chapter 11 page presentation for source references. */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory;
 if(!root||!root.parent||root.parent===root)return;
 let adapter=null;
 root.B737CDUAttachCduSgV1=function(){
  try{
   if(root.location.origin!==root.parent.location.origin)return false;
   const bridge=root.parent.B737CduSgBridgeV1,route=root.parent.B737CduSgRouteV1;
   if(!bridge?.isConnected?.()||!route||typeof state==='undefined'||typeof core==='undefined')return false;
   if(adapter)return true;
   adapter=factory(state,core,root.CDU_PAGES,bridge,route,()=>root.updateStage5View?.(),root.parent.B737UnifiedSGSourceGeometryV1);
   root.CDU_SG_API=adapter;
   adapter.attach();root.updateStage5View?.();return true;
  }catch(_){return false;}
 };
 root.B737CDUDetachCduSgV1=function(){
  if(!adapter)return false;
  adapter.detach();adapter=null;delete root.CDU_SG_API;
  root.updateStage5View?.();return true;
 };
})(typeof window==='undefined'?null:window,function(state,core,pages,bridge,shared,refresh,converter){
 'use strict';
 let serial=0,unsubscribe=null,attached=false,airwayBusy=false,airwayTicket=0,revisionBeforeExec=null,fixTicket=0;
 const CYCLE='UNSPECIFIED_IN_UPLOADED_FILES';
 const allowedAirport=s=>typeof s==='string'&&/^[A-Z0-9]{4}$/.test(s);
 const encoded=s=>encodeURIComponent(s);
 const update=()=>refresh?.();
 function issue(message){state.message=String(message||'NAV DATA ERROR').slice(0,24);update();}
 const catalogCache=new Map();
 function request(path){
  if(catalogCache.has(path))return catalogCache.get(path);
  const promise=(async()=>{const r=await bridge.request(path),body=await r.json();
   if(!r.ok)throw Error(body.error||'PRIVATE SOURCE UNAVAILABLE');return body;})();
  if(/^\/api\/cdu\/(airport|catalog|procedure)\?/.test(path)){catalogCache.set(path,promise);promise.catch(()=>catalogCache.delete(path));}
  return promise;
 }
 let preloadKey='';
 async function preloadAirports(){
  const origin=core.readValue?.(state,'ORIGIN','RTE'),dest=core.readValue?.(state,'DEST','RTE'),key=origin+'|'+dest;
  if(key===preloadKey)return;preloadKey=key;
  for(const airport of [origin,dest]){
   if(!allowedAirport(airport)||preloadKey!==key)continue;
   try{await Promise.all([request('/api/cdu/airport?icao='+encoded(airport)),
    ...['SID','STAR','APP'].map(kind=>request('/api/cdu/catalog?airport='+encoded(airport)+'&kind='+kind))]);}catch(_){return;}
  }
  if(preloadKey===key&&allowedAirport(origin)&&allowedAirport(dest))void bridge.preloadEnroute?.();
 }
 const routePages=['RTE','FLIGHT_PLAN','ACTIVATE','LEGS'];
 // Reference-only EXEC commits the SG preview state, never an operational FMC route.
 // Native Route activation and source-only reference acceptance are separate.
 const hasReferenceChanges=()=>Boolean(shared.snapshot().modified);
 const mayExecute=()=>state.routeActivated===true||state.routeActivationArmed===true;
 function visible(v,snapshot=shared.snapshot()){
  const role=v.departure?'DEP':'ARR',slot=role+'@'+v.airport;
  const chosen=!v.departure&&(v.inlineApp||snapshot.selections?.['APP@'+v.airport]);
  const app=chosen&&v.right.find(x=>x.kind==='APP'&&x.ident===chosen.ident);
  const runway=chosen?.runway||snapshot.runways?.[slot],fits=item=>!runway||!item.item?.runways?.length||item.item.runways.includes(runway);
  const right=app?[app,...app.item.transitions.map(ident=>({kind:'APP_TRANS',ident,app}))]:
    v.right.filter(x=>x.kind==='RUNWAY'?!runway||x.ident===runway:fits(x));
  return {slot,runway,left:v.left.filter(fits),right};
 }
 function marker(snapshot,field,key,ident){
  const value=bank=>field==='runways'?bank?.runways?.[key]:bank?.selections?.[key]?.ident;
  if(value(snapshot.modified)===ident&&value(snapshot.active)!==ident)return '<SEL>';
  return value(snapshot.active)===ident?'<ACT>':'';
 }
 function routeView(base){
  if(!base||!routePages.includes(state.page))return base;
  const snap=shared.snapshot();
  const hasReference=Object.keys(snap.selections||{}).length>0||
   Object.keys(snap.runways||{}).some(key=>key.includes('@'))||Object.keys(snap.geometries||{}).some(key=>key.startsWith('RTE@'));
  if(!snap.modified&&!hasReference)return base;
  const rows=base.rows.map(row=>({...row}));
  const runway=snap.runways['DEP@'+snap.origin];
  if(state.page==='RTE'&&base.number===1&&runway)rows[2].valueL=runway;
  if(snap.modified&&mayExecute())rows[5].valueL='<ERASE';
  const stage=snap.modified&&mayExecute()?'MOD':state.routeActivated&&hasReference?'ACT':'';
  return {...base,rows,title:stage?stage+' '+base.title.replace(/^(ACT|MOD) /,''):base.title};
 }
 function indexKey(k){
  const slots={LSK_L1:['ORIGIN','DEP'],LSK_R1:['ORIGIN','ARR'],
   LSK_R2:['DEST','ARR'],LSK_L6:['OTHER','DEP'],LSK_R6:['OTHER','ARR']};
  if(!slots[k])return false;
  const [source,mode]=slots[k],airport=String(source==='OTHER'?state.scratch:
   core.readValue(state,source,'RTE')||'').trim().toUpperCase();
  if(!allowedAirport(airport)){issue('ENTER VALID AIRPORT');return true;}
  // Preserve the shared RTE's actual origin/destination. OTHER remains read-only.
  const from=String(core.readValue(state,'ORIGIN','RTE')||'').toUpperCase();
  const to=String(core.readValue(state,'DEST','RTE')||'').toUpperCase();
  shared.setContext({origin:from,destination:to});
  const page=mode==='DEP'?'DEPARTURES':'ARRIVALS',referenceOnly=source==='OTHER';
  if(referenceOnly)state.scratch='';
  const view={owner:'CDU_SG_SOURCE',mode:'LOADING',airport,departure:mode==='DEP',
   source,referenceOnly,page:1,left:[],right:[],candidate:null,
   options:[],runway:null,transition:null};
  ++serial;const ticket=serial;
  delete state.stage6View;
  state.cduSgView=view;
  state.depArrSelection={airport,mode,source,referenceOnly};
  core.choose(state,pages,page);update();
  void (async()=>{
   try{
    const kinds=view.departure?['SID']:['STAR','APP'];
    const [catalogs,airportRecord]=await Promise.all([
     Promise.all(kinds.map(kind=>request('/api/cdu/catalog?airport='+encoded(airport)+'&kind='+kind))),
     request('/api/cdu/airport?icao='+encoded(airport))
    ]);
    if(ticket!==serial||state.cduSgView!==view||state.page!==page)return;
    if(airportRecord?.icao!==airport||!Array.isArray(airportRecord.runways)||
       !Array.isArray(airportRecord.published_runways)||
       catalogs.some((c,i)=>c.airport!==airport||c.kind!==kinds[i]||
        c.cycle!==CYCLE||c.fmc_executable!==false||!Array.isArray(c.items)||
        c.items.some(item=>!item||typeof item.ident!=='string'||
         !Array.isArray(item.runways)||!Array.isArray(item.transitions)||item.fmc_executable!==false)))
     throw Error('NAV SOURCE MISMATCH');
    view.airportRecord=airportRecord;
    view.left=catalogs[0].items.map(item=>({kind:kinds[0],ident:item.ident,item}));
    view.right=(view.departure?[]:catalogs[1].items.map(item=>({kind:'APP',ident:item.ident,item})))
     .concat(airportRecord.published_runways.map(runway=>({kind:'RUNWAY',ident:runway})));
    view.mode='CATALOG';view.page=1;update();
   }catch(err){if(ticket===serial&&state.cduSgView===view){view.mode='ERROR';view.error=err.message;issue('NAV SOURCE UNAVAILABLE');}}
  })();
  return true;
 }
 function count(v,catalog=visible(v)){return Math.max(1,Math.ceil(Math.max(
  v.mode==='CATALOG'?catalog.left.length:v.mode==='RUNWAY'||v.mode==='TRANSITION'?v.options.length:0,
  v.mode==='CATALOG'?catalog.right.length:0)/5))}
 function catalogView(){
  const v=state.cduSgView;
  if(!v||!['DEPARTURES','ARRIVALS'].includes(state.page))return null;
  const blank=()=>({labelL:'',labelR:'',valueL:'',valueR:''});
  const snapshot=shared.snapshot(),catalog=visible(v,snapshot),total=count(v,catalog);
  const number=Math.min(v.page,total),rows=Array.from({length:6},blank),start=(number-1)*5;
  if(v.mode==='LOADING'||v.mode==='ERROR'||v.mode==='VERIFYING'){
   rows[0]={labelL:v.departure?'SIDS':'STARS',labelR:v.departure?'RUNWAYS':'APPROACHES',valueL:'',valueR:''};
   rows[2]={...blank(),labelL:'NAV DATA',valueL:v.mode==='LOADING'?'LOADING':
    v.mode==='VERIFYING'?'VERIFYING':'UNAVAILABLE'};
  }else if(v.mode==='RUNWAY'||v.mode==='TRANSITION'){
   for(let i=0;i<5;i++){
    const entry=v.options[start+i];
    rows[i]={...blank(),labelL:i===0?(v.mode==='RUNWAY'?'RUNWAY':'TRANS'):'',
     valueL:entry||''};
   }
  }else{
   for(let i=0;i<5;i++){
    const l=catalog.left[start+i],r=catalog.right[start+i],previous=catalog.right[start+i-1];
    const lm=l?marker(snapshot,'selections',l.kind+'@'+v.airport,l.ident):'';
    const rm=r?.kind==='APP_TRANS'?(snapshot.selections?.['APP@'+v.airport]?.transition===r.ident?marker(snapshot,'selections','APP@'+v.airport,r.app.ident)||'<SEL>':''):r?marker(snapshot,r.kind==='RUNWAY'?'runways':'selections',
     r.kind==='RUNWAY'?catalog.slot:r.kind+'@'+v.airport,r.ident):'';
    rows[i]={
     labelL:i===0?(v.departure?'SIDS':'STARS'):'',
     valueL:l?l.ident+(lm?' '+lm:''):'',
     labelR:r?.kind==='APP_TRANS'&&previous?.kind!=='APP_TRANS'?'TRANS':r?.kind==='RUNWAY'&&(i===0||previous?.kind!=='RUNWAY')?'RUNWAYS':
      i===0?(v.departure?'RUNWAYS':'APPROACHES'):'',
     valueR:r?((rm||r.kind==='APP'&&v.inlineApp?.ident===r.ident&&'<SEL>')? (rm||'<SEL>')+' ':'')+r.ident:''
    };
   }
  }
  rows[5]={...blank(),valueL:!v.referenceOnly&&snapshot.modified&&mayExecute()?'<ERASE':'<INDEX',valueR:'ROUTE>'};
  return {title:v.airport+' '+state.page,number,count:total,rows};
 }
 function fromCatalogKey(k){
  const v=state.cduSgView;
  if(!v||!['DEPARTURES','ARRIVALS'].includes(state.page))return false;
  if(k==='LSK_L6'){
   ++serial;state.message='';
   if(!v.referenceOnly&&shared.snapshot().modified&&mayExecute()){
    shared.erase();v.mode='CATALOG';v.page=1;v.candidate=null;v.inlineApp=null;
   }else{delete state.cduSgView;core.choose(state,pages,'DEP_ARR');}
   update();return true;
  }
  if(k==='LSK_R6'){++serial;delete state.cduSgView;core.choose(state,pages,'RTE');update();return true;}
  if(k==='PREV_PAGE'||k==='NEXT_PAGE'){
   const pagesCount=count(v);v.page=(Math.min(v.page,pagesCount)-1+(k==='NEXT_PAGE'?1:-1)+pagesCount)%pagesCount+1;
   update();return true;
  }
  const m=/^LSK_([LR])([1-5])$/.exec(k);if(!m)return false;
  const catalog=visible(v);
  const row=(Math.min(v.page,count(v,catalog))-1)*5+Number(m[2])-1;
  if(v.mode==='LOADING'||v.mode==='ERROR'||v.mode==='VERIFYING'){issue('NAV SOURCE UNAVAILABLE');return true;}
  if(v.mode==='CATALOG'){
   const entry=(m[1]==='L'?catalog.left:catalog.right)[row];
   if(!entry){issue('KEY INACTIVE');return true;}
   if(v.referenceOnly){issue('NOT ON ROUTE');return true;}
   if(entry.kind==='APP_TRANS'){
    v.candidate=entry.app;v.runway=catalog.runway;v.transition=entry.ident;void confirm(v);return true;
   }
   if(entry.kind==='APP'&&(entry.item.runways.length===1||catalog.runway&&entry.item.runways.includes(catalog.runway))){
    v.inlineApp={ident:entry.ident,runway:entry.item.runways.length===1?entry.item.runways[0]:catalog.runway};v.candidate=entry;v.runway=v.inlineApp.runway;v.transition=null;
    try{shared.chooseRunway({airport:v.airport,runway:v.runway,airportRecord:v.airportRecord,role:'ARR'});}catch(e){issue(e.message);return true;}
    void confirm(v);return true;
   }
   if(entry.kind==='RUNWAY'){
    try{
     shared.chooseRunway({airport:v.airport,runway:entry.ident,airportRecord:v.airportRecord,role:v.departure?'DEP':'ARR'});
     v.page=1;state.message='';update();
    }catch(e){issue(e.message);}
    return true;
   }
   v.candidate=entry;v.runway=null;v.transition=null;
   v.runways=entry.item.runways;v.transitions=entry.item.transitions;
   if(catalog.runway&&v.runways.includes(catalog.runway))v.runway=catalog.runway;
   else if(v.runways.length===1)v.runway=v.runways[0];
   if(v.runways.length&&!v.runway){v.mode='RUNWAY';v.options=v.runways;v.page=1;update();}
   else if(v.transitions.length){v.mode='TRANSITION';v.options=v.transitions;v.page=1;update();}
   else void confirm(v);
   return true;
  }
  if(m[1]!=='L'){issue('KEY INACTIVE');return true;}
  const value=v.options[row];if(!value){issue('KEY INACTIVE');return true;}
  if(v.referenceOnly){issue('NOT ON ROUTE');return true;}
  if(v.mode==='RUNWAY'){
   v.runway=value;
   if(v.candidate?.kind==='APP'){v.inlineApp={ident:v.candidate.ident,runway:value};v.mode='CATALOG';void confirm(v);}
   else if(v.transitions.length){v.mode='TRANSITION';v.options=v.transitions;v.page=1;update();}
   else void confirm(v);
  }else if(v.mode==='TRANSITION'){v.transition=value;void confirm(v);}
  return true;
 }
 async function confirm(v){
  const entry=v.candidate;if(!entry)return;
  const ticket=++serial;
  if(entry.kind!=='APP'&&bridge.cycle!=='AIRAC-2611')v.mode='VERIFYING';v.page=1;update();
  const query='airport='+encoded(v.airport)+'&kind='+encoded(entry.kind)+'&ident='+encoded(entry.ident)+
   (v.runway?'&runway='+encoded(v.runway):'')+(v.transition?'&transition='+encoded(v.transition):'');
  try{
   const procedure=await request('/api/cdu/procedure?'+query);
   if(!converter?.hasSource?.(procedure))throw Error('PROCEDURE SOURCE INCOMPLETE');
   const geometry=converter.compile(procedure,{airport:v.airport,kind:entry.kind,
    ident:entry.ident,runway:v.runway,transition:v.transition,airportRecord:v.airportRecord});
   if(ticket!==serial||state.cduSgView!==v)return;
   shared.select({airport:v.airport,kind:entry.kind,ident:entry.ident,
    runway:v.runway,transition:v.transition,procedure,geometry,airportRecord:v.airportRecord});
   v.mode='CATALOG';v.page=1;v.candidate=null;v.inlineApp=null;
   state.message='';update();
  }catch(err){
   if(ticket===serial&&state.cduSgView===v){
    v.mode='CATALOG';v.page=1;issue(err.message);
   }
  }
 }

 // A VIA airway must be present at the previous verified source fix, not just
 // somewhere in the world NAV database.
 function precedingFix(field){
  const n=Number(/^VIA(\d+)$/.exec(field)?.[1]);
  if(!Number.isInteger(n)||n<1)return null;
  if(n>1){
   const from=String(core.readValue(state,'TO'+(n-1),'FLIGHT_PLAN')||'').toUpperCase().trim();
   if(!from)return null;
   const proof=state.navFixEvidence?.['TO'+(n-1)]||state.activeNavFixEvidence?.['TO'+(n-1)];
   return {ident:from,lat:proof?.ident===from?proof.lat:null,
    lon:proof?.ident===from?proof.lon:null};
  }
  const snap=shared.snapshot(),origin=core.readValue(state,'ORIGIN','RTE');
  const dest=core.readValue(state,'DEST','RTE'),bank=snap.modified||snap.active;
  if(snap.connected!==true||snap.origin!==origin||snap.destination!==dest)return null;
  const sid=bank?.selections?.['SID@'+origin],geo=bank?.geometries?.['SID@'+origin];
  if(!sid||sid.ident!==geo?.ident)return null;
  const fix=(geo.fixes||[]).filter(p=>typeof p.ident==='string'&&
   Number.isFinite(p.lat)&&Number.isFinite(p.lon)).at(-1);
  return fix?{ident:fix.ident,lat:fix.lat,lon:fix.lon}:null;
 }
 async function verifyAirwayKey(key,cell){
  if(airwayBusy){issue('NAV DATA LOOKUP BUSY');return;}
  const from=precedingFix(cell.field),value=String(state.scratch||'').trim().toUpperCase();
  if(!from||!value){issue('NOT IN DATABASE');return;}
  airwayBusy=true;const ticket=++airwayTicket,revision=shared.snapshot().revision;
  state.message='';update();
  try{
   const url='/api/cdu/airway-check?from='+encoded(from.ident)+'&airway='+encoded(value)+
    (Number.isFinite(from.lat)&&Number.isFinite(from.lon)?
     '&lat='+encoded(from.lat)+'&lon='+encoded(from.lon):'');
   const response=await bridge.request(url),data=await response.json();
   if(!attached||ticket!==airwayTicket||state.page!=='FLIGHT_PLAN'||
      String(state.scratch||'').toUpperCase().trim()!==value||
      shared.snapshot().revision!==revision||
      globalThis.CDU_CH11_ROUTE_PAGES?.routeCell(state,key)?.field!==cell.field)return;
   if(!response.ok||data?.available!==true){issue('NAV DATA UNAVAILABLE');return;}
   if(data.valid!==true||data.from!==from.ident||data.airway!==value){
    issue('NOT IN DATABASE');return;
   }
   state.verifiedAirwayEntries={...(state.verifiedAirwayEntries||{}),
    [cell.field]:{airway:value,from:from.ident,
     origin:core.readValue(state,'ORIGIN','RTE'),destination:core.readValue(state,'DEST','RTE'),
     source:'OWNER_WPNAVRTE_VERIFIED'}};
   const previous=core.readValue(state,cell.field,'FLIGHT_PLAN');
   state.message='';
   core.press(state,pages,'CDU_CAPT_'+key);
   if(bridge.cycle==='AIRAC-2611'&&previous!==value&&core.readValue(state,cell.field,'FLIGHT_PLAN')===value)shared.clearEnrouteFrom?.(Number(cell.field.slice(3)));
   update();
  }catch(_){if(attached&&ticket===airwayTicket)issue('NAV DATA UNAVAILABLE');}
  finally{if(ticket===airwayTicket)airwayBusy=false;}
 }

 // A TO entry must be reachable on the selected VIA airway, not merely
 // present somewhere in the waypoint database.
 async function verifyToKey(key,cell,via){
  if(airwayBusy){issue('NAV DATA LOOKUP BUSY');return;}
  const n=Number(/^TO(\d+)$/.exec(cell.field)?.[1]),viaField='VIA'+n;
  const from=precedingFix(viaField),input=String(state.scratch||'').trim().toUpperCase();
  const origin=core.readValue(state,'ORIGIN','RTE');
  const destination=core.readValue(state,'DEST','RTE');
  const verifiedVia=state.verifiedAirwayEntries?.[viaField];
  if(!from||!Number.isFinite(from.lat)||!Number.isFinite(from.lon)||
     verifiedVia?.airway!==via||verifiedVia?.from!==from.ident||
     verifiedVia?.origin!==origin||verifiedVia?.destination!==destination||
     verifiedVia?.source!=='OWNER_WPNAVRTE_VERIFIED'){
   issue('NAV DATA UNAVAILABLE');return;
  }
  airwayBusy=true;const ticket=++airwayTicket,revision=shared.snapshot().revision;
  state.message='';update();
  try{
   const url='/api/cdu/airway-check?from='+encoded(from.ident)+
    '&airway='+encoded(via)+'&to='+encoded(input)+
    '&lat='+encoded(from.lat)+'&lon='+encoded(from.lon);
   const result=await bridge.request(url),proof=await result.json();
   if(!attached||ticket!==airwayTicket||state.page!=='FLIGHT_PLAN'||
      String(state.scratch||'').trim().toUpperCase()!==input||
      core.readValue(state,viaField,'FLIGHT_PLAN')!==via||
      shared.snapshot().revision!==revision||
      globalThis.CDU_CH11_ROUTE_PAGES?.routeCell(state,key)?.field!==cell.field)return;
   if(!result.ok||proof?.available!==true){issue('NAV DATA UNAVAILABLE');return;}
   if(proof.valid!==true||proof.from!==from.ident||
      proof.airway!==via||proof.to!==input){
    issue('NOT IN DATABASE');return;
   }
   const fixes=Array.isArray(proof.fixes)&&proof.fixes.length<=250&&
    proof.fixes.every(f=>typeof f==='string'&&/^[A-Z0-9._-]{2,16}$/.test(f))&&
    proof.fixes.at(-1)===input?proof.fixes.slice():[input];
   state.verifiedToEntries={...(state.verifiedToEntries||{}),
    [cell.field]:{to:input,airway:via,from:from.ident,origin,destination,
     fixes,source:'OWNER_WPNAVRTE_VERIFIED'}};
   state.message='';
   core.press(state,pages,'CDU_CAPT_'+key);
   if(bridge.cycle==='AIRAC-2611'&&core.readValue(state,cell.field,'FLIGHT_PLAN')===input&&
      Array.isArray(proof.points)&&proof.points.length>1&&proof.points.at(-1).ident===input){
    const p=proof.points.at(-1);state.navFixEvidence={...(state.navFixEvidence||{}),[cell.field]:p};
    shared.stageEnroute?.(n,proof.points,via);
   }
   update();
  }catch(_){if(attached&&ticket===airwayTicket)issue('NAV DATA UNAVAILABLE');}
  finally{if(ticket===airwayTicket)airwayBusy=false;}
 }

 async function pilotPoint(input,route=[],index=null){
  const api=globalThis.B737PilotWaypointsV1;if(!api)throw Error('NAV DATA UNAVAILABLE');
  const spec=api.parse(input),snap=shared.snapshot();
  const points=Object.values(snap.geometries||{}).flatMap(g=>g.fixes||[]);
  const used=[...new Set([...points.map(p=>p.ident),...route.map(p=>p.ident),...Object.values(state.navFixEvidence||{}).map(p=>p.ident),...Object.values(state.activeNavFixEvidence||{}).map(p=>p.ident)])];
  async function lookup(id){
   const list=points.filter(p=>p.ident===id&&Number.isFinite(p.lat)&&Number.isFinite(p.lon));
   if(list.length){if(list.some(p=>api.distance(p,list[0])>.05))throw Error('DUPLICATE WAYPOINT');return list[0];}
   const res=await bridge.request('/api/iran-navdata/fix?ident='+encoded(id)),body=await res.json();
   if(!res.ok||body.matches?.length!==1)throw Error(body.matches?.length>1?'DUPLICATE WAYPOINT':'NOT IN DATABASE');
   return body.matches[0];
  }
  const p=await api.resolve(spec,{lookup,variation:point=>bridge.magneticVariation?.(point),route,index,used});
  // Avoid clashing with an existing database identifier.
  for(let attempt=0;attempt<999;attempt++){
   const res=await bridge.request('/api/iran-navdata/fix?ident='+encoded(p.ident));
   if(res.status===404)return p;
   if(!res.ok)throw Error('NAV DATA UNAVAILABLE');
   const v=await res.json();if(!v.matches?.length)return p;
   used.push(p.ident);p.ident=api.name(spec.prefix,used);
  }
  throw Error('WAYPOINT LIMIT');
 }
 async function insertLegPilot(k){
  if(airwayBusy){issue('NAV DATA LOOKUP BUSY');return;}
  const page=globalThis.CDU_CH11_ROUTE_PAGES,route=page?.visibleLegs?.(state)||[];
  const selected=((page?.view(state)?.number||1)-1)*5+Number(k.slice(-1))-1,input=String(state.scratch||'').trim().toUpperCase();
  const ref=route[selected],revision=shared.snapshot().revision,ticket=++airwayTicket;
  if(!ref||ref.conditional||ref.gap){issue('INVALID LEG');return;}
  airwayBusy=true;state.message='';update();
  try{
   const spec=globalThis.B737PilotWaypointsV1.parse(input);
   if(spec.kind==='ATW'&&spec.place!==ref.ident)throw Error('INVALID ALONG TRACK');
   const p=await pilotPoint(input,route,spec.kind==='ATW'?selected:null);
   const index=p.insertIndex??selected,next=route[index],prev=route[index-1];
   if(!attached||ticket!==airwayTicket||state.page!=='LEGS'||String(state.scratch||'').trim().toUpperCase()!==input||shared.snapshot().revision!==revision)return;
   if(!prev||!next||prev.conditional||next.conditional||prev.gap||next.gap||!next.geoKey)throw Error('INVALID LEG');
   shared.insertPilotBefore(next.geoKey,next.rawIndex,p,prev.ident,next.ident);
   state.scratch='';state.message='';update();
  }catch(e){if(attached&&ticket===airwayTicket)issue(e.message);}
  finally{if(ticket===airwayTicket)airwayBusy=false;}
 }

 async function verifyDirectKey(key,cell){
  if(airwayBusy){issue('NAV DATA LOOKUP BUSY');return;}
  const n=Number(cell.field.slice(2)),input=String(state.scratch||'').trim().toUpperCase();
  const isPilot=/[\/]/.test(input)||/^[NS]\d{2}.*[EW]\d{3}/.test(input);
  if(!Number.isInteger(n)||(!isPilot&&!core.validate?.('WAYPOINT',input))){issue('INVALID ENTRY');return;}
  if(isPilot){try{if(globalThis.B737PilotWaypointsV1.parse(input).kind==='ATW'){issue('USE LEGS PAGE');return;}}catch(e){issue(e.message);return;}}
  shared.setContext({origin:core.readValue(state,'ORIGIN','RTE'),destination:core.readValue(state,'DEST','RTE')});
  const from=precedingFix('VIA'+n),revision=shared.snapshot().revision,ticket=++airwayTicket;
  airwayBusy=true;state.message='';update();
  try{
   let p;
   if(isPilot)p=await pilotPoint(input);
   else {const result=await bridge.request('/api/iran-navdata/fix?ident='+encoded(input)),body=await result.json();
    if(!result.ok||body.matches?.length!==1)throw Error(body.matches?.length>1?'DUPLICATE WAYPOINT':'NOT IN DATABASE');
    p=body.matches[0];}
   if(!attached||ticket!==airwayTicket||state.page!=='FLIGHT_PLAN'||shared.snapshot().revision!==revision||
    String(state.scratch||'').trim().toUpperCase()!==input||globalThis.CDU_CH11_ROUTE_PAGES?.routeCell(state,key)?.field!==cell.field)return;
   if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||(!isPilot&&p.ident!==input)){issue('NOT IN DATABASE');return;}
   state.message='';state.scratch=p.ident;core.press(state,pages,'CDU_CAPT_'+key);
   if(core.readValue(state,cell.field,'FLIGHT_PLAN')===p.ident){
    state.navFixEvidence={...(state.navFixEvidence||{}),[cell.field]:p};
    const pts=from&&Number.isFinite(from.lat)&&Number.isFinite(from.lon)&&from.ident!==p.ident?[from,p]:[p];
    shared.stageEnroute?.(n,pts,'DIRECT');
   }
   update();
  }catch(e){if(attached&&ticket===airwayTicket)issue(e.message||'NAV DATA UNAVAILABLE');}
  finally{if(ticket===airwayTicket)airwayBusy=false;}
 }
 async function selectInfoFix(){
  const input=String(state.scratch||'').trim().toUpperCase(),number=state.subpage===2?2:1,ticket=++fixTicket;
  if(input==='DELETE'){const info={...state.fixInfo};delete info[number];state.fixInfo=info;state.scratch='';state.message='';update();return;}
  if(!/^[A-Z0-9]{2,7}$/.test(input)){issue('INVALID ENTRY');return;}
  try{const response=await bridge.request('/api/iran-navdata/fix?ident='+encoded(input)),body=await response.json();
   if(!attached||ticket!==fixTicket||state.page!=='FIX'||(state.subpage===2?2:1)!==number||state.scratch!==input)return;
   if(!response.ok||body.matches?.length!==1){issue(body.matches?.length>1?'DUPLICATE WAYPOINT':'NOT IN DATABASE');return;}
   const point=body.matches[0];if(point.ident!==input||!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180)throw Error('INVALID FIX DATA');
   state.fixInfo={...state.fixInfo,[number]:{ident:point.ident,lat:point.lat,lon:point.lon,entries:[]}};state.scratch='';state.message='';update();
  }catch(e){if(attached&&ticket===fixTicket)issue(e.message||'NAV DATA UNAVAILABLE');}
 }
 function beforeKey(code){
  if(!attached||!bridge.isConnected())return false;
  const k=String(code).replace(/^CDU_CAPT_/,'');
  if(k==='EXEC')revisionBeforeExec=mayExecute()?(state.routeRevision||0):null;
  if(bridge.cycle==='AIRAC-2611'&&state.page==='FIX'&&k==='LSK_L1'&&state.scratch){void selectInfoFix();return true;}
  if(bridge.cycle==='AIRAC-2611'&&state.page==='LEGS'&&/^LSK_L[1-5]$/.test(k)&&state.scratch){
   const api=globalThis.CDU_CH11_ROUTE_PAGES,route=api?.visibleLegs?.(state)||[],index=((api?.view(state)?.number||1)-1)*5+Number(k.slice(-1))-1;
   const gap=route[index],next=route[index+1],prev=route[index-1];
   if(gap?.gap){
    try{if(!next||!prev||state.scratch.trim().toUpperCase()!==next.ident||gap.geoKey!==next.geoKey||gap.geoKey!==prev.geoKey)throw Error('INVALID ENTRY');
     shared.linkDiscontinuity(gap.geoKey,gap.rawIndex,prev.ident,next.ident);state.scratch='';state.message='';update();
    }catch(e){issue(e.message);}return true;
   }
  }
  if(bridge.cycle==='AIRAC-2611'&&state.page==='LEGS'&&/^LSK_L[1-5]$/.test(k)&&(/[\/]/.test(state.scratch)||/^[NS]\d{2}.*[EW]\d{3}/.test(state.scratch))){
   void insertLegPilot(k);return true;
  }
  if(bridge.cycle==='AIRAC-2611'&&state.page==='FLIGHT_PLAN'&&/^LSK_[LR][1-5]$/.test(k)&&
   ['DELETE','DCT','DIRECT'].includes(String(state.scratch||'').toUpperCase())){
   const cell=globalThis.CDU_CH11_ROUTE_PAGES?.routeCell(state,k);
   if(cell&&/^(VIA|TO)\d+$/.test(cell.field)&&(state.scratch==='DELETE'||cell.field.startsWith('VIA'))){
    const row=Number(cell.field.replace(/^(VIA|TO)/,''));
    const before=core.readValue(state,cell.field,'FLIGHT_PLAN');core.press(state,pages,code);
    if(!state.scratch&&core.readValue(state,cell.field,'FLIGHT_PLAN')!==before)shared.clearEnrouteFrom?.(row);
    update();return true;
   }
  }
  if(state.page==='FLIGHT_PLAN'&&/^LSK_L[1-5]$/.test(k)&&state.scratch&&
     !['DELETE','DCT','DIRECT'].includes(state.scratch.trim().toUpperCase())){
   const cell=globalThis.CDU_CH11_ROUTE_PAGES?.routeCell(state,k);
   if(cell?.format==='AIRWAY'&&core.validate?.('AIRWAY',state.scratch)){
    void verifyAirwayKey(k,cell);return true;
   }
  }
  if(state.page==='FLIGHT_PLAN'&&/^LSK_R[1-5]$/.test(k)&&state.scratch&&
     state.scratch.trim().toUpperCase()!=='DELETE'){
   const cell=globalThis.CDU_CH11_ROUTE_PAGES?.routeCell(state,k);
   if(cell?.format==='WAYPOINT'&&/^TO\d+$/.test(cell.field)){
    const viaField='VIA'+cell.field.slice(2);
    const via=String(core.readValue(state,viaField,'FLIGHT_PLAN')||'').trim().toUpperCase();
    if(via&&via!=='DIRECT'&&via!=='DCT'){
     if(!core.validate?.('WAYPOINT',state.scratch)){issue('INVALID ENTRY');return true;}
     void verifyToKey(k,cell,via);return true;
    }
    if(bridge.cycle==='AIRAC-2611'){void verifyDirectKey(k,cell);return true;}
   }
  }
  if(state.page==='DEP_ARR')return indexKey(k);
  if(routePages.includes(state.page)&&k==='LSK_L6'&&shared.snapshot().modified&&mayExecute()){
   if(core.pendingCount?.(state)||state.routeActivationArmed)core.press(state,pages,code);
   shared.erase();
   state.message='';return true;
  }
  return fromCatalogKey(k);
 }
 function afterKey(code){
  if(attached)void preloadAirports();
  if(String(code).replace(/^CDU_CAPT_/,'')!=='EXEC'||!attached||revisionBeforeExec===null||!hasReferenceChanges()||state.routeActivated!==true)return;
  // The shared state is a verified display reference, not a flight-leg
  // execution or the activation of the aircraft FMC/LNAV. EXEC changes
  // the EHSI's cyan dashed MOD REF to magenta solid ACT REF only.
  if(revisionBeforeExec===(state.routeRevision||0))state.routeRevision=(state.routeRevision||0)+1;
  revisionBeforeExec=null;state.activeNavFixEvidence={...state.navFixEvidence};shared.execute();
  state.message='';
 }
 function execLit(){return attached&&mayExecute()&&hasReferenceChanges();}
 function attach(){
  if(attached)return;attached=true;void preloadAirports();
  if(['DEPARTURES','ARRIVALS'].includes(state.page)&&!state.cduSgView){
   const {source,mode}=state.depArrSelection||{};
   const key=source==='ORIGIN'?(mode==='DEP'?'LSK_L1':'LSK_R1'):
    source==='DEST'?'LSK_R2':null;
   core.choose(state,pages,'DEP_ARR');
   if(key)indexKey(key);
  }
  unsubscribe=shared.subscribe(()=>{if(attached)update();});
 }
 function detach(){
  ++serial;++airwayTicket;++fixTicket;airwayBusy=false;attached=false;unsubscribe?.();unsubscribe=null;
  if(state.cduSgView){delete state.cduSgView;if(['DEPARTURES','ARRIVALS'].includes(state.page))
   core.choose(state,pages,'DEP_ARR');}
 }
 return Object.freeze({attach,detach,beforeKey,afterKey,execLit,routeView,chapter11CatalogView:catalogView});
});
