'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../panel-mosaic-lab/cockpit/isn-engine-gauge-model');
class Element{
 constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.dataset={};this.style={};this.classList={add(){}};}
 setAttribute(k,v){this.attrs[k]=String(v);}
 append(child){child.parentNode=this;this.children.push(child);}
 remove(){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
}
let piece=new Element('article');const events={};
const document={querySelector:()=>piece,createElementNS:(_,tag)=>new Element(tag)};
const window={B737ISNEngineGaugeModel:model,addEventListener:(name,fn)=>events[name]=fn};
vm.runInNewContext(fs.readFileSync(require.resolve('../panel-mosaic-lab/cockpit/isn-engine-gauges.js'),'utf8'),{document,window});
const api=window.B737EISNeedlesV1;
const all=node=>[node,...node.children.flatMap(all)];
const nodes=()=>all(piece);
const group=id=>nodes().find(n=>n.attrs['data-gauge']===id);
const pointer=id=>group(id).children.find(n=>'data-pointer' in n.attrs);
assert.equal(nodes().filter(n=>'data-gauge' in n.attrs).length,16);
assert.equal(nodes().filter(n=>n.tag==='line').length,16);
assert.equal(nodes().filter(n=>n.tag==='circle'||n.tag==='path').length,0);
for(const s of api.getSpecs()){
 const line=pointer(s.id).children[0];
 assert.ok(-Number(line.attrs.y1)>s.radius,'Needle starts outside its own dial');
 assert.ok(-Number(line.attrs.y2)>-Number(line.attrs.y1),'Needle extends radially outward');
 assert.equal(line.attrs['stroke-linecap'],'butt');
}
api.mount();events['b737:cockpit-mounted']();
assert.equal(piece.children.length,1,'Repeated mounts must not add duplicate needles');
const before=pointer('oilPressure_2').attrs.transform;
events['b737:unified-ecu-observation']({detail:{engines:{engine1:{n1Percent:60,n2Percent:70,egtC:400,
 fuelFlowKgHr:1200,oil:{pressurePsi:50,temperatureC:100},hydraulic:{engineDrivenPressurePsi:3000}}}}});
assert.notEqual(pointer('oilPressure_1').attrs.transform,before,'Engine 1 uses its own live pressure');
assert.equal(pointer('oilPressure_2').attrs.transform,before,'Engine 2 is independent');
assert.equal(api.getReadings().hydPressure_1.value,3000);
assert.equal(api.getReadings().fuelFlow_1.value,1200);
assert.equal(api.getReadings().vibration_1.value,null,'No invented vibration sensor');
assert.throws(()=>api.setReading('engine1','n1',NaN));
piece=new Element('article');events['b737:cockpit-mounted']();
assert.equal(nodes().filter(n=>n.tag==='line').length,16,'Remount restores every pointer');
assert.equal(api.getReadings().n1_1.value,60,'Remount retains live readings');
console.log('PASS: sixteen single peripheral lines, independent ECU routing, stable remounts and no invented sensor data.');
