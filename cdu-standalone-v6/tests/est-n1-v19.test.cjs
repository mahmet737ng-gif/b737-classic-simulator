'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const canonical=fs.readFileSync(path.join(root,'engine/fmc/performance/epfsi-simulated-n1-v19.cjs'),'utf8');
const bundle=fs.readFileSync(path.join(root,'cdu-standalone-v6/data/epfsi-simulated-n1-v19.js'),'utf8');
assert.equal(canonical,bundle,'v6 estimate bundle must match canonical surrogate');
class E{
 constructor(){this.children=[];this.style={};this.dataset={};this.value='';this.textContent='';this.events={};this.className='';this.hidden=false;this.checked=false;this.classList={toggle:()=>{},contains:n=>this.className.split(/\s+/).includes(n),add:(...n)=>{this.className+=' '+n.join(' ')}}}
 get childNodes(){return this.children}get firstChild(){return this.children[0]||null}
 querySelector(selector){return this.children.find(c=>selector.startsWith('.')&&c.classList.contains(selector.slice(1)))||null}
 removeChild(child){this.children=this.children.filter(c=>c!==child);return child}
 insertBefore(child,before){const index=this.children.indexOf(before);this.children.splice(index<0?this.children.length:index,0,child);return child}
 appendChild(v){this.children.push(v);return v}replaceChildren(...v){this.children=[...v]}
 addEventListener(k,f){(this.events[k]??=[]).push(f)}setAttribute(){}remove(){}
 fire(k){for(const fn of this.events[k]||[])fn({target:this})}
}
const nodes={},document={
 getElementById:id=>nodes[id]??(nodes[id]=new E()),
 createElement:()=>new E(),
 addEventListener:()=>{}
};
// Load the same authoritative display dependencies as the actual v6 page.
const window={
 B737FCOMScreenContractV1:require('../../engine/ch11/fcom-screen-contract-v1.js'),
 CDU_SCREEN_COMPOSITOR_V1:require('../engine/screen-compositor-v1.js')
};
const context=vm.createContext({console,document,window,setTimeout,clearTimeout,MutationObserver:class{observe(){}},Date});
const files=['cdu-standalone-v6/data/cdu-map.js','cdu-standalone-v6/data/page-definitions.js',
 'cdu-standalone-v6/engine/cdu-engine.js','cdu-standalone-v6/data/epfsi-scenario-defaults-v17.js',
 'cdu-standalone-v6/data/epfsi-simulated-n1-v19.js','cdu-standalone-v6/app.js'];
for(const f of files)vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
const js=s=>vm.runInContext(s,context);
const rightValue=(row)=>nodes['fmc-lines'].children[2*row].children[1].textContent;
const leftValue=(row)=>nodes['fmc-lines'].children[2*row].children[0].textContent;
assert.equal(js('n1EstimateV19().status'),'SIM_ESTIMATE');
assert.equal(js('n1EstimateV19().maxN1Pct'),91.7);
js("core.choose(state,pages,'N1_LIMIT');update()");
assert.match(rightValue(1),/91\.7% EST/);
assert.match(nodes['n1-v6-est-status'].textContent,/ENG1 89\.5/);
assert.match(nodes['n1-v6-est-status'].textContent,/ENG2 89\.2/);
js("core.choose(state,pages,'TAKEOFF');update()");
assert.match(leftValue(3),/91\.7% EST/);
nodes['n1-v6-phase'].value='GO_AROUND';nodes['n1-v6-phase'].fire('change');
assert.match(leftValue(3),/93\.7% EST/);
nodes['n1-v6-lever'].value='0';nodes['n1-v6-lever'].fire('change');
assert.match(nodes['n1-v6-est-status'].textContent,/ENG1 20\.0/);
js("core.choose(state,pages,'N1_LIMIT');update()");
assert.match(rightValue(1),/93\.7% EST/);
assert.equal(js('n1EstimateV19().canDriveAutothrottle'),false);
console.log('PASS CDU v6 EST N1 LIMIT / TAKEOFF REF / PRESENT N1 indication without artwork changes');
