/* Scripted TCAS II 7.1 instructor model, not DO-185B collision-avoidance logic.
 * FCOM SHI 10.30.12-13, 10.32.29-34, 15.20.29-32; EUROCONTROL ACAS Guide 5.0.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B737ClassicTcasV1=api;})(globalThis,function(){
 'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),norm=x=>(x%360+360)%360;
 const RA=Object.freeze({
  CLIMB:{callout:'CLIMB, CLIMB',min:1500,max:null},
  DESCEND:{callout:'DESCEND, DESCEND',min:null,max:-1500},
  INCREASE_CLIMB:{callout:'INCREASE CLIMB, INCREASE CLIMB',min:2500,max:null,subsequent:true},
  INCREASE_DESCENT:{callout:'INCREASE DESCENT, INCREASE DESCENT',min:null,max:-2500,subsequent:true},
  REVERSAL_CLIMB:{callout:'CLIMB, CLIMB NOW, CLIMB, CLIMB NOW',min:1500,max:null,subsequent:true},
  REVERSAL_DESCEND:{callout:'DESCEND, DESCEND NOW, DESCEND, DESCEND NOW',min:null,max:-1500,subsequent:true},
  CROSSING_CLIMB:{callout:'CLIMB, CROSSING CLIMB, CLIMB, CROSSING CLIMB',min:1500,max:null},
  CROSSING_DESCEND:{callout:'DESCEND, CROSSING DESCEND, DESCEND, CROSSING DESCEND',min:null,max:-1500},
  LEVEL_OFF_CLIMB:{callout:'LEVEL OFF, LEVEL OFF',min:null,max:0},
  LEVEL_OFF_DESCENT:{callout:'LEVEL OFF, LEVEL OFF',min:0,max:null},
  MONITOR_CLIMB:{callout:'MONITOR VERTICAL SPEED',min:null,max:0,preventive:true},
  MONITOR_DESCENT:{callout:'MONITOR VERTICAL SPEED',min:0,max:null,preventive:true},
  MAINTAIN_CLIMB:{callout:'MAINTAIN VERTICAL SPEED, MAINTAIN',min:1500,max:null,maintain:true},
  MAINTAIN_DESCENT:{callout:'MAINTAIN VERTICAL SPEED, MAINTAIN',min:null,max:-1500,maintain:true},
  CROSSING_MAINTAIN_CLIMB:{callout:'MAINTAIN VERTICAL SPEED, CROSSING MAINTAIN',min:1500,max:null,maintain:true},
  CROSSING_MAINTAIN_DESCENT:{callout:'MAINTAIN VERTICAL SPEED, CROSSING MAINTAIN',min:null,max:-1500,maintain:true},
  MULTI_LEVEL:{callout:'LEVEL OFF, LEVEL OFF',min:-250,max:250}
 });
 const def=(label,ra,next=null,flags={})=>({label,ra,next,...flags});
 const SCENARIOS=Object.freeze({
  TA_ONLY:def('TA only / passing traffic',null),
  CLIMB:def('TA > CLIMB > LEVEL OFF','CLIMB','LEVEL_OFF_CLIMB'),
  DESCEND:def('TA > DESCEND > LEVEL OFF','DESCEND','LEVEL_OFF_DESCENT'),
  INCREASE_CLIMB:def('CLIMB > INCREASE CLIMB','CLIMB','INCREASE_CLIMB'),
  INCREASE_DESCENT:def('DESCEND > INCREASE DESCENT','DESCEND','INCREASE_DESCENT'),
  REVERSAL_CLIMB:def('DESCEND > CLIMB NOW (reversal)','DESCEND','REVERSAL_CLIMB'),
  REVERSAL_DESCEND:def('CLIMB > DESCEND NOW (reversal)','CLIMB','REVERSAL_DESCEND'),
  CROSSING_CLIMB:def('Altitude crossing climb','CROSSING_CLIMB'),
  CROSSING_DESCEND:def('Altitude crossing descent','CROSSING_DESCEND'),
  LEVEL_OFF_CLIMB:def('LEVEL OFF while climbing','LEVEL_OFF_CLIMB'),
  LEVEL_OFF_DESCENT:def('LEVEL OFF while descending','LEVEL_OFF_DESCENT'),
  MONITOR_CLIMB:def('Preventive: do not climb','MONITOR_CLIMB'),
  MONITOR_DESCENT:def('Preventive: do not descend','MONITOR_DESCENT'),
  MAINTAIN_CLIMB:def('Maintain climb (>=1500 fpm)','MAINTAIN_CLIMB'),
  MAINTAIN_DESCENT:def('Maintain descent (<=-1500 fpm)','MAINTAIN_DESCENT'),
  CROSSING_MAINTAIN_CLIMB:def('Maintain crossing climb','CROSSING_MAINTAIN_CLIMB'),
  CROSSING_MAINTAIN_DESCENT:def('Maintain crossing descent','CROSSING_MAINTAIN_DESCENT'),
  MULTI_THREAT:def('Multiple threats / level-off corridor','MULTI_LEVEL',null,{multi:true}),
  NO_BEARING:def('No-bearing threat','CLIMB',null,{noBearing:true}),
  OFFSCALE:def('Offscale threat','CLIMB',null,{offscale:true}),
  NO_ALTITUDE:def('Non-altitude-reporting traffic (TA only)',null,null,{noAltitude:true})
 });
 function thresholds(own,mode='TA_RA'){
  const a=Number.isFinite(own.pressureAltitudeFt)?own.pressureAltitudeFt:own.altitudeFt,h=own.radioAltitudeFt;
  if(mode==='TA_ONLY'||h<1000)return {sl:2,taSec:20,raSec:null,taNm:.30,raNm:null,taFt:850,raFt:null,alimFt:null};
  const row=h<2350?[3,25,15,.33,.20,850,600,300]:a<5000?[4,30,20,.48,.35,850,600,300]:
   a<10000?[5,40,25,.75,.55,850,600,350]:a<20000?[6,45,30,1,.8,850,600,400]:
   a<42000?[7,48,35,1.3,1.1,850,700,600]:[7,48,35,1.3,1.1,1200,800,700];
  const [sl,taSec,raSec,taNm,raNm,taFt,raFt,alimFt]=row;return {sl,taSec,raSec,taNm,raNm,taFt,raFt,alimFt};
 }
 function gates(own,mode='TA_RA',priorityWarning=false){
  const height=own?.radioAltitudeFt;
  const valid=own?.airborne===true&&Number.isFinite(height)&&Number.isFinite(own.altitudeFt)&&Number.isFinite(own.tasKt)&&own.tasKt>0&&Number.isFinite(own.pitchDeg)&&Number.isFinite(own.vsFpm);
  const reasons=[];
  if(!valid)reasons.push('AIRBORNE FLIGHT / RADIO ALTITUDE REQUIRED');
  if(priorityWarning)reasons.push('GPWS / WINDSHEAR PRIORITY');
  if(height<1000)reasons.push('RA INHIBIT BELOW 1000 FT RA');
  if(mode==='TA_ONLY')reasons.push('TA ONLY SELECTED');
  return {valid,raAllowed:valid&&height>=1000&&mode==='TA_RA'&&!priorityWarning,
   voiceAllowed:valid&&height>=500&&!priorityWarning,
   descendAllowed:height>=1100,increaseDescentAllowed:height>=1500,
   effectiveMode:mode==='TA_RA'&&valid&&height<1000?'TA_ONLY':mode,reasons};
 }
 function pitchForVs(vs,own){
  // Training flight-path-to-pitch conversion retains observed pitch/AoA.
  const speed=Math.max(own.tasKt*6076.11549/60,1);
  const gamma=v=>Math.asin(clamp(v/speed,-.7,.7))*180/Math.PI;
  return clamp(own.pitchDeg+gamma(vs)-gamma(own.vsFpm),-35,35);
 }
 function guidance(id,own){
  const raw=RA[id];if(!raw)return null;
  const r={...raw,id};
  if(raw.maintain){
   if(id.includes('CLIMB'))r.min=Math.max(1500,own.vsFpm-250);
   else r.max=Math.min(-1500,own.vsFpm+250);
  }
  r.avoid=[];
  if(r.min!==null)r.avoid.push({side:'BELOW',pitchDeg:pitchForVs(r.min,own)});
  if(r.max!==null)r.avoid.push({side:'ABOVE',pitchDeg:pitchForVs(r.max,own)});
  return r;
 }
 function evaluate({scenario='CLIMB',elapsedSec=0,own,mode='TA_RA',priorityWarning=false,powered=true}={}){
  if(!SCENARIOS[scenario])throw RangeError('UNKNOWN_TCAS_SCENARIO');
  const g=gates(own,mode,priorityWarning),spec=SCENARIOS[scenario];
  const out={schema:'B737_CLASSIC_TCAS_OUTPUT_V1',version:'7.1',source:'SCRIPTED_INSTRUCTOR_ENCOUNTER',
   mode:powered?g.effectiveMode:'FAIL',altitudeSource:Number.isFinite(own?.pressureAltitudeFt)?'PRESSURE_ALTITUDE':'SCENARIO_MSL_SURROGATE',stage:'OFF',advisory:null,ra:null,targets:[],callout:null,
   voiceAllowed:g.voiceAllowed&&powered,inhibits:[...g.reasons],thresholds:g.valid?thresholds(own,g.effectiveMode):null,complete:false};
  if(!powered||!g.valid||['OFF','FAIL'].includes(mode))return out;
  if(mode==='TEST')return {...out,stage:'TEST',targets:[
   {kind:'RA',bearing:own.trueHeadingDeg-10,distance:2,relativeAltitude:-200,verticalRate:1000},
   {kind:'TA',bearing:own.trueHeadingDeg+10,distance:3,relativeAltitude:200,verticalRate:-1000},
   {kind:'PROX',bearing:own.trueHeadingDeg+20,distance:4,relativeAltitude:500,verticalRate:0},
   {kind:'OTHER',bearing:own.trueHeadingDeg-20,distance:5,relativeAltitude:1500,verticalRate:0}]};
  const taDuration=Math.max(10,out.thresholds.taSec-(out.thresholds.raSec??10));
  const first=3+taDuration,change=first+7,end=first+18,clear=end+5;
  let kind=elapsedSec<3?'OTHER':elapsedSec<first?'TA':elapsedSec<end&&spec.ra?'RA':elapsedSec<end?'TA':'PROX';
  let id=kind==='RA'?(elapsedSec>=change&&spec.next?spec.next:spec.ra):null;
  if(kind==='RA'&&!g.raAllowed){kind='TA';id=null;}
  if(id&&RA[id].max!==null&&RA[id].max<0&&!g.descendAllowed){kind='TA';id=null;out.inhibits.push('DESCEND INHIBIT BELOW 1100 FT RA');}
  if(id==='INCREASE_DESCENT'&&!g.increaseDescentAllowed){id='DESCEND';out.inhibits.push('INCREASE DESCENT INHIBIT BELOW 1500 FT RA');}
  if(id&&RA[id].maintain&&((id.includes('CLIMB')&&own.vsFpm<1500)||(id.includes('DESCENT')&&own.vsFpm> -1500))){
   id=id.includes('CLIMB')?'CLIMB':'DESCEND';out.inhibits.push('MAINTAIN REQUIRES EXISTING VERTICAL RATE');
  }
  if(spec.noAltitude&&own.altitudeFt>=15500){kind='OTHER';id=null;out.inhibits.push('NON-ALTITUDE TRAFFIC TA INHIBIT AT / ABOVE FL155');}
  if(priorityWarning){kind='PROX';id=null;}
  out.stage=elapsedSec>=end?'CLEAR':kind;out.complete=elapsedSec>=clear;
  out.advisory=kind==='RA'?'RA':kind==='TA'?'TA':null;
  out.ra=id?guidance(id,own):null;
  out.callout=elapsedSec>=end&&spec.ra?'CLEAR OF CONFLICT':out.ra?.callout??(kind==='TA'?'TRAFFIC, TRAFFIC':null);
  const below=spec.ra&&(/CLIMB/.test(spec.ra))?-200:200;
  const target={kind,bearing:spec.noBearing?null:norm((own.trueTrackDeg??own.trueHeadingDeg)+15),
   distance:spec.offscale?Math.max(45,90-elapsedSec):Math.max(.4,(out.thresholds.taSec+3-elapsedSec)*.12),
   relativeAltitude:spec.noAltitude?null:below,verticalRate:spec.noAltitude?null:below<0?800:-800};
  if(kind==='OTHER'&&target.distance<=6&&Math.abs(target.relativeAltitude??Infinity)<=1200){target.kind='PROX';out.stage='PROX';}
  if(!out.complete){out.targets=[target];if(spec.multi)out.targets.push({...target,bearing:norm(target.bearing-30),relativeAltitude:-below});}
  return out;
 }
 return Object.freeze({RA,SCENARIOS,thresholds,gates,pitchForVs,guidance,evaluate});
});
