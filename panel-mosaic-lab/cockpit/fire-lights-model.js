/* FIRELAMP-0006: individually cropped owner-approved source, image coordinates 2172x724. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737UnifiedFireLampModel=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const BASE=Object.freeze({width:2172,height:724}), IMAGE_ROOT='./assets/fire-v6/';
const data=[
 ['ENG1_OVERHEAT',182,289,243,110,'rect'],['WHEEL_WELL',682,104,261,114,'rect'],
 ['FAULT',682,218,261,115,'rect'],['APU_DET_INOP',682,333,261,119,'rect'],
 ['APU_BOTTLE_DISCHARGED',682,453,261,121,'rect'],['ENG2_OVERHEAT',1236,289,246,111,'rect'],
 ['L_BOTTLE_DISCHARGED',1698,103,176,117,'rect'],['R_BOTTLE_DISCHARGED',1875,103,181,117,'rect'],
 ['EXT_L',1763,373,72,73,'round'],['EXT_R',1859,373,72,73,'round'],['EXT_APU',1810,467,72,73,'round']
];
const SLOTS=Object.freeze(data.map(([id,x,y,w,h,type])=>Object.freeze({id,type,cx:x+w/2,cy:y+h/2,bounds:Object.freeze([x,y,w,h])})));
const map=Object.freeze(Object.fromEntries(SLOTS.map(s=>[s.id,s])));
function file(slot,on){if(!map[slot.id])throw Error('Unknown indicator '+slot.id);return IMAGE_ROOT+slot.id+'_'+(on?'ON':'OFF')+'.webp';}
function region(s){const [left,top,width,height]=s.bounds;return {left,top,width,height};}
function percent(s){const b=region(s);return {left:(b.left/BASE.width*100)+'%',top:(b.top/BASE.height*100)+'%',width:(b.width/BASE.width*100)+'%',height:(b.height/BASE.height*100)+'%'};}
function facePercent(){return {left:'0%',top:'0%',width:'100%',height:'100%'};}
function validate(){
 if(SLOTS.length!==11||new Set(SLOTS.map(s=>s.id)).size!==11)throw Error('Missing/duplicate lights');
 for(let i=0;i<SLOTS.length;i++){const a=SLOTS[i],b=region(a);
  if(b.left<0||b.top<0||b.left+b.width>BASE.width||b.top+b.height>BASE.height)throw Error('Outside plate '+a.id);
  if(a.cx!==b.left+b.width/2||a.cy!==b.top+b.height/2)throw Error('Center mismatch '+a.id);
  for(let j=i+1;j<SLOTS.length;j++){const c=region(SLOTS[j]);if(b.left<c.left+c.width&&c.left<b.left+b.width&&b.top<c.top+c.height&&c.top<b.top+b.height)throw Error('Light collision '+a.id+'/'+SLOTS[j].id);}
 }
 if(map.L_BOTTLE_DISCHARGED.cy!==map.R_BOTTLE_DISCHARGED.cy)throw Error('Bottle row mismatch');
 if(SLOTS.filter(s=>s.type==='round').some(s=>s.bounds[2]<70||s.bounds[3]<70))throw Error('Green lens undersized');
 return true;
}
validate();
return Object.freeze({BASE,SLOTS,map,file,region,faceRegion:region,percent,facePercent,legendPercent:facePercent,validate,source:'fire-protection-lab/reference/unified-fire-approved-v6.json',version:'FIRELAMP-0006'});
});