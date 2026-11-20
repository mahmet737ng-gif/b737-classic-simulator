'use strict';
/* Regression checks for the instructor TCAS Encounter Lab (non-certified). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const TCAS=require('../../../engine/tcas/classic-tcas-v2.js');
const EHSI=require('../../../efis-display-lab/ehsi-v2.js');
const EFISCore=require('../../../efis-display-lab/core.js');
const Cruise=require('./cruise-scenario-v1.js');
const own=()=>({airborne:true,altitudeFt:10000,radioAltitudeFt:6000,
 tasKt:220,gsKt:220,iasKt:220,pitchDeg:2,vsFpm:0,
 trueHeadingDeg:0,trueTrackDeg:0,elapsedSec:0});
function run(id,options={},seconds=0){
 const o=own();let state=TCAS.create(id,o,options);
 for(let n=0;n<=seconds;n++)state=TCAS.step(state,o,n?1:0,TCAS.controls());
 return state;
}
test('passing-traffic TA uses a physical near miss and never generates an RA',()=>{
 const o=own(),limits=require('../../../engine/tcas/classic-tcas-v1.js').thresholds(o,'TA_RA');
 let s=TCAS.create('TA_ONLY',o);
 const g=TCAS.geometry(s,s.targets[0],o);
 assert.ok(g.missDistanceNm>limits.raNm && g.missDistanceNm<limits.taNm,'passing outside RA, inside TA envelope');
 const seen=new Set();
 for(let n=0;n<85;n++){
  s=TCAS.step(s,o,1,TCAS.controls());
  assert.equal(s.output.ra,null,'passing traffic must not become an RA');
  for(const t of s.output.targets)seen.add(t.kind);
 }
 assert.ok(seen.has('TA'),'passing traffic should create a TA');
});
test('2.1 NM / +300 ft / climbing away 1500 fpm is not a false TA or RA',()=>{
 const s=run('CLIMB',{distanceNm:2.1,relativeAltitudeFt:300,verticalRateFpm:1500});
 assert.ok(s.output.targets[0]);
 assert.ok(!['TA','RA'].includes(s.output.targets[0].kind));
 assert.equal(s.output.ra,null);
 assert.ok(s.output.targets[0].predictedSeparationFt>600);
});
test('automatic left/right convergence climbs or descends through own altitude',()=>{
 for(const [id,sign] of [['CLIMB',1],['DESCEND',-1]]){
  for(const side of ['LEFT','RIGHT']){
   const o=own();let s=TCAS.create(id,o,{converging:true,lateralSide:side});
   const g=TCAS.geometry(s,s.targets[0],o);
   assert.ok(g.tcpaSec>0&&g.missDistanceNm<.01);
   assert.equal(Math.sign(s.targets[0].verticalRate),sign);
   assert.ok(side==='LEFT'?g.bearing>180:g.bearing<180);
   const sequence=new Set();
   for(let n=0;n<=75;n++){s=TCAS.step(s,o,n?1:0,TCAS.controls());sequence.add(s.output.stage);}
   for(const stage of ['TA',id,'CLEAR OF CONFLICT'])assert.ok(sequence.has(stage),id+' '+side+' '+stage);
  }
 }
});
test('quick encounter controls precede EADI/EHSI, optional settings follow',()=>{
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 for(const id of ['scenario','start','play','step','respond','converging','intruderSide','displayMode','range','tfc','mode','eadi','ehsi'])
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.ok(html.indexOf('id="converging"')<html.indexOf('id="eadi"'));
 assert.ok(html.indexOf('id="mode"')>html.indexOf('id="ehsi"'));
 assert.ok(html.indexOf('id="displayMode"')<html.indexOf('id="ehsi"'));
 assert.ok(html.indexOf('id="range"')<html.indexOf('id="ehsi"'));
 assert.ok(html.indexOf('id="tfc"')<html.indexOf('id="ehsi"'));
 assert.match(html,/value="CTR_MAP" selected/);
 assert.ok(html.indexOf('id="efisCpMount"')>html.indexOf('id="ehsi"'));
 assert.ok(html.includes('efis-physical-cp-v1.js'));
 assert.ok(html.includes('../efis-pedestal-raster-v1.css'));
 assert.ok(html.includes('id="efis-state-bridge" hidden'));
});
test('RA response changes CMD to FD while retaining FMC SPD, VNAV PTH and LNAV',()=>{
 const defaults={altitude:'27000',radioHeight:'24000',speed:'293',pitch:'2',vs:'0',
  relative:'',intruderVS:'',rate:'1',displayMode:'CTR_MAP',range:'10',mode:'TA_RA',
  unit:'1',altSource:'1',code:'2000',filter:'NORM',intruderSide:'RIGHT'};
 const els=new Map();
 class Element{
  constructor(id){this.id=id;this.value=defaults[id]??'';
   this.checked=['bus1','bus2','atc2cb','tfc'].includes(id);this.dataset={};this.children=[];this.textContent='';}
  add(x){this.children.push(x);}
  append(...x){this.children.push(...x);}
  replaceChildren(...x){this.children=x;}
  addEventListener(){}
 }
 const get=id=>{if(!els.has(id))els.set(id,new Element(id));return els.get(id);};
 const document={getElementById:get,createElement:tag=>new Element(tag),createTextNode:s=>({textContent:s})};
 let eadi=null,ehsiInput=null;
 const window={B737ClassicTcasV2:TCAS,B737TcasCruiseScenarioV1:Cruise,
  EFISDisplayLabCore:{initial:()=>({eadi:{},power:{}})},
  EFISDisplayLabEadi:{render(_node,state){eadi={...state.eadi};}},
  EFISClassicEHSIV2:{render(_node,input){ehsiInput=input;}}};
 class Option{constructor(label,value){this.label=label;this.value=value;}}
 const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
 vm.runInNewContext(app,{window,document,Option,requestAnimationFrame(){}},{filename:'tcas-lab/app.js'});
 const fma=e=>[e.at,e.pitchMode,e.rollMode];
 assert.deepEqual(fma(eadi),['FMC SPD','VNAV PTH','LNAV']);
 assert.equal(eadi.afds,'CMD');
 assert.equal(ehsiInput.mode,'CTR_MAP');
 assert.equal(eadi.ias,293);
 assert.equal(eadi.mach,.73);
 assert.ok(eadi.fmaFontScale<1);
 assert.equal(eadi.dh,-20,'DH200 disabled for cruise scenario');
 assert.equal(eadi.pitch,eadi.otherPitch,'No fabricated PITCH comparison flag');
 const source=EFISCore.initial();Object.assign(source.eadi,eadi);
 assert.deepEqual(EFISCore.compare(source),[],'PITCH compare only when a real disagreement exists');
 assert.equal(EFISCore.evaluate(source).dhDigital,false);
 assert.ok(ehsiInput.groundSpeed>400);
 assert.ok(ehsiInput.trueAirspeed>400);
 assert.ok(ehsiInput.traffic.targets.filter(t=>t.id?.startsWith('OTHER-')).length<=2,
  '10 NM has at most two AMBIENT OTHER contacts besides the named primary target');
 assert.equal(ehsiInput.route.activeIndex,1);
 assert.ok(ehsiInput.route.points[1].name,'Next simulated FMC fix visible');
 assert.ok(ehsiInput.nav.timeToGo,'TTG available');
 assert.ok(ehsiInput.route.points[1].eta.endsWith('Z'),'Simulated ETA available');
 assert.equal(ehsiInput.options.tfc,true);
 get('tfc').onclick();
 assert.equal(ehsiInput.options.tfc,false,'TFC OFF hides EHSI overlay');
 assert.equal(get('tfc').textContent,'TFC OFF');
 get('tfc').onclick();
 assert.equal(ehsiInput.options.tfc,true,'TFC ON restores overlay');
 get('displayMode').value='MAP';get('displayMode').onchange();
 assert.equal(ehsiInput.mode,'MAP','MAP MODE changes instantly');
 get('range').value='20';get('range').onchange();
 assert.equal(ehsiInput.range,20,'EHSI range changes instantly');
 get('respond').onclick();
 assert.equal(eadi.afds,'CMD','No RA: autopilot stays engaged');
 get('converging').checked=true;get('scenario').value='CLIMB';get('start').onclick();
 for(let n=0;n<80&&!eadi.tcasRa;n++)get('step').onclick();
 assert.equal(eadi.tcasRa?.id,'CLIMB');
 const before=fma(eadi);
 get('respond').onclick();
 assert.equal(eadi.afds,'FD');assert.equal(eadi.apEngaged,false);assert.equal(eadi.fd,true);
 assert.deepEqual(fma(eadi),before,'FMC, VNAV and LNAV modes unchanged');
 const fdScreenOffset=eadi.fdPitch-eadi.pitch,commanded=Number(get('pitch').value);
 assert.ok(Number.isFinite(commanded)&&commanded>=-12&&commanded<=12,'RA pitch target remains available up to 12°');
 get('step').onclick();
 assert.ok(Math.abs((eadi.fdPitch-eadi.pitch)-fdScreenOffset)<1e-8,
  'Flight director bars stay in place on manual RA even as pitch changes');
 get('start').onclick();assert.equal(eadi.afds,'CMD','LOAD resets autopilot to CMD');
});

test('EHSI actually renders tracked traffic on 360° CTR MAP (even when beyond expanded MAP arc)',()=>{
 class SvgNode{
  constructor(name,doc){this.tagName=name;this.ownerDocument=doc;this.attributes={};this.children=[];this.style={};}
  setAttribute(k,v){this.attributes[k]=String(v);}
  appendChild(v){this.children.push(v);return v;}
  replaceChildren(...c){this.children=c;}
 }
 const doc={createElementNS(_,tag){return new SvgNode(tag,doc);}};
 const makeSvg=()=>{const el=new SvgNode('svg',doc);el.id='ehsi';return el;};
 const descendants=root=>[root,...root.children.flatMap(descendants)];
 const params=mode=>({
  mode,range:10,heading:0,track:0,selectedHeading:0,trueRef:false,
  nav:{valid:true},route:{points:[]},options:{tfc:true},
  traffic:run('OFFSCALE').output,
  efis:{displayPower:true,sgValid:true,headingValid:true,trackValid:true},weather:{}
 });
 const centered=makeSvg();const state=EHSI.render(centered,params('CTR_MAP'));
 const nodes=descendants(centered);
 assert.equal(state.trafficOverlay,true);
 assert.ok(nodes.some(n=>n.attributes['data-segment']==='traffic-prox'),
  'off-axis real intruder must be represented by a white diamond in CTR MAP');
 // Exercise the same OFFSCALE scenario after it has become an actual RA.
 // Its 45-degree bearing is outside the expanded arc, but lies within CTR MAP.
 let moving=TCAS.create('OFFSCALE',own());
 const o=own();let raState=null;
 for(let second=0;second<75;second++){
  moving=TCAS.step(moving,o,second?1:0,TCAS.controls());
  if(moving.output.targets.some(t=>t.kind==='RA')){raState=moving.output;break;}
 }
 assert.ok(raState,'offscale scenario must reach a real RA');
 const activeRa=makeSvg();
 EHSI.render(activeRa,{...params('CTR_MAP'),traffic:raState});
 assert.ok(descendants(activeRa).some(n=>n.attributes['data-segment']==='traffic-ra'),
  'RA red square must render in the correct bearing on CTR MAP');
 const raOffscale=makeSvg();
 EHSI.render(raOffscale,{...params('MAP'),traffic:raState});
 assert.ok(descendants(raOffscale).some(n=>n.attributes['data-text']==='OFFSCALE'),
  'expanded MAP truthfully reports an out-of-arc 45-degree RA');
 const expanded=makeSvg();EHSI.render(expanded,params('MAP'));
 const outOfArc=descendants(expanded);
 assert.ok(!outOfArc.some(n=>n.attributes['data-segment']==='traffic-prox'),
  'expanded MAP arc never fakes an in-scale position for a 45-degree target');
 const disabled=makeSvg();EHSI.render(disabled,{...params('CTR_MAP'),options:{tfc:false}});
 assert.ok(!descendants(disabled).some(n=>n.attributes['data-segment']==='traffic-prox'));
});

test('cruise route advances by ground speed, calculates distance/ETA/TTG and passes the next fix',()=>{
 const a=Cruise.route({elapsedSec:0,groundSpeedKt:448});
 const b=Cruise.route({elapsedSec:20,groundSpeedKt:448});
 const c=Cruise.route({elapsedSec:70,groundSpeedKt:448});
 assert.equal(a.next,'REKPA');assert.equal(a.utc,'1200Z');
 assert.ok(b.distanceNm<a.distanceNm,'Distance to next fix must decrease while approaching');
 assert.ok(b.own.northNm>a.own.northNm,'Aircraft progresses along route');
 assert.equal(c.next,'VABER','Active waypoint switches after first fix');
 assert.ok(c.route.points[1].x>0,'Following leg turns towards next fix');
 assert.ok(a.eta.endsWith('Z')&&b.eta.endsWith('Z'));
 assert.ok(/^\d+:\d\d$/.test(a.timeToGo));
 assert.equal(a.route.points[0].hidden,true);
 assert.equal(a.route.source,'TCAS_LAB_SIMULATED_FMC');
});
test('EHSI zooms compass-clipped route and displays max two OTHER contacts within 10 NM',()=>{
 class SvgNode{
  constructor(name,doc){this.tagName=name;this.ownerDocument=doc;this.attributes={};this.children=[];this.style={};}
  setAttribute(k,v){this.attributes[k]=String(v);}
  appendChild(v){this.children.push(v);return v;}
  replaceChildren(...c){this.children=c;}
 }
 const doc={createElementNS(_,tag){return new SvgNode(tag,doc);}};
 const descendants=root=>[root,...root.children.flatMap(descendants)];
 const render=(nm,showTfc=true,elapsedSec=0,mode='CTR_MAP')=>{
  const svg=new SvgNode('svg',doc);svg.id='ehsi';
  const route=Cruise.route({elapsedSec,groundSpeedKt:448});
  const ambient=Cruise.ambient({elapsedSec,ownAltitudeFt:27000,initialAltitudeFt:27000,ownGroundSpeedKt:448})
    .filter(t=>t.distance<=nm).slice(0,nm<=10?2:4);
  EHSI.render(svg,{mode,range:nm,heading:0,track:0,selectedHeading:0,
   nav:route.nav,route:route.route,groundSpeed:448,trueAirspeed:440,syntheticAirport:false,
   options:{tfc:showTfc},traffic:{mode:'TA_RA',targets:ambient},
    routeClipToScale:true,routeOnFull:true,trainingRoseLarge:true,
   trafficLabelOffsetY:12,efis:{displayPower:true,sgValid:true,headingValid:true,trackValid:true},weather:{}});
  return {svg,nodes:descendants(svg)};
 };
 const near=render(10),far=render(20);
 const line=nodes=>{
  const segments=nodes.find(n=>n.attributes['data-segment']==='route-segments');
  assert.ok(segments,'FMC route exists');
  return segments.children[0];
 };
 assert.ok(Number(line(near.nodes).attributes.y2)<Number(line(far.nodes).attributes.y2),
  'At 10 NM the next waypoint must be farther from aircraft than at 20 NM');
 assert.ok(render(10,true,0,'MAP').nodes.filter(n=>n.attributes['data-segment']==='traffic-other').length>=2,
  'At least two OTHER targets must remain visible in expanded MAP mode');
 assert.equal(near.nodes.filter(n=>n.attributes['data-segment']==='traffic-other').length,2,
  '10 NM rose contains only two non-threat contacts');
 assert.ok(near.nodes.some(n=>n.attributes['data-text']==='TTG '+Cruise.route({groundSpeedKt:448}).timeToGo),
  'Time-to-go must render on the EHSI');
 assert.ok(near.nodes.some(n=>n.attributes['data-text']==='GS448'),
  'Groundspeed is rendered on the EHSI');
 assert.ok(near.nodes.some(n=>n.attributes['data-text']==='TFC'));
 assert.ok(!near.nodes.some(n=>n.attributes['data-segment']==='route-airport'),
  'Do not invent database airports for instructor synthetic route');
 assert.equal(render(10,false).nodes.filter(n=>n.attributes['data-segment']==='traffic-other').length,0,
  'TFC OFF hides background traffic but does not hide route');
 assert.equal(render(10,true,10).nodes.filter(n=>n.attributes['data-segment']==='traffic-other').length,2,
  'Only two contacts remain at 10 NM as positions evolve');
 const clippedRoute=near.nodes.find(n=>n.attributes['data-segment']==='active-route');
 assert.equal(clippedRoute?.attributes['clip-path'],'url(#ehsi-route-range)');
 const fullClip=near.nodes.find(n=>n.tagName==='clipPath'&&n.attributes.id==='ehsi-route-range');
 assert.ok(fullClip?.children.some(n=>n.tagName==='ellipse'),'CTR MAP uses elliptical clip');
 assert.ok(near.nodes.filter(n=>n.attributes['data-segment']==='waypoint').length<6,
  'Waypoints outside compass range withheld');
 const expanded=render(10,true,0,'MAP');
 const sector=expanded.nodes.find(n=>n.tagName==='clipPath'&&n.attributes.id==='ehsi-route-range');
 assert.ok(sector?.children.some(n=>n.tagName==='polygon'),'Expanded MAP uses sector clip');
 const fullNav=render(10,true,0,'FULL_NAV');
 assert.ok(fullNav.nodes.some(n=>n.attributes['data-segment']==='active-route'));
 assert.ok(fullNav.nodes.filter(n=>n.attributes['data-segment']==='traffic-other').length<=2);
 assert.ok(near.nodes.some(n=>n.attributes['data-segment']==='compass-rose'));
 assert.ok(near.nodes.some(n=>n.attributes['data-segment']==='active-route'));
 assert.ok(render(10,false).nodes.some(n=>n.attributes['data-segment']==='active-route'));
});

test('ETA-to-3D proximity requires the two trajectories to overlap in time',()=>{
 const geom=(distance,relativeAltitude,relativeVerticalRate,tcpaSec,relativeSpeedKt)=>({
  distance,relativeAltitude,relativeVerticalRate,tcpaSec,relativeSpeedKt
 });
 const distant=TCAS.trajectoryIntersection(geom(2,0,0,120,360),.8,600);
 assert.ok(distant.timeSec>48,'No early advisory before meaningful closing time');
 const imminent=TCAS.trajectoryIntersection(geom(2,0,0,30,240),.8,600);
 assert.ok(Number.isFinite(imminent.timeSec));
 const lateVertical=TCAS.trajectoryIntersection(geom(2,1300,-600,30,240),.8,600);
 assert.equal(lateVertical.timeSec,Infinity,'Vertical crossing after horizontal passing is safe');
 const aligned=TCAS.trajectoryIntersection(geom(2,1000,-2000,30,240),.8,600);
 assert.ok(Number.isFinite(aligned.timeSec),'Simultaneous 3D crossing is unsafe');
 const miss=TCAS.trajectoryIntersection(geom(3,0,0,30,240),.2,600);
 assert.equal(miss.timeSec,Infinity,'Parallel offset must never generate an RA');
 const intruder=run('SAME_LEVEL',{},25).output.targets[0];
 assert.ok(intruder.timeToRaProximitySec!==null,'Every genuine RA has an estimated entry time');
 assert.ok(Number.isFinite(intruder.predictedSeparationFt));
 assert.ok(!['RA','TA'].includes(run('CLIMB',{
  distanceNm:2.1,relativeAltitudeFt:300,verticalRateFpm:1500
 }).output.targets[0].kind),'Climbing away does not create a false advisory');
});
test('TCAS EHSI labels remain whole even close to the enlarged lower/right compass rim',()=>{
 const l=EHSI.computeDisplay({mode:'CTR_MAP',range:10,nav:{valid:true},
  route:{points:[{name:'PT',x:0,y:2}]},trainingRoseLarge:true,
  efis:{displayPower:true,sgValid:true,headingValid:true,trackValid:true}}).layout;
 assert.ok(l.radius>180);
 for(const pt of [[254,451,'TOLRA'],[350,380,'SIBEN'],[255,118,'LEMDA'],[410,290,'VABER']]){
  const p=EHSI.routeFixLabel(...pt,l);
  assert.ok(p,'The label must be relocated fully inside the rose: '+pt);
  const [x1,y1,x2,y2]=p.box;
  for(const x of [x1,x2])for(const y of [y1,y2]){
   const nx=(x-l.roseCenter[0])/(l.radiusX-9);
   const ny=(y-l.roseCenter[1])/(l.radius-9);
   assert.ok(nx*nx+ny*ny<=1,'Whole label glyph footprint is in-scale');
  }
 }
 const cp=fs.readFileSync(path.join(__dirname,'efis-physical-cp-v1.js'),'utf8');
 assert.match(cp,/mode:'CTR_MAP',range:10,tfc:true,dh:-20/);
 assert.match(cp,/kind==='rst'\)\{state\.dh=-20/);
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 assert.ok(html.includes('3D proximity (s)')&&html.includes('Sep @ CPA (ft)'));
});

test('progressive flight-trajectory warning sequence distinguishes OTHER, PROX, TA and RA',()=>{
 const ownCruise={airborne:true,altitudeFt:27000,radioAltitudeFt:24000,iasKt:293,
  tasKt:440,gsKt:448,vsFpm:0,pitchDeg:2,trueTrackDeg:0,trueHeadingDeg:0,elapsedSec:0};
 const stepScenario=(name,options)=>{
  let s=TCAS.create(name,ownCruise,{progressive:true,...options});
  const sequence=[];
  for(let second=0;second<130;second++){
   s=TCAS.step(s,ownCruise,second?1:0,TCAS.controls());
   const kind=s.output.targets[0]?.kind;
   if(kind&&!sequence.includes(kind))sequence.push(kind);
   if(name==='TA_ONLY')assert.equal(s.output.ra,null,'Passing traffic must NEVER turn into an RA');
  }
  return sequence;
 };
 assert.deepEqual(stepScenario('TA_ONLY',{converging:true}),['OTHER','PROX','TA']);
 for(const id of ['CLIMB','DESCEND'])
  assert.deepEqual(stepScenario(id,{}).slice(0,4),['OTHER','PROX','TA','RA'],id);
 assert.deepEqual(stepScenario('DIVERGING_ABOVE',{}),['OTHER']);
});

test('Original photographed TCAS IVSI is the shared cockpit and lab renderer',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../tcas-photo/ivsi.js'),'utf8');
 assert.match(source,/B737ClassicPhotoIVSIV1=Object\.freeze\(\{renderLab\}\)/);
 assert.match(source,/paintFace\(g,state,controls,own,vs,valid,pref\.full\)/);
 assert.match(source,/paintFace\(canvas\.getContext\('2d'\),trafficState,selected,own/);
 const photoPath=path.join(__dirname,'../tcas-photo/');
 assert.ok(fs.existsSync(path.join(photoPath,'ivsi.webp')),'Original IVSI faceplate image is required');
 assert.ok(fs.existsSync(path.join(photoPath,'scale.webp')),'Original integrated TCAS scale image is required');
 const fakeWindow={},calls=[];
 class Img{
  constructor(){this.naturalWidth=403;}
  set src(v){this.srcValue=v;}
 }
 const document={currentScript:{src:'https://trainer.test/panel-mosaic-lab/cockpit/tcas-photo/ivsi.js'},
  baseURI:'https://trainer.test/panel-mosaic-lab/cockpit/'};
 vm.runInNewContext(source,{window:fakeWindow,document,Image:Img,URL,requestAnimationFrame(){}});
 const fn=fakeWindow.B737ClassicPhotoIVSIV1?.renderLab;
 assert.equal(typeof fn,'function','Original photo IVSI exposes a stand-alone lab adapter');
 const ctx=new Proxy({},{
  get(_target,key){return (...params)=>{calls.push({key,args:params});};},
  set(){return true;}
 });
 const canvas={width:403,height:403,dataset:{},style:{},getContext:()=>ctx};
 const traffic={mode:'TA_RA',advisory:'RA',ra:{id:'CLIMB',min:1500,max:null},
  targets:[{id:'UP',kind:'RA',distance:1.3,bearing:10,
   relativeAltitude:-300,verticalRate:1200},{id:'DOWN',kind:'TA',distance:2.6,bearing:340,
   relativeAltitude:500,verticalRate:-1000}]};
 assert.equal(fn(canvas,{vsFpm:1800,trueHeadingDeg:0,altitudeFt:27000},traffic,{rangeNm:10,filter:'NORM'}),true);
 assert.equal(canvas.dataset.ivsiPhoto,'original');
 assert.equal(canvas.dataset.ivsiFullTime,'true','Original IVSI TCAS traffic is visible in lab by default');
 assert.equal(canvas.dataset.ivsiBrightness,'1','Original photo brightness starts fully readable');
 assert.equal(fakeWindow.B737ClassicPhotoIVSIV1.toggleLabFull(),false,
  'Original TA SEL toggles from full-time to popup mode');
 assert.equal(canvas.dataset.ivsiFullTime,'false');
 assert.equal(fakeWindow.B737ClassicPhotoIVSIV1.adjustLabBrightness(-1),.95,
  'Original IVSI brightness decrements by 5 percent');
 assert.equal(canvas.dataset.ivsiBrightness,'0.95');
 assert.equal(canvas.dataset.tcasRaId,'CLIMB');
 assert.ok(calls.some(x=>x.key==='drawImage'),'Original photo IVSI scale must be painted');
 assert.ok(calls.filter(x=>x.key==='arc').length>=2,'Original RA arc sectors must be drawn');
 assert.ok(calls.some(x=>x.key==='fillText'&&x.args[0]==='↑'),'Original upward trend arrow required');
 assert.ok(calls.some(x=>x.key==='fillText'&&x.args[0]==='↓'),'Original downward trend arrow required');
});

test('TCAS Lab presents three real displays, no RA hatching, and TAKE ACTION',()=>{
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
 const eadi=fs.readFileSync(path.join(__dirname,'../../../efis-display-lab/eadi.js'),'utf8');
 assert.match(html,/id="respond">TAKE ACTION</);
 assert.equal((html.match(/id="ivsi"/g)||[]).length,1);
 assert.match(html,/\.\.\/tcas-photo\/ivsi\.js/);
 assert.match(html,/class="photo-ivsi-face"/);
 assert.doesNotMatch(html,/ivsi-tcas-v1\.js/);
 assert.match(app,/B737ClassicPhotoIVSIV1\?\.renderLab/);
 assert.match(app,/state\.eadi\.tcasFenceSimple=true/);
 assert.match(eadi,/if\(!e\.tcasFenceSimple\)/);
 assert.match(app,/fdHoldOffset=targetPitch-own\.pitchDeg/);
 assert.match(app,/own\.pitchDeg\+\(fdHoldOffset\?\?0\)/);
 assert.match(app,/commandedPitchForRa/);
 assert.match(app,/options=\{progressive:true\}/);
});

test('EHSI trend arrows are driven by target vertical motion, not the RA label',()=>{
 class Svg{
  constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.attrs={};this.children=[];this.style={};}
  setAttribute(k,v){this.attrs[k]=String(v);}
  appendChild(v){this.children.push(v);return v;}
  replaceChildren(...v){this.children=v;}
 }
 const doc={createElementNS(_,tag){return new Svg(tag,doc);}};
 const svg=new Svg('svg',doc);svg.id='ehsi';
 EHSI.render(svg,{mode:'CTR_MAP',range:10,heading:0,track:0,selectedHeading:0,
  nav:{valid:true},route:{points:[]},options:{tfc:true},
  traffic:{mode:'TA_RA',targets:[
   {id:'CLIMBER',bearing:8,distance:2.1,kind:'TA',relativeAltitude:400,verticalRate:900},
   {id:'DESCENDER',bearing:340,distance:3.0,kind:'PROX',relativeAltitude:-500,verticalRate:-1100},
   {id:'LEVEL',bearing:35,distance:3.1,kind:'OTHER',relativeAltitude:300,verticalRate:200}
  ]},
  efis:{displayPower:true,sgValid:true,headingValid:true,trackValid:true},weather:{}});
 const flatten=n=>[n,...n.children.flatMap(flatten)],nodes=flatten(svg);
 const trends=nodes.filter(n=>n.attrs['data-trend']).map(n=>n.attrs['data-trend']);
 assert.ok(trends.includes('UP'),'Climbing traffic must carry an UP arrow');
 assert.ok(trends.includes('DOWN'),'Descending traffic must carry a DOWN arrow');
 assert.equal(trends.length,2,'A level or <500 FPM target has no arrow');
});
