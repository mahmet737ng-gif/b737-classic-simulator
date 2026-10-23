'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const canonical=fs.readFileSync(path.join(root,'engine/fmc/performance/epfsi-simulated-n1-v19.cjs'),'utf8');
const browser=fs.readFileSync(path.join(root,'cdu-standalone/data/epfsi-simulated-n1-v19.js'),'utf8');
assert.equal(browser,canonical,'browser estimate bundle identical to module');
class E{
 constructor(){this.children=[];this.style={};this.dataset={};this.events={};this.attributes={};this.value='';this.className='';this.checked=false;this.hidden=false;this.classList={toggle:()=>{},contains:()=>false};}
 appendChild(c){this.children.push(c)}addEventListener(k,fn){(this.events[k]??=[]).push(fn)}setAttribute(k,v){this.attributes[k]=v}
 fire(k){for(const fn of this.events[k]??[])fn({target:this});}
}
const nodes={},document={getElementById:id=>nodes[id]??(nodes[id]=new E()),createElement:()=>new E(),addEventListener:()=>{}};
const window={CDU_MAP:JSON.parse(fs.readFileSync(path.join(root,'cdu-standalone/data/cdu-map.json'),'utf8'))};
const ctx=vm.createContext({document,window,console,Date,setTimeout,clearTimeout});
for(const p of [
 'cdu-standalone/data/epfsi-scenario-defaults-v17.js',
 'cdu-standalone/data/afm-epfsi-n1-v10.js',
 'cdu-standalone/data/present-n1-bridge-v18.js',
 'cdu-standalone/data/epfsi-simulated-n1-v19.js',
 'cdu-standalone/app.js'
])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),ctx,{filename:p});
const js=s=>vm.runInContext(s,ctx);
(async()=>{
 await new Promise(r=>setTimeout(r,20));
 assert.equal(nodes.clickmap.children.length,70);
 assert.match(js('pageLines()[6]'),/89\.5/);
 assert.match(js('pageLines()[6]'),/EST\/EST/);
 js("press('CDU_CAPT_N1_LIMIT')");
 assert.match(js('pageLines()[3]'),/91\.7% EST/);
 assert.match(js('pageLines()[10]'),/MAX N1 EST/);
 assert.match(js('pageLines()[8]'),/NOT VERIFIED/);
 assert.equal(js('epfsiN1().display'),'---.-','AFM actual numerical result still blocked');
 assert.equal(js('presentN1Snapshot().engine1.n1Pct'),null,'EST is NOT real sensor telemetry');
 nodes['n1-phase'].value='GO_AROUND';nodes['n1-phase'].fire('change');
 assert.match(js('pageLines()[3]'),/93\.7% EST/);
 assert.match(js('pageLines()[7]'),/92\.2/);
 nodes['n1-thrust-lever'].value='0';nodes['n1-thrust-lever'].fire('change');
 assert.match(js('pageLines()[7]'),/20\.0/);
 nodes['n1-thrust-lever'].value='';nodes['n1-thrust-lever'].fire('change');
 nodes['present-n1-eng1'].value='72.1';nodes['present-n1-eng2'].value='80.4';
 nodes['present-n1-inject'].fire('click');
 assert.match(js('pageLines()[6]'),/TEST\/TEST/);
 assert.match(js('pageLines()[7]'),/72\.1/);
 assert.match(js('pageLines()[7]'),/80\.4/);
 nodes['present-n1-clear'].fire('click');
 assert.match(js('pageLines()[6]'),/EST\/EST/);
 const pub=window.EPFSI_PRESENT_N1_INPUT;
 pub.publish({source:'ENGINE_CORE',registration:'EP-FSI',serial:29340,engineId:1,n1Pct:87.7,seq:0});
 assert.match(js('pageLines()[6]'),/LIVE\/EST/);
 assert.match(js('pageLines()[7]'),/87\.7/);
 js("setPage('TAKEOFF')");
 assert.match(js('pageLines()[8]'),/EST/);
 nodes.reset.onclick();
 js("press('CDU_CAPT_N1_LIMIT')");
 assert.match(js('pageLines()[3]'),/91\.7% EST/);
 assert.match(js('pageLines()[6]'),/EST\/EST/);
 assert.equal(window.EPFSI_PRESENT_N1_INPUT.snapshot().engine1.n1Pct,null);
 assert.equal(js('estimatedN1().canDriveAutothrottle'),false);
 console.log('PASS CDU v19: default TO and GA estimates + actual/TEST priority + throttle + reset + AFM gates');
})().catch(e=>{console.error(e);process.exitCode=1});
