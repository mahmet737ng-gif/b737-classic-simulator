'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const font=require('../engine/instruments/eis-dot-digits-v1');
const model=require('../panel-mosaic-lab/cockpit/isn-engine-gauge-model');
assert.equal(Object.keys(font.glyphs).filter(k=>/^[0-9]$/.test(k)).length,10);
assert.equal(new Set(Object.values(font.glyphs).map(g=>JSON.stringify(g.points))).size,12);
for(const [input,expected]of [[0,'0.0'],[21.4,'21.4'],[64.6,'64.6'],[99.96,'100.0'],[-.01,'0.0'],[null,'--.-'],[NaN,'--.-']])
 assert.equal(font.format(input,{decimals:1}),expected);
assert.equal(font.format(511.6),'512');
assert.equal(font.format(1425,{integerDigits:5}),'1425');
assert.equal(font.format(1000,{integerDigits:3}),'---','Overflow cannot silently lose a digit');
assert.throws(()=>font.layout('A'));
class Element{
 constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.dataset={};}
 setAttribute(k,v){this.attrs[k]=String(v);}
 append(c){c.parentNode=this;this.children.push(c);}
 remove(){this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null;}
}
let piece=new Element('article');const events={};
const document={querySelector:()=>piece,createElementNS:(_,tag)=>new Element(tag)};
const window={B737EISDotDigitsV1:font,B737ISNEngineGaugeModel:model,addEventListener:(n,fn)=>events[n]=fn};
vm.runInNewContext(fs.readFileSync(require.resolve('../panel-mosaic-lab/cockpit/eis-dot-readouts-v1.js'),'utf8'),{window,document});
const api=window.B737EISDotReadoutsV1;
const nodes=n=>[n,...n.children.flatMap(nodes)];
assert.equal(api.getSpecs().length,10,'Eight primary and two oil quantity numeric windows');
const count=nodes(piece).length;
const engine1={n1Percent:21.4,n2Percent:64.6,egtC:512,fuelFlowKgHr:1200,oil:{quantityPct:97}};
const engine2={...engine1,n1Percent:21.5,n2Percent:64.4,egtC:519};
events['b737:unified-ecu-observation']({detail:{engines:{engine1,engine2}}});
assert.equal(api.getReadings().n1_1.text,'21.4');assert.equal(api.getReadings().n1_2.text,'21.5');
assert.equal(api.getReadings().egt_1.text,'512');assert.equal(api.getReadings().egt_2.text,'519');
assert.equal(api.getReadings().n2_1.text,'64.6');assert.equal(api.getReadings().oilQuantity_1.text,'97');
assert.equal(nodes(piece).length,count,'Live updates reuse prebuilt glyphs and digit cells');
api.mount();assert.equal(piece.children.length,1,'Mount is idempotent');
events['b737:unified-ecu-observation']({detail:{engines:{engine1:{...engine1,egtC:null}}}});
assert.equal(api.getReadings().egt_1.text,'---','Missing sensor must not retain a stale number');
assert.equal(api.getReadings().egt_2.text,'519','The other engine stays independent');
events['b737:isn-start-indications']({detail:{engines:{engine1:{fuelFlow:{value:350}}}}});
events['b737:unified-ecu-observation']({detail:{engines:{engine1:{n1Percent:21.4}}}});
assert.equal(api.getReadings().fuelFlow_1.text,'350','Omitted ECU fields cannot erase the observed start channel');
piece=new Element('article');api.mount();
assert.equal(nodes(piece).filter(n=>'data-eis-readout' in n.attrs).length,10);
assert.equal(api.getReadings().n1_1.text,'21.4','Remount preserves state');
const css=fs.readFileSync(require.resolve('../panel-mosaic-lab/cockpit/eis-dot-readouts-v1.css'),'utf8');
assert.ok(css.includes('data-engine-indication="CONVENTIONAL"'));
console.log('PASS EIS dot glyphs 0-9, precision/carry, independent ECU values, missing data, remount and fixed DOM cost.');
