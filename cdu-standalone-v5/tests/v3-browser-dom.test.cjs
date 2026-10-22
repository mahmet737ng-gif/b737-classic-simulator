'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const map=JSON.parse(fs.readFileSync(path.join(root,'data/cdu-map.json'))),pages=JSON.parse(fs.readFileSync(path.join(root,'data/page-definitions.json'))).pages;
const core=require('../engine/cdu-engine.js');
class E{constructor(){this.children=[];this.style={};this.dataset={};this.events={};this.attributes={};this.className='';this.textContent='';this.value='';this.hidden=false;this.checked=false;this.classList={add:n=>{const s=new Set(this.className.split(' ').filter(Boolean));s.add(n);this.className=[...s].join(' ')},toggle:(name,on)=>{if(on===undefined)on=!this.className.split(' ').includes(name);const cs=new Set(this.className.split(' ').filter(Boolean));if(on)cs.add(name);else cs.delete(name);this.className=[...cs].join(' ')},contains:n=>this.className.split(' ').includes(n)}}
appendChild(x){this.children.push(x);x.parent=this;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(y=>y!==this);}replaceChildren(...xs){this.children=[...xs]};addEventListener(t,f){(this.events[t]??=[]).push(f)}setAttribute(k,v){this.attributes[k]=v;}fire(t,v={}){for(const f of this.events[t]??[])f(v)}}
const nodes={},document={getElementById:n=>nodes[n]??(nodes[n]=new E()),createElement:()=>new E(),addEventListener:()=>{}};
const window={CDU_MAP:map,CDU_PAGES:pages,CDU_ENGINE:core};
const sandbox={document,window,MutationObserver:class{observe(){}},console,setTimeout,clearTimeout};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),sandbox);
assert.equal(nodes.clickmap.children.length,70);assert.equal(nodes.annunciators.children.length,5);assert.equal(nodes['fmc-lines'].children.length,14);assert.equal(nodes['page-now'].textContent,'INDEX');
let send=k=>vm.runInContext(`send('CDU_CAPT_${k}')`,sandbox);
send('RTE');for(const k of 'OIII')send('KEY_'+k);send('LSK_L1');assert.equal(nodes['pending-now'].textContent,0);assert(!nodes['annunciators'].children.find(x=>x.id==='CDU_CAPT_EXEC_LIGHT').classList.contains('on'));send('LSK_L5');assert.equal(nodes['pending-now'].textContent,1);assert(nodes['annunciators'].children.find(x=>x.id==='CDU_CAPT_EXEC_LIGHT').classList.contains('on'));
send('EXEC');assert.equal(nodes['pending-now'].textContent,0);assert(!nodes['annunciators'].children.find(x=>x.id==='CDU_CAPT_EXEC_LIGHT').classList.contains('on'));
send('INIT_REF');send('LSK_R2');assert.equal(nodes['page-now'].textContent,'PERF_INIT');assert.equal(nodes['fmc-lines'].children.length,14);assert(nodes['current-reference'].textContent.includes('11.40.37'));
send('KEY_2');send('KEY_0');send('KEY_1');send('LSK_L5');assert(nodes['annunciators'].children.find(x=>x.id==='CDU_CAPT_MSG_LIGHT').classList.contains('on'));
send('KEY_CLR');assert(!nodes['annunciators'].children.find(x=>x.id==='CDU_CAPT_MSG_LIGHT').classList.contains('on'));
assert(!fs.readFileSync(path.join(root,'app.js'),'utf8').includes("$('fmc-screen').style.opacity"),'screen cover cannot be dimmed');
send('DIM_BRT');assert.equal(nodes['fmc-lines'].style.opacity,0.4);
for(const line of nodes['fmc-lines'].children){const spans=line.children.filter(x=>x.className?.startsWith('fmc-'));for(const el of spans)assert(el.textContent.length<=24,'column text too long');} const firstPair=nodes['fmc-lines'].children[1]; assert(firstPair.children.some(x=>x.className==='fmc-right'), 'right LSK text must have a distinct right anchored field');
console.log('PASS mocked DOM integration: 70 interactive hotspots, 5 backlit outputs, 14 lines, RTE/PERF INIT, CI L5, EXEC, MSG, DIM framebuffer');