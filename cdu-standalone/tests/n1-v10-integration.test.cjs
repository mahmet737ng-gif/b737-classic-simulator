'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..','..');
const browser=fs.readFileSync(path.join(root,'cdu-standalone','data','afm-epfsi-n1-v10.js'),'utf8');
const commonjs=fs.readFileSync(path.join(root,'engine','fmc','performance','afm-epfsi-n1-v10.cjs'),'utf8');
assert.equal(browser,commonjs,'standalone source must match canonical v10 module');
const map=JSON.parse(fs.readFileSync(path.join(root,'cdu-standalone','data','cdu-map.json'),'utf8'));
class N{
 constructor(){this.children=[];this.style={};this.dataset={};this.events={};this.attributes={};this.className='';this.hidden=false;this.checked=false;this.value='';this.classList={toggle:()=>{},contains:()=>false};}
 appendChild(child){this.children.push(child)}addEventListener(kind,fn){(this.events[kind]??=[]).push(fn)}
 setAttribute(name,value){this.attributes[name]=value}fire(kind){(this.events[kind]??[]).forEach(fn=>fn({}));}
}
const nodes={};
const document={getElementById:id=>nodes[id]??(nodes[id]=new N()),createElement:()=>new N(),addEventListener:()=>{}};
const window={CDU_MAP:map};
const ctx=vm.createContext({console,document,window,setTimeout,clearTimeout});
vm.runInContext(browser,ctx,{filename:'cdu-standalone/data/afm-epfsi-n1-v10.js'});
assert.equal(typeof window.EPFSI_N1_ENGINE,'object');
vm.runInContext(fs.readFileSync(path.join(root,'cdu-standalone','app.js'),'utf8'),ctx,{filename:'cdu-standalone/app.js'});
const js=s=>vm.runInContext(s,ctx);
(async()=>{
 await new Promise(r=>setTimeout(r,10));
 assert.equal(nodes.clickmap.children.length,70);
 assert.equal(nodes.annunciators.children.length,5);
 js("press('CDU_CAPT_N1_LIMIT')");
 assert.equal(nodes['page-now'].textContent,'N1_LIMIT');
 assert.match(js("pageLines()[3]"),/---.-/);
 assert.match(js("pageLines()[8]"),/NOT VERIFIED/);
 assert.equal(js("epfsiN1().source"),null,'PMC unknown should not select a chart');
 nodes['n1-pmc-mode'].value='OFF';nodes['n1-pmc-mode'].fire('change');
 assert.equal(js("epfsiN1().source.pdfPage"),756);
 nodes['n1-phase'].value='GO_AROUND';nodes['n1-phase'].fire('change');
 assert.equal(js("epfsiN1().source.pdfPage"),129,'PMC OFF must inherit base GA');
 nodes['n1-phase'].value='MAX_CONTINUOUS';nodes['n1-phase'].fire('change');
 assert.equal(js("epfsiN1().source.pdfPage"),130,'PMC OFF must inherit base MCT');
 nodes['n1-phase'].value='TAKEOFF';nodes['n1-phase'].fire('change');
 js("press('CDU_CAPT_KEY_1')");
 js("press('CDU_CAPT_KEY_0')");
 js("press('CDU_CAPT_KEY_9')");
 js("press('CDU_CAPT_LSK_L1')");
 assert.equal(js('sim.active.N1'),'','invalid manual N1 must not be applied');
 js("press('CDU_CAPT_KEY_CLR')");
 js("press('CDU_CAPT_KEY_9')");
 js("press('CDU_CAPT_KEY_5')");
 js("press('CDU_CAPT_LSK_L1')");
 js("press('CDU_CAPT_EXEC')");
 assert.equal(js('sim.active.N1'),'95');
 assert.match(js('pageLines()[3]'),/MAN/);
 assert.equal(js("epfsiN1().canDriveAutothrottle"),false);
 js("setPage('TAKEOFF')");
 assert.match(js("pageLines()[10]"),/NOT VERIFIED/);
 js("setPage('IDENT')");
 assert.match(js("pageLines()[3]"),/B737-300/);
 assert.match(js("pageLines()[3]"),/20K/);
 console.log('PASS: standalone CDU v10 offline bundle / 70 keys / guarded N1 / PMC / manual vs AFM');
})().catch(e=>{console.error(e);process.exitCode=1;});
