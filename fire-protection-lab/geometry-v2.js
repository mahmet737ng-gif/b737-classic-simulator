/* Photo registration v2: normalized to the 900×300 source-image footprint
 * in user screenshot 2026-10-26. Provisional image registration, NOT pixel signoff.
 * Slot dimensions are independent; never use one-size-fits-all images.
 */
(function(root,factory){const result=factory();if(typeof module==='object'&&module.exports)module.exports=result;else root.B737FirePanelGeometry=result;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const BASE={width:900,height:300,screenX:528,screenY:229};
 const slots={
  ENG1_OVERHEAT:          {x:12.9,y:51.8,w:7.9,h:10.2,slot:'ENG 1 OVHT'},
  ENG2_OVERHEAT:          {x:64.2,y:51.8,w:8.0,h:10.2,slot:'ENG 2 OVHT'},
  WHEEL_WELL:             {x:36.2,y:27.5,w:9.6,h:11.4,slot:'WHEEL WELL'},
  FAULT:                  {x:36.2,y:41.4,w:9.5,h:10.3,slot:'FAULT'},
  APU_DET_INOP:           {x:36.2,y:55.1,w:9.5,h:10.3,slot:'APU DET INOP'},
  APU_BOTTLE_DISCHARGED:  {x:36.2,y:69.3,w:9.5,h:10.3,slot:'APU BOTTLE',assetPending:false},
  L_BOTTLE_DISCHARGED:    {x:76.8,y:29.0,w:7.8,h:9.7,slot:'L BOTTLE DISCHARGED'},
  R_BOTTLE_DISCHARGED:    {x:85.9,y:29.0,w:7.8,h:9.7,slot:'R BOTTLE DISCHARGED'},
  EXT_L:                  {x:86.5,y:64.5,w:2.9,h:8.2,slot:'EXT L TEST',type:'green-lens'},
  EXT_R:                  {x:92.0,y:64.5,w:2.9,h:8.2,slot:'EXT R TEST',type:'green-lens'},
  EXT_APU:                {x:89.3,y:74.0,w:2.9,h:8.2,slot:'EXT APU TEST',type:'green-lens'},
  HANDLE_ENG1:            {x:21.3,y:65.0,w:8.8,h:49.0,slot:'ENGINE 1 HANDLE',type:'handle'},
  HANDLE_APU:             {x:49.9,y:65.0,w:10.8,h:49.0,slot:'APU HANDLE',type:'handle'},
  HANDLE_ENG2:            {x:78.9,y:65.0,w:10.8,h:49.0,slot:'ENGINE 2 HANDLE',type:'handle'}
 };
 function rect(g){return {l:g.x-g.w/2,r:g.x+g.w/2,t:g.y-g.h/2,b:g.y+g.h/2};}
 function overlap(a,b){return Math.min(a.r,b.r)>Math.max(a.l,b.l)&&Math.min(a.b,b.b)>Math.max(a.t,b.t);}
 function collisions(){const keys=Object.keys(slots).filter(k=>!slots[k].assetPending);const found=[];for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){const A=keys[i],B=keys[j];if(overlap(rect(slots[A]),rect(slots[B])))found.push([A,B]);}return found;}
 return Object.freeze({BASE,slots,collisions,version:'3.0.0',status:'screenshot anchored; 4-lamp center stack and 3 EXT lenses; final high-res pixel QA pending'});
});
