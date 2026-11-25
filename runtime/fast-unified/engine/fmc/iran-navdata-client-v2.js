/* B737 Classic EHSI route preview — training only, not AFDS/LNAV guidance. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737RouteEngine=api;})(typeof globalThis==='object'?globalThis:null,function(){
'use strict';
const R=3440.065,rad=Math.PI/180,wrap=a=>(a%360+360)%360,diff=(a,b)=>wrap(a-b+180)-180;
const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180&&!(p.lat===0&&p.lon===0);
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mul=(a,k)=>[a[0]*k,a[1]*k],dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a)),v=h=>[Math.sin(h*rad),Math.cos(h*rad)],hd=a=>wrap(Math.atan2(a[0],a[1])/rad);
function distance(a,b){let d=(b.lat-a.lat)*rad,l=diff(b.lon,a.lon)*rad;let x=Math.sin(d/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(l/2)**2;return 2*R*Math.asin(Math.sqrt(Math.min(1,x)));}
function bearing(a,b){let p=a.lat*rad,q=b.lat*rad,l=diff(b.lon,a.lon)*rad;return wrap(Math.atan2(Math.sin(l)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(l))/rad);}
function destination(a,b,d){let p=a.lat*rad,l=a.lon*rad,h=b*rad,t=d/R;let q=Math.asin(Math.sin(p)*Math.cos(t)+Math.cos(p)*Math.sin(t)*Math.cos(h));return {lat:q/rad,lon:diff((l+Math.atan2(Math.sin(h)*Math.sin(t)*Math.cos(p),Math.cos(t)-Math.sin(p)*Math.sin(q)))/rad,0)};}
const local=(o,p)=>mul(v(bearing(o,p)),distance(o,p)),geo=(o,p)=>destination(o,hd(p),norm(p));
const radius=(tas,bank)=>((tas*0.514444)**2/(9.80665*Math.tan(bank*rad)))/1852;
const limits={gsKt:170,vsFpm:2000,rollNm:0.9,bankDeg:25,variationDeg:4.5};
function arc(center,start,sweep){const rr=norm(sub(start,center)),a=hd(sub(start,center)),n=Math.max(2,Math.ceil(Math.abs(sweep)/2));return Array.from({length:n+1},(_,i)=>add(center,mul(v(a+sweep*i/n),rr)));}
function toHeading(p,h,wanted,r,turn='Auto'){let d=diff(wanted,h);if(turn==='Left'&&d>0)d-=360;if(turn==='Right'&&d<0)d+=360;if(Math.abs(d)<0.05)return {points:[p],end:p,heading:wanted,sweep:0};let sign=Math.sign(d),c=add(p,mul(v(h+90*sign),r)),points=arc(c,p,d);return {points,end:points.at(-1),heading:wanted,sweep:d};}
function turnDirect(p,h,target,r,turn='Auto'){
 if(norm(sub(target,p))<1e-5)return null;
 if(turn==='Auto'&&Math.abs(diff(hd(sub(target,p)),h))<0.1)return {points:[p],end:p,sweep:0};
 let options=[];for(let sign of (turn==='Left'?[-1]:turn==='Right'?[1]:[-1,1])){
  let c=add(p,mul(v(h+sign*90),r)),d=sub(target,c),len=norm(d);if(len<=r+1e-7)continue;
  let base=hd(d),a=Math.acos(r/len)/rad,start=hd(sub(p,c));
  for(let angle of [base+a,base-a]){let end=add(c,mul(v(angle),r)),tangent=v(angle+sign*90);if(dot(sub(target,end),tangent)<1e-7)continue;let sweep=sign*wrap(sign*(angle-start));if(Math.abs(sweep)>359.99)continue;options.push({points:arc(c,p,sweep),end,sweep});}
 }return options.sort((a,b)=>Math.abs(a.sweep)-Math.abs(b.sweep))[0]||null;
}
function normalize(raw){let n=k=>raw[k]!==undefined&&raw[k]!==''?Number(raw[k]):null;return {ident:raw.Name??raw.ident,type:raw.Type??raw.type??'Normal',lat:n('Latitude')??raw.lat,lon:n('Longitude')??raw.lon,alt:n('Altitude')??raw.alt,speed:n('Speed')??raw.speed,restriction:raw.AltitudeRestriction??raw.restriction,heading:n('Hdg_Crs_value')??raw.heading,headingKind:n('Hdg_Crs')??raw.headingKind,bank:n('BankLimit')??raw.bank,turn:raw.Sp_Turn??raw.turn??'Auto',fly:raw.Flytype??raw.fly??'Fly-by',radial:n('RadialtoIntercept')??raw.radial,dme:n('DMEtoIntercept')??raw.dme};}
function build(input){
 const p={...limits,...input.performance},warnings=[],segments=[],fixes=[];const warn=(code,leg)=>warnings.push({code,ident:leg?.ident??null});
 if(![p.gsKt,p.vsFpm,p.rollNm,p.bankDeg,p.variationDeg].every(Number.isFinite)||p.gsKt<=0||p.vsFpm<=0||p.rollNm<0||p.bankDeg<=0||p.bankDeg>35)throw Error('INVALID_PERFORMANCE');
 const legs=(input.legs||[]).map(normalize),start=input.start,origin=valid(start)?start:legs.find(valid);if(!valid(origin))return {segments,fixes,warnings:[{code:'NO_POSITION'}],trainingOnly:true};
 let pos=valid(start)?[0,0]:null,h=Number.isFinite(input.headingMag)?wrap(input.headingMag+p.variationDeg):null,alt=Number.isFinite(input.altFt)?input.altFt:null,ground=!!input.onGround,afterConditional=false;
 const state=input.state==='MOD'?'MOD':'ACT';
 function segment(type,pts,leg,extra={}){if(pts.length<2||norm(sub(pts[0],pts.at(-1)))<1e-8&&pts.length===2)return;segments.push({type,points:pts.map(x=>geo(origin,x)),state,ident:leg?.ident,estimated:!['DIRECT','RUNWAY'].includes(type),...extra});}
 function mark(leg,xy,estimated=false){fixes.push({ident:leg.ident, ...geo(origin,xy),alt:leg.alt,restriction:leg.restriction,estimated,fly:leg.fly});}
 function straight(end,leg,type='DIRECT'){if(pos){let d=sub(end,pos);if(norm(d)>1e-7){segment(type,[pos,end],leg);h=hd(d);}}pos=end;}
 function bankFor(l){return Math.min(p.bankDeg,l.bank>0?l.bank:p.bankDeg);}
 function breakAt(code,l){warn(code,l);pos=null;h=null;afterConditional=false;ground=false;alt=null;}
 for(let i=0;i<legs.length;i++){
  let l=legs[i],b=bankFor(l),r=radius(p.gsKt,b),wanted=Number.isFinite(l.heading)?wrap(l.heading+p.variationDeg):null;
  if(l.type==='Discontinuity'||l.type==='Vectors'){breakAt('OPEN_LEG_'+l.type.toUpperCase(),l);continue;}
  if(['Normal','Runway'].includes(l.type)){
   if(!valid(l)){breakAt('INVALID_FIX',l);continue;}let end=local(origin,l);
   if(pos&&h!==null&&(afterConditional||l.turn==='Left'||l.turn==='Right')&&norm(sub(end,pos))>1e-5){let t=turnDirect(pos,h,end,r,l.turn);if(!t){breakAt('TURN_GEOMETRY_UNRESOLVED',l);}else{segment('TURN',t.points,l,{sweepDeg:t.sweep,radiusNm:r});pos=t.end;}}
   straight(end,l,l.type==='Runway'?'RUNWAY':'DIRECT');mark(l,end);afterConditional=false;ground=false;
   // A published constraint is not a predicted crossing altitude. Do not silently set it.
   if(l.type==='Runway'&&l.alt>0)alt=l.alt;else alt=null;
   continue;
  }
  if(l.type==='ConstHdgtoAlt'){
   if(!pos||wanted===null||!Number.isFinite(alt)||!Number.isFinite(l.alt)||l.alt<=alt){breakAt('ALTITUDE_PREDICTION_NEEDS_CLIMB_STATE',l);continue;}
   if(h!==null&&Math.abs(diff(wanted,h))>0.5&&!ground){let t=toHeading(pos,h,wanted,r,l.turn),turnNm=Math.abs(t.sweep)*rad*r,gain=turnNm/p.gsKt*60*p.vsFpm;if(alt+gain>=l.alt){breakAt('ALTITUDE_REACHED_DURING_TURN_UNRESOLVED',l);continue;}segment('TURN',t.points,l,{sweepDeg:t.sweep,radiusNm:r});pos=t.end;alt+=gain;h=wanted;}
   let d=(ground?p.rollNm:0)+(l.alt-alt)*p.gsKt/(60*p.vsFpm);let end=add(pos,mul(v(wanted),d));segment('HEADING_TO_ALTITUDE',[pos,end],l,{distanceNm:d});pos=end;h=wanted;alt=l.alt;ground=false;afterConditional=true;mark(l,end,true);continue;
  }
  if(['Intc','VorRadialIntc','DmeIntc'].includes(l.type)){
   if(!pos||wanted===null||!valid(l)){breakAt('INTERCEPT_INPUT_MISSING',l);continue;}
   if(h!==null&&Math.abs(diff(wanted,h))>0.5){let t=toHeading(pos,h,wanted,r,l.turn);segment('TURN',t.points,l,{sweepDeg:t.sweep,radiusNm:r});pos=t.end;}
   let ref=local(origin,l),dir=v(wanted),d=null;
   if(l.type==='DmeIntc'&&l.dme>0){let q=sub(pos,ref),b=dot(q,dir),c=dot(q,q)-l.dme*l.dme,disc=b*b-c;if(disc>=0)d=[-b-Math.sqrt(disc),-b+Math.sqrt(disc)].filter(x=>x>1e-5).sort((a,b)=>a-b)[0]??null;}
   else if(Number.isFinite(l.radial)){let ray=v(l.radial+p.variationDeg),den=cross(dir,ray);if(Math.abs(den)>1e-7){let q=sub(ref,pos),t=cross(q,ray)/den,u=cross(q,dir)/den;if(t>1e-5&&u>=0)d=t;}}
   if(d===null||d>200){breakAt('NO_FORWARD_INTERCEPT',l);continue;}
   let end=add(pos,mul(dir,d));segment(l.type==='DmeIntc'?'DME_INTERCEPT':'RADIAL_INTERCEPT',[pos,end],l);pos=end;h=wanted;mark({...l,ident:l.type==='DmeIntc'?`${l.ident}/${l.dme}D`:'(INTC)'},end,true);afterConditional=true;alt=null;continue;
  }
  // Holds and PBD are not treated as ordinary fixes without reference semantics.
  breakAt('UNSUPPORTED_'+l.type.toUpperCase(),l);
 }
 // Fly-by anticipation at a common fixed waypoint, only when two straight legs meet.
 for(let i=0;i<segments.length-1;i++){
  let a=segments[i],b=segments[i+1];if(a.type!=='DIRECT'||b.type!=='DIRECT')continue;
  let f=fixes.find(f=>f.ident===a.ident&&f.fly==='Fly-by');if(!f||distance(a.points.at(-1),b.points[0])>0.001)continue;
  let x=local(origin,a.points[0]),y=local(origin,a.points.at(-1)),z=local(origin,b.points.at(-1)),u=sub(y,x),w=sub(z,y),la=norm(u),lb=norm(w);if(la<.01||lb<.01)continue;
  let h1=hd(u),h2=hd(w),sweep=diff(h2,h1);if(Math.abs(sweep)<2||Math.abs(sweep)>155)continue;
  let l=legs.find(l=>l.ident===a.ident),rr=radius(p.gsKt,bankFor(l||{})),d=rr*Math.tan(Math.abs(sweep)*rad/2);if(d>la*.45||d>lb*.45){warn('FLYBY_INSUFFICIENT_SPACE',l);continue;}
  let entry=sub(y,mul(unit(u),d)),exit=add(y,mul(unit(w),d)),t=toHeading(entry,h1,h2,rr);
  a.points[a.points.length-1]=geo(origin,entry);b.points[0]=geo(origin,exit);segments.splice(i+1,0,{type:'FLY_BY',points:t.points.map(x=>geo(origin,x)),state,ident:a.ident,estimated:true,sweepDeg:sweep,radiusNm:rr});i++;
 }
 return {segments,fixes,warnings,performance:p,context:{ownship:input.ownship||input.start,headingMag:input.headingMag,rwy:input.rwy,airport:input.airport,kind:input.kind,runway:input.runway},trainingOnly:true,sourceOnly:true,fmcExecutable:false};
}
const MODES=['MAP','CTR_MAP','PLAN','EXP_NAV','FULL_NAV','EXP_VOR_ILS','FULL_VOR_ILS'];
const RANGES=[10,20,40,80,160,320];
function project(route,{mode='MAP',range=20,ownship,headingMag=0,variationDeg=0,centerFix=null,width=480,height=480,routeInNav=true}={}){
 if(!MODES.includes(mode)||!Number.isFinite(range)||range<=0)throw Error('INVALID_DISPLAY');
 const plan=mode==='PLAN',expanded=mode==='MAP'||mode==='EXP_NAV'||mode==='EXP_VOR_ILS',visible=!mode.includes('VOR_ILS')&&(routeInNav||!mode.includes('NAV'));
 const c=[width/2,expanded?height*.88:height*.51],rr=expanded?Math.min(width*.86,height*.78):Math.min(width,height)*.43;
 let anchor=plan?(centerFix||route.fixes[0]||ownship):ownship;
 let ref=plan?0:wrap(headingMag+variationDeg),scale=rr/range;
 const xy=p=>{let d=distance(anchor,p),a=diff(bearing(anchor,p),ref)*rad;return [c[0]+d*Math.sin(a)*scale,c[1]-d*Math.cos(a)*scale];};
 if(!visible||!valid(anchor))return {mode,range,center:c,radius:rr,segments:[],fixes:[],ownship:null,visible,reference:plan?0:headingMag};
 // Densify great-circle straight segments, keep curved geometry; canvas clip is applied by renderer.
 function sample(points){let out=[];for(let i=0;i<points.length-1;i++){let a=points[i],b=points[i+1],d=distance(a,b),n=Math.max(1,Math.min(600,Math.ceil(d/Math.max(1,range/15))));for(let j=0;j<n;j++)out.push(xy(destination(a,bearing(a,b),d*j/n)));}out.push(xy(points.at(-1)));return out;}
 const inside=([x,y])=>Math.hypot(x-c[0],y-c[1])<=rr&&x>=12&&x<=width-12&&y>=12&&y<=height-12;
 return {mode,range,center:c,radius:rr,reference:plan?0:headingMag,segments:route.segments.map(s=>({...s,xy:sample(s.points)})),fixes:route.fixes.map(f=>({...f,xy:xy(f)})).filter(f=>inside(f.xy)),ownship:valid(ownship)?xy(ownship):null,visible,clip:{width,height},inside,projectPoint:xy};
}
// Atomic CDU MOD / EXEC store: route rendering is entirely independent from AFDS.
function createStore(initial=null){let act=initial,mod=null,rev=0;return {stage(input){mod=build({...input,state:'MOD'});rev++;return this.snapshot();},exec(){if(mod){act={...mod,segments:mod.segments.map(s=>({...s,state:'ACT'}))};mod=null;rev++;}return this.snapshot();},erase(){mod=null;rev++;return this.snapshot();},snapshot(){return {revision:rev,active:act,modified:mod};}};}
return Object.freeze({build,project,normalize,createStore,distance,bearing,destination,radius,turnDirect,MODES,RANGES});
});


/* Private AIRAC-2611 route-preview adapter; no licensed data in this script.
 * Compatible with the existing shared CDU/SG state and independent displays.
 * Training geometry only: never supplies AFDS/LNAV commands. */
(function(root){
'use strict';
const E=root.B737RouteEngine;
const LEGACY='UNSPECIFIED_IN_UPLOADED_FILES',CYCLE='AIRAC-2611',VERSION='IRAN-ROUTE-PREVIEW-V2';
const coord=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180&&!(p.lat===0&&p.lon===0);
const ident=s=>typeof s==='string'&&/^[A-Z0-9._-]{2,16}$/.test(s);
const norm=x=>String(x||'').trim().toUpperCase();
const reciprocal=r=>String((Number(r.slice(0,2))+17)%36+1).padStart(2,'0')+({L:'R',R:'L',C:'C','':''}[r.slice(2)]||'');
const legRecord=x=>Object.fromEntries((x.children||[]).filter(c=>typeof c.text==='string').map(c=>[c.tag,c.text]));
function createCatalog(data){
 if(data?.schema!=='UNIFIED_IRAN_NAVDATA_V2'||data.cycle!==CYCLE||data.training_only!==true)throw Error('INVALID AIRAC BANK');
 const bank=data.procedures?.airports,airports={};
 for(const icao of ['OIII','OIFM','OIMM','OISS']){
  const a=bank?.[icao];if(!a||!Array.isArray(a.procedures)||!Array.isArray(a.approaches)||!a.runways)throw Error('INCOMPLETE AIRAC BANK');
  const published_runways=Object.keys(a.runways).sort();
  const runways=published_runways.map(runway=>{
   const p=a.runways[runway],meta=(data.runway_metadata?.[icao]||[]).find(x=>x.runway===runway);
   if(!coord(p)||!Number.isFinite(p.alt))throw Error('INVALID RUNWAY');
   return {runway,threshold_lat:p.lat,threshold_lon:p.lon,airport_elevation_ft:p.alt,magnetic_heading_deg:meta?.heading_mag,length_ft:meta?.length_ft};
  });
  const all=[...a.procedures];
  for(const app of a.approaches){
   const name=norm(app.attributes?.Name);
   if(!ident(name))continue;
   const legs=(app.children||[]).filter(x=>x.tag==='App_Waypoint').map(legRecord);
   const i=legs.findIndex(x=>x.Type==='Runway'&&/^RW\d{2}[LRC]?$/.test(x.Name));
   if(i<0)continue; // catalogue keeps only runway-identified approach variants
   const runway=legs[i].Name.slice(2);
   if(!published_runways.includes(runway))continue;
   const transitions=(app.children||[]).filter(x=>x.tag==='App_Transition').map(x=>({name:norm(x.attributes?.Name),legs:(x.children||[]).filter(c=>c.tag==='AppTr_Waypoint').map(legRecord)}));
   all.push({kind:'APP',name,runway,legs:legs.slice(0,i+1),missed:legs.slice(i+1),transitions});
  }
  const kinds={};
  for(const kind of ['SID','STAR','APP']){
   const byName=new Map();
   for(const p of all.filter(p=>p.kind===kind)){if(!byName.has(p.name))byName.set(p.name,[]);byName.get(p.name).push(p);}
   kinds[kind]=byName;
  }
  airports[icao]={airport:{icao,published_runways,runways,source_cycle:CYCLE},kinds};
 }
 function options(variants,airport){
  const rw=variants.some(v=>v.runway==='All')?airport.published_runways:variants.map(v=>v.runway).filter(Boolean);
  return [...new Set(rw)].sort();
 }
 function parsePath(path){
  if(typeof path!=='string'||path.length>420||!/^\/api\/cdu\/(airport|catalog|procedure)\?[^#]+$/.test(path))throw Error('INVALID NAV DATA QUERY');
  // Explicit parse keeps the core portable to Node/browser tests.
  const [pathname,query]=path.split('?'),q=Object.fromEntries(query.split('&').map(x=>{const [k,v]=x.split('=');return [decodeURIComponent(k),decodeURIComponent(v||'')];}));
  return {pathname,q};
 }
 function request(path){
  const {pathname,q}=parsePath(path),icao=q.icao||q.airport,a=airports[icao];
  if(!a)throw Error('AIRPORT NOT IN NAV DATA');
  if(pathname.endsWith('/airport'))return a.airport;
  const group=a.kinds[q.kind];if(!group)throw Error('INVALID PROCEDURE KIND');
  const catalog=[...group].map(([id,vs])=>({ident:id,runways:options(vs,a.airport),transitions:[...new Set(vs.flatMap(v=>(v.transitions||[]).map(t=>t.name)).filter(ident))].sort(),fmc_executable:false}));
  // The existing CDU wire contract expects its legacy cycle token; the actual
  // source cycle travels separately and is shown in the NAV DATA status.
  if(pathname.endsWith('/catalog'))return {airport:icao,kind:q.kind,cycle:LEGACY,source_cycle:CYCLE,items:catalog,fmc_executable:false};
  const vs=group.get(q.ident),item=catalog.find(x=>x.ident===q.ident);
  if(!vs||!item)throw Error('PROCEDURE NOT IN NAV DATA');
  const runway=q.runway||null,transition=q.transition||null;
  if(runway&&!item.runways.includes(runway)||!runway&&item.runways.length>1||transition&&!item.transitions.includes(transition))throw Error('SELECT PUBLISHED VARIANT');
  let selected=vs.filter(v=>v.runway===runway||(!runway&&v.runway!=='All'));
  if(!selected.length)selected=vs.filter(v=>v.runway==='All');
  if(transition)selected=selected.filter(v=>(v.transitions||[]).some(t=>t.name===transition));
  const candidates=selected.map(v=>{
   const t=transition?v.transitions?.find(t=>t.name===transition)?.legs||[]:[];
   const legs=[...t,...v.legs];
   // Drop only an exact repeated transition-join fix (not distinct leg types).
   return legs.filter((l,i)=>!i||JSON.stringify(l)!==JSON.stringify(legs[i-1]));
  });
  const unique=[...new Map(candidates.map(x=>[JSON.stringify(x),x])).values()];
  if(unique.length!==1)throw Error(unique.length?'AMBIGUOUS PROCEDURE VARIANT':'PROCEDURE SOURCE INCOMPLETE');
  const rawLegs=unique[0];
  const events=rawLegs.filter(l=>['Normal','Runway'].includes(l.Type)&&coord({lat:Number(l.Latitude),lon:Number(l.Longitude)})&&ident(l.Name))
   .map(l=>({kind:'FIX_PASSAGE',values:{ident:l.Name},reference_status:'LOCAL_FIX_COORDINATE_VERIFIED',fix:{ident:l.Name,lat:Number(l.Latitude),lon:Number(l.Longitude)}}));
  return {airport:icao,kind:q.kind,ident:q.ident,airac:CYCLE,source_cycle:CYCLE,fmc_executable:false,
    requires_runway_selection:item.runways.length>1,requires_transition_selection:false,runway_options:item.runways,transition_options:item.transitions,rawLegs,segments:[{events}]};
 }
 return {request,airports};
}
function program(source,opt){
 const {airport,kind,runway,airportRecord}=opt;
 if(source?.airac!==CYCLE||source.airport!==airport||source.kind!==kind||source.fmc_executable!==false||!Array.isArray(source.rawLegs))throw Error('INVALID SOURCE LEGS');
 let input={airport,kind,runway,legs:source.rawLegs,performance:{gsKt:170,vsFpm:2000,rollNm:.9,bankDeg:25,variationDeg:4.5}};
 const selected=airportRecord?.runways?.find(r=>r.runway===runway);
 if(selected){
  const start={lat:selected.threshold_lat,lon:selected.threshold_lon},opp=airportRecord.runways.find(r=>r.runway===reciprocal(runway));
  const end=opp?{lat:opp.threshold_lat,lon:opp.threshold_lon}:null;
  if(coord(start)&&coord(end)&&Number.isFinite(selected.magnetic_heading_deg)){
   input.performance.variationDeg=((E.bearing(start,end)-selected.magnetic_heading_deg+540)%360)-180;
   if(kind==='SID'){input.start=start;input.onGround=true;input.altFt=selected.airport_elevation_ft;input.headingMag=selected.magnetic_heading_deg;}
  }
 }
 return {version:VERSION,sourceOnly:true,fmcExecutable:false,runway,input};
}
const cache=new WeakMap();
function trajectory(p,flight=null){
 if(p?.version!==VERSION||p.sourceOnly!==true||p.fmcExecutable!==false)return null;
 const perf={...p.input.performance};
 // Do not use ground speed zero at the threshold or a descent rate for SID.
 if(flight?.airborne===true&&p.input.kind==='SID'&&flight.gsKt>=80&&flight.gsKt<=350&&flight.vsFpm>=500&&flight.vsFpm<=6000){
  perf.gsKt=Math.round(flight.gsKt/5)*5;perf.vsFpm=Math.round(flight.vsFpm/100)*100;
 }
 const key=JSON.stringify(perf);
 const old=cache.get(p);if(old?.key===key)return old.result;
 const result=E.build({...p.input,performance:perf});
 const model={...result,profile:'TRAINING_PREVIEW_AIRAC_2611'};
 cache.set(p,{key,result:model});return model;
}
function compile(source,opt){
 const p=program(source,opt),model=trajectory(p),features=[];
 const mark=(f)=>({type:'Feature',geometry:{type:'Point',coordinates:[f.lon,f.lat]},properties:{ident:f.ident,render_style:'reference_fix_only',fmc_executable:false}});
 for(const f of model.fixes.filter(f=>coord(f)&&ident(f.ident)&&!f.estimated))features.push(mark(f));
 for(const seg of model.segments){
  for(let i=1;i<seg.points.length;i++){
   const a=seg.points[i-1],b=seg.points[i];if(!coord(a)||!coord(b))continue;
   features.push({type:'Feature',geometry:{type:'LineString',coordinates:[[a.lon,a.lat],[b.lon,b.lat]]},properties:{render_style:'training_reference_geometry',fmc_executable:false}});
  }
 }
 return {type:'FeatureCollection',metadata:{airport:opt.airport,kind:opt.kind,ident:opt.ident,airac:LEGACY,source_cycle:CYCLE,selected_runway:opt.runway||null,selected_transition:opt.transition||null,fmc_executable:false,source_only:true,pathProgram:p,warnings:model.warnings},features};
}
function mount(){
 if(!root.document)return;
 const doc=root.document,frames=()=>Array.from(doc.querySelectorAll('iframe.cdu-frame'));
 let installed=false,attempts=0;
 function announce(name){for(const f of frames())try{f.contentWindow?.[name]?.()}catch(_){}}
 function status(message){
  root.B737IranNavdataStatus={cycle:CYCLE,message,connected:installed};
  const el=doc.getElementById('cduSgPrivateStatus');if(el)el.textContent=message;
  doc.documentElement.dataset.iranNavdata=installed?'AIRAC-2611':'PENDING';
 }
 async function connect(){
  if(installed)return;
  const shared=root.B737CduSgRouteV1,oldConverter=root.B737UnifiedSGSourceGeometryV1;
  if(!shared||!oldConverter){if(++attempts<120)root.setTimeout(connect,100);return;}
  try{
   const res=await root.fetch('/api/iran-navdata/local-reference',{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'}});
   if(!res.ok){status('AIRAC 2611 not installed; existing bank preserved.');return;}
   const catalog=createCatalog(await res.json());
   const oldBridge=root.B737CduSgBridgeV1;
   announce('B737CDUDetachCduSgV1');shared.setConnected(false);
   root.B737UnifiedSGSourceGeometryV1=Object.freeze({...oldConverter,compile:(source,opt)=>source?.airac===CYCLE?compile(source,opt):oldConverter.compile(source,opt)});
   root.B737CduSgBridgeV1=Object.freeze({
    cycle:CYCLE,source:'PRIVATE_RAILWAY_AIRAC_2611',isConnected:()=>installed,
    async request(path){
     if(/^\/api\/cdu\/airway-check\?/.test(path))return root.fetch(path.replace('/api/cdu/','/api/iran-navdata/'),{credentials:'same-origin',cache:'no-store',redirect:'error'});
     if(/^\/api\/iran-navdata\/fix\?/.test(path))return root.fetch(path,{credentials:'same-origin',cache:'no-store',redirect:'error'});
     try{return {ok:true,json:async()=>catalog.request(path)};}catch(e){return {ok:false,json:async()=>({error:e.message})};}
    }
   });
   // Evaluate catalog requests synchronously before resolving the response.
   const bridge=root.B737CduSgBridgeV1;
   root.B737CduSgBridgeV1=Object.freeze({...bridge,async request(path){
    if(/^\/api\/(?:cdu\/airway-check|iran-navdata\/fix)\?/.test(path))return bridge.request(path);
    try{const value=catalog.request(path);return {ok:true,json:async()=>value};}catch(e){return {ok:false,json:async()=>({error:e.message})};}
   }});
   installed=true;shared.setConnected(true);announce('B737CDUAttachCduSgV1');
   status('AIRAC 2611 · OIII / OIFM / OIMM / OISS · TRAINING');
   root.addEventListener('message',e=>{if(installed&&e.origin===root.location.origin&&e.data?.type==='b737:unified-cdu'&&e.data.kind==='ready'&&frames().some(f=>f.contentWindow===e.source))try{e.source.B737CDUAttachCduSgV1?.()}catch(_){}});
   for(const f of frames())f.addEventListener('load',()=>{if(installed)try{f.contentWindow.B737CDUAttachCduSgV1?.()}catch(_){}});
  }catch(e){status('AIRAC 2611 connection failed: '+e.message);}
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>root.setTimeout(connect,0),{once:true});else root.setTimeout(connect,0);
}
const api={createCatalog,program,trajectory,compile,VERSION};
root.B737IranRoutePreviewV2=api;
if(typeof module==='object'&&module.exports)module.exports=api;
mount();
})(typeof globalThis==='object'?globalThis:this);
