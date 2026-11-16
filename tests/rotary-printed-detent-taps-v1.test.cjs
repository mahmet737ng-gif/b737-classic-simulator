'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const efis=read('panel-mosaic-lab/cockpit/efis-pedestal-raster-v1.js');
const overhead=read('panel-mosaic-lab/interactive-overhead/rotary-guards.js');
const vbr=read('panel-mosaic-lab/cockpit/asp-vbr-selector-v1.js');
const irs=read('panel-mosaic-lab/cockpit/irs-msu-detent-labels-v1.js');
const html=read('panel-mosaic-lab/cockpit/index.html');
const stage=read('panel-mosaic-lab/cockpit/overhead-stage.html');
const EIS=require('../panel-mosaic-lab/cockpit/eis-autobrake-physical-v1.js');
const CONV=require('../panel-mosaic-lab/cockpit/conventional-physical-controls-v1.js');
test('EFIS all seven mode and six range printed legend centers select exactly their real detents',()=>{
 const start=efis.indexOf('const MODE_HITS='),end=efis.indexOf('const states=',start);
 assert.ok(start>=0&&end>start);
 const source=efis.slice(start,end);
 const f=vm.runInNewContext(source+'\n({mode:MODE_HITS,range:RANGE_HITS,nearestLabel,LABEL_HIT_SIZE})');
 assert.deepEqual(Object.keys(f.mode).sort(),['FULL_NAV','FULL_VOR_ILS','EXP_NAV','EXP_VOR_ILS','MAP','CTR_MAP','PLAN'].sort());
 assert.deepEqual(Object.keys(f.range).map(Number).sort((a,b)=>a-b),[10,20,40,80,160,320]);
 for(const [kind,table]of [['mode',f.mode],['range',f.range]])
  for(const [key,coordinates]of Object.entries(table)){
   const hit=f.nearestLabel(...coordinates);
   assert.equal(hit.kind,kind,key+' kind');
   assert.equal(String(hit.value),key,key+' label');
   assert.ok(f.LABEL_HIT_SIZE[kind][key][0]>=80,'Tap target enlarged beyond old 2.1% circle');
  }
 assert.equal(f.nearestLabel(20,20),null,'Blank photo outside printed labels must not change a mode');
 assert.match(efis,/change\(seat,kind,kind==='range'\?Number\(value\):value\)/);
 assert.match(efis,/parts\.detents\.push\(b\)/);
 assert.match(efis,/b\.setAttribute\('aria-pressed'/);
 assert.match(html,/efis-pedestal-raster-v1\.js\?v=EFIS-LABEL-TAPS-0004/);
});

test('EIS and Conventional autobrake share the same six hard-stop detent bearings',()=>{
 const values=['RTO','OFF','1','2','3','MAX'];
 assert.deepEqual(EIS.DETENTS,values);
 assert.deepEqual(CONV.DETENTS,values);
 assert.deepEqual(EIS.ANGLES,CONV.ANGLES);
 const e=read('panel-mosaic-lab/cockpit/eis-autobrake-physical-v1.js');
 const c=read('panel-mosaic-lab/cockpit/conventional-physical-controls-v1.js');
 for(const [file,src,mode]of [['EIS',e,'EIS'],['CONV',c,'CONVENTIONAL']]){
  assert.match(src,/function placeDetentLabels\(/,file);
  assert.match(src,/set\(detent,'printed-label-tap'\)|set\(value,'printed-label-tap'\)/,file);
  assert.ok(src.includes('data')&&src.includes('aria-pressed'));
  assert.ok(src.includes("dataset.autobrakeInstallation='"+mode+"'"),file+' mode gate');
 }
 const style=read('panel-mosaic-lab/cockpit/eis-autobrake-physical-v1.css');
 assert.match(style,/data-autobrake-installation="EIS"/);
 assert.match(style,/data-autobrake-installation="CONVENTIONAL"/);
 assert.match(style,/display:none;pointer-events:none/,'Inactive detent taps cannot intercept input');
});

test('Both ASP stations and OBS printed V/B/R labels route through actual rotor state',()=>{
 assert.match(vbr,/const LEGEND=Object\.freeze\(\{V:/);
 assert.match(vbr,/choose\(rotor,model\.positions\.indexOf\(position\)\)/);
 assert.match(vbr,/mountLabels\(host,button,seat\)/);
 assert.match(stage,/asp-vbr-selector-v1\.js\?v=ASP-VBR-LABEL-TAPS-0002/);
 assert.match(html,/asp-vbr-selector-v1\.js\?v=ASP-VBR-LABEL-TAPS-0002/);
});

test('IRS L and R OFF/ALIGN/NAV/ATT labels go through trainer safety and power model',()=>{
 assert.match(irs,/const MODES=Object\.freeze\(\['OFF','ALIGN','NAV','ATT'\]\)/);
 assert.match(irs,/owner\.setMode\(side,mode\)/);
 assert.match(irs,/root\.B737IRSRotaryIndices\?\.angles/);
 assert.match(irs,/b737:irs-trainer-state/);
 assert.match(html,/irs-msu-detent-labels-v1\.js\?v=IRS-MSU-LABEL-TAPS-0001/);
 const protectedSrc=read('panel-mosaic-lab/cockpit/irs-rotary-detent-indices-v1.js');
 assert.match(protectedSrc,/IRS-INDEX-0002/);
});

test('Overhead labels preserve source-measured polygons, otherwise choose real detent-angle targets',()=>{
 assert.match(overhead,/c\.legendAreas\?model\.legendHotspots\(c,placement,points\.mapPoint\)/);
 assert.match(overhead,/unmeasuredLegendTargets\(c,placement\)/);
 assert.match(overhead,/engine\.setRotary\(c\.id,hit\.state,'legend-tap'\)/);
 assert.match(overhead,/c\.mode==='detent'&&c\.id!=='ignition-source'/);
 assert.match(overhead,/model\.detentAngles\(c\)/);
 assert.match(overhead,/METER_ALIAS/);
 assert.match(overhead,/owner\.choose\(side,mapped\)/);
 assert.ok(!overhead.includes("if(c.mode==='continuous')mountLegendTargets"),'Continuous dimmers are not discrete labeled detents');
 assert.match(stage,/LABEL-DETENT-FALLBACK-0002/);
});
