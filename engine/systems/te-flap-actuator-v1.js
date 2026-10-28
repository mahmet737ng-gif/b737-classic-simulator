/* B737 Classic simulated trailing-edge flap actuator, calibrated placeholder values.
 * Owner-supplied 2026-10-28 estimates, NOT aircraft-certified travel limits:
 * 0->1 20 s; 1->2 15 s; 2->5 12 s; 15->40 total 4.5 s.
 * Directional timings symmetric until owner supplies stopwatch data.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737TEFlapActuatorV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const STOPS=Object.freeze([0,1,2,5,10,15,25,30,40]);
 const DEFAULT_SECONDS=Object.freeze([20,15,12,9,7,2,1.25,1.25]);
 const EPS=1e-8;
 function initialState(){
  return {schema:'b737-te-flap-actuator/1',revision:0,command:0,actual:0,
   hydraulicB:true,pressurePsi:3000,elapsedSeconds:0,segmentSeconds:[...DEFAULT_SECONDS]};
 }
 function validate(s){if(!s||s.schema!=='b737-te-flap-actuator/1')throw Error('Invalid flap actuator state');}
 const pressureFactor=s=>s.hydraulicB?Math.max(0,Math.min(1.10,s.pressurePsi/3000)):0;
 function segment(pos,direction){
  for(let i=0;i<STOPS.length-1;i++){
   if(direction>0&&pos>=STOPS[i]-EPS&&pos<STOPS[i+1]-EPS)return i;
   if(direction<0&&pos>STOPS[i]+EPS&&pos<=STOPS[i+1]+EPS)return i;
  }
  return -1;
 }
 function apply(prev,action){
  validate(prev);
  if(!action||typeof action.type!=='string')throw Error('Actuator action required');
  if(action.type==='RESET')return initialState();
  const s={...prev,segmentSeconds:[...prev.segmentSeconds]};
  switch(action.type){
   case 'COMMAND':
    if(!STOPS.includes(action.value))throw Error('Invalid flap lever detent');
    s.command=action.value;break;
   case 'HYDRAULIC':
    if(typeof action.value!=='boolean')throw Error('Hydraulic B must be boolean');
    s.hydraulicB=action.value;break;
   case 'PRESSURE':
    if(typeof action.psi!=='number'||!Number.isFinite(action.psi)||action.psi<0||action.psi>3500)throw Error('Invalid hydraulic pressure');
    s.pressurePsi=action.psi;break;
   case 'CALIBRATE':{
    const i=STOPS.findIndex((v,k)=>k<STOPS.length-1&&v===action.from&&STOPS[k+1]===action.to);
    if(i<0||typeof action.seconds!=='number'||!Number.isFinite(action.seconds)||action.seconds<.25||action.seconds>120)throw Error('Invalid flap segment calibration');
    s.segmentSeconds[i]=action.seconds;break;
   }
   case 'TICK':{
    let remaining=action.seconds;
    if(typeof remaining!=='number'||!Number.isFinite(remaining)||remaining<0||remaining>60)throw Error('Invalid tick seconds');
    const factor=pressureFactor(s);
    // Segment-wise integration supports target changes mid-flight and either direction.
    for(let guard=0;remaining>EPS&&factor>0&&guard<64;guard++){
     const dir=Math.sign(s.command-s.actual);
     if(!dir)break;
     const index=segment(s.actual,dir);
     if(index<0)throw Error('Flap actuator outside calibrated envelope');
     const low=STOPS[index],high=STOPS[index+1];
     const limit=dir>0?Math.min(high,s.command):Math.max(low,s.command);
     const rate=(high-low)/s.segmentSeconds[index]*factor;
     const distance=Math.abs(limit-s.actual);
     if(distance<=EPS){s.actual=Number(limit.toFixed(8));continue;}
     const needed=distance/rate;
     const dt=Math.min(remaining,needed);
     s.actual=Number((s.actual+dir*Math.min(distance,rate*dt)).toFixed(8));
     if(Math.abs(limit-s.actual)<EPS)s.actual=limit;
     remaining-=dt;
    }
    s.elapsedSeconds+=action.seconds;
    break;
   }
   default:throw Error('Unknown flap actuator action');
  }
  s.revision++;
  return s;
 }
 function estimate(state,from,to){
  validate(state);
  if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||from>40||to<0||to>40)throw Error('Invalid travel range');
  if(from===to)return 0;
  const lo=Math.min(from,to),hi=Math.max(from,to),factor=pressureFactor(state);
  if(factor===0)return Infinity;
  let total=0;
  for(let i=0;i<DEFAULT_SECONDS.length;i++){
   const portion=Math.max(0,Math.min(hi,STOPS[i+1])-Math.max(lo,STOPS[i]));
   total+=portion/(STOPS[i+1]-STOPS[i])*state.segmentSeconds[i]/factor;
  }
  return Number(total.toFixed(4));
 }
 function evaluate(s){validate(s);return {command:s.command,actual:s.actual,hydraulicB:s.hydraulicB,
  pressurePsi:s.pressurePsi,pressureFactor:pressureFactor(s),moving:Math.abs(s.command-s.actual)>EPS&&pressureFactor(s)>0,
  nominalRemainingSeconds:estimate(s,s.actual,s.command),revision:s.revision};}
 return Object.freeze({STOPS,DEFAULT_SECONDS,initialState,apply,evaluate,estimate});
});
