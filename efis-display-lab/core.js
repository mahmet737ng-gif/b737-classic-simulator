/* EFIS DISPLAY LAB 0001 — training only, event-driven, no flight use.
 * Source register: B737CL FCOM Vol.2 10.30.6-14; 10.31.2-...; 10.40.9-11.
 * Data tagged SIM is not a live aircraft signal. Visual acceptance is pending.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.EFISDisplayLabCore=api;})(typeof globalThis==='object'?globalThis:null,function(){
'use strict';
const VERSION='EFIS-DISPLAY-LAB-0004';
const MODES=['FULL_VOR_ILS','EXP_VOR_ILS','FULL_NAV','EXP_NAV','MAP','CTR_MAP','PLAN'];
const RANGES=[10,20,40,80,160,320];
const FCOM='https://boredaviator.com/wp-content/uploads/2025/03/B737-300-FCOM-.pdf';
const items=[
 ['eadi','fma','FMA — 4 mode zones','10.30.6 / Ch.4','RULE_ONLY',[0,0,100,14],'Unified FMA engine with instructor MCP/FCC scenarios'],
 ['eadi','bank','Bank scale / moving pointer','10.30.6','RULE_ONLY',[25,15,53,16],'0/10/20/30/45/60 degree markings'],
 ['eadi','attitude','Pitch ladder / horizon / black L aircraft','10.30.6–7','VISUAL_PENDING',[25,22,53,62],'Classic 10-degree numerals; pixel registration pending'],
 ['eadi','slip','Slip/skid indicator','10.30.8','VISUAL_PENDING',[36,85,29,5],'Injected simulated slip'],
 ['eadi','speed','IAS tape / speed bug / Mach','10.30.7, 10.30.10–12','RULE_ONLY',[2,26,24,55],'Actual MCP/ADC/stall margins not yet bridged'],
 ['eadi','grounds','Groundspeed indication','10.30.7','RULE_ONLY',[3,88,25,7],'FMC/IRS input currently simulated'],
 ['eadi','fd','Flight director command bars','10.30.7 / Ch.4','RULE_ONLY',[26,36,50,42],'Shown only on valid selected FD command'],
 ['eadi','gs','Glideslope deviation','10.30.7','RULE_ONLY',[83,28,16,47],'Invalid signal/backcourse blanks pointer'],
 ['eadi','loc','Localizer deviation','10.30.8','RULE_ONLY',[34,88,40,10],'Invalid LOC blanks pointer'],
 ['eadi','dh','Decision height / RA color','10.30.9–10; 10.40.4–5','RULE_ONLY',[76,77,23,19],'RA warning, reset, and DH+75 restoration'],
 ['eadi','runway','Rising runway','10.30.10; 10.40.4','VISUAL_PENDING',[40,66,25,21],'Appears with valid LOC and RA below 2500 ft; rises below 200 ft'],
 ['eadi','pli','Pitch limit indicator','10.30.7','VISUAL_PENDING',[35,19,30,15],'Lack of stall computer input: illustrative only'],
 ['eadi','tcas','TCAS RA pitch limits','10.30.9','VISUAL_PENDING',[25,22,53,62],'Red avoid region; precise extent pending source verification'],
 ['eadi','alerts','Windshear / PULL UP','10.30.10, 10.30.14','RULE_ONLY',[29,54,43,23],'Alert message injection only'],
 ['eadi','flags','Failure flags / comparator','10.30.13–14','RULE_ONLY',[16,11,73,78],'Source transfer and injected opposite-side comparison'],
 ['ehsi','mode','7 selector modes / orientation','10.40.9–11','RULE_ONLY',[2,0,96,15],'Availability varies by airplane equipment'],
 ['ehsi','rose','Rose / arc / cardinal references','10.31.2–6','VISUAL_PENDING',[5,14,90,76],'Heading-up vs track-up vs true-north'],
 ['ehsi','heading','Heading bug / track indicator','10.31.2–5','RULE_ONLY',[26,6,48,24],'Independent HDG/TRK inputs'],
 ['ehsi','route','Active route / waypoint symbols','10.31.2–5','VISUAL_PENDING',[14,22,72,64],'SYNTHETIC geometry; not FMC route'],
 ['ehsi','course','VOR/ILS CDI / source','10.40.11; 10.31.x','RULE_ONLY',[19,25,63,64],'Navigation validity and course source checks'],
 ['ehsi','dme','VOR DME / active fix information','10.40.10–11','RULE_ONLY',[1,80,98,19],'Injected data, independent VOR/ILS/FMC sources'],
 ['ehsi','opts','WPT / ARPT / NAVAID selections','10.30.3–4','RULE_ONLY',[3,20,94,71],'WPT non-route database points only at <=40 NM'],
 ['ehsi','wxr','WXR / TERR selector exclusion','10.30.4; 10.40.11','RULE_ONLY',[5,63,88,28],'Mode, remote selection, validity and synthetic test packets'],
 ['ehsi','tfc','TCAS traffic overlay','10.30.4; 10.31.x','VISUAL_PENDING',[65,11,30,27],'Injected RA, TA, proximate and other traffic'],
 ['ehsi','fail','Power / SG / IRS / NAV flags','10.30.13–14; 10.40','RULE_ONLY',[10,34,80,39],'Fail-safe simplified; CB source mapping pending']
].map(([display,id,name,folio,status,box,note])=>({display,id,name,folio,status,box,note}));
function clamp(v,min,max){const x=Number(v);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):min;}
function norm(v){return ((Number(v)||0)%360+360)%360;}
function initial(){
 return {seat:'CAPT',power:{eadi:true,ehsi:true,sg1:true,sg2:true,source:'NORMAL',att:true,heading:true,track:true,adc:true,nav:true,loc:true,gs:true,ra:true,fd:true,dhData:true,selSpeed:true,v1Data:true,speedLimit:true,machData:true,irsLeft:true,irsRight:true,irsSource:'NORMAL',eadiThermal:'NORMAL',ehsiThermal:'NORMAL',fmcTrack:true,remoteWxr:false,wxrHealthy:true,terrainHealthy:true,mapRange:true,wxrRange:true,terrainRange:true},
 eadi:{brightness:1,pitch:0,bank:0,slip:0,ias:220,selectedSpeed:230,mach:.55,groundSpeed:310,radioAlt:800,dh:200,descent:true,fd:true,fdPitch:4,fdRoll:0,locDev:.3,gsDev:-.3,frontCourse:true,tcas:'OFF',windshear:false,pullup:false,pli:false,at:'FMC SPD',pitchMode:'VNAV PTH',rollMode:'LNAV',afds:'CMD',machVisible:true,dhReset:false,heightReset:false,dhLatched:false,otherPitch:0,otherBank:0,fdAuto:false,locCaptured:false,gsCaptured:false,fmcVerticalValid:true,altAcquire:false,apEngaged:false,locExcessive:false,tcasLimit:6,phase:'CRUISE',flaps:0,armedPitch:'',armedRoll:'',acceleration:0,pliAngle:17,v1:121,vr:125,vref:136,demoLimits:false,minManeuver:135,shaker:120,vmo:340,gearState:'UP',flap30MaximumKt:180,speedSource:'AUTO',fmcCommandSpeed:230,retractSpeed:155,flapsUpSpeed:205},
 ehsi:{mode:'MAP',range:40,heading:240,track:245,selectedHeading:252,course:233,options:{wpt:true,arpt:false,navAid:false,vorAdf:false,rteData:false,tfc:false,wxr:false,terr:false},showSyntheticRoute:true,brightness:1,wxBrightness:1,navType:'VOR',vorFreq:116.8,ilsFreq:110.1,autoTune:false,dme:13.5,fmcCourse:238,xtk:.7,vorDev:2.5,toFrom:'FROM',vnav:0,vnavActive:false,planStep:1,wxrReturns:false,terrainReturns:false,tcMode:'TA_RA',traffic:false,trueAirspeed:230,windDirection:127,windSpeed:20,trueRef:false,altitude:8500,selectedAltitude:10000,verticalSpeed:1400,altitudeArc:false,tcFailSuppressed:false},
 audit:Object.fromEntries(items.map(x=>[x.display+'.'+x.id,'PENDING']))};
}
function activeSg(s){const which=s.power.source==='SG1'?'sg1':s.power.source==='SG2'?'sg2':s.seat==='FO'?'sg2':'sg1';return !!s.power[which];}
function seatSource(s){
 const sg=s.power.source==='NORMAL'?(s.seat==='FO'?'SG2':'SG1'):s.power.source;
 const irs=s.power.irsSource==='NORMAL'?(sg==='SG1'?'LEFT':'RIGHT'):s.power.irsSource;
 return {sg,irs,irsValid:irs==='LEFT'?s.power.irsLeft:s.power.irsRight};
}
function compare(s){
 const {power:p,eadi:e}=s;
 if(p.irsSource!=='NORMAL')return [];
 if(p.source!=='NORMAL'||!p.irsLeft||!p.irsRight||!p.att)return ['COMP'];
 return [Math.abs(e.pitch-e.otherPitch)>3?'PITCH':null,Math.abs(e.bank-e.otherBank)>3?'ROLL':null].filter(Boolean);
}
function evaluate(s){
 const e=s.eadi,p=s.power,source=seatSource(s),sg=activeSg(s),ra=p.ra?e.radioAlt:null;
 const powered=p.eadi&&p.eadiThermal!=='BLANK';
 const valid=powered&&sg,attitude=valid&&p.att&&source.irsValid;
 const ils=s.ehsi.navType==='ILS',loc=valid&&ils&&p.loc;
 const front=e.frontCourse&&Math.abs(((s.ehsi.track-s.ehsi.course+540)%360)-180)<=90;
 const raDigital=valid&&ra!==null&&ra<2500, dial=raDigital&&ra<1000;
 const dhArmed=p.dhData&&e.dh>=0&&!e.dhReset;
 const dhAlert=raDigital&&dhArmed&&ra>0&&(e.dhLatched||(e.descent&&ra<=e.dh));
 return {powered,raster:p.eadiThermal==='NORMAL',sg,source,attitude,ias:valid&&p.adc,
  fd:attitude&&p.fd&&(e.fd||e.fdAuto),ils,loc,locFlag:valid&&ils&&!p.loc,
  locExpanded:loc&&e.locCaptured&&Math.abs(e.locDev)>.5,
  locWarning:loc&&e.apEngaged&&e.locExcessive,
  gs:valid&&ils&&p.gs&&front,gsScale:valid&&ils,ra:raDigital,radioAlt:ra,dial,dhAlert,
  dhPointer:dial&&p.dhData&&e.dh>=0,dhDigital:valid&&ra!==null&&ra>=1000&&p.dhData&&e.dh>=0,
  heightAlert:dial&&ra>=500&&e.descent&&!e.heightReset,
  runway:loc&&raDigital,mach:valid&&p.adc&&p.machData&&e.machVisible,comparison:valid?compare(s):[],
  flags:[!attitude?'ATT':null,!p.adc?'SPD':null,!p.fd&&(e.fd||e.fdAuto)?'FD':null,
   valid&&ils&&!p.loc?'LOC':null,!p.ra?'RA':null,!p.dhData?'DH':null,
   !p.selSpeed?'SEL SPD':null,!p.v1Data?'V1 INOP':null,!p.speedLimit?'SPD LIM':null,!p.machData?'MACH':null].filter(Boolean)};
}
function ehsiModel(s){
 const e=s.ehsi,p=s.power,source=seatSource(s),sg=activeSg(s);
 const mode=MODES.includes(e.mode)?e.mode:'MAP',range=RANGES.includes(Number(e.range))?Number(e.range):40;
 const opts={...e.options,demoRoute:!!e.showSyntheticRoute};
 const fmcOk=!!p.nav&&p.mapRange;
 const pts=e.showSyntheticRoute&&fmcOk?[
  {name:'SADAF',x:-2.4,y:-6.6,altitude:'6500',eta:'1333Z'},
  {name:'KAVIR',x:-14.7,y:.85,altitude:'9000',eta:'1335Z'},
  {name:'NEMAT',x:-27.1,y:6.1,altitude:'12000',eta:'1338Z'},
  {name:'DARYA',x:-35,y:-5.3,altitude:'',eta:'1342Z'}]:[];
 const weatherMode=['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'].includes(mode);
 const wxrSelected=weatherMode&&opts.wxr&&p.remoteWxr;
 const terrainSelected=weatherMode&&opts.terr;
 const disagreements=[];
 if(!p.mapRange&&p.nav&&['MAP','CTR_MAP','PLAN','EXP_NAV'].includes(mode))disagreements.push('MAP');
 if(!p.wxrRange&&wxrSelected&&p.wxrHealthy)disagreements.push('WXR');
 if(!p.terrainRange&&terrainSelected&&p.terrainHealthy)disagreements.push('TERR');
 return {mode,range,heading:norm(e.heading),track:norm(e.track),selectedHeading:norm(e.selectedHeading),
  course:norm(mode.includes('VOR_ILS')?e.course:e.fmcCourse),trueRef:e.trueRef,
  trueAirspeed:e.trueAirspeed,windDirection:e.windDirection,windSpeed:e.windSpeed,groundSpeed:s.eadi.groundSpeed,bank:s.eadi.bank,
  altitudeArc:e.altitudeArc?{current:e.altitude,target:e.selectedAltitude,verticalSpeed:e.verticalSpeed}:null,
  nav:{valid:mode.includes('VOR_ILS')?(e.navType==='ILS'?!!p.loc:!!p.nav):fmcOk,
   type:e.navType,source:e.navType+(s.seat==='FO'?' 2':' 1'),dme:e.dme,
   frequency:e.autoTune?null:e.navType==='ILS'?e.ilsFreq:e.vorFreq,
   cdi:mode.includes('VOR_ILS')?(e.navType==='ILS'?s.eadi.locDev:e.vorDev/5):e.xtk/2,
   gsDev:s.eadi.gsDev,gsValid:e.navType==='ILS'&&p.gs&&e.frontCourse&&Math.abs(((e.track-e.course+540)%360)-180)<=90,
   toFrom:e.toFrom,vnavActive:e.vnavActive,vnav:e.vnav},
  route:{source:'SYNTHETIC',activeIndex:1,centerIndex:e.planStep,points:pts},
  options:opts,weather:{selected:wxrSelected,healthy:p.wxrHealthy,
   visible:wxrSelected&&p.wxrHealthy&&p.wxrRange&&e.wxrReturns&&p.ehsiThermal==='NORMAL',
   displayCooling:wxrSelected&&p.ehsiThermal==='RASTER_OFF',
   terrain:terrainSelected&&p.terrainHealthy&&p.terrainRange&&e.terrainReturns&&p.ehsiThermal==='NORMAL',
   terrainFailure:terrainSelected&&!p.terrainHealthy,disagreement:disagreements.join('/')},
  traffic:{mode:e.tcMode,failSuppressed:e.tcFailSuppressed,targets:e.traffic?[
   {kind:s.eadi.tcas==='OFF'?'TA':'RA',bearing:258,distance:5.3,relativeAltitude:300,verticalRate:-600},
   {kind:'TA',bearing:227,distance:9,relativeAltitude:-1200,verticalRate:650},
   {kind:'PROX',bearing:250,distance:3.5,relativeAltitude:-500,verticalRate:0},
   {kind:'OTHER',bearing:211,distance:15,relativeAltitude:null,verticalRate:0}]:[]},
  efis:{headingValid:!!p.heading&&source.irsValid,trackValid:!!p.track&&(p.fmcTrack||source.irsValid),
   trackSource:p.fmcTrack?'FMC':source.irsValid?'IRS '+source.irs:null,
   sgValid:!!sg,displayPower:p.ehsi&&p.ehsiThermal!=='BLANK',wxBrightness:clamp(e.wxBrightness,0,1),brightness:clamp(e.brightness,0,1)}};
}
function orientation(mode){return mode==='PLAN'?'TRUE_NORTH':mode.includes('VOR_ILS')?'HEADING_UP':'TRACK_UP';}
function apply(s,patch){const x=structuredCopy(s);if(patch.type==='reset')return initial();
 if(patch.type==='scenario'){
  if(patch.name==='normal')return initial();
  const fresh=initial(),e=fresh.eadi,p=fresh.power,h=fresh.ehsi;
  if(patch.name==='approach'){Object.assign(e,{radioAlt:120,ias:143,locDev:.2,gsDev:-.4,locCaptured:true,gsCaptured:true,gearState:'DOWN',phase:'APPROACH',flaps:30,demoLimits:true,rollMode:'VOR/LOC',pitchMode:'G/S'});Object.assign(h,{mode:'FULL_VOR_ILS',navType:'ILS',course:240});}
  if(patch.name==='takeoff'){Object.assign(e,{radioAlt:0,ias:119,selectedSpeed:150,fdPitch:12,phase:'TAKEOFF',flaps:5,demoLimits:true,minManeuver:109,shaker:101,at:'N1',pitchMode:'TO/GA',rollMode:'',afds:'FD',acceleration:1.8});}
  if(patch.name==='cruise'){Object.assign(e,{radioAlt:4500,mach:.75,ias:280,pitch:2});h.range=160;}
  if(patch.name==='tcas'){e.tcas='UP';e.radioAlt=350;h.traffic=true;h.options.tfc=true;h.range=20;}
  if(patch.name==='weather'){h.options.wxr=true;p.remoteWxr=true;h.wxrReturns=true;}
  if(patch.name==='terrain'){h.options.terr=true;h.terrainReturns=true;}
  if(patch.name==='failure'){p.sg1=false;}
  if(patch.name==='dark'){p.eadi=false;p.ehsi=false;}
  if(patch.name==='navfail'){p.nav=false;p.heading=false;p.track=false;}
  return fresh;
 } else if(patch.type==='seat'){
  if(!['CAPT','FO'].includes(patch.value))throw Error('BAD_SEAT');
  x.seat=patch.value;
 } else if(patch.type==='dhReset'){
  x.eadi.dhReset=true;x.eadi.dhLatched=false;x.eadi.heightReset=true;
 }
 else if(patch.type==='set'){
  const path=patch.path.split('.');if(path.length!==2||!Object.hasOwn(x,path[0])||!Object.hasOwn(x[path[0]],path[1]))throw Error('BAD_PATH '+patch.path);
  x[path[0]][path[1]]=patch.value;
  if(patch.path==='eadi.dh')x.eadi.dh=clamp(patch.value,-20,999);
  if(['eadi.brightness','ehsi.brightness','ehsi.wxBrightness'].includes(patch.path))x[path[0]][path[1]]=clamp(patch.value,0,1);
  if(patch.path==='eadi.mach')x.eadi.machVisible=Number(patch.value)>=.40?true:Number(patch.value)<.38?false:s.eadi.machVisible;
  const e=x.eadi;
  if(patch.path==='ehsi.tcMode')x.ehsi.tcFailSuppressed=false;
  if(patch.path==='eadi.radioAlt'){
   if(e.radioAlt>=1000)e.heightReset=false;
   if(e.radioAlt>=e.dh+75){e.dhReset=false;e.dhLatched=false;}
   if(e.radioAlt<=0){e.dhLatched=false;e.dhReset=true;}
   if(e.radioAlt>0&&e.radioAlt<=e.dh&&e.dh>=0&&e.descent&&!e.dhReset&&x.power.ra)e.dhLatched=true;
  }
  if(patch.path==='eadi.dh'){e.dhReset=false;e.dhLatched=false;}
  if(patch.path==='power.eadi'&&patch.value&&!s.power.eadi){e.dh=200;e.dhReset=false;e.dhLatched=false;e.heightReset=false;}

 }else if(patch.type==='option'){
  if(!Object.hasOwn(x.ehsi.options,patch.name))throw Error('BAD_OPTION');
  x.ehsi.options[patch.name]=!!patch.value;
  if(patch.name==='tfc'&&x.ehsi.tcMode==='FAIL')x.ehsi.tcFailSuppressed=!x.ehsi.tcFailSuppressed;
  if(patch.name==='wxr'&&patch.value)x.ehsi.options.terr=false;
  if(patch.name==='terr'&&patch.value)x.ehsi.options.wxr=false;
 }else if(patch.type==='audit'){
  const k=patch.key;if(!Object.hasOwn(x.audit,k))throw Error('BAD_AUDIT');x.audit[k]=patch.status;
 }else throw Error('BAD_EVENT');
 return x;
}
function structuredCopy(o){return JSON.parse(JSON.stringify(o));}
function selfTest(){
 const checks=[];const assert=(id,v)=>checks.push({id,pass:!!v});
 let s=initial();assert('Mach initially visible',evaluate(s).mach);
 s=apply(s,{type:'set',path:'eadi.mach',value:.37});assert('Mach below .38 disappears',!evaluate(s).mach);
 s=apply(s,{type:'set',path:'eadi.mach',value:.39});assert('Mach hysteresis retains blank',!evaluate(s).mach);
 s=apply(s,{type:'set',path:'eadi.mach',value:.40});assert('Mach at .40 reappears',evaluate(s).mach);
 s=apply(s,{type:'set',path:'eadi.radioAlt',value:100});assert('RA below DH is amber',evaluate(s).dhAlert);
 s=apply(s,{type:'dhReset'});assert('DH reset clears amber',!evaluate(s).dhAlert);
 s=apply(s,{type:'set',path:'eadi.radioAlt',value:300});assert('DH reset rearmed above DH+75',!s.eadi.dhReset);
 s=apply(s,{type:'set',path:'power.fd',value:false});assert('FD failure blanks bars',!evaluate(s).fd);
 const approach=apply(initial(),{type:'scenario',name:'approach'});
 const set=(state,path,value)=>apply(state,{type:'set',path,value});
 assert('Back course inhibits GS',evaluate(approach).gs&&!evaluate(set(approach,'eadi.frontCourse',false)).gs);
 assert('RA at 2500 blanks',!evaluate(set(approach,'eadi.radioAlt',2500)).ra);
 assert('Positive DH reads above 1000',evaluate(set(approach,'eadi.radioAlt',1250)).dhDigital);
 assert('RA below 1000 adds dial',evaluate(set(approach,'eadi.radioAlt',999)).dial);
 assert('RA at 1000 uses digital DH',!evaluate(set(approach,'eadi.radioAlt',1000)).dial);
 assert('Height alert at 700, ends below 500',evaluate(set(approach,'eadi.radioAlt',700)).heightAlert&&!evaluate(set(approach,'eadi.radioAlt',499)).heightAlert);
 assert('Runway already visible above 200',evaluate(set(approach,'eadi.radioAlt',1000)).runway);
 assert('Untuned EADI blanks ILS',!evaluate(initial()).loc);
 assert('TCAS scenario generates injected traffic',ehsiModel(apply(initial(),{type:'scenario',name:'tcas'})).traffic.targets.length===4);
 assert('Attitude difference exactly 3° accepted',compare(set(initial(),'eadi.otherPitch',3)).length===0);
 assert('Attitude difference above 3° flags PITCH',compare(set(initial(),'eadi.otherPitch',3.1)).includes('PITCH'));
 assert('Common SG flags comparator',compare(set(initial(),'power.source','SG2')).includes('COMP'));
 assert('IRS transfer inhibits disagreement',compare(set(set(initial(),'eadi.otherPitch',4),'power.irsSource','LEFT')).length===0);
 let restore=set(set(initial(),'eadi.dh',180),'power.eadi',false);
 restore=set(restore,'power.eadi',true);
 assert('EADI power restoration resets DH to 200',restore.eadi.dh===200);
 assert('EADI first thermal stage retains vector attitude',evaluate(set(initial(),'power.eadiThermal','RASTER_OFF')).attitude&&!evaluate(set(initial(),'power.eadiThermal','RASTER_OFF')).raster);
 assert('EADI second thermal stage blanks display',!evaluate(set(initial(),'power.eadiThermal','BLANK')).powered);
 assert('DH data failure blanks selection and alert',!evaluate(set(approach,'power.dhData',false)).dhAlert&&!evaluate(set(approach,'power.dhData',false)).dhPointer);
 assert('Mach failure does not blank CAS',!evaluate(set(initial(),'power.machData',false)).mach&&evaluate(set(initial(),'power.machData',false)).ias);
 assert('FMC track falls back to the selected IRS',ehsiModel(set(set(initial(),'power.fmcTrack',false),'power.irsSource','RIGHT')).efis.trackSource==='IRS RIGHT');
 s=apply(s,{type:'set',path:'power.sg1',value:false});assert('CAPT SG1 failure blanks',!evaluate(s).sg);
 s=apply(s,{type:'set',path:'power.source',value:'SG2'});assert('Transfer to SG2 available',evaluate(s).sg);
 s=apply(s,{type:'set',path:'power.eadi',value:false});assert('Power EADI fail dark',!evaluate(s).powered);
 const h=ehsiModel(initial());assert('MAP track-up',orientation(h.mode)==='TRACK_UP');
 assert('VOR heading-up',orientation('FULL_VOR_ILS')==='HEADING_UP');
 assert('PLAN north-up',orientation('PLAN')==='TRUE_NORTH');
 assert('WPT range <=40',!!h.options.wpt&&h.range<=40);
 s=apply(initial(),{type:'option',name:'wxr',value:true});s=apply(s,{type:'option',name:'terr',value:true});assert('TERR and WXR mutually exclusive',!s.ehsi.options.wxr&&s.ehsi.options.terr);
 return {pass:checks.every(x=>x.pass),checks};
}
return {VERSION,MODES,RANGES,FCOM,items,initial,clamp,norm,activeSg,seatSource,compare,evaluate,ehsiModel,orientation,apply,selfTest};
});
