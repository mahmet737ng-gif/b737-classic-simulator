'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const visual=require('../golden-screen-diff-v1.js');
function img(positions){
 const w=30,h=16,pixels=new Uint8Array(w*h*4);for(let i=0;i<w*h;i++)pixels[i*4+3]=255;
 for(const [x,y] of positions){const j=(y*w+x)*4;pixels[j]=41;pixels[j+1]=255;pixels[j+2]=49;}
 return {width:w,height:h,rgba:pixels};
}
const baseline=Array.from({length:12},(_,j)=>Array.from({length:5},(_,k)=>[j+3,k+3])).flat();
test('No source golden or render can ever count as verified',()=>{
 assert.equal(visual.compare({actual:img(baseline)}).status,'BLOCKED_NO_FCOM_GOLDEN_REFERENCE');
 assert.equal(visual.compare({reference:img(baseline)}).status,'BLOCKED_NO_UNIFIED_RENDER');
});
test('Identical letter-ink mask passes only when real comparison evidence exists',()=>{
 const x=visual.compare({reference:img(baseline),actual:img(baseline)});
 assert.equal(x.passed,true);assert.equal(x.f1,1);
});
test('Missing or shifted CDU characters fail pixel comparison',()=>{
 const bad=baseline.map(([x,y])=>[x+7,y]);
 const x=visual.compare({reference:img(baseline),actual:img(bad)});
 assert.equal(x.passed,false);assert.equal(x.status,'VISUAL_DIFF_FAIL');
});
test('Wrong-size screenshots and empty references cannot be certified',()=>{
 assert.equal(visual.compare({reference:img(baseline),actual:{width:2,height:2,rgba:new Uint8Array(16)}}).status,'FRAME_GEOMETRY_MISMATCH');
 assert.equal(visual.compare({reference:img([]),actual:img(baseline)}).status,'EMPTY_OR_INVALID_FCOM_GOLDEN');
});
test('Passing visual similarity is still NOT automatic aircraft/software certification',()=>{
 const spec={verification:{full:'NOT_VERIFIED'},source:{folio:'11.40.32'}};
 const output=visual.certify(spec,{fcomGolden:img(baseline),runtimeImage:img(baseline),
  interactionTestPassed:true,installedSoftwareVerified:true,fcomFolio:'11.40.32'});
 assert.equal(output.visual.passed,true);
 assert.equal(output.certified,false);
 assert.equal(output.decision,'READY_FOR_HUMAN_SIGNOFF');
});
