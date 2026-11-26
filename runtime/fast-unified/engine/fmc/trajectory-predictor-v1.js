/* B737 Classic Unified: training-only trajectory solver. No certified dispatch use. */
(function(root){const api=(function makeTrajectory(){
 "use strict";
 const f=Number.isFinite,clamp=(x,l,h)=>Math.max(l,Math.min(h,x)),rad=Math.PI/180;
 const n=v=>typeof v==="number"&&f(v)?v:null;
 const at=v=>{const m=/^(FL)?(\d{2,5})$/.exec(String(v||""));return m?+m[2]*(m[1]?100:1):null};
 function limits(text){
  const [sp="",al=""]=String(text||"").split("/");
  let lo=0,hi=41000, speed=null,mach=null;
  const m=/^(FL\d{2,3}|\d{3,5})([AB])?(?:(FL\d{2,3}|\d{3,5})B)?$/.exec(al);
  if(m){const x=at(m[1]);if(m[2]!=="B")lo=x;if(m[2]!=="A")hi=x;if(m[3])hi=at(m[3]);}
  if(/^\d{2,3}$/.test(sp)&&+sp>=100&&+sp<=350)speed=+sp;
  if(/^\.\d{2,3}$/.test(sp)&&+sp>=.3&&+sp<=.82)mach=+sp;
  return {lo,hi,speed,mach};
 }
 function atmosphere(ft,isa){const h=clamp(ft,-1000,41000)*.3048,t=288.15-.0065*Math.min(11000,h),p=101325*(t/288.15)**5.25588*Math.exp(-Math.max(0,h-11000)*9.80665/(287.05287*216.65));return {p,t:Math.max(150,t+isa)}}
 function air(cas,ft,isa){const {p,t}=atmosphere(ft,isa),q=101325*((1+.2*(cas/661.4788)**2)**3.5-1),mach=Math.sqrt(5*((1+q/p)**(2/7)-1));return {mach,tas:mach*Math.sqrt(1.4*287.05287*t)/.514444};}
 function casAtMach(m,ft){const {p}=atmosphere(ft,0),q=p*((1+.2*m*m)**3.5-1);return 661.4788*Math.sqrt(5*((1+q/101325)**(2/7)-1))}
 function solve(o){
  const {legs,startFt,endFt,crz,gw,fuelKg,ci,isa=0,windFromDeg=0,windKt=0,transitionAltitudeFt=18000,nowMs,origin,dest,complete=true,onGround=false}=o;
  if(!Array.isArray(legs)||!legs.length||legs.length>501||![startFt,crz,gw,fuelKg,ci,isa,windFromDeg,windKt].every(f)||gw<=fuelKg||fuelKg<0||crz<1000||crz>41000||ci<0||ci>200||startFt< -1000||startFt>41000||windKt<0||windKt>250||complete&&(!f(endFt)||endFt< -1000||endFt>41000))return null;
  if(legs.some(l=>!f(l.segmentNm)||l.segmentNm<0||!f(l.courseTrueDeg)))return null;
  // Explicit approximate point-mass training envelope, never AFM-certified.
  const wf=clamp(gw/55000,.7,1.5),up=clamp(340/wf,220,460),down=350;
  const dist=[0],cs=[{lo:startFt,hi:startFt,speed:null,mach:null}];
  for(const l of legs){dist.push(dist.at(-1)+l.segmentNm);cs.push(limits(l.constraint));}
  const last=dist.length-1,total=dist[last],cap=Math.max(crz,startFt,complete?endFt:0);
  if(complete){cs[last].lo=Math.max(cs[last].lo===0?-1000:cs[last].lo,endFt);cs[last].hi=Math.min(cs[last].hi,endFt);}
  const hi=cs.map((c,i)=>Math.min(c.hi, i===0?startFt:cap));
  for(let i=1;i<=last;i++)hi[i]=Math.min(hi[i],hi[i-1]+up*(dist[i]-dist[i-1]));
  for(let i=last-1;i>=0;i--)hi[i]=Math.min(hi[i],hi[i+1]+down*(dist[i+1]-dist[i]));
  const conflicts=cs.map((c,i)=>hi[i]<c.lo-1?{index:i-1,ident:legs[i-1]?.ident||origin,minFt:c.lo,reachableFt:hi[i]}:null).filter(Boolean);
  if(conflicts.length)return {quality:"UNABLE",reason:"ALTITUDE_CONSTRAINT_UNREACHABLE",conflicts,waypoints:[],origin,dest,transitionAltitudeFt};
  const altitude=(i,x)=>Math.min(cap,hi[i-1]+up*(x-dist[i-1]),hi[i]+down*(dist[i]-x));
  const maxAltitudeFt=Math.max(...hi,...legs.map((l,i)=>{const a=i+1,x=clamp((hi[a]-hi[a-1]+up*dist[a-1]+down*dist[a])/(up+down),dist[a-1],dist[a]);return altitude(a,x)}));
  const phaseAt=(ft,gradient,remaining)=>gradient>1?"CLIMB":gradient< -1?"DESCENT":ft>=crz-100?"CRUISE":remaining<Math.max(0,ft-(endFt??0))/down+15?"DESCENT":"CLIMB";
  function schedule(phase,ft,course,weight,restriction){
   const provided=o.speedAt?.(phase,ft,course,weight,restriction);
   let cas=f(provided)?provided:Math.min((phase==="CRUISE"?255:250)*Math.sqrt(weight/50000)+ci*.25,casAtMach(.74+ci*.0003,ft),340);
   if(ft<10000)cas=Math.min(cas,250);
   if(f(restriction?.speed))cas=Math.min(cas,restriction.speed);
   if(f(restriction?.mach))cas=Math.min(cas,casAtMach(restriction.mach,ft));
   return clamp(cas,100,340);
  }
  const phaseSpeeds=Object.fromEntries(["CLIMB","CRUISE","DESCENT"].map(p=>[p,schedule(p,p==="CRUISE"?crz:Math.min(crz,12000),legs[0].courseTrueDeg,gw,null)]));
  const records=[],samples=[],markers={};let burn=onGround?100:0,seconds=0,previousPhase=null;
  for(let i=1;i<=last;i++){
   const l=legs[i-1],from=dist[i-1],to=dist[i],cross=clamp((hi[i]-hi[i-1]+up*from+down*to)/(up+down),from,to);
   const breaks=[from,to,cross,clamp(from+(cap-hi[i-1])/up,from,to),clamp(to-(cap-hi[i])/down,from,to)];
   for(let x=from+5;x<to;x+=5)breaks.push(x);
   const xs=[...new Set(breaks)].sort((a,b)=>a-b);
   let phase=phaseAt(hi[i],(hi[i]-hi[i-1])/Math.max(.001,to-from),total-to);
   for(let j=1;j<xs.length;j++){
    const a=xs[j-1],b=xs[j],dx=b-a;if(dx<1e-8)continue;
    const h1=altitude(i,a),h2=altitude(i,b),mid=(h1+h2)/2,grad=(h2-h1)/dx;
    phase=phaseAt(mid,grad,total-(a+b)/2);
    if(phase==="CRUISE"&&previousPhase==="CLIMB"&&!markers.tc)markers.tc={distanceNm:a,altitudeFt:h1,etaMs:f(nowMs)?nowMs+seconds*1000:null};
    if(phase==="DESCENT"&&previousPhase==="CRUISE"&&!markers.td)markers.td={distanceNm:a,altitudeFt:h1,etaMs:f(nowMs)?nowMs+seconds*1000:null};
    previousPhase=phase;
    const mass=Math.max(gw-fuelKg,gw-burn);
    // Start slowing ahead of a crossing speed restriction (approximate clean deceleration).
    const restriction=cs[i],distanceLeft=to-(a+b)/2;
    const maxCas=restriction.speed!==null?Math.sqrt(restriction.speed**2+3500*distanceLeft):null;
    const cas=schedule(phase,mid,l.courseTrueDeg,mass,{speed:maxCas,mach:distanceLeft<2?restriction.mach:null});
    const {tas,mach}=air(cas,mid,isa),head=windKt*Math.cos((windFromDeg-l.courseTrueDeg)*rad),crosswind=windKt*Math.sin((windFromDeg-l.courseTrueDeg)*rad);
    const gs=Math.sqrt(Math.max(0,tas*tas-crosswind*crosswind))-head;
    if(!f(gs)||gs<=30)return {quality:"UNAVAILABLE",reason:"WIND_OR_SPEED_UNREACHABLE",waypoints:[],origin,dest};
    const hours=dx/gs,weightFactor=clamp(mass/55000,.7,1.5);
    const tableFlow=o.fuelFlowAt?.(phase,mid,cas,mach,mass);
    const flow=f(tableFlow)&&tableFlow>0?tableFlow:(phase==="CLIMB"?3800:phase==="DESCENT"?1250:2450+2*ci)*weightFactor;
    burn+=flow*hours;seconds+=hours*3600;
    samples.push({distanceNm:b,altitudeFt:h2,phase,casKt:Math.round(cas),mach,tasKt:tas,gsKt:gs,fuelKg:Math.max(0,fuelKg-burn),elapsedSec:seconds});
   }
   const ft=hi[i],cas=schedule(phase,ft,l.courseTrueDeg,Math.max(gw-fuelKg,gw-burn),cs[i]),a=air(cas,ft,isa);
   const etaMs=f(nowMs)?nowMs+seconds*1000:null,eta=etaMs!==null?new Date(etaMs).toISOString().slice(11,16).replace(":","")+"Z":null;
   records.push({...l,index:l.index??i-1,distanceNm:to,phase,altitudeFt:Math.round(ft),predictedIasKt:Math.round(cas),predictedMach:a.mach,tasKt:a.tas,etaMs,eta,fuelKg:Math.max(0,fuelKg-burn),grossWeightKg:Math.max(gw-fuelKg,gw-burn),speedRestrictionKt:cs[i].speed,forecastWindFromDeg:windFromDeg,forecastWindKt:windKt});
  }
  const remaining=fuelKg-burn,reserve=o.reservesKg,warnings=complete?[...(remaining<900?["INSUFFICIENT FUEL"]:[]),...(f(reserve)&&remaining<reserve?["USING RSV FUEL"]:[])]:[];
  const destination=complete?{...records.at(-1),ident:dest,distanceNm:total}:null;
  const ceilingReached=maxAltitudeFt>=crz-1;
  return {quality:"TRAINING_ESTIMATE",source:"UNIFIED_TRAJECTORY_V1",reason:complete?"TRAINING_APPROXIMATION":"PARTIAL_ROUTE",origin,dest,ready:true,complete,crz,gw,ci,isa,windFromDeg,windKt,transitionAltitudeFt,waypoints:records,profile:samples,phaseSpeeds,active:records[0]??null,next:records[1]??null,destination,maxAltitudeFt,cruiseReached:ceilingReached,topOfClimb:markers.tc??null,topOfDescent:markers.td??null,topOfDescentNm:markers.td?.distanceNm??null,requiredFuelKg:complete?burn:null,remainingFuelRawKg:complete?remaining:null,fuelAtDestinationKg:destination?.fuelKg??null,reserveWarnings:warnings,reserveWarning:warnings[0]??null,assumptions:["TRAINING_CLIMB_DESCENT_ENVELOPE","CLEAN_AIRCRAFT","PHASE_FUEL_MODEL",...(o.assumedDestinationAltitude?["DEST_ALT_ASSUMED"]:[])]};
 }
 return Object.freeze({solve,limits,air,casAtMach});
})();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737TrajectoryPredictorV1=api;})(typeof globalThis==='object'?globalThis:null);
