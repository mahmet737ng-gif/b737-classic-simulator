'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
class N{constructor(){this.children=[];this.style={};this.dataset={};this.events={};this.attributes={};this.value='';this.checked=false;this.hidden=false;this.className='';this.classList={toggle:()=>{},contains:()=>false};}
appendChild(x){this.children.push(x)}addEventListener(t,f){(this.events[t]??=[]).push(f)}setAttribute(k,v){this.attributes[k]=v}
fire(t){for(const fn of this.events[t]||[])fn({target:this})}}
const nodes={},document={getElementById:id=>nodes[id]??(nodes[id]=new N()),createElement:()=>new N(),addEventListener:()=>{}};
const window={CDU_MAP:JSON.parse(fs.readFileSync(path.join(root,'cdu-standalone/data/cdu-map.json'),'utf8'))};
const ctx=vm.createContext({document,window,console,setTimeout,clearTimeout});
for(const file of ['cdu-standalone/data/epfsi-scenario-defaults-v17.js','cdu-standalone/data/afm-epfsi-n1-v10.js','cdu-standalone/app.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
}
const run=s=>vm.runInContext(s,ctx);
const pause=()=>new Promise(r=>setTimeout(r,20));
(async()=>{
 await pause();
 assert.equal(nodes.clickmap.children.length,70);
 for(const [id,expected] of [['n1-weather-mode','ISA'],['n1-anti-ice','OFF'],['n1-engine-bleed','ON'],['n1-bleed','AUTO']])assert.equal(nodes[id].value,expected,id);
 assert.equal(run('sim.n1.pmcMode'),'UNKNOWN');
 nodes['n1-pressure-alt'].value='5000';nodes['n1-pressure-alt'].fire('change');
 assert.ok(Math.abs(run('currentN1Context().oatC')-5.094)<0.001);
 assert.equal(run('currentN1Context().temperatureProvenance'),'ISA_BY_PRESSURE_ALTITUDE');
 assert.equal(run('currentN1Context().tatC'),null);
 assert.match(nodes['n1-defaults-status'].textContent,/Bleed ON/);
 assert.match(nodes['n1-defaults-status'].textContent,/A\/I OFF/);
 nodes['n1-oat'].value='30';nodes['n1-oat'].fire('change');
 assert.equal(run('currentN1Context().weatherMode'),'CUSTOM');
 assert.equal(run('currentN1Context().oatC'),30);
 nodes['n1-weather-mode'].value='ISA';nodes['n1-weather-mode'].fire('change');
 assert.ok(Math.abs(run('currentN1Context().oatC')-5.094)<0.001);
 nodes['n1-anti-ice'].value='ENGINE';nodes['n1-anti-ice'].fire('change');
 assert.equal(run('currentN1Context().antiIceMode'),'ENGINE');
 run("press('CDU_CAPT_N1_LIMIT')");
 assert.match(run('pageLines()[9]'),/ENGINE/);
 assert.equal(run('epfsiN1().display'),'---.-');
 nodes.reset.onclick();
 assert.equal(run('sim.n1.antiIceMode'),'OFF');
 assert.equal(run('sim.n1.engineBleedMode'),'ON');
 assert.equal(run('sim.n1.weatherMode'),'ISA');
 assert.equal(nodes['n1-anti-ice'].value,'OFF');
 assert.equal(nodes['n1-weather-mode'].value,'ISA');
 console.log('PASS: ISA/bleed-on/anti-ice-off v17 CDU start/change/override/reset; N1 stays blocked');
})().catch(e=>{console.error(e);process.exitCode=1});
