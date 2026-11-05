'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const font=require('../engine/instruments/eis-dot-digits-v1');
const model=require('../panel-mosaic-lab/cockpit/isn-engine-gauge-model');
assert.equal(Object.keys(font.glyphs).filter(k=>/^[0-9]$/.test(k)).length,10);
assert.equal(new Set(Object.values(font.glyphs).map(g=>JSON.stringify(g.points))).size,12);
assert.equal(font.glyphs['8'].width,13);assert.equal(font.glyphs['8'].height,21);
assert.ok(font.glyphs['8'].points.length>=50,'At least twice the previous 25-dot glyph');
assert.ok(20*font.style.pitch<20,'Digits are physically smaller than the original 20-pixel face');
for(const [input,expected]of [[0,'0.0'],[21.4,'21.4'],[64.6,'64.6'],[99.96,'100.0'],[-.01,'0.0'],[null,'--.-'],[NaN,'--.-']])
 assert.equal(font.format(input,{decimals:1}),expected);
assert.equal(font.format(511.6),'512');
assert.equal(font.format(1425,{integerDigits:5}),'1425');
for(const [kg,text]of [[0,'0.00'],[560,'0.56'],[565,'0.57'],[1200,'1.20'],[4000,'4.00']])
 assert.equal(font.format(kg,{divisor:1000,decimals:2,integerDigits:1}),text);
assert.equal(font.format(null,{divisor:1000,decimals:2}),'-.--');
assert.equal(font.format(1000,{integerDigits:3}),'---','Overflow cannot silently lose a digit');
assert.throws(()=>font.layout('A'));
const wheel=font.createWheel(9);
wheel.setColumn(10);wheel.step(1/60);
assert.ok(wheel.snapshot().phase>9&&wheel.snapshot().phase<10,'9 -> 0 rolls upward through the boundary');
for(let i=0;i<180;i++)wheel.step(1/60);
assert.equal(wheel.snapshot().phase,0);assert.equal(wheel.snapshot().moving,false);
wheel.setColumn(9);wheel.step(1/60);
assert.ok(wheel.snapshot().phase<0&&wheel.snapshot().phase>-1,'0 -> 9 rolls downward through the boundary');
for(let i=0;i<180;i++)wheel.step(1/60);
assert.equal(wheel.snapshot().phase,9);
wheel.setColumn(10009);
assert.ok(Math.abs(wheel.snapshot().target-wheel.snapshot().phase)<=20,'Huge data jumps cannot queue hundreds of revolutions');
const reversal=font.createWheel(0);reversal.setColumn(2);reversal.step(.02);reversal.setColumn(1);
assert.equal(reversal.snapshot().target,1,'A retarget during movement must not introduce an unwanted full revolution');
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
assert.equal(api.getReadings().fuelFlow_1.text,'1.20');
assert.equal(api.getReadings().fuelFlow_1.value,1200,'Conversion is display-only; raw kg/h is preserved');
assert.equal(api.getReadings().fuelFlow_1.displayUnit,'t/h');
assert.equal(nodes(piece).filter(n=>'data-eis-display-face' in n.attrs).length,10);
assert.equal(nodes(piece).filter(n=>'data-eis-tall-window' in n.attrs).length,8);
const n2Group=nodes(piece).find(n=>n.attrs['data-eis-readout']==='n2_1');
const fragments=nodes(n2Group).filter(n=>'data-eis-adjacent-digit' in n.attrs);
assert.deepEqual(fragments.map(n=>n.attrs.href),['#eis-dot-glyph-5','#eis-dot-glyph-7']);
assert.ok(fragments.every(n=>n.parentNode.parentNode.attrs['clip-path']&&n.parentNode.attrs.visibility==='visible'));
assert.ok(font.style.windowHeight>font.style.bodyHeight,'Last digit has a physically taller viewing window');
assert.equal(nodes(piece).length,count,'Live updates reuse prebuilt glyphs and digit cells');
api.mount();assert.equal(piece.children.length,1,'Mount is idempotent');
events['b737:unified-ecu-observation']({detail:{engines:{engine1:{...engine1,egtC:null}}}});
assert.equal(api.getReadings().egt_1.text,'---','Missing sensor must not retain a stale number');
assert.equal(api.getReadings().egt_2.text,'519','The other engine stays independent');
events['b737:isn-start-indications']({detail:{engines:{engine1:{fuelFlow:{value:350}}}}});
assert.equal(api.getReadings().fuelFlow_1.text,'1.20','A start estimate cannot reverse an authoritative ECU drum');
events['b737:unified-ecu-observation']({detail:{engines:{engine1:{n1Percent:21.4}}}});
assert.equal(api.getReadings().fuelFlow_1.text,'0.35','Omitted ECU fields cannot erase the observed start channel');
api.setReading('engine1','fuelFlow',565);
assert.equal(api.getReadings().fuelFlow_1.text,'0.57');
assert.equal(api.getReadings().fuelFlow_1.value,565);
piece=new Element('article');api.mount();
assert.equal(nodes(piece).filter(n=>'data-eis-readout' in n.attrs).length,10);
assert.equal(api.getReadings().n1_1.text,'21.4','Remount preserves state');
const css=fs.readFileSync(require.resolve('../panel-mosaic-lab/cockpit/eis-dot-readouts-v1.css'),'utf8');
assert.ok(css.includes('data-engine-indication="CONVENTIONAL"'));
// Exercise the real renderer with one deterministic browser-frame queue.
let frameClock=0,sequence=0;const queue=new Map(),animatedPiece=new Element('article');
const animatedWindow={B737EISDotDigitsV1:font,B737ISNEngineGaugeModel:model,addEventListener(){}};
const animatedDocument={querySelector:()=>animatedPiece,createElementNS:(_,tag)=>new Element(tag)};
vm.runInNewContext(fs.readFileSync(require.resolve('../panel-mosaic-lab/cockpit/eis-dot-readouts-v1.js'),'utf8'),{
 window:animatedWindow,document:animatedDocument,
 requestAnimationFrame:callback=>{queue.set(++sequence,callback);return sequence;},
 cancelAnimationFrame:id=>queue.delete(id)
});
const movingAPI=animatedWindow.B737EISDotReadoutsV1;
function frames(n){for(let i=0;i<n;i++){frameClock+=1000/60;const callbacks=[...queue.values()];queue.clear();for(const callback of callbacks)callback(frameClock);}}
movingAPI.setReading('engine1','n1',.1);movingAPI.setReading('engine2','n2',.1);
assert.equal(queue.size,1,'All active digit wheels share one animation frame loop');
frames(5);
let motion=movingAPI.getMotion().n1_1.at(-1);
assert.ok(motion.phase>0&&motion.phase<1&&motion.direction==='UP','The intermediate upward movement is visible');
const tape=nodes(animatedPiece).find(n=>'data-eis-digit-tape' in n.attrs&&n.attrs.transform&&n.attrs.transform!=='translate(0 0.0000)');
assert.ok(tape,'Real SVG glyphs translate between the two digit stops');
frames(180);assert.equal(queue.size,0,'The frame loop stops when all drums settle');
movingAPI.setReading('engine1','n1',0);frames(5);
motion=movingAPI.getMotion().n1_1.at(-1);
assert.ok(motion.phase>0&&motion.phase<1&&motion.direction==='DOWN','The intermediate downward movement is visible');
frames(180);assert.equal(queue.size,0);
assert.equal(movingAPI.getMotion().n1_1.at(-1).phase,0);
console.log('PASS dense EIS glyphs, bidirectional rolling/carry, rapid retargets, shared RAF, clipped windows and tonne/hour conversion.');
