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
 assert.equal(ehsiInput.traffic.targets.filter(t=>t.kind==='OTHER').length,4);
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
 const c=Cruise.route({elapsedSec:45,groundSpeedKt:448});
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
test('EHSI plots route legs with range-dependent zoom and four safe moving OTHER contacts',()=>{
 class SvgNode{
  constructor(name,doc){this.tagName=name;this.ownerDocument=doc;this.attributes={};this.children=[];this.style={};}
  setAttribute(k,v){this.attributes[k]=String(v);}
  appendChild(v){this.children.push(v);return v;}
  replaceChildren(...c){this.children=c;}
 }
 const doc={createElementNS(_,tag){return new SvgNode(tag,doc);}};
 const descendants=root=>[root,...root.children.flatMap(descendants)];
 const render=(nm,showTfc=true,elapsedSec=0)=>{
  const svg=new SvgNode('svg',doc);svg.id='ehsi';
  const route=Cruise.route({elapsedSec,groundSpeedKt:448});
  const ambient=Cruise.ambient({elapsedSec,ownAltitudeFt:27000,initialAltitudeFt:27000,ownGroundSpeedKt:448});
  EHSI.render(svg,{mode:'CTR_MAP',range:nm,heading:0,track:0,selectedHeading:0,
   nav:route.nav,route:route.route,groundSpeed:448,trueAirspeed:440,syntheticAirport:false,
   options:{tfc:showTfc},traffic:{mode:'TA_RA',targets:ambient},
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
 assert.equal(near.nodes.filter(n=>n.attributes['data-segment']==='traffic-other').length,4,
  'All four non-threat contacts are drawn on the TCAS rose');
 assert.ok(near.nodes.some(n=>n.attributes['data-text']==='TTG '+Cruise.route({groundSpeedKt:448}).timeToGo),
  'Time-to-go must render on the EHSI');
 assert.ok(near.nodes.some(n=>n.attributes['data-text']==='GS448'),
  'Groundspeed is rendered on the EHSI');
 assert.ok(near.nodes.some(n=>n.attributes['data-text']==='TFC'));
 assert.ok(!near.nodes.some(n=>n.attributes['data-segment']==='route-airport'),
  'Do not invent database airports for instructor synthetic route');
 assert.equal(render(10,false).nodes.filter(n=>n.attributes['data-segment']==='traffic-other').length,0,
  'TFC OFF hides background traffic but does not hide route');
 assert.equal(render(10,true,10).nodes.filter(n=>n.attributes['data-segment']==='traffic-other').length,4,
  'Background traffic updates over time');
 assert.ok(near.nodes.some(n=>n.attributes['data-segment']==='active-route'));
 assert.ok(render(10,false).nodes.some(n=>n.attributes['data-segment']==='active-route'));
});
