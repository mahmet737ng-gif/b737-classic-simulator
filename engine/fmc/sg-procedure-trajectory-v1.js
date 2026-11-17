/* FCOM-like source-token to EHSI training geometry. NOT a flight director,
 * certified FMS turn-prediction algorithm, or real-world procedure validation.
 * Known fixes, runway thresholds and command altitudes are sourced; GS, VS,
 * roll and bank used to locate the variable altitude turn are TRAINING inputs.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedSGProcedureTrajectoryV1=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const VERSION='SG-PROCEDURE-TRAJECTORY-0001',RAD=Math.PI/180,TO_RAD=Math.PI/180;
 const FT_PER_NM=6076.1155,EARTH_KT_TO_MPS=0.514444;
 const finite=Number.isFinite;
 const wrap=v=>(v%360+360)%360;
 const diff=(a,b)=>((a-b+540)%360)-180;
 const point=p=>p&&finite(p.lon)&&finite(p.lat)&&Math.abs(p.lon)<=180&&Math.abs(p.lat)<=90;
 const pick=(arr,kind)=>arr.find(e=>e.kind===kind);
 const radians=d=>d*RAD;
 function distanceNM(a,b){
  const x=(b.lon-a.lon)*60*Math.cos(radians((a.lat+b.lat)/2));
  const y=(b.lat-a.lat)*60;
  return Math.hypot(x,y);
 }
 function bearing(a,b){
  const x=(b.lon-a.lon)*Math.cos(radians((a.lat+b.lat)/2));
  const y=b.lat-a.lat;
  return wrap(Math.atan2(x,y)/RAD);
 }
 function local(origin,p){
  return [(p.lon-origin.lon)*60*Math.cos(radians((origin.lat+p.lat)/2)),(p.lat-origin.lat)*60];
 }
 function geo(origin,p){
  const lat=origin.lat+p[1]/60;
  return {lat,lon:origin.lon+p[0]/(60*Math.cos(radians((origin.lat+lat)/2)))};
 }
 function program(source,{kind,runway,airportRecord}={}){
  if(kind!=='SID'||source?.fmc_executable!==false||!Array.isArray(source.segments)||
     !Array.isArray(airportRecord?.runways)||typeof runway!=='string')return null;
  const runwayRecord=airportRecord.runways.find(x=>x?.runway===runway);
  const start={lat:runwayRecord?.threshold_lat,lon:runwayRecord?.threshold_lon};
  if(!point(start)||!finite(runwayRecord?.airport_elevation_ft))return null;
  const oppositeName=runway.replace(/^(\d{2})([LCR]?)$/,(_whole,num,suffix)=>{
   const reciprocal=(Number(num)+17)%36+1;
   const end={L:'R',R:'L',C:'C','':''}[suffix];
   return String(reciprocal).padStart(2,'0')+end;
  });
  const other=airportRecord.runways.find(x=>x?.runway===oppositeName);
  const opposite={lat:other?.threshold_lat,lon:other?.threshold_lon};
  // Magnetic track is not a true bearing. A surveyed reciprocal runway pair
  // gives a local inferred variation rather than silently equating the two.
  if(!point(opposite)||distanceNM(start,opposite)<0.2||
     !finite(runwayRecord.magnetic_heading_deg))return null;
  const variation=diff(bearing(start,opposite),runwayRecord.magnetic_heading_deg);
  if(Math.abs(variation)>15)return null;
  for(const segment of source.segments){
   const events=segment?.events||segment?.ast;
   if(!Array.isArray(events))continue;
   const filtered=events.filter(e=>e&&
    !['RUNWAY_REFERENCE','ALTITUDE_CONSTRAINT','SPEED_TOKEN'].includes(e.kind));
   // Unrecognized path terminators must not be silently interpolated.
   if(filtered.length!==6||filtered.map(x=>x.kind).join(',')!==
      'TRK,UNTIL,TURN,DIRECT,FIX_PASSAGE,FIX_PASSAGE')continue;
   const [trk,until,turn,direct,first,last]=filtered;
   const magneticTrack=Number(trk.values?.degrees),altitude=Number(until.values?.altitudeFt);
   const direction=turn.values?.direction;
   if(!finite(magneticTrack)||magneticTrack<0||magneticTrack>=360||
      !finite(altitude)||altitude<=runwayRecord.airport_elevation_ft||altitude>20000||
      !['LEFT','RIGHT'].includes(direction))continue;
   if(first.reference_status!=='LOCAL_FIX_COORDINATE_VERIFIED'||
      last.reference_status!=='LOCAL_FIX_COORDINATE_VERIFIED'||
      !point(first.fix)||!point(last.fix)||
      first.values?.ident!==first.fix.ident||last.values?.ident!==last.fix.ident||
      !first.fix.ident||!last.fix.ident)continue;
   return {version:VERSION,kind:'TRACK_UNTIL_ALTITUDE_TURN_DIRECT',
    runway,source:'OIII_PUBLISHED_TEXT_REFERENCE',sourceOnly:true,fmcExecutable:false,
    trackMagneticDeg:magneticTrack,altitudeMSLFt:altitude,
    runwayElevationFt:runwayRecord.airport_elevation_ft,
    runwayLengthFt:finite(runwayRecord.length_ft)?runwayRecord.length_ft:null,
    variationDeg:variation,turnDirection:direction,
    start,opposite,fixes:[{ident:first.fix.ident,lat:first.fix.lat,lon:first.fix.lon},
     {ident:last.fix.ident,lat:last.fix.lat,lon:last.fix.lon}]};
  }
  return null;
 }
 function trajectory(p,flight=null){
  if(p?.version!==VERSION||p.kind!=='TRACK_UNTIL_ALTITUDE_TURN_DIRECT'||
    !point(p.start)||!Array.isArray(p.fixes)||p.fixes.length!==2||
    !p.fixes.every(point)||!['LEFT','RIGHT'].includes(p.turnDirection))return null;
  const airborne=flight?.airborne===true;
  const gs=airborne&&finite(flight?.gsKt)&&flight.gsKt>=80&&flight.gsKt<=350?
   flight.gsKt:160;
  const vs=airborne&&finite(flight?.vsFpm)&&flight.vsFpm>=500&&flight.vsFpm<=6000?
   flight.vsFpm:1600;
  // No actual liftoff or 4360-ft crossing point is supplied by OIII.txt.
  // Roll distance is an explicit training assumption, NOT an AFM datum.
  const rollNm=finite(p.runwayLengthFt)?Math.max(.65,Math.min(1.6,p.runwayLengthFt/FT_PER_NM*.6)):1.2;
  const climbNm=Math.max(.05,(p.altitudeMSLFt-p.runwayElevationFt)*gs/(vs*60));
  if(!finite(climbNm)||climbNm>40)return null;
  const theta=radians(wrap(p.trackMagneticDeg+p.variationDeg));
  const r=(gs*EARTH_KT_TO_MPS)**2/(9.80665*Math.tan(radians(25)))/1852;
  if(!finite(r)||r<.1||r>10)return null;
  const from=p.start,target=local(from,p.fixes[0]),sign=p.turnDirection==='LEFT'?1:-1;
  const to=geo(from,[(rollNm+climbNm)*Math.sin(theta),(rollNm+climbNm)*Math.cos(theta)]);
  const initial=[(rollNm+climbNm)*Math.sin(theta),(rollNm+climbNm)*Math.cos(theta)];
  const startVector=[Math.sin(theta),Math.cos(theta)];
  const center=[initial[0]-sign*startVector[1]*r,initial[1]+sign*startVector[0]*r];
  const radial=[initial[0]-center[0],initial[1]-center[1]];
  const phi=Math.atan2(radial[1],radial[0]);
  const delta=[target[0]-center[0],target[1]-center[1]],distance=Math.hypot(...delta);
  if(distance<=r+.01)return null;
  const base=Math.atan2(delta[1],delta[0]),tangentArc=Math.acos(r/distance);
  const options=[base+tangentArc,base-tangentArc].map(angle=>{
   const end=[center[0]+r*Math.cos(angle),center[1]+r*Math.sin(angle)];
   const v=[target[0]-end[0],target[1]-end[1]];
   const dir=[-Math.sin(angle)*sign,Math.cos(angle)*sign];
   const forward=v[0]*dir[0]+v[1]*dir[1];
   const sweep=sign>0?(angle-phi+4*Math.PI)%(2*Math.PI):
    (phi-angle+4*Math.PI)%(2*Math.PI);
   return {angle,end,forward,sweep};
  }).filter(x=>x.forward>0.1&&x.sweep>0.01&&x.sweep<2*Math.PI-.01)
   .sort((a,b)=>a.sweep-b.sweep);
  if(!options.length)return null;
  const arc=options[0],slices=Math.min(180,Math.max(12,Math.ceil(arc.sweep/radians(3))));
  const routeArc=[];
  for(let i=0;i<=slices;i++){
   const angle=phi+sign*arc.sweep*i/slices;
   routeArc.push(geo(from,[center[0]+r*Math.cos(angle),center[1]+r*Math.sin(angle)]));
  }
  const startLatLon=geo(from,[0,0]),turnEnd=routeArc.at(-1),lead=p.fixes[0];
  return {version:VERSION,sourceOnly:true,fmcExecutable:false,
   profile:airborne&&gs===flight.gsKt&&vs===flight.vsFpm?'LIVE_TRAINING_SNAPSHOT':'NOMINAL_TRAINING_PREVIEW',
   assumptions:{groundRollNm:rollNm,groundSpeedKt:gs,verticalSpeedFpm:vs,
    bankDeg:25,turnRadiusNm:r,altitudeMSLFt:p.altitudeMSLFt},
   altitudeTurnPoint:to,turnEntryTrackTrueDeg:wrap(p.trackMagneticDeg+p.variationDeg),
   segments:[
    {type:'TRACK_TO_ALTITUDE',points:[startLatLon,to]},
    {type:'TURN_'+p.turnDirection,points:routeArc},
    {type:'DIRECT_FIX',points:[turnEnd,lead]},
    {type:'NEXT_FIX',points:[lead,p.fixes[1]]}
   ]};
 }
 return Object.freeze({VERSION,program,trajectory,distanceNM,bearing});
});
