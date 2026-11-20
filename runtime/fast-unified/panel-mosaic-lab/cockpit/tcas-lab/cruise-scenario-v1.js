/* TCAS Encounter Lab only: synthetic FMC cruise route and background traffic.
 * Coordinates are NM in a local tangent plane, never published as NAV DATA.
 * Advisory classification stays with the TCAS engine: the ambient targets
 * are visualization-only and cannot trigger instructor TA/RA decisions.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.B737TcasCruiseScenarioV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const rad=x=>x*Math.PI/180,norm=x=>(x%360+360)%360;
 const FIXES=Object.freeze([
  {name:'REKPA',eastNm:0,northNm:7.4},
  {name:'VABER',eastNm:1.5,northNm:17.5},
  {name:'DOKIT',eastNm:4.2,northNm:29.0},
  {name:'TOLRA',eastNm:7.8,northNm:45.0},
  {name:'SIBEN',eastNm:10.8,northNm:67.0},
  {name:'LEMDA',eastNm:13.0,northNm:98.0}
 ]);
 const TRAFFIC=Object.freeze([
  {id:'OTHER-1',bearing:329,distanceNm:5.1,altitudeDeltaFt:1800,verticalRateFpm:0,headingDeg:8,speedKt:455},
  {id:'OTHER-2',bearing:28,distanceNm:8.4,altitudeDeltaFt:-1600,verticalRateFpm:350,headingDeg:330,speedKt:425},
  {id:'OTHER-3',bearing:133,distanceNm:16.0,altitudeDeltaFt:2400,verticalRateFpm:0,headingDeg:75,speedKt:410},
  {id:'OTHER-4',bearing:232,distanceNm:24.0,altitudeDeltaFt:-2300,verticalRateFpm:-550,headingDeg:190,speedKt:455}
 ]);
 const start={eastNm:0,northNm:0};
 const length=(a,b)=>Math.hypot(b.eastNm-a.eastNm,b.northNm-a.northNm);
 function position(distanceNm){
  let distance=Math.max(0,distanceNm),prior=start;
  for(let i=0;i<FIXES.length;i++){
   const next=FIXES[i],len=length(prior,next),headingDeg=norm(Math.atan2(next.eastNm-prior.eastNm,next.northNm-prior.northNm)*180/Math.PI);
   if(distance<len||i===FIXES.length-1){
    const fraction=Math.min(1,distance/len);
    return {eastNm:prior.eastNm+(next.eastNm-prior.eastNm)*fraction,
     northNm:prior.northNm+(next.northNm-prior.northNm)*fraction,
     headingDeg,nextIndex:i};
   }
   distance-=len;prior=next;
  }
  return {eastNm:0,northNm:0,headingDeg:0,nextIndex:0};
 }
 function timeText(totalSec){
  const total=Math.max(0,Math.round(totalSec));
  const mm=Math.floor(total/60),ss=total%60;
  return String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0');
 }
 function utcText(simSeconds){
  const utcMinutes=Math.floor((12*3600+simSeconds)/60);
  return String(Math.floor(utcMinutes/60)%24).padStart(2,'0')+
    String(utcMinutes%60).padStart(2,'0')+'Z';
 }
 function route({elapsedSec=0,groundSpeedKt=445}={}){
  const seconds=Math.max(0,Number(elapsedSec)||0),gs=Math.max(1,Number(groundSpeedKt)||1);
  const own=position(seconds*gs/3600),remaining=FIXES.slice(own.nextIndex);
  const next=remaining[0],distance=next?Math.hypot(next.eastNm-own.eastNm,next.northNm-own.northNm):0;
  const etaSeconds=seconds+distance/gs*3600,eta=utcText(etaSeconds),ttg=timeText(distance/gs*3600);
  const points=[{name:'',x:0,y:0,hidden:true,leg:'ACTIVE'},
   ...remaining.map((f,i)=>({
    name:f.name,x:f.eastNm-own.eastNm,y:f.northNm-own.northNm,
    leg:'ACTIVE',altitude:'',eta:i===0?eta:''
   }))];
  return {own,nav:{valid:true,timeToGo:ttg,estimatedArrival:eta},
   route:{source:'TCAS_LAB_SIMULATED_FMC',activeIndex:1,centerIndex:1,points},
   next:next?.name??'END',distanceNm:distance,timeToGo:ttg,eta,
   utc:utcText(seconds)};
 }
 function ambient({elapsedSec=0,ownAltitudeFt=27000,initialAltitudeFt=27000,ownGroundSpeedKt=445}={}){
  const seconds=Math.max(0,Number(elapsedSec)||0),ownTrack=route({elapsedSec:seconds,groundSpeedKt:ownGroundSpeedKt}).own;
  return TRAFFIC.map(t=>{
   const angle=rad(t.bearing),hdg=rad(t.headingDeg);
   const north=t.distanceNm*Math.cos(angle)+t.speedKt*seconds/3600*Math.cos(hdg)-ownTrack.northNm;
   const east=t.distanceNm*Math.sin(angle)+t.speedKt*seconds/3600*Math.sin(hdg)-ownTrack.eastNm;
   const delta=(initialAltitudeFt+t.altitudeDeltaFt+t.verticalRateFpm*seconds/60)-ownAltitudeFt;
   return {id:t.id,kind:'OTHER',bearing:norm(Math.atan2(east,north)*180/Math.PI),
    distance:Math.hypot(north,east),relativeAltitude:delta,verticalRate:t.verticalRateFpm,
    verticalRelation:'AMBIENT',displayAltitude:null,source:'SYNTHETIC_BACKGROUND'};
  });
 }
 return Object.freeze({FIXES,TRAFFIC,position,route,ambient,utcText,timeText});
});
