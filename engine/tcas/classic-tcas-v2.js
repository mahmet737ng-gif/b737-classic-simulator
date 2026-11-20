/* Classic TCAS encounter plant. Sources: owner's FCOM SHI 10.30/10.32,
 * 11.10.27-33, SP.11.1, 15.10.19-26, 15.20.29-32; MRG CL pp136,173,188,373.
 * Nominal 40/25s warning model and pitch conversion are instructor approximations.
 * No external ACAS threshold table, DO-185 implementation or WDM is claimed. */
(function(root,factory){const api=factory(root.B737ClassicTcasV1||(typeof require==='function'?require('./classic-tcas-v1.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;root.B737ClassicTcasV2=api;})(globalThis,function(V1){
 'use strict';
 const norm=n=>(n%360+360)%360,rad=n=>n*Math.PI/180,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const copy=x=>JSON.parse(JSON.stringify(x));
 const DEFAULT_FEEDS=Object.freeze({xpdr1:true,xpdr2:true,adc1:true,adc2:true,radioAlt:true,irs:true,aligned:true,computer:true});
 const MODES=['STBY','ALT_OFF','ALT_ON','TA_ONLY','TA_RA','TEST'];
 const legacy=Object.fromEntries(Object.entries(V1.SCENARIOS).map(([id,s])=>[id,{...s,label:s.label,vertical:'LEVEL'}]));
 const SCENARIOS=Object.freeze({...legacy,
  CLIMB:{...legacy.CLIMB,label:'TA > CLIMB > CLEAR OF CONFLICT'},
  DESCEND:{...legacy.DESCEND,label:'TA > DESCEND > CLEAR OF CONFLICT'},
  SAME_LEVEL:{label:'Same level / zero vertical rate',ra:'CLIMB',vertical:'LEVEL',relativeAltitude:0},
  CONVERGING_ABOVE:{label:'Above / descending toward own altitude',ra:'DESCEND',vertical:'CONVERGING',relativeAltitude:900},
  CONVERGING_BELOW:{label:'Below / climbing toward own altitude',ra:'CLIMB',vertical:'CONVERGING',relativeAltitude:-900},
  DIVERGING_ABOVE:{label:'Above / climbing away',ra:null,vertical:'DIVERGING',relativeAltitude:900},
  DIVERGING_BELOW:{label:'Below / descending away',ra:null,vertical:'DIVERGING',relativeAltitude:-900},
  NO_TRANSPONDER:{label:'Intruder transponder OFF / invisible',ra:null,noTransponder:true},
  INVALID_RA:{label:'MRG suppression-interface failure / own echo',ra:null,invalidRa:true},
  DISPLAY_TYPES:{label:'Traffic symbol / altitude / trend demonstration',ra:null,demo:true}
 });
 function controls(){return {mode:'TA_RA',unit:1,altSource:1,code:'2000',filter:'NORM',rangeNm:5,identUntil:0,absoluteUntil:0,
  failures:{computer:false,xpdr1:false,xpdr2:false,antenna:false,adc1:false,adc2:false,radioAlt:false,irs:false,suppression1:false,suppression2:false},priorityWarning:false};}
 function transponder(c,own,feeds=DEFAULT_FEEDS){
  if(!MODES.includes(c.mode)||![1,2].includes(c.unit)||![1,2].includes(c.altSource))throw RangeError('TRANSPONDER_SELECTION');
  if(!/^[0-7]{4}$/.test(c.code))throw RangeError('SQUAWK_REQUIRES_FOUR_OCTAL_DIGITS');
  const f=c.failures||{},power=feeds['xpdr'+c.unit]===true,failed=f['xpdr'+c.unit]===true||!power;
  const adc=feeds['adc'+c.altSource]===true&&f['adc'+c.altSource]!==true;
  const enabled=c.mode!=='STBY'&&!failed;
  const surveillance=['TA_ONLY','TA_RA'].includes(c.mode)&&enabled&&!f.computer&&!f.antenna&&feeds.computer===true;
  const altitudeReporting=enabled&&adc&&!['ALT_OFF','TEST'].includes(c.mode)&&own.airborne===true;
  return {selectedUnit:c.unit,altitudeSource:c.altSource,code:c.code,displayedCode:c.mode==='TEST'&&power?'8888':c.code,mode:c.mode,powered:power,failed,
   modeS:enabled,modeAC:enabled&&own.airborne===true,altitudeReporting,altitudeValid:adc,
   transmittedAltitudeFt:altitudeReporting?(own.pressureAltitudeFt??own.altitudeFt):null,
   surveillance,raCapable:surveillance&&adc&&c.mode==='TA_RA',
   ident:(own.elapsedSec??0)<c.identUntil,absolute:(own.elapsedSec??0)<c.absoluteUntil,
   test:c.mode==='TEST',atcFailLight:failed||c.mode==='TEST'};
 }
 function vector(speed,heading){return {n:Math.cos(rad(heading))*speed/3600,e:Math.sin(rad(heading))*speed/3600};}
 function offset(anchor,own){
  return Number.isFinite(anchor.lat)&&Number.isFinite(own.lat)&&Number.isFinite(anchor.lon)&&Number.isFinite(own.lon)?
   {n:(own.lat-anchor.lat)*60,e:(own.lon-anchor.lon)*60*Math.cos(rad(anchor.lat))}:{n:0,e:0};
 }
 function create(id,own,options={}){
  const spec=SCENARIOS[id];if(!spec)throw RangeError('UNKNOWN_TCAS_SCENARIO');
  for(const [key,value] of Object.entries(options)){
   if(key==='converging'||key==='progressive'){if(typeof value!=='boolean')throw RangeError('INVALID_INTRUDER_'+key);continue;}
   if(key==='lateralSide'){if(!['LEFT','RIGHT'].includes(value))throw RangeError('INVALID_INTRUDER_lateralSide');continue;}
   if(!Number.isFinite(value))throw RangeError('INVALID_INTRUDER_'+key);
  }
  if(options.distanceNm!==undefined&&options.distanceNm<=0)throw RangeError('INVALID_INTRUDER_DISTANCE');
  const heading=own.trueTrackDeg??own.trueHeadingDeg??0,forward=vector(1,heading),side=vector(1,heading+90);
  const converging=options.converging===true&&id!=='TA_ONLY';
  // Lab-only sequence: choose a physically intersecting relative trajectory at
  // cruise while keeping the alert thresholds untouched.  A crossing aircraft
  // with a similar GS gives an initial OTHER -> PROX -> TA -> RA progression.
  // Passing traffic remains a lateral near miss even if CONVERGING was checked.
  const stagedProgression=options.progressive===true&&!spec.demo&&!spec.offscale;
  const progressive=stagedProgression&&!converging;
  const range=options.distanceNm??(stagedProgression?8.2:5.5);
  // Converging traffic flies across the OWN flight path, arriving from the
  // chosen left/right side at horizontal CPA. Its relative altitude crosses
  // from -300 to +300 ft (or reverse) during the approach without manual VS.
  // A passing-traffic TA is an actual lateral near-miss: inside the TA
  // distance envelope, outside the RA envelope. Do not suppress RA solely
  // because of a scenario label; an explicit CONVERGING override may still
  // generate a genuine RA.
  const limits=V1.thresholds(own,'TA_RA');
  const passingMiss=(limits.taNm+limits.raNm)/2;
  const lateral=id==='TA_ONLY'&&!converging?passingMiss:(spec.ra===null?.72:0);
  let speedKt=options.speedKt??(progressive?(own.gsKt??own.tasKt):220);
  let targetHeading=norm(heading+(progressive?40:180));
  let initialN=forward.n*3600*range+side.n*3600*lateral;
  let initialE=forward.e*3600*range+side.e*3600*lateral;
  let estimatedCpaSec=range*3600/Math.max(1,(own.gsKt??own.tasKt)+speedKt);
  if(progressive){
   const ownV=vector(own.gsKt??own.tasKt,heading),intruderV=vector(speedKt,targetHeading);
   const relN=intruderV.n-ownV.n,relE=intruderV.e-ownV.e;
   const relSpeed=Math.max(1e-6,Math.hypot(relN,relE));
   estimatedCpaSec=range/relSpeed;
   initialN=-relN*estimatedCpaSec-relE/relSpeed*lateral;
   initialE=-relE*estimatedCpaSec+relN/relSpeed*lateral;
  }
  if(converging){
   // At cruise a shallow real crossing with matched GS gives an early
   // WHITE -> PROX -> TA -> RA trajectory instead of an immediate red alert.
   const crossingAngle=stagedProgression?40:90;
   targetHeading=norm(heading+(options.lateralSide==='LEFT'?crossingAngle:-crossingAngle));
   if(stagedProgression&&options.speedKt===undefined)speedKt=own.gsKt??own.tasKt;
   const ownV=vector(own.gsKt??own.tasKt,heading),intruderV=vector(speedKt,targetHeading);
   const relN=intruderV.n-ownV.n,relE=intruderV.e-ownV.e;
   estimatedCpaSec=range/Math.max(1e-6,Math.hypot(relN,relE));
   initialN=-relN*estimatedCpaSec;
   initialE=-relE*estimatedCpaSec;
  }
  const sense=spec.ra?.includes('CLIMB')?1:spec.ra?.includes('DESCEN')?-1:
   spec.vertical==='CONVERGING'&&spec.relativeAltitude>0?-1:1;
  const relative=options.relativeAltitudeFt??(converging?-(stagedProgression?600:300)*sense:
   spec.relativeAltitude??(spec.ra?.includes('CLIMB')?-200:200));
  let rate=options.verticalRateFpm??(converging?
   (own.vsFpm??0)-2*relative*60/estimatedCpaSec:
   spec.vertical==='CONVERGING'?-Math.sign(relative)*1200:
   spec.vertical==='DIVERGING'?Math.sign(relative)*1200:0);
  const target={id:'INTRUDER1',n:initialN,e:initialE,
   altitudeFt:own.altitudeFt+relative,speedKt,headingDeg:targetHeading,verticalRate:rate,
   reportsAltitude:!spec.noAltitude,transponder:!spec.noTransponder,bearingValid:!spec.noBearing};
  if(spec.offscale){target.n=Math.cos(rad(heading+45))*range;target.e=Math.sin(rad(heading+45))*range;target.headingDeg=norm(heading+270);target.speedKt=own.gsKt??own.tasKt;}
  const targets=[target];if(spec.multi)targets.push({...target,id:'INTRUDER2',altitudeFt:own.altitudeFt-relative,n:target.n+.4,e:target.e-.4});
  if(spec.demo){targets.splice(0,1,...[
   {id:'OTHER',distance:7,relative:1800,vr:0,angle:-22},{id:'PROX',distance:5,relative:-1000,vr:-700,angle:22},
   {id:'TA',distance:3,relative:500,vr:0,angle:-12},{id:'RA',distance:1.6,relative:-500,vr:800,angle:12}
  ].map(x=>({...target,id:x.id,n:Math.cos(rad(heading+x.angle))*x.distance,e:Math.sin(rad(heading+x.angle))*x.distance,
   altitudeFt:own.altitudeFt+x.relative,verticalRate:x.vr,demoKind:x.id,speedKt:0})));}
  return {schema:'B737_CLASSIC_TCAS_ENCOUNTER_V2',scenario:id,anchor:{lat:own.lat,lon:own.lon},targets,time:0,
   ownN:0,ownE:0,firstRaTime:null,raId:null,hadRA:false,clearTime:0,cleared:false,maneuvered:false,output:null};
 }
 function geometry(state,t,own){
  const p=offset(state.anchor,own),ov=vector(own.gsKt??own.tasKt,own.trueTrackDeg??own.trueHeadingDeg),iv=vector(t.speedKt,t.headingDeg);
  const n=t.n-p.n-state.ownN,e=t.e-p.e-state.ownE,distance=Math.hypot(n,e),vn=iv.n-ov.n,ve=iv.e-ov.e;
  const vv=vn*vn+ve*ve,dot=n*vn+e*ve,tcpa=vv>1e-10?-dot/vv:Infinity;
  const cpaTime=Number.isFinite(tcpa)?Math.max(0,tcpa):0;
  const miss=Math.hypot(n+vn*cpaTime,e+ve*cpaTime);
  const relative=t.altitudeFt-own.altitudeFt,relativeRate=t.verticalRate-own.vsFpm;
  return {id:t.id,bearing:t.bearingValid?norm(Math.atan2(e,n)*180/Math.PI):null,distance,
   relativeAltitude:t.reportsAltitude?relative:null,absoluteAltitudeFt:t.reportsAltitude?t.altitudeFt:null,
   verticalRate:t.reportsAltitude?t.verticalRate:null,relativeVerticalRate:t.reportsAltitude?relativeRate:null,
   verticalRelation:Math.abs(relativeRate)<1?'LEVEL_RATE':relative*relativeRate<0?'CONVERGING':'DIVERGING',
   tcpaSec:tcpa,missDistanceNm:miss,relativeSpeedKt:Math.sqrt(vv)*3600,
   closingKt:distance>.0001?-dot/distance*3600:0,
   predictedSeparationFt:t.reportsAltitude?Math.abs(relative+relativeRate*cpaTime/60):null};
 }
 // Simultaneous future horizontal/vertical protected-volume approach
 // under constant relative velocity. Not a certified TCAS II algorithm.
 function trajectoryIntersection(g,radiusNm,verticalFt){
  if(!Number.isFinite(radiusNm)||radiusNm<=0)return {timeSec:Infinity,reason:'INVALID_THRESHOLD'};
  const speed=g.relativeSpeedKt/3600;
  let hEnter=0,hExit=Infinity;
  if(speed<1e-8){
   if(g.distance>radiusNm)return {timeSec:Infinity,reason:'HORIZONTAL_MISS'};
  }else{
   const perp=Math.sqrt(Math.max(0,g.distance*g.distance-(speed*g.tcpaSec)**2));
   if(perp>radiusNm)return {timeSec:Infinity,reason:'HORIZONTAL_MISS'};
   const dt=Math.sqrt(Math.max(0,radiusNm*radiusNm-perp*perp))/speed;
   hEnter=Math.max(0,g.tcpaSec-dt);hExit=g.tcpaSec+dt;
   if(hExit<0||hExit<hEnter)return {timeSec:Infinity,reason:'HORIZONTAL_PASSED'};
  }
  if(g.relativeAltitude===null||verticalFt===null)
   return {timeSec:hEnter,exitSec:hExit,reason:'HORIZONTAL_ONLY'};
  const alt=g.relativeAltitude,rate=g.relativeVerticalRate/60;
  let vEnter=0,vExit=Infinity;
  if(Math.abs(rate)<1e-8){
   if(Math.abs(alt)>verticalFt)return {timeSec:Infinity,reason:'VERTICAL_MISS'};
  }else{
   const times=[(-verticalFt-alt)/rate,(verticalFt-alt)/rate].sort((a,b)=>a-b);
   vEnter=Math.max(0,times[0]);vExit=times[1];
   if(vExit<0||vExit<vEnter)return {timeSec:Infinity,reason:'VERTICAL_PASSED'};
  }
  const entry=Math.max(hEnter,vEnter),exit=Math.min(hExit,vExit);
  if(entry>exit)return {timeSec:Infinity,reason:'NO_3D_OVERLAP'};
  return {timeSec:entry,exitSec:exit,reason:'PREDICTED_3D_PROXIMITY'};
 }
 function output(state,own,c=controls(),feeds=DEFAULT_FEEDS){
  const spec=SCENARIOS[state.scenario],xpdr=transponder(c,own,feeds),f=c.failures||{},height=own.radioAltitudeFt;
  const thresholds=V1.thresholds(own,c.mode);
  const flightValid=own.airborne===true&&[own.altitudeFt,own.vsFpm,own.pitchDeg,own.tasKt].every(Number.isFinite)&&own.tasKt>0;
  const radioValid=Number.isFinite(height)&&!f.radioAlt&&feeds.radioAlt===true;
  const irsValid=!f.irs&&feeds.irs===true;
  const testOk=!xpdr.failed&&!f.computer&&!f.antenna&&feeds.computer===true&&irsValid&&feeds.aligned===true;
  const inhibits=[];
  let mode=c.mode==='STBY'||['ALT_OFF','ALT_ON'].includes(c.mode)?'OFF':c.mode==='TEST'?'TEST':c.mode;
  if(xpdr.failed||f.computer||f.antenna||feeds.computer!==true)mode='FAIL';
  if(!flightValid&&c.mode!=='TEST')inhibits.push('AIRBORNE FLIGHT DATA REQUIRED');
  if(!radioValid||height<1000){if(mode==='TA_RA')mode='TA_ONLY';inhibits.push(radioValid?'RA INHIBIT <1000 FT RA':'RADIO ALTITUDE INVALID / RA INHIBIT');}
  if(!xpdr.altitudeValid){if(mode==='TA_RA')mode='TA_ONLY';inhibits.push('SELECTED ADC INVALID / ALTITUDE REPORTING LOST');}
  if(!irsValid)inhibits.push('IRS BEARING / ATTITUDE INVALID');
  if(c.priorityWarning)inhibits.push('GPWS / WINDSHEAR PRIORITY');
  const out={schema:'B737_CLASSIC_TCAS_OUTPUT_V2',source:'FCOM_MRG_KINEMATIC_TRAINER',mode,stage:'MONITOR',advisory:null,
   ra:null,targets:[],callout:null,transponder:xpdr,inhibits,voiceAllowed:flightValid&&radioValid&&height>=500&&!c.priorityWarning,
   nominalTaSec:thresholds.taSec,nominalRaSec:thresholds.raSec,complete:false,clearOfConflict:false};
  if(mode==='TEST')return {...out,stage:testOk?'TEST OK':'TEST FAIL',callout:testOk?'TCAS SYSTEM TEST OK':'TCAS SYSTEM TEST FAIL',
   voiceAllowed:true,targets:testOk?[{kind:'RA',bearing:own.trueHeadingDeg+12,distance:2,relativeAltitude:-500,verticalRate:600},
    {kind:'TA',bearing:own.trueHeadingDeg-12,distance:3,relativeAltitude:500,verticalRate:0},
    {kind:'PROX',bearing:own.trueHeadingDeg+24,distance:4,relativeAltitude:-1000,verticalRate:-600},
    {kind:'OTHER',bearing:own.trueHeadingDeg-24,distance:5,relativeAltitude:1800,verticalRate:0}]:[]};
  if(['OFF','FAIL'].includes(mode)||!flightValid||!xpdr.surveillance)return out;
  const raAllowed=mode==='TA_RA'&&radioValid&&height>=1000&&xpdr.altitudeValid&&!c.priorityWarning;
  for(const t of state.targets){
   if(!t.transponder)continue;
   const g=geometry(state,t,own),alt=g.relativeAltitude,pred=g.predictedSeparationFt;
   let kind=g.distance<=6&&alt!==null&&Math.abs(alt)<=1200?'PROX':'OTHER';
   // CPA/tau warning times and SL-specific DMOD/ZTHR protection envelopes
   // are both required; present altitude difference alone is never an RA.
   const taPrediction=trajectoryIntersection(g,thresholds.taNm??.75,thresholds.taFt??850);
   const raPrediction=trajectoryIntersection(g,thresholds.raNm??.55,thresholds.raFt??600);
   const separatingSafely=g.verticalRelation==='DIVERGING'&&
    pred!==null&&pred>=thresholds.raFt;
   const ta=!separatingSafely&&taPrediction.timeSec<=(thresholds.taSec??0);
   const threat=alt!==null&&!separatingSafely&&raPrediction.timeSec<=(thresholds.raSec??-1);
   g.timeToTaProximitySec=Number.isFinite(taPrediction.timeSec)?taPrediction.timeSec:null;
   g.timeToRaProximitySec=Number.isFinite(raPrediction.timeSec)?raPrediction.timeSec:null;
   g.predictionReason=threat?raPrediction.reason:taPrediction.reason;
   g.timeToCoAltitudeSec=alt===null?null:
    (alt*g.relativeVerticalRate<0?-60*alt/g.relativeVerticalRate:null);
   if(ta)kind='TA';if(threat&&raAllowed)kind='RA';
   if(spec.demo)kind=t.demoKind==='RA'&&!raAllowed?'TA':t.demoKind;
   if(c.priorityWarning&&(kind==='RA'||kind==='TA'))kind='PROX';
   if(!irsValid)g.bearing=null;
   const band=c.filter==='ABOVE'?[-2700,9900]:c.filter==='BELOW'?[-9900,2700]:[-2700,2700];
   // Threats remain visible regardless of the selected non-threat altitude band.
   if(alt!==null&&(alt<band[0]||alt>band[1])&&!['TA','RA'].includes(kind))continue;
   out.targets.push({...g,kind,displayAltitude:xpdr.absolute&&g.absoluteAltitudeFt!==null?Math.round(g.absoluteAltitudeFt/100):null});
  }
  if(((spec.invalidRa&&c.unit===1)||f['suppression'+c.unit])&&xpdr.surveillance){
   out.targets.push({id:'OWN_ECHO',kind:'RA',bearing:own.trueHeadingDeg,distance:0,relativeAltitude:0,verticalRate:0,invalidEcho:true});
   out.advisory='RA';out.stage='INVALID RA / SUPPRESSION INTERFACE';out.voiceAllowed=false;out.invalidRa=true;
   return out;
  }
  const threats=out.targets.filter(t=>t.kind==='RA'),tas=out.targets.filter(t=>t.kind==='TA');
  if(threats.length){
   state.cleared=false;state.clearTime=0;state.hadRA=true;
   if(state.firstRaTime===null)state.firstRaTime=state.time;
   let id=state.raId||spec.ra||(threats[0].relativeAltitude>=0?'DESCEND':'CLIMB');
   const age=state.time-state.firstRaTime;
   if(spec.next&&age>=7){
    const next=spec.next;
    if(next.startsWith('REVERSAL')){
     const min=next.includes('CLIMB')?1500:-1500;
     const now=threats[0],horizon=clamp(now.tcpaSec,1,25);
     const projected=rate=>Math.abs(now.relativeAltitude+(now.verticalRate-rate)*horizon/60);
     if(projected(min)>projected(-min))id=next;
    }else if(next.startsWith('INCREASE')&&threats.some(t=>t.predictedSeparationFt<400))id=next;
    // Keep the initial sense until measured separation permits recovery;
    // an elapsed timer alone must not weaken a live conflict.
   }
   if(id.includes('DESCEN')&&height<1100){id='MONITOR_DESCENT';inhibits.push('DESCEND INHIBIT <1100 FT RA');}
   if(id==='INCREASE_DESCENT'&&height<1500){id='DESCEND';inhibits.push('INCREASE DESCENT INHIBIT <1500 FT RA');}
   if(id.includes('MAINTAIN')&&(id.includes('CLIMB')?own.vsFpm:-own.vsFpm)<1500)id=id.includes('CLIMB')?'CLIMB':'DESCEND';
   state.raId=id;out.ra=V1.guidance(id,own);out.advisory='RA';out.stage=id;out.callout=out.ra?.callout;
  }else if(state.hadRA&&state.clearTime>=2){
   state.cleared=true;out.clearOfConflict=true;out.stage='CLEAR OF CONFLICT';out.callout='CLEAR OF CONFLICT';
  }else if(tas.length){out.advisory='TA';out.stage='TA';out.callout=state.hadRA?null:'TRAFFIC, TRAFFIC';}
  return out;
 }
 function step(prior,own,dt,c=controls(),feeds=DEFAULT_FEEDS){
  const s=copy(prior);dt=clamp(Number(dt)||0,0,2);s.time+=dt;
  if(!Number.isFinite(s.anchor.lat)||!Number.isFinite(own.lat)){
   const v=vector(own.gsKt??own.tasKt,own.trueTrackDeg??own.trueHeadingDeg);s.ownN+=v.n*dt;s.ownE+=v.e*dt;
  }
  const spec=SCENARIOS[s.scenario];
  if(spec.next?.startsWith('REVERSAL')&&s.firstRaTime!==null&&s.time-s.firstRaTime>=7&&!s.maneuvered){
   for(const t of s.targets)t.verticalRate=spec.next==='REVERSAL_CLIMB'?-3000:3000;s.maneuvered=true;
  }
  for(const t of s.targets){const v=vector(t.speedKt,t.headingDeg);t.n+=v.n*dt;t.e+=v.e*dt;t.altitudeFt+=t.verticalRate*dt/60;}
  s.output=output(s,own,c,feeds);
  if(s.hadRA&&!s.output.targets.some(t=>t.kind==='RA'))s.clearTime+=dt;else s.clearTime=0;
  return s;
 }
 return Object.freeze({MODES,SCENARIOS,controls,transponder,create,step,output,geometry,trajectoryIntersection,nominalThresholds:{taSec:40,raSec:25},pitchForVs:V1.pitchForVs});
});
