'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),map=require('../data/cdu-map.json'),engine=require('../fmc-runtime-v2.js');
class Element {
 constructor(id){this.id=id;this.dataset={};this.style={};this.children=[];this.listeners={};this.attributes={};this.classList={toggle:()=>{}};this.textContent='';}
 setAttribute(k,v){this.attributes[k]=v}
 addEventListener(k,fn){this.listeners[k]=fn}
 append(x){this.children.push(x)}
 appendChild(x){this.children.push(x)}
 replaceChildren(...x){this.children=x}
}
const els={};
const document={getElementById:id=>els[id]||(els[id]=new Element(id)),createElement:type=>new Element(type)};
const window={CDU_MAP:map,CH11_FMC_RUNTIME_V2:engine};
vm.runInNewContext(fs.readFileSync(path.join(base,'physical-cdu/app.js'),'utf8'),{window,document,setTimeout,clearTimeout});
const api=window.CH11_PHYSICAL_LAB_QA;
assert.ok(api);assert.equal(api.getControlCount(),70);
assert.equal(els.clickmap.children.length,70);
assert.equal(els.annunciators.children.length,5);
const key=els.clickmap.children[0],c=map.controls[0];
assert.equal(key.style.left,c.bbox_px[0]/1199*100+'%');
assert.equal(key.style.top,c.bbox_px[1]/1312*100+'%');
function p(k){api.press('CDU_CAPT_'+k)}
function chars(s){for(const c of s)p('KEY_'+c)}
p('RTE');chars('OIII');p('LSK_L1');chars('OIMM');p('LSK_R1');
let s=api.readState();assert.equal(s.route.draft.ORIGIN,'OIII');assert.equal(s.route.draft.DEST,'OIMM');
assert.equal(s.route.active.ORIGIN,'');assert.equal(s.lights.EXEC,false);
p('DEP_ARR');assert.equal(els['fmc-lines'].children[2].textContent.includes('OIII'),true);
assert.equal(els['fmc-lines'].children[2].textContent.includes('OIMM'),true);
p('RTE');p('LSK_R6');assert.equal(api.readState().lights.EXEC,true);
p('EXEC');s=api.readState();
assert.equal(s.route.active.ORIGIN,'OIII');assert.equal(s.route.active.DEST,'OIMM');
assert.equal(s.lights.EXEC,false);assert.equal(s.guidance.AFDS_AUTHORITY,false);
assert.equal(s.guidance.LNAV,false);assert.equal(s.guidance.VNAV,false);
assert.equal(s.guidance.actuator_commands.length,0);
console.log('PASS: 70 original physical button boxes and Chapter11 RTE/DEP-ARR/ACTIVATE/EXEC wiring; no AFDS authority');
