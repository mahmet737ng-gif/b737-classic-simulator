/* B737 Classic fire annunciator registration – on the 2172x724 bare plate.
 * Source of centers: fire-protection-lab/reference/unified-11-indicator-placement-v2.json
 * Only lamps mount here; fire handles and switch mechanics are not altered.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737UnifiedFireLampModel=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const BASE=Object.freeze({width:2172,height:724});
const LAMP_ROOT="../assets/locked/2026-10-23/LIGHTS/";
const AMBER_ROOT=LAMP_ROOT+"black-amber-v1/mounted/";
const GREEN_ROOT="../../fire-protection-lab/assets/";
const DERIVED_FACE_ROOT="./assets/fire-lamps-v2/";
const RECT_SIZE=Object.freeze({width:208,height:105}); // same low-pressure-size module, centered per aperture
const SLOTS=Object.freeze([
 {id:'ENG1_OVERHEAT',type:'rect',cx:287,cy:342,face:'ENG_1_OVERHEAT'},
 {id:'WHEEL_WELL',type:'rect',cx:812,cy:110,face:'WHEEL_WELL_RED'},
 {id:'FAULT',type:'rect',cx:813,cy:247,face:'FAULT'},
 {id:'APU_DET_INOP',type:'rect',cx:813,cy:382,face:'APU_DET_INOP'},
 {id:'APU_BOTTLE_DISCHARGED',type:'rect',cx:813,cy:529,face:'APU_BOTTLE_DISCHARGED'},
 {id:'ENG2_OVERHEAT',type:'rect',cx:1412,cy:365,face:'ENG_2_OVERHEAT'},
 {id:'L_BOTTLE_DISCHARGED',type:'rect',cx:1653,cy:138,face:'L_BOTTLE_DISCHARGED'},
 {id:'R_BOTTLE_DISCHARGED',type:'rect',cx:1864,cy:138,face:'R_BOTTLE_DISCHARGED'},
 {id:'EXT_L',type:'round',cx:1739,cy:400,radius:30},
 {id:'EXT_R',type:'round',cx:1872,cy:400,radius:30},
 {id:'EXT_APU',type:'round',cx:1807,cy:550,radius:30}
].map(x=>Object.freeze(x)));
const map=Object.freeze(Object.fromEntries(SLOTS.map(x=>[x.id,x])));
function file(slot,on){
 const suffix=on?'ON':'OFF';
 if(slot.type==='round')return GREEN_ROOT+'EXT_TEST_CIRCULAR_GREEN_'+suffix+'.svg';
 return DERIVED_FACE_ROOT+slot.id+'_'+suffix+'.svg';
}
function region(slot){
 const diameter=slot.type==='round'?slot.radius*2:null;
 const w=diameter||RECT_SIZE.width,h=diameter||RECT_SIZE.height;
 return {left:slot.cx-w/2,top:slot.cy-h/2,width:w,height:h};
}
function percent(slot){
 const g=region(slot);
 return {left:(g.left/BASE.width*100)+'%',top:(g.top/BASE.height*100)+'%',
 width:(g.width/BASE.width*100)+'%',height:(g.height/BASE.height*100)+'%'};
}
function validate(){
 if(SLOTS.length!==11||new Set(SLOTS.map(s=>s.id)).size!==11)throw Error('Fire lamp slot count/ID');
 for(const slot of SLOTS){
  const b=region(slot);
  if(b.left<0||b.top<0||b.left+b.width>BASE.width||b.top+b.height>BASE.height)throw Error('Fire lamp outside plate '+slot.id);
  for(const state of [false,true])if(!file(slot,state).endsWith(state?'_ON.svg':'_OFF.svg'))throw Error('Missing state '+slot.id);
 }
 const bottleL=map.L_BOTTLE_DISCHARGED,bottleR=map.R_BOTTLE_DISCHARGED;
 if(bottleL.cy!==bottleR.cy||bottleL.cx>=bottleR.cx)throw Error('Bottle lamps must be side by side, left to right');
 for(const slot of SLOTS.filter(x=>x.type==='round'))if(slot.radius!==30)throw Error('EXT lens must be 60 pixels');
 return true;
}
validate();
return Object.freeze({BASE,SLOTS,map,RECT_SIZE,file,region,percent,validate,source:'fire-protection-lab/reference/unified-11-indicator-placement-v2.json',version:'FIRELAMP-0002'});
});
