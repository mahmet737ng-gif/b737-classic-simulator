'use strict';
/* 737 Classic EADI radio-altitude presentation increments.
 * Only display digits are quantized. FCC/DH/audio keep full RA precision.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sandbox={
 EFISLabGlyphs:{colors:{white:'#fff',green:'#0f0',magenta:'#f0f',amber:'#fb0',red:'#f00'}},
 B737EfisReferenceGeometry:{eadi:{center:[320,320],attitude:{pitchPerDeg:6},
  radioAltitude:{x:463,y:525,size:42}}},
 console
};
vm.runInNewContext(read('efis-display-lab/eadi.js'),sandbox,{filename:'eadi.js',timeout:3000});
const display=sandbox.EFISDisplayLabEadi.radioAltitudeDisplayFt;

test('RA 20-ft displayed increments from 1000 ft upward',()=>{
 assert.equal(display(2860),2860);
 assert.equal(display(2856),2860);
 assert.equal(display(2844),2840);
 assert.equal(display(2820),2820);
 assert.equal(display(1001),1000);
 assert.equal(display(1000),1000);
 assert.equal(display(2560),2560);
 assert.equal(display(2501),2500);
});

test('RA 10-ft displayed increments between 100 and 1000 ft',()=>{
 for(const [input,shown] of [[999,1000],[996,1000],[994,990],[980,980],
  [455,460],[446,450],[120,120],[119,120],[111,110],[105,110],[104,100],[100,100]])
  assert.equal(display(input),shown,'RA '+input+' ft');
});

test('RA increments in single feet below 100 ft',()=>{
 for(const [input,shown] of [[99,99],[98,98],[91,91],[50,50],[9,9],
  [1.49,1],[1.51,2],[0,0],[-1,0],[-30,0]])
  assert.equal(display(input),shown,'RA '+input+' ft');
});

test('RA invalid data stays invalid, not a fabricated zero',()=>{
 for(const input of [null,undefined,NaN,Infinity,-Infinity,'1000'])
  assert.equal(display(input),null,String(input));
});

test('RA presented values remain multiples of selected increment',()=>{
 for(let alt=0;alt<=3500;alt+=.7){
  const x=display(alt);
  const step=alt>=1000?20:alt>=100?10:1;
  assert.equal(x%step,0,'raw RA '+alt+' ft');
 }
});

test('digit changes in descending RA do not reverse or exceed mode steps',()=>{
 let previous=Infinity;
 for(let alt=3500;alt>=0;alt-=.1){
  const shown=display(alt);
  assert.ok(shown<=previous,'display moved upward at '+alt+' ft');
  previous=shown;
 }
});

test('both EADI dial and digital views use shared 20/10/1 formatter',()=>{
 const source=read('efis-display-lab/eadi.js');
 assert.match(source,/const displayedRa=radioAltitudeDisplayFt\(v\.radioAlt\);/);
 assert.match(source,/txt\(c,displayedRa,x,y,27,color,'center'\)/);
 assert.match(source,/txt\(c,displayedRa,G\.radioAltitude\.x,G\.radioAltitude\.y/);
 assert.doesNotMatch(source,/Math\.round\(v\.radioAlt\)/);
 assert.match(source,/canvas\.dataset\.radioAltitudeDisplayFt=/);
});

test('radio altitude DH and callout runtime keep the accurate unquantized signal',()=>{
 const displaySource=read('panel-mosaic-lab/cockpit/eadi-lab-unified-v2.js');
 const audio=read('panel-mosaic-lab/cockpit/radio-altimeter-audio-runtime-v1.js');
 assert.match(displaySource,/trackDh\(seat,cp,radAlt,powered\)/);
 assert.match(displaySource,/radioAltFt:radAlt/);
 assert.match(audio,/radioAltitudeFt:ra,minimumsRadioFt:dh/);
 assert.doesNotMatch(audio,/radioAltitudeDisplayFt/);
});
