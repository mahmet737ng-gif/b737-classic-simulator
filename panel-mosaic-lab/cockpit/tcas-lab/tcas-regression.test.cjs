'use strict';
/* Regression checks for the instructor TCAS Encounter Lab (non-certified). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const TCAS=require('../../../engine/tcas/classic-tcas-v2.js');
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
 for(const id of ['scenario','start','play','step','respond','converging','intruderSide','mode','eadi','ehsi'])
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.ok(html.indexOf('id="converging"')<html.indexOf('id="eadi"'));
 assert.ok(html.indexOf('id="mode"')>html.indexOf('id="ehsi"'));
});
test('RA response changes CMD to FD while retaining FMC SPD, VNAV PTH and LNAV',()=>{
 const defaults={altitude:'10000',radioHeight:'6000',speed:'220',pitch:'2',vs:'0',
  relative:'',intruderVS:'',rate:'1',displayMode:'MAP',range:'10',mode:'TA_RA',
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
 let eadi=null;
 const window={B737ClassicTcasV2:TCAS,
  EFISDisplayLabCore:{initial:()=>({eadi:{},power:{}})},
  EFISDisplayLabEadi:{render(_node,state){eadi={...state.eadi};}},
  EFISClassicEHSIV2:{render(){}}};
 class Option{constructor(label,value){this.label=label;this.value=value;}}
 const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
 vm.runInNewContext(app,{window,document,Option,requestAnimationFrame(){}},{filename:'tcas-lab/app.js'});
 const fma=e=>[e.at,e.pitchMode,e.rollMode];
 assert.deepEqual(fma(eadi),['FMC SPD','VNAV PTH','LNAV']);
 assert.equal(eadi.afds,'CMD');
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
