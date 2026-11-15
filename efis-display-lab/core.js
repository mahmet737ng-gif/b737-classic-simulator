/* EFIS DISPLAY LAB 0001 — training only, event-driven, no flight use.
 * Source register: B737CL FCOM Vol.2 10.30.6-14; 10.31.2-...; 10.40.9-11.
 * Data tagged SIM is not a live aircraft signal. Visual acceptance is pending.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.EFISDisplayLabCore=api;})(typeof globalThis==='object'?globalThis:null,function(){
'use strict';
const VERSION='EFIS-DISPLAY-LAB-0002';
const MODES=['FULL_VOR_ILS','EXP_VOR_ILS','FULL_NAV','EXP_NAV','MAP','CTR_MAP','PLAN'];
const RANGES=[10,20,40,80,160,320];
const FCOM='https://boredaviator.com/wp-content/uploads/2025/03/B737-300-FCOM-.pdf';
const items=[
 ['eadi','fma','FMA — 4 mode zones','10.30.6 / Ch.4','RULE_ONLY',[0,0,100,14],'Manual injection; MCP/FCC integration pending'],
 ['eadi','bank','Bank scale / moving pointer','10.30.6','RULE_ONLY',[25,15,53,16],'0/10/20/30/45/60 degree markings'],
 ['eadi','attitude','Pitch ladder / horizon / black L aircraft','10.30.6–7','VISUAL_PENDING',[25,22,53,62],'Classic 10-degree numerals; pixel registration pending'],
 ['eadi','slip','Slip/skid indicator','10.30.8','VISUAL_PENDING',[36,85,29,5],'Injected simulated slip'],
 ['eadi','speed','IAS tape / speed bug / Mach','10.30.7, 10.30.10–12','RULE_ONLY',[2,26,24,55],'Actual MCP/ADC/stall margins not yet bridged'],
 ['eadi','grounds','Groundspeed indication','10.30.7','RULE_ONLY',[3,88,25,7],'FMC/IRS input currently simulated'],
 ['eadi','fd','Flight director command bars','10.30.7 / Ch.4','RULE_ONLY',[26,36,50,42],'Shown only on valid selected FD command'],
 ['eadi','gs','Glideslope deviation','10.30.7','RULE_ONLY',[83,28,16,47],'Invalid signal/backcourse blanks pointer'],
 ['eadi','loc','Localizer deviation','10.30.8','RULE_ONLY',[34,88,40,10],'Invalid LOC blanks pointer'],
 ['eadi','dh','Decision height / RA color','10.30.7','RULE_ONLY',[76,77,23,19],'RA warning, reset, and DH+75 restoration'],
 ['eadi','runway','Rising runway','10.30.7','VISUAL_PENDING',[40,66,25,21],'Requires valid LOC/RA and RA below 200 ft'],
 ['eadi','pli','Pitch limit indicator','10.30.7','VISUAL_PENDING',[35,19,30,15],'Lack of stall computer input: illustrative only'],
 ['eadi','tcas','TCAS RA pitch limits','10.30.9','VISUAL_PENDING',[25,22,53,62],'Red avoid region; precise extent pending source verification'],
 ['eadi','alerts','Windshear / PULL UP','10.30.10, 10.30.14','RULE_ONLY',[29,54,43,23],'Alert message injection only'],
 ['eadi','flags','Failure flags / comparator','10.30.13–14','RULE_ONLY',[16,11,73,78],'Source validity; dual-seat comparator deferred'],
 ['ehsi','mode','7 selector modes / orientation','10.40.9–11','RULE_ONLY',[2,0,96,15],'Availability varies by airplane equipment'],
 ['ehsi','rose','Rose / arc / cardinal references','10.31.2–6','VISUAL_PENDING',[5,14,90,76],'Heading-up vs track-up vs true-north'],
 ['ehsi','heading','Heading bug / track indicator','10.31.2–5','RULE_ONLY',[26,6,48,24],'Independent HDG/TRK inputs'],
 ['ehsi','route','Active route / waypoint symbols','10.31.2–5','VISUAL_PENDING',[14,22,72,64],'SYNTHETIC geometry; not FMC route'],
 ['ehsi','course','VOR/ILS CDI / source','10.40.11; 10.31.x','RULE_ONLY',[19,25,63,64],'Navigation validity and course source checks'],
 ['ehsi','dme','VOR DME / active fix information','10.40.10–11','RULE_ONLY',[1,80,98,19],'Synthetic nav input'],
 ['ehsi','opts','WPT / ARPT / NAVAID selections','10.30.3–4','RULE_ONLY',[3,20,94,71],'WPT non-route database points only at <=40 NM'],
 ['ehsi','wxr','WXR / TERR selector exclusion','10.30.4; 10.40.11','RULE_ONLY',[5,63,88,28],'No real radar or terrain data rendered'],
 ['ehsi','tfc','TCAS traffic overlay','10.30.4; 10.31.x','VISUAL_PENDING',[65,11,30,27],'Traffic symbology not synthesized'],
 ['ehsi','fail','Power / SG / IRS / NAV flags','10.30.13–14; 10.40','RULE_ONLY',[10,34,80,39],'Fail-safe simplified; CB source mapping pending']
].map(([display,id,name,folio,status,box,note])=>({display,id,name,folio,status,box,note}));
function clamp(v,min,max){const x=Number(v);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):min;}
function norm(v){return ((Number(v)||0)%360+360)%360;}
function initial(){
 return {seat:'CAPT',power:{eadi:true,ehsi:true,sg1:true,sg2:true,source:'NORMAL',att:true,heading:true,track:true,adc:true,nav:true,loc:true,gs:true,ra:true,fd:true},
 eadi:{pitch:0,bank:0,slip:0,ias:220,selectedSpeed:230,mach:.55,groundSpeed:310,radioAlt:800,dh:200,descent:true,fd:true,fdPitch:4,fdRoll:0,locDev:.3,gsDev:-.3,frontCourse:true,tcas:'OFF',windshear:false,pullup:false,pli:false,at:'FMC SPD',pitchMode:'VNAV PTH',rollMode:'LNAV',afds:'CMD',machVisible:true,dhReset:false},
 ehsi:{mode:'MAP',range:40,heading:240,track:245,selectedHeading:252,course:233,options:{wpt:true,arpt:false,navAid:false,vorAdf:false,rteData:false,tfc:false,wxr:false,terr:false},showSyntheticRoute:true,brightness:1},
 audit:Object.fromEntries(items.map(x=>[x.display+'.'+x.id,'PENDING']))};
}
function activeSg(s){const which=s.power.source==='SG1'?'sg1':s.power.source==='SG2'?'sg2':s.seat==='FO'?'sg2':'sg1';return !!s.power[which];}
function evaluate(s){
 const e=s.eadi,p=s.power;const sg=activeSg(s);const ra=p.ra?e.radioAlt:null;
 const valid=p.eadi&&sg;const dhAlert=valid&&ra!=null&&e.dh>=0&&e.descent&&ra<=e.dh&&!e.dhReset;
 const fd=valid&&p.att&&p.fd&&e.fd;
 return {powered:!!p.eadi,sg,attitude:valid&&p.att,ias:valid&&p.adc,fd,loc:valid&&p.loc,gs:valid&&p.gs&&e.frontCourse,ra:valid&&p.ra,radioAlt:ra,dhAlert,raColor:dhAlert?'#edb333':'#f4f5fa',mach:valid&&p.adc&&e.machVisible,runway:valid&&p.loc&&p.ra&&ra!==null&&ra<200,flags:[!p.att?'ATT':null,!p.adc?'SPD':null,!p.fd?'FD':null,!p.loc?'LOC':null,!p.gs?'G/S':null,!p.ra?'RA':null].filter(Boolean)};
}
function ehsiModel(s){
 const e=s.ehsi,p=s.power;const sg=activeSg(s);const mode=MODES.includes(e.mode)?e.mode:'MAP',range=RANGES.includes(Number(e.range))?Number(e.range):40;
 const opts={...e.options,wxr:!!e.options.wxr,terr:!!e.options.terr,demoRoute:!!e.showSyntheticRoute};
 const pts=e.showSyntheticRoute&&p.nav?[{name:'SIM0',x:0,y:0},{name:'TEST1',x:0,y:10},{name:'TEST2',x:5,y:19},{name:'TEST3',x:10,y:27}]:[];
 return {mode,range,heading:norm(e.heading),track:norm(e.track),selectedHeading:norm(e.selectedHeading),course:norm(e.course),
 nav:{valid:!!p.nav,source:'VOR1',ident:'SIM VOR',dme:16.2,cdi:.65,toFrom:'TO'},
 route:{source:'SYNTHETIC_TRAINING_ROUTE',activeIndex:1,points:pts},
 options:opts,efis:{headingValid:!!p.heading,trackValid:!!p.track,sgValid:!!sg,displayPower:!!p.ehsi,remoteWxr:false,wxrTransmitter:false,brightness:clamp(e.brightness,.2,1)}};
}
function orientation(mode){return mode==='PLAN'?'TRUE_NORTH':mode.includes('VOR_ILS')?'HEADING_UP':'TRACK_UP';}
function apply(s,patch){const x=structuredCopy(s);if(patch.type==='reset')return initial();
 if(patch.type==='scenario'){
  const e=x.eadi,p=x.power,h=x.ehsi;
  if(patch.name==='approach'){e.radioAlt=120;e.dh=200;e.descent=true;e.dhReset=false;e.locDev=.2;e.gsDev=-.4;h.mode='FULL_VOR_ILS';p.loc=p.gs=p.ra=p.nav=true;}
  if(patch.name==='cruise'){e.radioAlt=4500;e.mach=.75;e.ias=280;e.bank=0;e.pitch=2;h.mode='MAP';h.range=160;}
  if(patch.name==='tcas'){e.tcas='UP';e.radioAlt=350;h.options.tfc=true;}
  if(patch.name==='failure'){p.sg1=false;p.sg2=false;}
  if(patch.name==='dark'){p.eadi=false;p.ehsi=false;}
  if(patch.name==='navfail'){p.nav=false;p.heading=false;p.track=false;}
  if(patch.name==='normal')return initial();
 } else if(patch.type==='dhReset')x.eadi.dhReset=true;
 else if(patch.type==='set'){
  const path=patch.path.split('.');if(path.length!==2||!Object.hasOwn(x,path[0])||!Object.hasOwn(x[path[0]],path[1]))throw Error('BAD_PATH '+patch.path);
  x[path[0]][path[1]]=patch.value;
  if(patch.path==='eadi.mach')x.eadi.machVisible=Number(patch.value)>=.40?true:Number(patch.value)<.38?false:s.eadi.machVisible;
  if(patch.path==='eadi.radioAlt'&&Number(patch.value)>x.eadi.dh+75)x.eadi.dhReset=false;
  if(patch.path==='eadi.radioAlt'&&Number(patch.value)<=0)x.eadi.dhReset=true;
  if(patch.path==='eadi.dh')x.eadi.dhReset=false;
 }else if(patch.type==='option'){
  if(!Object.hasOwn(x.ehsi.options,patch.name))throw Error('BAD_OPTION');
  x.ehsi.options[patch.name]=!!patch.value;
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
 s=apply(s,{type:'set',path:'eadi.frontCourse',value:false});assert('Back course inhibits GS',!evaluate(s).gs);
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
return {VERSION,MODES,RANGES,FCOM,items,initial,clamp,norm,activeSg,evaluate,ehsiModel,orientation,apply,selfTest};
});
