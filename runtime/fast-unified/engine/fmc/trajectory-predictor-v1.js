/* B737 Classic Unified: data-backed, simulation-only trajectory predictor V2. */
(function(root){const api=(function makeTrajectory(root){
 "use strict";
 const f=Number.isFinite,clamp=(x,l,h)=>Math.max(l,Math.min(h,x)),rad=Math.PI/180;
 const at=v=>{const m=/^(FL)?(\d{2,5})$/.exec(String(v||""));return m?+m[2]*(m[1]?100:1):null};
 const coord=p=>p&&f(p.lat)&&f(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
 const normLon=x=>((x+540)%360)-180;
 function limits(text){const [sp="",al=""]=String(text||"").split("/");let lo=-1000,hi=37000,speed=null,mach=null;
  const m=/^(FL\d{2,3}|\d{3,5})([AB])?(?:(FL\d{2,3}|\d{3,5})B)?$/.exec(al);
  if(m){const x=at(m[1]);if(m[2]!=="B")lo=x;if(m[2]!=="A")hi=x;if(m[3])hi=at(m[3]);}
  if(/^\d{2,3}$/.test(sp)&&+sp>=100&&+sp<=350)speed=+sp;
  if(/^\.\d{2,3}$/.test(sp)&&+sp>=.3&&+sp<=.82)mach=+sp;return {lo,hi,speed,mach};}
 function atmosphere(ft,isa){const h=clamp(ft,-1000,41000)*.3048,t=288.15-.0065*Math.min(11000,h),p=101325*(t/288.15)**5.25588*Math.exp(-Math.max(0,h-11000)*9.80665/(287.05287*216.65));return {p,t:Math.max(150,t+isa)}}
 function air(cas,ft,isa){const {p,t}=atmosphere(ft,isa),q=101325*((1+.2*(cas/661.4788)**2)**3.5-1),mach=Math.sqrt(5*((1+q/p)**(2/7)-1));return {mach,tas:mach*Math.sqrt(1.4*287.05287*t)/.514444};}
 function casAtMach(m,ft){const {p}=atmosphere(ft,0),q=p*((1+.2*m*m)**3.5-1);return 661.4788*Math.sqrt(5*((1+q/101325)**(2/7)-1))}
 function crossover(cas,mach){if(!f(cas)||!f(mach)||cas<=0||mach<=0)return null;let lo=0,hi=37000;if(casAtMach(mach,hi)>cas)return null;for(let i=0;i<32;i++){const m=(lo+hi)/2;if(casAtMach(mach,m)>cas)lo=m;else hi=m;}return (lo+hi)/2;}
 function geoAt(a,b,t){if(!coord(a)||!coord(b)||!f(t))return null;t=clamp(t,0,1);if(t===0)return {lat:a.lat,lon:a.lon};if(t===1)return {lat:b.lat,lon:b.lon};const u=p=>[Math.cos(p.lat*rad)*Math.cos(p.lon*rad),Math.cos(p.lat*rad)*Math.sin(p.lon*rad),Math.sin(p.lat*rad)],p=u(a),q=u(b),angle=Math.acos(clamp(p.reduce((s,v,i)=>s+v*q[i],0),-1,1));if(angle<1e-8)return {lat:a.lat+(b.lat-a.lat)*t,lon:normLon(a.lon+normLon(b.lon-a.lon)*t)};if(Math.abs(Math.sin(angle))<1e-8)return null;const v=p.map((x,i)=>(Math.sin((1-t)*angle)*x+Math.sin(t*angle)*q[i])/Math.sin(angle));return {lat:Math.atan2(v[2],Math.hypot(v[0],v[1]))/rad,lon:normLon(Math.atan2(v[1],v[0])/rad)};}
 function positionAtDistance(start,legs,distance){if(!coord(start)||!f(distance)||distance<0)return null;let previous=start,total=0;for(const l of legs){const n=l.segmentNm;if(!coord(l)||!f(n)||n<0)return null;if(distance<=total+n+1e-6&&n>1e-8)return geoAt(previous,l,(distance-total)/n);previous=l;total+=n;}return Math.abs(total-distance)<1e-5?{lat:previous.lat,lon:previous.lon}:null;}
 function makeCurve(fn,gradient){const heights=[-1000,0,...Array.from({length:37},(_,i)=>(i+1)*1000)],ds=heights.map(h=>h<0?h/gradient:(fn?fn(h):h/gradient));for(let i=0;i<ds.length;i++){if(!f(ds[i]))ds[i]=heights[i]/gradient;if(i&&ds[i]<=ds[i-1])ds[i]=ds[i-1]+(heights[i]-heights[i-1])/gradient;}
  function interp(xs,ys,x){if(x<=xs[0])return ys[0];if(x>=xs.at(-1))return ys.at(-1);let lo=0,hi=xs.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(xs[m]<=x)lo=m;else hi=m;}return ys[lo]+(ys[hi]-ys[lo])*(x-xs[lo])/(xs[hi]-xs[lo]);}return {d:h=>interp(heights,ds,h),h:x=>interp(ds,heights,x)};}
 function solve(o){
  const {legs,startFt,endFt,crz,gw,fuelKg,ci,isa=0,windFromDeg=0,windKt=0,transitionAltitudeFt=18000,nowMs,origin,dest,complete=true,onGround=false}=o;
  if(!Array.isArray(legs)||!legs.length||legs.length>501||![startFt,crz,gw,fuelKg,ci,isa,windFromDeg,windKt].every(f)||gw<=fuelKg||fuelKg<0||crz<1000||crz>41000||ci<0||ci>200||startFt< -1000||startFt>41000||windKt<0||windKt>250||complete&&(!f(endFt)||endFt< -1000||endFt>37000))return null;
  if(legs.some(l=>!f(l.segmentNm)||l.segmentNm<0||!f(l.courseTrueDeg)))return null;
  const provider=root.B737TrajectoryPerformanceV2?.make({model:o.model,rating:o.rating,weightKg:gw,isa,ci,windFromDeg,windKt,engines:o.engines,engineAI:o.engineAI,wingAI:o.wingAI});
  const pl=provider?.altitudeLimits()??{optimumAltitudeFt:null,maximumOperatingAltitudeFt:null,engineOutCeilingFt:null,certifiedCeilingFt:37000,native:false,source:"GENERIC_TRAINING_MODEL"};
  const base={...pl,source:"UNIFIED_TRAJECTORY_V2",origin,dest,routeRevision:o.routeRevision??null,transitionAltitudeFt,crz,gw,ci,isa,windFromDeg,windKt,performanceData:provider?.provenance??{source:"GENERIC_TRAINING_MODEL",certification:"SIMULATION_ONLY"}};
  if(crz>37000||startFt>37000)return {...base,quality:"UNABLE",reason:"CERTIFIED_ALTITUDE_LIMIT",waypoints:[],profile:[],destination:null,ready:false};
  const cap=Math.max(complete?endFt:-1000,Math.min(crz,pl.native&&f(pl.maximumOperatingAltitudeFt)?pl.maximumOperatingAltitudeFt:37000,o.engines===1&&f(pl.engineOutCeilingFt)?pl.engineOutCeilingFt:37000));
  const dist=[0],cs=[{lo:startFt,hi:startFt,speed:null,mach:null}];for(const l of legs){dist.push(dist.at(-1)+l.segmentNm);cs.push(limits(l.constraint));}
  const last=dist.length-1,total=dist[last];if(complete){cs[last].lo=Math.max(cs[last].lo,endFt);cs[last].hi=Math.min(cs[last].hi,endFt);}
  const up=makeCurve(provider?.climbAirNm,clamp(340/clamp(gw/55000,.7,1.5),220,460)),down=makeCurve(provider?.descentAirNm,350);
  const factor=(course,phase)=>provider?.windFactor(course,phase)??clamp(1-windKt*Math.cos((windFromDeg-course)*rad)/(phase==="CLIMB"?330:370),.5,1.7);
  const uf=legs.map(l=>factor(l.courseTrueDeg,"CLIMB")),df=legs.map(l=>factor(l.courseTrueDeg,"DESCENT"));
  const climb=(h,dx,i)=>up.h(up.d(h)+Math.max(0,dx)/uf[i-1]),descend=(h,dx,i)=>down.h(down.d(h)+Math.max(0,dx)/df[i-1]);
  // Backward descent envelope intentionally independent of current altitude.
  const back=cs.map((v,i)=>i===0?cap:Math.min(cap,v.hi));for(let i=last-1;i>=0;i--)back[i]=Math.min(back[i],descend(back[i+1],dist[i+1]-dist[i],i+1));
  const hi=back.slice();hi[0]=Math.min(startFt,back[0]);for(let i=1;i<=last;i++)hi[i]=Math.min(hi[i],climb(hi[i-1],dist[i]-dist[i-1],i));
  const conflicts=cs.map((v,i)=>hi[i]<v.lo-1?{index:i-1,ident:legs[i-1]?.ident||origin,minFt:v.lo,reachableFt:hi[i],kind:i===0?"ABOVE_PATH":"ALTITUDE_CONSTRAINT"}:null).filter(Boolean);
  const altitude=(i,x)=>Math.min(cap,climb(hi[i-1],x-dist[i-1],i),descend(hi[i],dist[i]-x,i));
  const look=Math.min(1,Math.max(0,dist[1])),pathAltitudeFt=back[0],descentRef=x=>Math.min(cap,descend(back[1],dist[1]-x,1));
  const descentGradientFtNm=look>1e-6?(descentRef(look)-pathAltitudeFt)/look:0,currentGradient=look>1e-6?(altitude(1,look)-hi[0])/look:0;
  let currentPhase=currentGradient>1?"CLIMB":currentGradient< -1?"DESCENT":hi[0]>=cap-100?"CRUISE":"LEVEL";if(startFt>pathAltitudeFt+1)currentPhase="DESCENT";
  function schedule(phase,ft,course,weight,restriction){const p=phase==="LEVEL"?"CRUISE":phase,b=o.speedAt?.(p,ft,course,weight,restriction),v=provider?.speed(p,ft,course,weight,b);let cas=f(v)?v:f(b)?b:f(b?.targetKt)?b.targetKt:Math.min((p==="CRUISE"?255:250)*Math.sqrt(weight/50000)+ci*.25,casAtMach(.74+ci*.0003,ft),340);if(ft<10000)cas=Math.min(cas,250);if(f(restriction?.speed))cas=Math.min(cas,restriction.speed);if(f(restriction?.mach))cas=Math.min(cas,casAtMach(restriction.mach,ft));return clamp(cas,100,340);}
  const phaseSpeeds=Object.fromEntries(["CLIMB","CRUISE","DESCENT"].map(p=>[p,Math.round(schedule(p,p==="CRUISE"?cap:Math.min(cap,12000),legs[0].courseTrueDeg,gw,null))]));
  const first=cs[1],firstSp=schedule(currentPhase,startFt,legs[0].courseTrueDeg,gw,{speed:first.speed===null?null:Math.sqrt(first.speed**2+3500*dist[1]),mach:dist[1]<2?first.mach:null});
  const guide={phase:currentPhase,plannedAltitudeFt:hi[0],descentPathFt:pathAltitudeFt,verticalDeviationFt:startFt-pathAltitudeFt,descentGradientFtNm,profileGradientFtNm:currentGradient,targetKt:Math.round(firstSp),nextAltitudeFt:hi[1],nextMinimumFt:first.lo,nextMaximumFt:first.hi,nextSpeedKt:first.speed,cruiseTargetFt:cap,source:"UNIFIED_TRAJECTORY_V2",recoverable:conflicts.length===1&&conflicts[0].kind==="ABOVE_PATH",complete};
  if(conflicts.length&&!onGround)return {...base,quality:"UNABLE",reason:guide.recoverable?"ABOVE_DESCENT_PATH":"ALTITUDE_CONSTRAINT_UNREACHABLE",conflicts,waypoints:[],profile:[],destination:null,ready:false,guidance:guide,phaseSpeeds};
  const advisory=conflicts.length>0;
  const records=[],samples=[],markers={},fuelSources=new Set();let burn=onGround?100:0,seconds=0,previousPhase=null,seenCruise=hi[0]>=cap-100,peak=hi[0];
  const utc=ms=>f(ms)?new Date(ms).toISOString().slice(11,16).replace(":","")+"Z":null;
  const marker=(label,d,h)=>{const p=positionAtDistance(o.startPoint,legs,d),etaMs=f(nowMs)?nowMs+seconds*1000:null;return {label,distanceNm:d,altitudeFt:Math.round(h),etaMs,eta:utc(etaMs),fuelKg:Math.max(0,fuelKg-burn),...(p||{})};};
  const mode=(phase,cas,ft,r)=>f(r?.speed)&&cas<=r.speed+.5?"IAS":f(r?.mach)?"MACH":ft>=(crossover((phase==="CLIMB"?280:phase==="DESCENT"?250:290)+ci*.08,.74+ci*.0002)??Infinity)?"MACH":"IAS";
  for(let i=1;i<=last;i++){
   const l=legs[i-1],from=dist[i-1],to=dist[i];let low=from,high=to;
   for(let k=0;k<32;k++){const m=(low+high)/2;if(climb(hi[i-1],m-from,i)<descend(hi[i],to-m,i))low=m;else high=m;}
   const breaks=[from,to,(low+high)/2,clamp(from+(up.d(cap)-up.d(hi[i-1]))*uf[i-1],from,to),clamp(to-(down.d(cap)-down.d(hi[i]))*df[i-1],from,to)];for(let x=from+5;x<to;x+=5)breaks.push(x);
   const xs=[...new Set(breaks)].sort((a,b)=>a-b);let phase=currentPhase;
   for(let j=1;j<xs.length;j++){const x1=xs[j-1],x2=xs[j],dx=x2-x1;if(dx<1e-6)continue;const h1=altitude(i,x1),h2=altitude(i,x2),mid=(h1+h2)/2,grad=(h2-h1)/dx;peak=Math.max(peak,h1,h2);
    phase=grad>1?"CLIMB":grad< -1?"DESCENT":mid>=cap-100?"CRUISE":"LEVEL";
    if(phase==="CRUISE"&&previousPhase==="CLIMB"&&!markers.tc&&cap>=crz-1)markers.tc=marker("T/C",x1,h1);
    if(phase==="DESCENT"&&seenCruise&&!markers.td)markers.td=marker("T/D",x1,h1);if(phase==="CRUISE")seenCruise=true;previousPhase=phase;
    const mass=Math.max(gw-fuelKg,gw-burn),restriction=cs[i],left=to-(x1+x2)/2,maxCas=restriction.speed!==null?Math.sqrt(restriction.speed**2+3500*left):null,cas=schedule(phase,mid,l.courseTrueDeg,mass,{speed:maxCas,mach:left<2?restriction.mach:null});
    const {tas,mach}=air(cas,mid,isa),head=windKt*Math.cos((windFromDeg-l.courseTrueDeg)*rad),crosswind=windKt*Math.sin((windFromDeg-l.courseTrueDeg)*rad),gs=Math.sqrt(Math.max(0,tas*tas-crosswind*crosswind))-head;
    if(!f(gs)||gs<=30||samples.length>15000)return {...base,quality:"UNAVAILABLE",reason:"WIND_SPEED_OR_SAMPLE_LIMIT",waypoints:[],profile:[],destination:null};
    const hours=dx/gs,external=o.fuelFlowAt?.(phase,mid,cas,mach,mass),tableFlow=provider?.fuelFlow(phase==="LEVEL"?"CRUISE":phase,mid,cas,mach,mass),flow=f(external)&&external>0?external:f(tableFlow?.kgHr)?tableFlow.kgHr:(phase==="CLIMB"?3800:phase==="DESCENT"?1250:2450+2*ci)*clamp(mass/55000,.7,1.5);
    fuelSources.add(f(external)&&external>0?"EXTERNAL_PERFORMANCE_PROVIDER":tableFlow?.source??"PHASE_FUEL_TRAINING_MODEL");burn+=flow*hours;seconds+=hours*3600;
    samples.push({distanceNm:x2,altitudeFt:h2,phase,gradientFtNm:grad,casKt:Math.round(cas),mach,tasKt:tas,gsKt:gs,fuelKg:Math.max(0,fuelKg-burn),elapsedSec:seconds,legIndex:l.index??i-1});
   }
   const ft=hi[i],cas=schedule(phase,ft,l.courseTrueDeg,Math.max(gw-fuelKg,gw-burn),cs[i]),spd=air(cas,ft,isa),etaMs=f(nowMs)?nowMs+seconds*1000:null;
   records.push({...l,index:l.index??i-1,distanceNm:to,phase,altitudeFt:Math.round(ft),predictedIasKt:Math.round(cas),predictedMach:spd.mach,speedMode:mode(phase,cas,ft,cs[i]),tasKt:spd.tas,etaMs,eta:utc(etaMs),fuelKg:Math.max(0,fuelKg-burn),grossWeightKg:Math.max(gw-fuelKg,gw-burn),speedRestrictionKt:cs[i].speed,forecastWindFromDeg:windFromDeg,forecastWindKt:windKt});
  }
  const remaining=fuelKg-burn,reserve=o.reservesKg,warnings=complete?[...(remaining<900?["INSUFFICIENT FUEL"]:[]),...(f(reserve)&&remaining<reserve?["USING RSV FUEL"]:[])]:[],destination=complete&&!advisory?{...records.at(-1),ident:dest,distanceNm:total}:null;
  if(complete)markers.ed=marker("E/D",total,endFt);
  return {...base,quality:advisory?"UNABLE":"TRAINING_ESTIMATE",reason:advisory?"ALTITUDE_CONSTRAINT_UNREACHABLE":cap<crz-1?"UNABLE_CRZ_ALT":complete?"DATA_BACKED_TRAINING_APPROXIMATION":"PARTIAL_ROUTE",advisory,conflicts,ready:!advisory,complete:complete&&!advisory,waypoints:records,profile:samples,phaseSpeeds,active:records[0]??null,next:records[1]??null,destination,maxAltitudeFt:peak,cruiseReached:peak>=crz-1,achievableCruiseAltitudeFt:cap,tripAltitudeFt:complete&&o.computeTrip!==false?provider?.tripAltitude(total,startFt,endFt)??null:null,topOfClimb:markers.tc??null,topOfDescent:markers.td??null,endOfDescent:markers.ed??null,altitudeChange:markers.tc??markers.td??null,topOfDescentNm:markers.td?.distanceNm??null,requiredFuelKg:complete&&!advisory?burn:null,remainingFuelRawKg:complete&&!advisory?remaining:null,fuelAtDestinationKg:destination?.fuelKg??null,reserveWarnings:advisory?[]:warnings,reserveWarning:advisory?null:warnings[0]??null,guidance:{...guide,topOfDescentNm:markers.td?.distanceNm??null},fuelSources:[...fuelSources],assumptions:[...(provider?.provenance?.assumptions??["GENERIC_TRAINING_MODEL"]),...(o.assumedDestinationAltitude?["DEST_ALT_ASSUMED"]:[]),...(legs.some(l=>l.estimated)?["ESTIMATED_CONDITIONAL_GEOMETRY"]:[])]};
 }
 function sessionKey(s){if(s?.routeActivated!==true)return null;const p=root.B737AircraftProfileStore?.get?.()||{};return JSON.stringify([s.routeRevision??0,Object.entries(s.active||{}).sort(([a],[b])=>a.localeCompare(b)),p.aircraftModel??null,p.engineVariant??null]);}
 let preview=null;
 function publishPreview(result,session){const key=sessionKey(session),actual=root.B737UnifiedFmc?.snapshot?.();if(actual&&sessionKey(actual)!==key)return false;const value=key&&result?.quality==="TRAINING_ESTIMATE"&&result.origin===session.active?.ORIGIN&&result.dest===session.active?.DEST?result:null;const fingerprint=JSON.stringify(value?[key,value.topOfClimb,value.topOfDescent,value.endOfDescent,value.maxAltitudeFt]:[key,null]),changed=fingerprint!==preview?.fingerprint;preview={key,value,fingerprint,at:Date.now()};if(changed&&typeof root.dispatchEvent==="function"&&typeof root.CustomEvent==="function")root.dispatchEvent(new root.CustomEvent("b737:fmc-trajectory-preview",{detail:{key,valid:!!value}}));return !!value;}
 function getPreview(session){return preview?.key&&preview.key===sessionKey(session)&&Date.now()-preview.at<5000?preview.value:null;}
 return Object.freeze({solve,limits,air,casAtMach,crossover,geoAt,positionAtDistance,publishPreview,getPreview,sessionKey});
})(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737TrajectoryPredictorV1=api;})(typeof globalThis==='object'?globalThis:null);
