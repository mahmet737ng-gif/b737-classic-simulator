'use strict';
// Regression: source-photo readouts are separate from all physical needle pivots.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const digits=read('eis-dot-readouts-v1.js'),needleJs=read('conventional-engine-needles-v1.js');
const needleCss=read('conventional-engine-needles-v1.css'),digitCss=read('eis-dot-readouts-v1.css');
const live=read('engine-indication-live-v2.js'),html=read('index.html');
function readObject(name,source){
 const start=source.indexOf('const '+name+'=Object.freeze(');
 assert.ok(start>=0,name+' registry not found');
 const body=source.slice(start+'const '.length+name.length+'=Object.freeze('.length);
 const end=body.indexOf(');');assert.ok(end>0,'Unterminated '+name);
 return vm.runInNewContext(body.slice(0,end));
}
const windows=readObject('CONVENTIONAL_APERTURES',digits),centers=readObject('CENTERS',needleJs);
const expected={n1:[[424,401],[597,401]],egt:[[424,555],[597,555]],
 n2:[[422,706],[597,706]],fuelFlow:[[423,869],[597,869]]};
assert.deepEqual(JSON.parse(JSON.stringify(windows)),expected,'All eight conventional drums fitted to one owner-marked upper window');
for(const [signal,apertures] of Object.entries(expected))for(const [side,[x,y]] of apertures.entries()){
 const [needleX,needleY]=centers[signal][side];
 assert.equal(needleX-x,3,signal+' exact photo slot horizontal offset');
 assert.equal(needleY-y,signal==='n1'?26:41,
  signal+' raised top-window photo slot offset');
}
assert.ok(digits.includes("specs.filter(s=>s.signal!=='oilQuantity').map"),
 'Conventional oil quantity must not add numeric overlay');
assert.ok(digits.includes("id:'oilQuantity_'+n"),
 'EIS oil-quantity digital readout remains supported');
assert.ok(needleJs.includes("const SPECS=Object.freeze(ROWS.flatMap("),
 'All sixteen photographic needles must mount');
assert.ok(needleJs.includes("href:PHOTO"),'Keep N1 photographic needle asset for every analog gauge');
assert.match(needleCss,/z-index:8;/);
assert.ok(digits.includes("'data-conventional-backplate':spec.id"),
 'Restore the unmasked dark rectangular background for N2 and all other primary Conventional dials');
assert.ok(digits.includes("group.dataset.photoWindow='OWNER_RED_RECT_1920'"),
 'All eight Conventional readouts must be confined to the marked physical rectangle');
assert.ok(digits.includes("x:lastX-5,y:-5,width:23,height:31"),
 'Conventional preview digits must not overflow the target photograph aperture');
assert.match(digitCss,/conventional-dot-readouts-v1[^\n]+z-index:6/);
assert.ok(live.includes("group.style.visibility='visible'"),'Physical pointers must remain visible');
for(const ver of ['EIS-CONV-DRUM-0011-RAISED-DIGITS-ALL-FACES','EIS-CONV-DRUM-0008-CONV-LAYER',
'CONV-FULL-NEEDLES-0002-ABOVE-DIGITS','CONV-DIAL-TICKS-0007-ALL-DIAL-MARKS-N2-LOCK','ENG-LIVE-0002-CONTROLS-FIX01&amp;drums=EIS-CONV-DRUM-0008'])
 assert.ok(html.includes(ver),'Cached module missing revision '+ver);
console.log('PASS: eight photo readouts, all needles front, no oil digital Conventional, unchanged EIS.');
