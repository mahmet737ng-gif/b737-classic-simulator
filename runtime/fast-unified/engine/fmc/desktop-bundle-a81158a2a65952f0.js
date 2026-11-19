(async()=>{
;
/* ../../engine/fmc/sg-source-geometry-v1.js?v=UNIFIED-SG-SOURCE-GEOMETRY-0002-LEG-PROGRAM */
try{
/* Unified FMC -> SG reference geometry. Pure read-only translator:
 * NAVDATA source tokens + verified fix coordinates -> point/segment graphics.
 * No turn, vector, hold, path-terminator or AFDS command is inferred.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedSGSourceGeometryV1=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const VERSION='UNIFIED-SG-SOURCE-GEOMETRY-0002-LEG-PROGRAM';
 const Trajectory=(typeof globalThis==='object'?globalThis.B737UnifiedSGProcedureTrajectoryV1:null)||
  (typeof module==='object'&&typeof require==='function'?require('./sg-procedure-trajectory-v1.js'):null);
 const CYCLE='UNSPECIFIED_IN_UPLOADED_FILES';
 const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&
   Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 const validFix=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&
   validPoint([p.lon,p.lat]);
 const ident=s=>typeof s==='string'&&/^[A-Z0-9._-]{2,24}$/.test(s);
 const radians=x=>x*Math.PI/180;
 function nm(a,b){
  const x=radians(b[1]-a[1]),y=radians(b[0]-a[0]);
  const h=Math.sin(x/2)**2+Math.cos(radians(a[1]))*Math.cos(radians(b[1]))*Math.sin(y/2)**2;
  return 3440.065*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
 }
 function resolveLocalFix(source,name){
  const table=source.local_fixes||source.localFixes;
  const selected=Array.isArray(table)?table.filter(x=>x?.ident===name):
   table&&typeof table==='object'?table[name]:null;
  const rows=Array.isArray(selected)?selected:selected?[selected]:[];
  // Local FIX records must carry original source-line provenance.
  if(!rows.length||!rows.every(r=>r?.ident===name&&validFix(r)&&
    Number.isInteger(r.post_marker_line)&&r.post_marker_line>0))return null;
  if(rows.some(r=>nm([r.lon,r.lat],[rows[0].lon,rows[0].lat])>.027))
   return null; // Conflicting duplicate identifiers must never be guessed.
  return {ident:name,lat:rows[0].lat,lon:rows[0].lon};
 }
 function hasSource(source){return Array.isArray(source?.segments)&&source.segments.some(s=>
  Array.isArray(s?.events)||Array.isArray(s?.ast));}
 function compile(source,{airport,kind,ident:procedureIdent,runway=null,transition=null,airportRecord=null}={}){
  if(!source||!hasSource(source)||source.fmc_executable===true||
     source.airport&&source.airport!==airport||source.kind&&source.kind!==kind||
     source.ident&&source.ident!==procedureIdent||
     !/^[A-Z0-9]{4}$/.test(airport||'')||!['SID','STAR','APP'].includes(kind)||
     !ident(procedureIdent))throw Error('SG_SOURCE_UNVERIFIED');
  const features=[],warnings=[],seenMarkers=new Set();
  const pathProgram=Trajectory?.program?.(source,{airport,kind,runway,airportRecord})||null;
  function point(f,sequence){
   if(!validFix(f)||!ident(f.ident))return null;
   const p=[f.lon,f.lat],key=f.ident+'@'+p.join(',');
   if(!seenMarkers.has(key)){
    seenMarkers.add(key);
    features.push({type:'Feature',geometry:{type:'Point',coordinates:p},
     properties:{ident:f.ident,sequence,render_style:'reference_fix_only',fmc_executable:false}});
   }
   return p;
  }
  for(const [groupIndex,group] of source.segments.entries()){
   let previous=null,previousFix='';
   const tokens=group?.events||group?.ast||[];
   if(!Array.isArray(tokens))throw Error('SG_TOKEN_ARRAY_INVALID');
   for(const [eventIndex,node] of tokens.entries()){
    const type=node?.kind,values=node?.values||{};
    if(type==='SPEED_TOKEN'||type==='ALTITUDE_CONSTRAINT')continue;
    if(type!=='FIX_PASSAGE'){
     previous=null;previousFix='';
     if(type!=='RUNWAY_REFERENCE')warnings.push({group:groupIndex,event:eventIndex,kind:String(type||'UNKNOWN')});
     continue;
    }
    const name=node.fix?.ident||values.ident;
    // Only a verified source-local fix may determine a coordinate.
    const record=node.fix&&node.reference_status==='LOCAL_FIX_COORDINATE_VERIFIED'?
      node.fix:resolveLocalFix(source,name);
    const current=record?point({ident:name,lat:record.lat,lon:record.lon},[groupIndex,eventIndex]):null;
    if(!current){
     previous=null;previousFix='';
     warnings.push({group:groupIndex,event:eventIndex,kind:'FIX_COORDINATE_UNVERIFIED',ident:String(name||'')});
     continue;
    }
    if(previous&&!pathProgram){
     const distance=nm(previous,current);
     if(distance>.005&&distance<=200){
      features.push({type:'Feature',geometry:{type:'LineString',coordinates:[previous,current]},
       properties:{from:previousFix,to:name,reference_distance_nm:Math.round(distance*1000)/1000,
        render_style:'dashed_reference_not_actual_flight_path',fmc_executable:false}});
     }else warnings.push({group:groupIndex,event:eventIndex,kind:'CHORD_DISTANCE_REVIEW_REQUIRED'});
    }
    previous=current;previousFix=name;
   }
  }
  if(features.length>800)throw Error('SG_SOURCE_TOO_LARGE');
  return {type:'FeatureCollection',metadata:{airport,kind,ident:procedureIdent,
    airac:CYCLE,source_cycle:source.airac||null,selected_runway:runway,
    selected_transition:transition,fmc_executable:false,source_only:true,
    warnings,version:VERSION,...(pathProgram?{pathProgram}:{})},features};
 }
 return Object.freeze({VERSION,CYCLE,hasSource,compile});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cdu-sg-route-state-v1.js?v=SG-AUTHORED-LEG-PROGRAM-20261117 */
try{
/* Unified shared reference route. Not FMC ACTIVE, LNAV, VNAV or AFDS input. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737CduSgRouteV1=api.create();
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const VERSION='CDU-SG-ROUTE-0001',CYCLE='UNSPECIFIED_IN_UPLOADED_FILES';
 const copy=x=>JSON.parse(JSON.stringify(x));
 const isIcao=x=>typeof x==='string'&&/^[A-Z0-9]{4}$/.test(x);
 const isIdent=x=>typeof x==='string'&&/^[A-Z0-9._-]{2,16}$/.test(x);
 const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 function create(){
  let revision=0,connected=false,origin='',destination='';
  const empty=()=>({selections:{},geometries:{},runways:{}}),listeners=new Set();
  let active=empty(),mod=null;
  const working=()=>mod??active;
  const startMod=()=>mod??(mod=copy(active));
  const snapshot=()=>copy({version:VERSION,revision,connected,origin,destination,cycle:CYCLE,
   sourceOnly:true,fmcExecutable:false,active,modified:mod,...working()});
  function execute(){if(!mod)return snapshot();active=mod;mod=null;return publish();}
  function erase(){if(!mod)return snapshot();mod=null;return publish();}
  function publish(){revision++;const v=snapshot();for(const fn of [...listeners])try{fn(v)}catch(_){/* Observer isolation */}return v}
  function clearAll(){active=empty();mod=null;}
  function setConnected(on){if(connected===(on===true))return snapshot();connected=on===true;if(!connected)clearAll();return publish()}
  function setContext({origin:a='',destination:b=''}={}){
   a=String(a||'').toUpperCase().trim();b=String(b||'').toUpperCase().trim();
   if(a===origin&&b===destination)return snapshot();
   origin=a;destination=b;clearAll();return publish();
  }
  function permitted(kind,airport){return kind==='SID'?airport===origin:
   (kind==='STAR'||kind==='APP')&&(airport===origin||airport===destination)}
  function setRunway(bank,airport,role,runway,airportRecord){
   const slot=role+'@'+airport,key='RUNWAY_'+slot;
   bank.runways[slot]=runway;
   if(role==='DEP'||!bank.runways[airport])bank.runways[airport]=runway;
   const rwy=airportRecord?.runways.find(r=>r.runway===runway);
   const point=r=>r&&[r.threshold_lon,r.threshold_lat];
   const threshold=point(rwy);
   if(!validPoint(threshold)){delete bank.geometries[key];return;}
   const match=/^(\d{2})([LCR]?)$/.exec(runway);
   const end=match?String((Number(match[1])+17)%36+1).padStart(2,'0')+
    ({L:'R',R:'L',C:'C','':''})[match[2]]:null;
   const opposite=point(airportRecord.runways.find(r=>r.runway===end));
   bank.geometries[key]={airport,kind:'RUNWAY',ident:runway,
    segments:validPoint(opposite)?[[threshold,opposite]]:[],
    fixes:[{ident:'RW'+runway,lon:threshold[0],lat:threshold[1]}],
    renderStyle:'DASHED_REFERENCE_CHORDS_ONLY'};
  }
  function chooseRunway({airport,runway,airportRecord,role=airport===origin?'DEP':'ARR'}){
   if(!connected)throw Error('NAV SOURCE DISCONNECTED');
   if(!isIcao(airport)||!isIdent(runway)||![origin,destination].includes(airport)||
      airportRecord?.icao!==airport||!Array.isArray(airportRecord.runways)||
      !airportRecord.runways.some(r=>r?.runway===runway))throw Error('RUNWAY NOT VERIFIED');
   if(!['DEP','ARR'].includes(role)||role==='DEP'&&airport!==origin)throw Error('NOT ON ROUTE');
   const slot=role+'@'+airport;
   if(working().runways[slot]===runway)return snapshot();
   const bank=startMod();
   for(const kind of role==='DEP'?['SID']:['STAR','APP']){
    const key=kind+'@'+airport,s=bank.selections[key];
    if(s?.runway&&s.runway!==runway){delete bank.selections[key];delete bank.geometries[key];}
   }
   setRunway(bank,airport,role,runway,airportRecord);return publish();
  }
  function select({airport,kind,ident,runway=null,transition=null,procedure,geometry,airportRecord}){
   if(!connected)throw Error('NAV SOURCE DISCONNECTED');
   if(!isIcao(airport)||!['SID','STAR','APP'].includes(kind)||!isIdent(ident)||!permitted(kind,airport))
    throw Error('NOT ON ROUTE');
   if(procedure?.airport!==airport||procedure?.kind!==kind||procedure?.ident!==ident||
      procedure?.fmc_executable!==false||
      (procedure?.requires_runway_selection===true&&!runway)||
      (procedure?.requires_transition_selection===true&&!transition)||
      !Array.isArray(procedure?.runway_options)||
      !Array.isArray(procedure?.transition_options))throw Error('UNVERIFIED PROCEDURE');
   if(runway&&!procedure.runway_options.includes(runway)||transition&&!procedure.transition_options.includes(transition)||
      procedure.runway_options.length>1&&!runway||procedure.transition_options.length>1&&!transition)
    throw Error('SELECT PUBLISHED VARIANT');
   const meta=geometry?.metadata;
   if(geometry?.type!=='FeatureCollection'||!Array.isArray(geometry.features)||
      meta?.airport!==airport||meta?.kind!==kind||meta?.ident!==ident||
      meta?.airac!==CYCLE||meta?.fmc_executable!==false||
      (meta?.selected_runway||null)!==(runway||null)||
      (meta?.selected_transition||null)!==(transition||null))
    throw Error('SOURCE GEOMETRY MISMATCH');
   const segments=[];
   for(const feature of geometry.features){
    const pts=feature?.geometry?.coordinates;
    if(feature?.geometry?.type!=='LineString'||!Array.isArray(pts)||
       pts.length!==2||!pts.every(validPoint)||feature.properties?.fmc_executable!==false||
       !String(feature.properties?.render_style||'').includes('reference'))continue;
    segments.push(pts.map(p=>[p[0],p[1]]));
    if(segments.length>=300)break;
   }
   // Source coordinate fixes are display symbols, not inferred flyable legs.
   const fixes=[];
   for(const feature of geometry.features){
    if(feature?.geometry?.type!=='Point'||!validPoint(feature.geometry.coordinates)||
       typeof feature.properties?.ident!=='string'||!isIdent(feature.properties.ident)||
       feature.properties?.fmc_executable!==false)continue;
    const [lon,lat]=feature.geometry.coordinates;
    fixes.push({ident:feature.properties.ident,lon,lat});
    if(fixes.length>=150)break;
   }
   const key=kind+'@'+airport;
   if(!segments.length&&!fixes.length)throw Error('NO VERIFIED GEOMETRY');
   const bank=startMod();
   bank.selections[key]={airport,kind,ident,runway,transition,cycle:CYCLE,sourceOnly:true,fmcExecutable:false};
   const program=meta?.pathProgram?.version==='SG-PROCEDURE-TRAJECTORY-0001'&&
    meta.pathProgram.sourceOnly===true&&meta.pathProgram.fmcExecutable===false&&
    meta.pathProgram.runway===runway&&meta.pathProgram.fixes?.length===2?
    copy(meta.pathProgram):null;
   bank.geometries[key]={airport,kind,ident,segments,fixes,
    ...(program?{program}:{}),
    warnings:Array.isArray(meta?.warnings)?meta.warnings.slice(0,100):[],
    renderStyle:'DASHED_REFERENCE_CHORDS_ONLY'};
   if(runway){
    const role=kind==='SID'?'DEP':'ARR',slot=role+'@'+airport;
    if(bank.runways[slot]!==runway)setRunway(bank,airport,role,runway,airportRecord);
   }
   return publish();
  }
  function clear(kind,airport){if(!connected)throw Error('NAV SOURCE DISCONNECTED');const key=kind+'@'+airport;
   if(!working().selections[key])return snapshot();const bank=startMod();
   delete bank.selections[key];delete bank.geometries[key];return publish();}
  function subscribe(fn){if(typeof fn!=='function')throw Error('SUBSCRIBER_REQUIRED');
   listeners.add(fn);fn(snapshot());return ()=>listeners.delete(fn)}
  return Object.freeze({snapshot,subscribe,setConnected,setContext,select,chooseRunway,clear,execute,erase});
 }
 return Object.freeze({VERSION,CYCLE,create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cdu-session.js?v=CDU-SYNC-VERIFIED-TO-20261117-0002 */
try{
/* One shared FMC dataset, with separate CDU display/input state. Unified only. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737CduSession=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const keys=Object.freeze(['active','pending','stagedRoute','routeActivated','routeActivationArmed','routeRevision','navFixEvidence','activeNavFixEvidence','verifiedAirwayEntries','verifiedToEntries','navdbActive','navdbPending','navdbStage','stage5Pending','stage5Committed','stage5AwaitingExec','stage6BasePlanId','stage6Selections','stage6PendingPlan','stage6AwaitingExec','fmcNavDataBanks']);
 const copy=value=>JSON.parse(JSON.stringify(value));
 function extract(state){const shared={};for(const key of keys)if(Object.hasOwn(state,key))shared[key]=copy(state[key]);return shared;}
 function apply(state,shared){for(const key of keys){if(Object.hasOwn(shared,key))state[key]=copy(shared[key]);else delete state[key];}}
 function create(){
  const peers=new Map(),subscribers=new Set();let shared=null,revision=0;
  function notify(){const value=copy(shared||{});for(const fn of [...subscribers])try{fn(value)}catch(_){/* Subscriber isolation */}}
  function deliver(peer){peer.write(copy(shared));peer.refresh();}
  function attach(seat,peer){
   if(!['CAPT','FO'].includes(seat)||!peer||!['read','write','refresh'].every(k=>typeof peer[k]==='function'))throw Error('Invalid CDU session peer');
   if(shared===null)shared=extract(peer.read());
   peers.set(seat,peer);deliver(peer);notify();
   return Object.freeze({
    publish(){if(peers.get(seat)!==peer)return;const next=extract(peer.read());if(JSON.stringify(next)===JSON.stringify(shared))return;shared=next;revision++;for(const [other,p]of peers)if(other!==seat)deliver(p);notify();},
    snapshot:()=>copy(shared),
    revision:()=>revision
   });
  }
  return Object.freeze({attach,snapshot:()=>copy(shared||{}),subscribe(fn){
    if(typeof fn!=='function')throw Error('SUBSCRIBER_REQUIRED');
    subscribers.add(fn);fn(copy(shared||{}));return ()=>subscribers.delete(fn);
   }});
 }
 return Object.freeze({create,extract,apply,keys});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./wheel-pan-model-v1.js?v=WHEEL-PAN-0001 */
try{
/* Unified cockpit wheel routing (display navigation only).
 * Distinguishes line/pixel/page wheel deltas. No effect on cockpit controls.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737WheelPanModelV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 function normalize(payload,viewport){
  if(!payload||!Number.isFinite(payload.deltaX)||!Number.isFinite(payload.deltaY))return null;
  const mode=payload.deltaMode===1?1:payload.deltaMode===2?2:0;
  const factor=mode===1?16:mode===2?Math.max(1,Number(viewport?.height)||600):1;
  let x=payload.deltaX*factor,y=payload.deltaY*factor;
  if(payload.shiftKey&&x===0){x=y;y=0;}
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  return {x,y};
 }
 function pan(viewport,payload){
  const p=normalize(payload,{height:viewport?.clientHeight});
  if(!p||!viewport)return false;
  viewport.scrollLeft+=p.x;
  viewport.scrollTop+=p.y;
  return true;
 }

 // RAF-coalesced visual pan. Keep the original synchronous pan() API for
 // compatibility with standalone embedded panels and existing test fixtures.
 function createController(viewport,{requestFrame=null,cancelFrame=null,ease=0.48}={}){
  const raf=requestFrame||(typeof requestAnimationFrame==='function'?requestAnimationFrame:null);
  const caf=cancelFrame||(typeof cancelAnimationFrame==='function'?cancelAnimationFrame:null);
  if(!viewport)throw Error('Wheel viewport required');
  if(!Number.isFinite(ease)||ease<=0||ease>1)throw Error('Invalid smoothing factor');
  let goalX=0,goalY=0,ticket=null,running=false;
  function bound(value,extent,visible){
   return Math.max(0,Math.min(value,Number.isFinite(extent)&&Number.isFinite(visible)?Math.max(0,extent-visible):Infinity));
  }
  function cancel(){
   if(ticket!==null&&caf)caf(ticket);
   ticket=null;running=false;
  }
  function frame(){
   ticket=null;if(!running)return;
   const dx=goalX-viewport.scrollLeft,dy=goalY-viewport.scrollTop;
   if(Math.abs(dx)<0.5&&Math.abs(dy)<0.5){
    viewport.scrollLeft=goalX;viewport.scrollTop=goalY;running=false;return;
   }
   viewport.scrollLeft+=dx*ease;viewport.scrollTop+=dy*ease;
   ticket=raf(frame);
  }
  function enqueue(payload){
   const delta=normalize(payload,{height:viewport.clientHeight});
   if(!delta)return false;
   if(!raf||!caf)return pan(viewport,payload);
   if(!running){goalX=viewport.scrollLeft;goalY=viewport.scrollTop;running=true;}
   goalX=bound(goalX+delta.x,viewport.scrollWidth,viewport.clientWidth);
   goalY=bound(goalY+delta.y,viewport.scrollHeight,viewport.clientHeight);
   if(ticket===null)ticket=raf(frame);
   return true;
  }
  return Object.freeze({pan:enqueue,cancel,active:()=>running});
 }
 return Object.freeze({normalize,pan,createController});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./isn-engine-gauge-model.js?v=ISN-0006&amp;eis=EIS-SINGLE-LINE-0001 */
try{
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNEngineGaugeModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 // Coordinates are in the untouched 1235 × 1274 engine-panel source image.
 // Angular scales are temporary training visualization, not instrument calibration.
 const source=Object.freeze({width:1235,height:1274});
 const gauges=Object.freeze([
  Object.freeze({id:'egt1',engine:'engine1',signal:'egt',cx:535,cy:723,radius:53,max:800}),
  Object.freeze({id:'egt2',engine:'engine2',signal:'egt',cx:724,cy:723,radius:53,max:800}),
  Object.freeze({id:'n2_1',engine:'engine1',signal:'n2',cx:535,cy:900,radius:55,max:100}),
  Object.freeze({id:'n2_2',engine:'engine2',signal:'n2',cx:724,cy:900,radius:55,max:100})
 ]);
 function angle(value,max){if(value===null||value===undefined)return null;
  if(!Number.isFinite(value))throw Error('Finite gauge value required');
  // Follow the visible long arc from upper-left through the bottom to upper-right.
  return -45-270*Math.max(0,Math.min(max,value))/max;
 }
 // Native EIS glass: eight primary and eight secondary dials. Angles use
 // an upward-pointing radial marker, clockwise from 12 o'clock. The older
 // four-gauge API above remains available to the start-system diagnostics.
 const rows=[
  {key:'n1',signal:'n1',y:542,x:[536,724],radius:55,min:0,max:120,start:45,sweep:270},
  {key:'egt',signal:'egt',y:724,x:[536,724],radius:55,min:0,max:800,start:45,sweep:270,valueText:true},
  {key:'n2',signal:'n2',y:896,x:[536,724],radius:55,min:0,max:120,start:45,sweep:270,valueText:true},
  {key:'fuelFlow',signal:'fuelFlow',y:1051,x:[536,724],radius:55,min:0,max:6000,start:45,sweep:270},
  {key:'oilPressure',signal:'oilPressure',y:496,x:[984,1118],radius:39,min:0,max:100,start:135,sweep:270},
  {key:'oilTemperature',signal:'oilTemperature',y:646,x:[984,1118],radius:39,min:0,max:200,start:195,sweep:210},
  {key:'vibration',signal:'vibration',y:839,x:[984,1118],radius:39,min:0,max:5,start:135,sweep:270},
  {key:'hydPressure',signal:'hydPressure',y:991,x:[982,1118],radius:39,min:0,max:4000,start:132,sweep:277}
 ];
 const eisGauges=Object.freeze(rows.flatMap(row=>[1,2].map(side=>Object.freeze({
  ...row,id:row.key+'_'+side,engine:'engine'+side,cx:row.x[side-1],cy:row.y,
  length:row.radius*.44,width:row.radius*.10,gap:row.radius*.06
 }))));
 const needle=Object.freeze({color:'#83a220',shape:'single-straight-line',linecap:'butt'});
 function eisAngle(spec,value){
  if(!Number.isFinite(value))return null;
  const fraction=Math.max(0,Math.min(1,(value-spec.min)/(spec.max-spec.min)));
  return spec.start+spec.sweep*fraction;
 }
 return Object.freeze({source,gauges,angle,eisGauges,eisAngle,needle});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./isn-engine-gauges.js?v=ISN-0008-ATA77-GATED&amp;eis=EIS-SINGLE-LINE-0001&amp;digits=EIS-CONV-DRUM-0004&amp;startup=0003 */
try{
(function(){
 'use strict';
 const model=window.B737ISNEngineGaugeModel,ns='http://www.w3.org/2000/svg';
 if(!model)return;
 // At initial cold-dark boot the stationary N2 spools read zero.
 // EGT must not be fabricated as zero: hot metal cools toward ambient.
 // A subsequent ISN observation always replaces this fallback.
 const initialColdDark=Object.freeze({engines:{
  engine1:{n2:{value:0},egt:{value:null}},
  engine2:{n2:{value:0},egt:{value:null}}
 }});
 let layer=null,last=initialColdDark;
 const readings=new Map(model.eisGauges.map(spec=>[spec.id,{value:null,source:'PARKED_NO_DATA'}]));
 const parts=new Map();
 const element=(parent,tag,attrs={})=>{const node=document.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));
  parent.append(node);return node;
 };
 function mount(){const piece=document.querySelector('#region-main .texture-piece[data-piece="engine"]');
  if(!piece)return;
  if(layer?.parentNode===piece)return;
  if(layer)layer.remove();
  parts.clear();
  const svg=element(piece,'svg',{'data-isn-engine-gauges':'EIS-SINGLE-LINE-0001',viewBox:'0 0 1235 1274',
   role:'img','aria-label':'Sixteen EIS peripheral single-line gauge pointers'});
  svg.classList.add('isn-engine-gauges');
  for(const spec of model.eisGauges){
   const group=element(svg,'g',{'data-gauge':spec.id});
   const pointer=element(group,'g',{'data-pointer':'',transform:`translate(${spec.cx} ${spec.cy}) rotate(${spec.start})`});
   element(pointer,'line',{x1:0,x2:0,y1:-(spec.radius+spec.gap),y2:-(spec.radius+spec.gap+spec.length),
    stroke:model.needle.color,'stroke-width':spec.width,'stroke-linecap':model.needle.linecap});
   // The independent dot-matrix renderer owns all EIS numeric fields.
   parts.set(spec.id,{group,pointer});
  }
  layer=svg;paint();
  window.performance?.mark?.('b737:eis-needles-mounted');
 }
 function paint(){if(!layer)return;
  for(const spec of model.eisGauges){
   const reading=readings.get(spec.id),part=parts.get(spec.id);
   const degrees=model.eisAngle(spec,reading.value)??spec.start;
   part.pointer.setAttribute('transform',`translate(${spec.cx} ${spec.cy}) rotate(${degrees})`);
   part.group.dataset.source=reading.source;
  }
 }
 function setReading(engine,signal,value,source='EXPLICIT_TRAINER_OR_SOURCE'){
  const spec=model.eisGauges.find(g=>g.engine===engine&&g.signal===signal);
  if(!spec||!Number.isFinite(value))throw Error('Known EIS gauge and finite value required');
  readings.set(spec.id,{value,source});
 }
 function render(indications){
  if(window.B737UnifiedEngineIndicationsV2?.ownsPresentation?.())return;
  last=indications||last;
  for(const spec of model.eisGauges){const value=last?.engines?.[spec.engine]?.[spec.signal]?.value;
   if(Number.isFinite(value))setReading(spec.engine,spec.signal,value,'ISN_START_SOURCE');
  }
  paint();
 }
 function observeECU(live){
  // Raw ECU samples are boot fallback only; electrical/CB/sensor gates
  // belong to the installed indication backend, not this SVG layer.
  if(window.B737UnifiedEngineIndicationsV2?.ownsPresentation?.())return;
  const paths={n1:'n1Percent',n2:'n2Percent',egt:'egtC',fuelFlow:'fuelFlowKgHr',
   oilPressure:'oil.pressurePsi',oilTemperature:'oil.temperatureC',
   hydPressure:'hydraulic.engineDrivenPressurePsi'};
  for(const spec of model.eisGauges){
   const path=paths[spec.signal];if(!path)continue;
   const value=path.split('.').reduce((obj,key)=>obj?.[key],live?.engines?.[spec.engine]);
   if(Number.isFinite(value))setReading(spec.engine,spec.signal,value,'UNIFIED_ECU_OBSERVATION');
  }
  mount();paint();
 }
 window.addEventListener('b737:cockpit-mounted',mount);
 window.addEventListener('b737:isn-start-indications',event=>{render(event.detail);mount();});
 window.addEventListener('b737:unified-ecu-observation',event=>{
  const profiler=window.B737InteractionProfilerV1,started=profiler?performance.now():0;
  try{observeECU(event.detail);}
  finally{if(profiler)profiler.markWork('ECU listener EIS pointers fallback',performance.now()-started);}
 });
 window.B737EISNeedlesV1=Object.freeze({
  getSpecs:()=>model.eisGauges.map(spec=>({...spec})),
  getReadings:()=>Object.fromEntries([...readings].map(([id,r])=>[id,{...r}])),
  setReading:(engine,signal,value)=>{setReading(engine,signal,value);paint();},mount
 });
 render(last);
 if(document.querySelector('#region-main'))mount();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/eis-dot-digits-v1.js?v=EIS-CONV-DRUM-0004 */
try{
/* Reference-matched EIS dot glyphs and numeric formatting. No simulator state. */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737EISDotDigitsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const patterns={
  '0':['0011100','0100010','1000001','1000001','1000001','1000001','1000001','1000001','1000001','0100010','0011100'],
  '1':['0001000','0011000','0101000','0001000','0001000','0001000','0001000','0001000','0001000','0001000','0111110'],
  '2':['0011100','0100010','1000001','0000001','0000010','0000100','0001000','0010000','0100000','1000000','1111111'],
  '3':['0111110','1000001','0000001','0000001','0000010','0011100','0000010','0000001','0000001','1000001','0111110'],
  '4':['0000010','0000110','0001010','0010010','0100010','1000010','1111111','0000010','0000010','0000010','0000010'],
  '5':['1111111','1000000','1000000','1000000','1111100','0000010','0000001','0000001','0000001','1000001','0111110'],
  '6':['0001110','0010000','0100000','1000000','1011100','1100010','1000001','1000001','1000001','0100010','0011100'],
  '7':['1111111','0000001','0000010','0000010','0000100','0000100','0001000','0001000','0010000','0010000','0010000'],
  '8':['0011100','0100010','1000001','1000001','0100010','0011100','0100010','1000001','1000001','0100010','0011100'],
  '9':['0011100','0100010','1000001','1000001','1000001','0100011','0011101','0000001','0000010','0000100','0111000'],
  '-':['0000000','0000000','0000000','0000000','0000000','0111110','0000000','0000000','0000000','0000000','0000000'],
  '.':['0','0','0','0','0','0','0','0','0','0','1']
 };
 const glyphs=Object.freeze(Object.fromEntries(Object.entries(patterns).map(([key,rows])=>{
  // Re-sample connected strokes on a twice-denser 13 x 21 matrix. These
  // are individual dots, including midpoints, rather than enlarged pixels.
  const points=new Map(),add=(x,y)=>points.set(x+','+y,Object.freeze({x,y}));
  rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v!=='1')return;
   add(2*x,2*y);
   for(const [dx,dy]of [[1,0],[0,1],[1,1],[-1,1]])
    if(rows[y+dy]?.[x+dx]==='1')add(2*x+dx,2*y+dy);
  }));
  return [key,Object.freeze({width:2*rows[0].length-1,height:2*rows.length-1,points:Object.freeze([...points.values()])})];
 })));
 // Olive yellow of the reference, with lit-dot intensity compensated for
 // subpixel antialiasing at the native panel's much smaller display size.
 const style=Object.freeze({color:'#92913f',pitch:.8,radius:.36,advance:18,decimalAdvance:6,
  height:21,drumStride:24,windowTop:-8,windowHeight:36,bodyTop:-1,bodyHeight:22});
 function format(value,{decimals=0,integerDigits=3,divisor=1}={}){
  if(!Number.isInteger(decimals)||decimals<0||decimals>2)throw Error('EIS precision must be zero, one or two decimals');
  if(!Number.isFinite(divisor)||divisor<=0)throw Error('Positive unit divisor required');
  if(!Number.isFinite(value))return decimals===2?'-.--':decimals?'--.-':'---';
  // Quantize before formatting so carry/rollover is atomic (99.96 -> 100.0).
  // Scale before division: 565 kg/h -> 56.5 hundredths -> 0.57 t/h.
  const factor=10**decimals,rounded=Math.round(value*factor/divisor)/factor;
  const text=(Object.is(rounded,-0)?0:rounded).toFixed(decimals);
  if(text.replace('-','').split('.')[0].length>integerDigits)return '---';
  return text;
 }
 function layout(text){
  let cursor=0;const cells=[];
  for(const character of String(text)){
   if(!glyphs[character])throw Error('Unsupported EIS character '+character);
   cells.push({character,x:cursor});
   cursor+=character==='.'?style.decimalAdvance:style.advance;
  }
  return {cells,width:Math.max(0,cursor-4),height:style.height};
 }
 function createWheel(initial,{omega=16,maxSpeed=26}={}){
  if(!Number.isInteger(initial)||!Number.isFinite(omega)||omega<=0||!Number.isFinite(maxSpeed)||maxSpeed<=0)
   throw Error('Integer wheel column and positive motion settings required');
  const mod=n=>((n%10)+10)%10;
  let column=initial,phase=mod(initial),target=phase,velocity=0;
  const moving=()=>Math.abs(target-phase)>.001||Math.abs(velocity)>.015;
  function snapshot(){return {column,phase,target,velocity,moving:moving(),
   direction:!moving()?'REST':target>phase?'DOWN':'UP'};}
  function snap(next=column){
   if(!Number.isInteger(next))throw Error('Integer wheel column required');
   column=next;phase=target=mod(next);velocity=0;return snapshot();
  }
  function setColumn(next){
   if(!Number.isInteger(next))throw Error('Integer wheel column required');
   const delta=next-column;if(delta===0)return snapshot();
   column=next;const digit=mod(next);
   // Keep the requested direction through 9->0 and 0->9. Big source jumps
   // make at most two visible turns instead of queuing hundreds of digits.
   const steps=Math.abs(delta)>20?Math.sign(delta)*(10+Math.abs(delta)%10):delta;
   target+=steps;
   if(Math.abs(target-phase)>20){
    const direction=Math.sign(target-phase);
    const distance=direction>0?mod(digit-mod(phase)):mod(mod(phase)-digit);
    target=phase+direction*(distance+10);
   }
   if(Math.sign(velocity)!==Math.sign(target-phase))velocity=0;
   return snapshot();
  }
  function step(seconds){
   if(!Number.isFinite(seconds)||seconds<0)throw Error('Nonnegative wheel timestep required');
   if(!moving()||seconds===0)return snapshot();
   const dt=Math.min(seconds,.05),old=phase,offset=phase-target;
   const term=velocity+omega*offset,decay=Math.exp(-omega*dt);
   let next=target+(offset+term*dt)*decay;
   velocity=(velocity-omega*term*dt)*decay;
   const travel=next-old,limit=maxSpeed*dt;
   if(Math.abs(travel)>limit){next=old+Math.sign(travel)*limit;velocity=Math.sign(travel)*maxSpeed;}
   if((target-old)*(target-next)<=0){next=target;velocity=0;}
   phase=next;
   if(!moving()){phase=target=mod(target);velocity=0;}
   return snapshot();
  }
  return Object.freeze({setColumn,step,snap,snapshot});
 }
 return Object.freeze({VERSION:'EIS-CONV-DRUM-0004',glyphs,style,format,layout,createWheel});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./eis-dot-readouts-v1.js?v=CONV-N2-POWER-BLANK-0001-STARTUP-0002 */
try{
/* Live EIS numeric presentation. Reads the shared ECU; owns no engine plant. */
(function(){'use strict';
 const font=window.B737EISDotDigitsV1,model=window.B737ISNEngineGaugeModel;
 if(!font||!model)return;
 const ns='http://www.w3.org/2000/svg';
 const specs=Object.freeze(model.eisGauges.filter(g=>['n1','egt','n2','fuelFlow'].includes(g.signal)).map(g=>Object.freeze({
  id:g.id,engine:g.engine,signal:g.signal,cx:g.cx,cy:g.cy,
  decimals:g.signal==='fuelFlow'?2:['n1','n2'].includes(g.signal)?1:0,
  integerDigits:g.signal==='fuelFlow'?1:3,divisor:g.signal==='fuelFlow'?1000:1,
  unit:g.signal==='fuelFlow'?'t/h':g.signal==='egt'?'°C':'%',
  template:g.signal==='fuelFlow'?'0.00':g.signal==='egt'?'999':'100.0',drum:true,scale:1
 })).concat([1,2].map(n=>Object.freeze({id:'oilQuantity_'+n,engine:'engine'+n,signal:'oilQuantity',
  cx:n===1?984:1095,cy:741,decimals:0,integerDigits:3,divisor:1,unit:'%FULL',template:'999',drum:false,scale:.83}))));
 const values=new Map(specs.map(s=>[s.id,{value:['n1','n2'].includes(s.signal)?0:null,source:'INITIAL'}]));
 const mounted=new Map(),ecuOwned=new Set(),backendOwned=new Set(),startFallbacks=new Map();
  // Conventional numerical counters share instrument power with their pointer.
  // A null sensor reading may render fault dashes; a lost instrument bus must
  // instead remove ALL luminous glyphs, without hiding its dark photo aperture.
  const conventionalPowerLoss=new Set();
  function applyConventionalPowerGate(part){
   if(!part||part.variant!=='CONVENTIONAL')return;
   const lost=conventionalPowerLoss.has(part.spec.id);
   part.group.style.display=lost?'none':'';
   part.group.dataset.electricalPower=lost?'OFF':'ON_OR_UNKNOWN';
  }
  function setConventionalPowerLoss(engine,signal,lost){
   if(!['engine1','engine2'].includes(engine)||!['n1','egt','n2','fuelFlow'].includes(signal)
     ||typeof lost!=='boolean')throw Error('Invalid Conventional digital power gate');
   const id=signal+'_'+engine.slice(-1);
   if(conventionalPowerLoss.has(id)===lost)return false;
   if(lost)conventionalPowerLoss.add(id);else conventionalPowerLoss.delete(id);
   applyConventionalPowerGate(mounted.get('CONVENTIONAL.'+id));
   return true;
  }
 let layer=null,conventionalLayer=null,ticket=null,lastFrame=null,initialEisStamped=false;
 const raf=typeof requestAnimationFrame==='function'?requestAnimationFrame:null;
 const caf=typeof cancelAnimationFrame==='function'?cancelAnimationFrame:null;
 function element(parent,tag,attrs={}){const node=document.createElementNS(ns,tag);
  for(const [k,v]of Object.entries(attrs))node.setAttribute(k,String(v));parent.append(node);return node;}
 const glyphId=(ch,variant='EIS')=>(variant==='EIS'?'eis':'conv')+'-dot-glyph-'+(ch==='.'?'decimal':ch==='-'?'dash':ch);
 // Photo-native readout apertures (1463 × 1075), calibrated separately
 // from the independent needle pivots. These slots are ABOVE each dial label
 // and LEFT of the pointer tip, matching the owner's marked red rectangles.
 // ENGINE 1 / ENGINE 2 coordinates; EIS and oil quantity are not re-registered.
 // Owner-marked upper dial window: the same offset for every physical shaft,
 // at the gap between the 12 and 0 dial markers. No EIS coordinates change.
 // The accepted N1 window remains fixed. EGT/N2/FF windows use independent
 // upward registration because their legends sit lower than the N1 artwork.
 // All group transforms and their background rectangles use the same frame;
 // the extra upper-row offset prevents overlap with EGT / N2 / FF labels.
 // Pixel centres measured in the owner's original 1463x1075 instrument
 // photograph. The RED target window is aligned with each mechanical shaft
 // horizontally, 41–42 native pixels above it, between the 0 and 12 marks.
 // Do not alter N2's needle shape, axis, tick scale or motion.
 const CONVENTIONAL_APERTURES=Object.freeze({
  n1:Object.freeze([[427,385],[600,385]]),
  egt:Object.freeze([[427,555],[600,555]]),
  n2:Object.freeze([[425,706],[600,706]]),
  fuelFlow:Object.freeze([[426,869],[600,869]])
 });
 function conventionalSpecs(){
  const registered=window.B737ConventionalNeedlesV1?.getSpecs?.();if(!registered)return [];
  return specs.filter(s=>s.signal!=='oilQuantity').map(s=>{
   const point=registered.find(g=>g.engine===s.engine&&g.signal===(s.signal==='oilQuantity'?'oilQty':s.signal));
   if(!point)throw Error('Conventional dial registration missing: '+s.id);
   // Fixed photo slots never inherit a needle's shaft translation.
   // Conventional oil quantity is analog-only; EIS electronic oil readout remains unchanged.
   const side=s.engine==='engine1'?0:1;
   const aperture=CONVENTIONAL_APERTURES[s.signal]?.[side];
   if(!aperture)throw Error('Missing calibrated Conventional aperture '+s.id);
   // EGT=1000 and FF=12000 must still fit their conventional numeric face.
   // EIS maintains its existing separately designed three-digit readout.
   const full=s.signal==='egt'?{integerDigits:4,template:'9999',scale:.61}:
    s.signal==='fuelFlow'?{integerDigits:2,template:'00.00',scale:.61}:{scale:.75};
   return {...s,cx:aperture[0],cy:aperture[1],...full};
  });
 }
 function createLayer(piece,layerSpecs,variant){
  const svg=element(piece,'svg',{class:variant==='EIS'?'eis-dot-readouts-v1':'conventional-dot-readouts-v1',
   viewBox:variant==='EIS'?'0 0 1235 1274':'0 0 1463 1075',
   [variant==='EIS'?'data-eis-dot-readouts':'data-conventional-dot-readouts']:font.VERSION,
   'aria-label':variant+' live dot matrix engine numbers'});
  const defs=element(svg,'defs');
  for(const [ch,glyph]of Object.entries(font.glyphs)){
   const g=element(defs,'g',{id:glyphId(ch,variant),fill:font.style.color,
    stroke:font.style.color,'stroke-width':'.25','stroke-opacity':'.36'});
   for(const p of glyph.points)element(g,'circle',{cx:p.x,cy:p.y,r:ch==='.'?.9:font.style.radius/font.style.pitch});
  }
  for(const spec of layerSpecs){
   const width=font.layout(spec.template).width,lastX=width-14;
   const pitch=font.style.pitch*spec.scale;
   const photoTransform=`translate(${spec.cx-width*pitch/2} ${spec.cy-10*pitch}) scale(${pitch})`;
   // A SEPARATE, unconditional backplate is painted before each digit group.
   // The older group-local plate was sometimes masked by the rotating-drum
   // clip, leaving N2 and EGT without the same dark face as N1.
   if(variant==='CONVENTIONAL'){
    // Full opaque aperture painted as an unmasked sibling under the glyphs.
    // Previously the face was only 22 units tall while the rotating number
    // window was 31 units tall. The leaked area showed dial lettering.
    element(svg,'rect',{'data-conventional-backplate':spec.id,
     transform:photoTransform,x:-3,y:-5,width:width+6,height:31,
     fill:'#343738','fill-opacity':'1','aria-hidden':'true'});
   }
   const group=element(svg,'g',{[variant==='EIS'?'data-eis-readout':'data-conventional-readout']:spec.id,role:'img'});
   // Conventional drum aperture: show more of the numbers above and below
   // the active right-hand digit, without altering the calibrated EIS window.
   // The owner's red box spans one numeral row. Keep the wider last-column
   // preview, but constrain its upper/lower neighbors to the real aperture.
   const drumWindow=variant==='CONVENTIONAL'?{x:lastX-5,y:-5,width:23,height:31}:
    {x:lastX-2,y:font.style.windowTop,width:16,height:font.style.windowHeight};
   if(variant==='CONVENTIONAL'){
    const outerId='conv-photo-aperture-'+spec.id;
    const apertureClip=element(defs,'clipPath',{id:outerId,clipPathUnits:'userSpaceOnUse'});
    element(apertureClip,'rect',{x:-3,y:-5,width:width+6,height:31});
    group.setAttribute('clip-path','url(#'+outerId+')');
    group.dataset.photoWindow='OWNER_RED_RECT_1920';
   }
   if(variant==='EIS')element(group,'rect',{'data-eis-display-face':'',x:-2,y:font.style.bodyTop,
    width:width+4,height:font.style.bodyHeight,fill:'#343738','fill-opacity':'.92','aria-hidden':'true'});
   const clipId=variant+'-last-digit-window-'+spec.id,bodyId=variant+'-body-window-'+spec.id;
   const bodyClip=element(defs,'clipPath',{id:bodyId,clipPathUnits:'userSpaceOnUse'});
   element(bodyClip,'rect',{x:-2,y:font.style.bodyTop,width:width+4,height:font.style.bodyHeight});
   if(spec.drum){
    element(group,'rect',{'data-eis-tall-window':'',x:drumWindow.x,y:drumWindow.y,
     width:drumWindow.width,height:drumWindow.height,fill:'#343738','fill-opacity':'.92','aria-hidden':'true'});
    const clip=element(defs,'clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'});
    element(clip,'rect',{x:drumWindow.x,y:drumWindow.y,width:drumWindow.width,height:drumWindow.height});
   }
   // Fixed windows clip independent vertical digit tapes. Glyph nodes are
   // allocated once; one shared RAF moves all active drums without timers.
   const template=font.layout(spec.template),digits=[...spec.template].filter(c=>c!=='.').length;
   let position=digits;
   const slots=template.cells.map((cell,index)=>{
    const tall=spec.drum&&index===template.cells.length-1;
    const clip=element(group,'g',{'data-eis-digit-cell':index,'clip-path':'url(#'+(tall?clipId:bodyId)+')'});
    const fixed=element(clip,'use',{x:cell.x,visibility:'hidden','aria-hidden':'true'});
    const tape=element(clip,'g',{'data-eis-digit-tape':'',visibility:'hidden','aria-hidden':'true'});
    const glyphs=[-2,-1,0,1,2].map(offset=>element(tape,'use',{
     x:cell.x,y:-offset*font.style.drumStride,'data-drum-glyph':offset,
     ...(tall&&Math.abs(offset)===1?{'data-eis-adjacent-digit':offset}:{})}));
    return {clip,fixed,tape,glyphs,x:cell.x,power:cell.character==='.'?null:--position,
     wheel:null,character:' ',base:null,offset:null};
   });
   group.dataset.displayUnit=spec.unit;
   group.setAttribute('transform',photoTransform);
   const part={spec,variant,group,slots,width,text:null,dirty:true};
    mounted.set(variant+'.'+spec.id,part);
    applyConventionalPowerGate(part);
  }
  return svg;
 }
 function removeLayer(variant,svg){
  if(svg)svg.remove();
  for(const [key,part]of mounted)if(part.variant===variant)mounted.delete(key);
 }
 function mount(){
  const piece=document.querySelector('#region-main .texture-piece[data-piece="engine"]');if(!piece)return false;
  if(layer?.parentNode!==piece){removeLayer('EIS',layer);layer=createLayer(piece,specs,'EIS');
   if(!initialEisStamped){initialEisStamped=true;window.performance?.mark?.('b737:eis-digits-mounted');}
  }
  const host=window.B737EngineIndicationModeV1?.wrap?.(),layout=window.B737EngineIndicationModeV1?.layout?.();
  if(host&&layout){
   if(conventionalLayer?.parentNode!==host){
    const registered=conventionalSpecs();
    if(registered.length){removeLayer('CONVENTIONAL',conventionalLayer);conventionalLayer=createLayer(host,registered,'CONVENTIONAL');}
   }
   if(conventionalLayer)Object.assign(conventionalLayer.style,{width:'1463px',height:'1075px',transform:layout.cssMatrix});
  }
  syncTargets();paint();schedule();return true;
 }
 function syncTargets(){if(!mounted.size)return;
  for(const part of mounted.values()){
   const spec=part.spec,reading=values.get(spec.id);
   const text=font.format(reading.value,spec);part.group.dataset.source=reading.source;
   if(part.text===text)continue;
   part.text=text;part.dirty=true;part.group.dataset.value=text;
   part.group.setAttribute('aria-label',spec.engine+' '+spec.signal+' '+text+' '+(part.group.dataset.displayUnit||spec.unit));
   const padded=text.padStart(spec.template.length,' ');
   const numeric=Number.isFinite(Number(text));
   const ticks=numeric?Math.round(Math.abs(Number(text))*10**spec.decimals):0;
   part.slots.forEach((slot,i)=>{
    const character=padded[i]||' ';slot.character=character;
    if(slot.power!==null&&numeric&&(character===' '||/^[0-9]$/.test(character))){
     const column=Math.floor(ticks/10**slot.power);
     if(!slot.wheel)slot.wheel=font.createWheel(column);else slot.wheel.setColumn(column);
     // The shared Conventional display animation already moves the value.
     // Snapping this wheel to its synchronized frame removes the old
     // second phase-lag; EIS retains its own drum movement.
     if(!raf||(part.variant==='CONVENTIONAL'&&reading.source==='ENGINE_INDICATION_SYNC_V1'))
      slot.wheel.snap(column);
     slot.fixed.setAttribute('visibility','hidden');
    }else{
     slot.wheel=null;slot.tape.setAttribute('visibility','hidden');
     slot.fixed.setAttribute('visibility',character===' '?'hidden':'visible');
     if(character!==' ')slot.fixed.setAttribute('href','#'+glyphId(character,part.variant));
    }
   });
  }
 }
 const isMoving=()=>[...mounted.values()].some(p=>p.slots.some(s=>s.wheel?.snapshot().moving));
 function paint(){if(!layer)return;
  for(const part of mounted.values()){
   const moving=part.slots.some(s=>s.wheel?.snapshot().moving);
   if(!part.dirty&&!moving&&part.group.dataset.motion==='REST')continue;
   let direction='REST';
   part.slots.forEach(slot=>{
    if(!slot.wheel)return;
    const state=slot.wheel.snapshot(),base=Math.floor(state.phase),fraction=state.phase-base;
    slot.tape.setAttribute('visibility',slot.character===' '&&!state.moving?'hidden':'visible');
    slot.clip.dataset.drumPhase=state.phase.toFixed(4);
    slot.clip.dataset.drumDirection=state.direction;
    if(state.moving)direction=state.direction;
    if(slot.base!==base){
     slot.base=base;
     slot.glyphs.forEach((node,i)=>node.setAttribute('href','#'+glyphId(String(((base+i-2)%10+10)%10),part.variant)));
    }
    const offset=(fraction*font.style.drumStride).toFixed(4);
    if(slot.offset!==offset){slot.offset=offset;slot.tape.setAttribute('transform','translate(0 '+offset+')');}
   });
   part.group.dataset.motion=direction;part.dirty=false;
  }
 }
 function schedule(){if(raf&&ticket===null&&isMoving())ticket=raf(frame);}
 function frame(now){
  ticket=null;const seconds=lastFrame===null?1/60:Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  for(const part of mounted.values())for(const slot of part.slots)slot.wheel?.step(seconds);
  paint();if(isMoving())schedule();else lastFrame=null;
 }
 function refresh(){mount();syncTargets();paint();schedule();}
 function write(spec,value,source){values.set(spec.id,{value:Number.isFinite(value)?value:null,source});}
 function observeECU(live){
  // The installed FCOM/MRG/LAN feed/fault backend is authoritative after load.
  // Do not let raw ECU telemetry repower failed/CB-isolated readouts.
  if(window.B737UnifiedEngineIndicationsV2?.ownsPresentation?.())return;
  const paths={n1:'n1Percent',n2:'n2Percent',egt:'egtC',fuelFlow:'fuelFlowKgHr',oilQuantity:'oil.quantityPct'};
  for(const s of specs){
   if(backendOwned.has(s.id))continue;
   const engine=live?.engines?.[s.engine];if(!engine)continue;
   const value=paths[s.signal].split('.').reduce((o,k)=>o?.[k],engine);
   // Some ECU snapshots omit FF; the start observation supplies that channel.
   // An absent property is not an invalid sensor and must not erase it.
   if(value!==undefined){ecuOwned.add(s.id);write(s,value,'UNIFIED_ECU_OBSERVATION');}
   else{
    ecuOwned.delete(s.id);
    if(startFallbacks.has(s.id))write(s,startFallbacks.get(s.id),'ISN_START_SOURCE');
   }
  }
  refresh();
 }
 function observeStart(packet){
  if(window.B737UnifiedEngineIndicationsV2?.ownsPresentation?.())return;
  for(const s of specs){
   if(backendOwned.has(s.id))continue;
   const signal=packet?.engines?.[s.engine]?.[s.signal];
   if(signal&&Object.hasOwn(signal,'value')){
    startFallbacks.set(s.id,signal.value);
    // Do not retarget a moving drum to a legacy start estimate immediately
    // before its authoritative ECU value arrives in the same update cycle.
    if(!ecuOwned.has(s.id))write(s,signal.value,'ISN_START_SOURCE');
   }
  }
  refresh();
 }
 window.B737EISDotReadoutsV1=Object.freeze({
  getSpecs:(mode='EIS')=>(mode==='CONVENTIONAL'?conventionalSpecs():specs).map(s=>({...s})),
  getReadings:()=>Object.fromEntries([...values].map(([id,v])=>{
   const spec=specs.find(s=>s.id===id);return [id,{...v,text:font.format(v.value,spec),displayUnit:spec.unit}];
  })),
  getMotion:(mode='EIS')=>Object.fromEntries([...mounted.values()].filter(p=>p.variant===mode).map(p=>[p.spec.id,p.slots.map(s=>s.wheel?.snapshot()||null)])),
  getDisplayed:(mode='CONVENTIONAL')=>Object.fromEntries([...mounted.values()]
   .filter(p=>p.variant===mode).map(p=>[p.spec.id,{
    source:values.get(p.spec.id)?.source||null,raw:values.get(p.spec.id)?.value??null,
    text:p.group.dataset.value||null,phase:p.group.dataset.motion||'REST',
    numeric:font.format(values.get(p.spec.id)?.value,p.spec)
   }])),
  setBatchReadings(records,source='ENGINE_INDICATION_SYNC_V1'){
   if(!Array.isArray(records))throw Error('Numerical display batch required');
   for(const row of records){
    const spec=specs.find(s=>s.engine===row.engine&&s.signal===row.signal);
    if(!spec)throw Error('Unknown numerical engine field '+row.engine+'/'+row.signal);
    if(source==='ENGINE_INDICATION_SYNC_V1'||source==='ENGINE_INDICATION_BACKEND_V2'){
     backendOwned.add(spec.id);ecuOwned.add(spec.id);
    }
    write(spec,row.value,source);
   }
   // Eight gauges, ONE frame and ONE numeric render pass.
   if(records.length)refresh();
  },
  setConventionalPowerLoss,
   getConventionalPowerLoss:(engine,signal)=>conventionalPowerLoss.has(signal+'_'+engine.slice(-1)),
   setReading(engine,signal,value,source='EXPLICIT_TRAINER_OR_SOURCE'){
   const spec=specs.find(s=>s.engine===engine&&s.signal===signal);if(!spec)throw Error('Unknown EIS numeric field');
   if(source==='ENGINE_INDICATION_BACKEND_V2'||source==='ENGINE_INDICATION_SYNC_V1'){
    backendOwned.add(spec.id);ecuOwned.add(spec.id);
   }
   write(spec,value,source);refresh();
  },mount
 });
 window.addEventListener('b737:cockpit-mounted',mount);
 window.addEventListener('b737:engine-indication-view',mount);
 window.addEventListener('b737:unified-ecu-observation',e=>{
  const profiler=window.B737InteractionProfilerV1,started=profiler?performance.now():0;
  try{observeECU(e.detail);}
  finally{if(profiler)profiler.markWork('ECU listener EIS digits fallback',performance.now()-started);}
 });
 window.addEventListener('b737:isn-start-indications',e=>observeStart(e.detail));
 mount();
 const live=window.B737ISNCockpitV1?.getECUState?.();if(live)observeECU(live);
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
