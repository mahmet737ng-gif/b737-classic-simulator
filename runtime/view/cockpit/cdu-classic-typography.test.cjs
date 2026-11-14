'use strict';
/* Synthetic screen raster test for the approved Boeing Classic CRT type hierarchy.
 * Does not alter or redistribute the locked fonts or cockpit artwork. */
const assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const file=read('cdu-screen-fit-v6.js');
const physical=JSON.parse(read('../../cdu-standalone-v6/data/cdu-map.json'));
const lsk=physical.controls.filter(c=>/^CDU_CAPT_LSK_L[1-6]$/.test(c.id));
assert.equal(lsk.length,6,'Approved keymap must retain six left LSK row anchors');
function style(){const applied=new Map();return {
 applied,setProperty:(k,v)=>applied.set(k,String(v)),removeProperty:k=>applied.delete(k)
};}
function el(klass,text='',family='BoeingCDULarge',rectWidth=243){
 const classes=new Set(klass.split(' ').filter(Boolean));
 return {classList:{contains:x=>classes.has(x),add:x=>classes.add(x)},textContent:text,style:style(),family,
  getBoundingClientRect:()=>({width:rectWidth,bottom:395}),
  querySelectorAll:()=>[],
  querySelector:()=>null};
}
const header=el('fmc-line fmc-header');const pairs=[];
for(let i=0;i<6;i++){
 for(const small of [true,false]){
  const item=el('fmc-line fmc-pairline'+(small?' fmc-small':''),'',
   small?'BoeingCDUSmall':'BoeingCDULarge');
  const left=el('fmc-left',small?'GW/CRZ CG':'65.0','BoeingCDU'+(small?'Small':'Large'));
  const right=el('fmc-right',small?'CRZ ALT':'FL350','BoeingCDU'+(small?'Small':'Large'));
  item.querySelectorAll=()=>[left,right];pairs.push(item);
 }
}
// Input prompts are distinct from navigation LSK options; the large
// label/data scales must not inflate placeholder text.
pairs[3].querySelectorAll()[0].textContent='-----';
pairs[5].querySelectorAll()[1].textContent='□□□□';
pairs[7].querySelectorAll()[0].textContent='TRAINER';
pairs[9].querySelectorAll()[0].textContent='<ACTIVATE';
pairs[11].querySelectorAll()[1].textContent='LEGS>';
const scratch=el('fmc-line scratch fmc-pairline');
const scratchLeft=el('fmc-left full','A'.repeat(24),'BoeingCDULarge',520);
scratch.querySelector=x=>x==='.fmc-left'||x==='.fmc-left.full'?scratchLeft:null;
const all=[header,...pairs,scratch];
const box={style:style(),querySelector:x=>x==='.fmc-line.scratch'?scratch:
 x==='.fmc-line.fmc-small .fmc-left'?pairs[0].querySelectorAll()[0]:null,
 querySelectorAll:()=>all};
const screen={getBoundingClientRect:()=>({bottom:900})};
const canvasCtx={font:'',
 measureText(txt){const px=Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1]||44);
  return {width:px*.57*txt.length,actualBoundingBoxAscent:px*.69,
   actualBoundingBoxDescent:px*.01};}};
const root={location:{search:'?seat=FO'},CDU_MAP:{controls:physical.controls},
 B737CDU24ColumnMetricsV1:{TEST:'A'.repeat(24),COLUMNS:24,
  calibrate(_c,_width,family){return {valid:true,fontSizePx:family.includes('Small')?39:44}}},
 document:{documentElement:{dataset:{}},getElementById(id){return id==='fmc-lines'?box:screen},
  createElement:()=>({getContext:()=>canvasCtx})},
 getComputedStyle:item=>({fontFamily:item.family||'BoeingCDULarge',top:'0px'}),
 addEventListener:()=>{},requestAnimationFrame:fn=>fn()};
const context={window:root,URLSearchParams,MutationObserver:class{observe(){}},console};
vm.runInNewContext(file,context,{timeout:3000});
const api=root.B737CduScreenFitV6;
assert.ok(api,'FO runtime must have a typography calibration controller');
const registered=api.rowRegistration();
assert.equal(registered.label.length,6);
assert.equal(registered.value.length,6);
for(let i=0;i<6;i++){
 const cy=(lsk[i].bbox_px[1]+lsk[i].bbox_px[3])/2;
 const height=1312*.375,screenTop=1312*.0765;
 const shift=Math.max(0,cy-13-(565-4-height*.09));
 const expectedLabel=(cy-(i===0?42:50)-shift-screenTop)/height*100;
 const expectedValue=(cy-13-shift-screenTop)/height*100;
 assert.ok(Math.abs(registered.label[i]-expectedLabel)<.02,
  'Small label above physical LSK '+(i+1));
 assert.ok(Math.abs(registered.value[i]-expectedValue)<.02,
  'Large value centred on physical LSK '+(i+1));
 assert.ok(registered.label[i]<registered.value[i]);
 const rowGapPx=(registered.value[i]-registered.label[i])/100*height;
 // With line-height .78, the largest permitted title fits strictly
 // above its LSK value, with at least 5px empty space on the native panel.
 assert.ok(rowGapPx-(44*.73*.78)>=3.5,
  'Field label must not touch LSK value, row '+(i+1));
 assert.ok(cy-13-shift+height*.09<=561.01,
  'LSK text must finish before scratchpad '+(i+1));
}
assert.ok(registered.value[5]<registered.scratch);
const result=api.apply();
assert.equal(result.ready,true);
assert.equal(result.columns,24);
assert.equal(result.standard,true);
assert.equal(parseFloat(pairs[0].style.applied.get('font-size')),Number(result.labelPx.toFixed(2)),'small label font must match all CDU pages');
assert.equal(pairs[1].style.applied.get('font-size'),'44px','data values must equal the 24-column master font');
for(const [row,index] of [[3,0],[5,1],[7,0]]){
 const span=pairs[row].querySelectorAll()[index];
 assert.equal(span.style.applied.get('font-size'),'44px','entry boxes are native large-size glyphs');
 assert.ok(span.classList.contains('cdu-entry-placeholder'),'entry placeholder classification');
}
for(const [row,index] of [[9,0],[11,1]]){
 const action=pairs[row].querySelectorAll()[index];
 assert.equal(action.style.applied.get('font-size'),'44px','LSK prompts are native large-size glyphs');
 assert.ok(action.classList.contains('cdu-lsk-prompt'));
}
assert.ok(registered.value[5]<85,'last LSK safely before scratchpad');
assert.equal(result.pageValueMultiplier,1);
assert.equal(result.entryPromptMultiplier,1);
assert.equal(result.navigationPromptMultiplier,1);
assert.equal(result.pageLabelMultiplier,1);
assert.equal(scratch.style.applied.get('font-size'),'44px');
assert.ok(result.labelPx/44>=.68&&result.labelPx/44<=.73,
 'Labels are smaller than LSK data and must not overlap');
assert.equal(pairs[0].style.applied.get('top'),registered.label[0]+'%');
assert.equal(pairs[0].querySelectorAll()[0].style.applied.get('transform'),'none','labels must not be stretched');
assert.equal(pairs[1].style.applied.get('top'),registered.value[0]+'%');
assert.equal(root.document.documentElement.dataset.cduScreenFit,'CDU-24COL-0006');
assert.equal(root.CDU_MAP.controls.length,physical.controls.length,
 'Typography must not edit physical control map');
assert.equal(scratchLeft.style.applied.get('font-size'),undefined,
 'Scratchpad glyphs must retain 24-column calibration instead of per-fragment resizing');
console.log('PASS: Classic 737 CRT small labels, large LSK prompts, 6 physical LSK anchors, last row scratch clearance, exactly 24-column font calibration.');
