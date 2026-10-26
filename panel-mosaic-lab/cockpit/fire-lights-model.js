/* B737 Classic fire annunciator registration – on the 2172x724 bare plate.
 * Source of physical aperture corners: fire-protection-lab/reference/unified-11-indicator-aperture-audit-v3.json
 * Only lamps mount here; fire handles and switch mechanics are not altered.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737UnifiedFireLampModel=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const BASE=Object.freeze({width:2172,height:724});
const LAMP_ROOT="../assets/locked/2026-10-23/LIGHTS/";
const AMBER_ROOT=LAMP_ROOT+"black-amber-v1/mounted/";
const GREEN_ROOT="../../fire-protection-lab/assets/";
const DERIVED_FACE_ROOT="./assets/fire-lamps-v2/";
const RECT_SIZE=Object.freeze({kind:'per-slot-aperture',comment:'Black opening without covering corner screws'}); // same low-pressure-size module, centered per aperture
const SLOTS=Object.freeze([
 {id:'ENG1_OVERHEAT',type:'rect',cx:293,cy:348,bounds:[215,317,156,62]},
 {id:'WHEEL_WELL',type:'rect',cx:785,cy:153.5,bounds:[718,119,134,69]},
 {id:'FAULT',type:'rect',cx:785,cy:272.5,bounds:[718,238,134,69]},
 {id:'APU_DET_INOP',type:'rect',cx:785,cy:391.5,bounds:[718,357,134,69]},
 {id:'APU_BOTTLE_DISCHARGED',type:'rect',cx:785,cy:510.5,bounds:[718,476,134,69]},
 {id:'ENG2_OVERHEAT',type:'rect',cx:1377,cy:350.5,bounds:[1297,318,160,65]},
 {id:'L_BOTTLE_DISCHARGED',type:'rect',cx:1803.5,cy:150,bounds:[1747,117,113,66]},
 {id:'R_BOTTLE_DISCHARGED',type:'rect',cx:1983.5,cy:150,bounds:[1927,117,113,66]},
 {id:'EXT_L',type:'round',cx:1832,cy:416,radius:30},
 {id:'EXT_R',type:'round',cx:1927,cy:416,radius:30},
 {id:'EXT_APU',type:'round',cx:1881,cy:504,radius:30}
].map(x=>Object.freeze(x)));
const map=Object.freeze(Object.fromEntries(SLOTS.map(x=>[x.id,x])));
function file(slot,on){
 const suffix=on?'ON':'OFF';
 if(slot.type==='round')return GREEN_ROOT+'EXT_TEST_CIRCULAR_GREEN_'+suffix+'.svg';
 return DERIVED_FACE_ROOT+slot.id+'_'+suffix+'.svg';
}
function region(slot){
 if(slot.type==='rect'){const [left,top,width,height]=slot.bounds;return {left,top,width,height};}
 const diameter=slot.radius*2;return {left:slot.cx-slot.radius,top:slot.cy-slot.radius,width:diameter,height:diameter};
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
  if(slot.type==='rect'&&(Math.abs(slot.cx-(b.left+b.width/2))>0.1||Math.abs(slot.cy-(b.top+b.height/2))>0.1))throw Error('Aperture centroid mismatch '+slot.id);
  if(b.left<0||b.top<0||b.left+b.width>BASE.width||b.top+b.height>BASE.height)throw Error('Fire lamp outside plate '+slot.id);
  for(const state of [false,true])if(!file(slot,state).endsWith(state?'_ON.svg':'_OFF.svg'))throw Error('Missing state '+slot.id);
 }
 const bottleL=map.L_BOTTLE_DISCHARGED,bottleR=map.R_BOTTLE_DISCHARGED;
 if(bottleL.cy!==bottleR.cy||bottleL.cx>=bottleR.cx)throw Error('Bottle lamps must be side by side, left to right');
 for(const slot of SLOTS.filter(x=>x.type==='round'))if(slot.radius!==30)throw Error('EXT lens must be 60 pixels');
 return true;
}
validate();
return Object.freeze({BASE,SLOTS,map,RECT_SIZE,file,region,percent,validate,source:'fire-protection-lab/reference/unified-11-indicator-aperture-audit-v3.json',version:'FIRELAMP-0003'});
});
