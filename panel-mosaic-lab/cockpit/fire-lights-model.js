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
 {id:'ENG1_OVERHEAT',type:'rect',frameBounds:[177,296,227,119],cx:293,cy:348,bounds:[215,317,156,62]},
 {id:'WHEEL_WELL',type:'rect',frameBounds:[681,101,208,105],cx:785,cy:153.5,bounds:[718,119,134,69]},
 {id:'FAULT',type:'rect',frameBounds:[681,220,208,105],cx:785,cy:272.5,bounds:[718,238,134,69]},
 {id:'APU_DET_INOP',type:'rect',frameBounds:[681,339,208,105],cx:785,cy:391.5,bounds:[718,357,134,69]},
 {id:'APU_BOTTLE_DISCHARGED',type:'rect',frameBounds:[681,458,208,105],cx:785,cy:510.5,bounds:[718,476,134,69]},
 {id:'ENG2_OVERHEAT',type:'rect',frameBounds:[1258,294,237,121],cx:1377,cy:350.5,bounds:[1297,318,160,65]},
 {id:'L_BOTTLE_DISCHARGED',type:'rect',frameBounds:[1716,100,175,99],cx:1803.5,cy:150,bounds:[1747,117,113,66]},
 {id:'R_BOTTLE_DISCHARGED',type:'rect',frameBounds:[1896,100,175,99],cx:1983.5,cy:150,bounds:[1927,117,113,66]},
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
function boundsAsRegion(bounds){const [left,top,width,height]=bounds;return {left,top,width,height};}
function faceRegion(slot){
 if(slot.type==='rect')return boundsAsRegion(slot.bounds);
 return region(slot);
}
function region(slot){
 if(slot.type==='rect')return boundsAsRegion(slot.frameBounds);
 const diameter=slot.radius*2;return {left:slot.cx-slot.radius,top:slot.cy-slot.radius,width:diameter,height:diameter};
}
function percent(slot){
 const g=region(slot);
 return {left:(g.left/BASE.width*100)+'%',top:(g.top/BASE.height*100)+'%',
 width:(g.width/BASE.width*100)+'%',height:(g.height/BASE.height*100)+'%'};
}
function facePercent(slot){
 const frame=region(slot),glass=faceRegion(slot);
 return {left:((glass.left-frame.left)/frame.width*100)+'%',top:((glass.top-frame.top)/frame.height*100)+'%',
 width:(glass.width/frame.width*100)+'%',height:(glass.height/frame.height*100)+'%'};
}
/* The photographic panel already contains its metal bezel and four screws.
 * Put the database legend on the WHOLE measured housing as a transparent
 * lighting pass (screen blend), without repainting metal. Inset glass geometry
 * remains independently measurable and unchanged for strict QA. */
function legendPercent(slot){
 return slot.type==='rect'
  ? {left:'0%',top:'0%',width:'100%',height:'100%'}
  : facePercent(slot);
}
function validate(){
 if(SLOTS.length!==11||new Set(SLOTS.map(s=>s.id)).size!==11)throw Error('Fire lamp slot count/ID');
 for(const slot of SLOTS){
  const b=region(slot);
  if(slot.type==='rect'&&(Math.abs(slot.cx-(faceRegion(slot).left+faceRegion(slot).width/2))>0.1||Math.abs(slot.cy-(faceRegion(slot).top+faceRegion(slot).height/2))>0.1))throw Error('Aperture centroid mismatch '+slot.id);
  if(b.left<0||b.top<0||b.left+b.width>BASE.width||b.top+b.height>BASE.height)throw Error('Fire lamp outside plate '+slot.id);
  if(slot.type==='rect'){const g=faceRegion(slot);if(g.left<b.left||g.top<b.top||g.left+g.width>b.left+b.width||g.top+g.height>b.top+b.height)throw Error('Face outside frame '+slot.id);}
  for(const state of [false,true])if(!file(slot,state).endsWith(state?'_ON.svg':'_OFF.svg'))throw Error('Missing state '+slot.id);
 }
 const bottleL=map.L_BOTTLE_DISCHARGED,bottleR=map.R_BOTTLE_DISCHARGED;
 if(bottleL.cy!==bottleR.cy||bottleL.cx>=bottleR.cx)throw Error('Bottle lamps must be side by side, left to right');
 for(const slot of SLOTS.filter(x=>x.type==='round'))if(slot.radius!==30)throw Error('EXT lens must be 60 pixels');
 return true;
}
validate();
return Object.freeze({BASE,SLOTS,map,RECT_SIZE,file,region,faceRegion,percent,facePercent,legendPercent,validate,source:'fire-protection-lab/reference/unified-11-indicator-frame-glass-v4.json',version:'FIRELAMP-0005'});
});
