'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const canonical=fs.readFileSync(path.join(root,'engine/fmc/indications/present-n1-bridge-v18.cjs'),'utf8');
const browser=fs.readFileSync(path.join(root,'cdu-standalone/data/present-n1-bridge-v18.js'),'utf8');
assert.equal(browser,canonical,'browser bridge must match authoritative module');
class El{
 constructor(){this.children=[];this.style={};this.dataset={};this.events={};this.attributes={};this.className='';this.checked=false;this.hidden=false;this.value='';this.classList={contains:()=>false,toggle:()=>{}};}
 appendChild(c){this.children.push(c)}addEventListener(k,fn){(this.events[k]??=[]).push(fn)}
 setAttribute(k,v){this.attributes[k]=v}fire(k){for(const f of this.events[k]??[])f({target:this});}
}
const nodes={},document={getElementById:id=>nodes[id]??(nodes[id]=new El()),createElement:()=>new El(),addEventListener:()=>{}};
const window={CDU_MAP:JSON.parse(fs.readFileSync(path.join(root,'cdu-standalone/data/cdu-map.json'),'utf8'))};
const context=vm.createContext({console,document,window,Date,setTimeout,clearTimeout});
for(const p of ['cdu-standalone/data/epfsi-scenario-defaults-v17.js',
 'cdu-standalone/data/afm-epfsi-n1-v10.js','cdu-standalone/data/present-n1-bridge-v18.js','cdu-standalone/app.js']){
 vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),context,{filename:p});
}
const js=s=>vm.runInContext(s,context);
(async()=>{
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(nodes['clickmap'].children.length,70);
 assert.match(js('pageLines()[6]'),/---.-/);
 assert.doesNotMatch(js('pageLines()[6]'),/87\.3/);
 js("press('CDU_CAPT_N1_LIMIT')");
 assert.match(js('pageLines()[7]'),/---.-/);
 assert.match(js('pageLines()[8]'),/NOT VERIFIED/);
 assert.match(js('pageLines()[10]'),/MAX N1/);
 nodes['present-n1-eng1'].value='61.5';
 nodes['present-n1-eng2'].value='73.2';
 nodes['present-n1-inject'].fire('click');
 assert.match(js('pageLines()[6]'),/TEST/);
 assert.match(js('pageLines()[7]'),/61.5/);
 assert.match(js('pageLines()[7]'),/73.2/);
 assert.equal(window.EPFSI_PRESENT_N1_INPUT.snapshot().forAutothrottle,false);
 assert.equal(js('epfsiN1().display'),'---.-');
 nodes['present-n1-clear'].fire('click');
 assert.equal(window.EPFSI_PRESENT_N1_INPUT.snapshot().source,'ENGINE_CORE');
 assert.doesNotMatch(js('pageLines()[7]'),/61\.5/);
 const pub=window.EPFSI_PRESENT_N1_INPUT;
 pub.publish({source:'ENGINE_CORE',registration:'EP-FSI',serial:29340,engineId:1,n1Pct:90.4,seq:0});
 pub.publish({source:'ENGINE_CORE',registration:'EP-FSI',serial:29340,engineId:2,n1Pct:87.6,seq:0});
 assert.match(js('pageLines()[7]'),/90.4/);
 assert.match(js('pageLines()[7]'),/87.6/);
 assert.equal(pub.snapshot().engine1.status,'LIVE_OBSERVATION');
 assert.equal(js('epfsiN1().display'),'---.-');
 nodes.reset.onclick();
 assert.match(js("pageLines()[6]"),/---.-/);
 assert.equal(pub.snapshot().engine1.n1Pct,null);
 console.log('PASS CDU v18: no invented present values, two engines, TEST isolation, core input, reset and MAX N1 blocked');
})().catch(e=>{console.error(e);process.exitCode=1;});
