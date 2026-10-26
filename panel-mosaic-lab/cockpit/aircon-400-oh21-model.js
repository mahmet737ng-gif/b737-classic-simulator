/* Unified-only 737-400 OH21 installation geometry; frozen OH21 artwork unchanged.
 * Positions originate from OH21 source coordinates (1122 x 1402).
 * This variant reuses the existing right RECIRC FAN switch and both pack trip inputs.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Aircon400Oh21Model=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const source=Object.freeze({width:1122,height:1402,placementId:'OH21'});
 const switches=Object.freeze([
  Object.freeze({id:'recirc-fan-l',label:'L RECIRC FAN',sourcePoint:Object.freeze([185.13,231.33]),states:Object.freeze(['OFF','AUTO']),default:'AUTO'}),
  Object.freeze({id:'recirc-fan',label:'R RECIRC FAN',sourcePoint:Object.freeze([860.57,231.33]),states:Object.freeze(['OFF','AUTO']),default:'AUTO',existing:true})
 ]);
 const packs=Object.freeze([
  Object.freeze({side:'L',id:'pack-400-l',legacyId:'pack-trip-l',label:'PACK',rect:Object.freeze([243,862,180,66])}),
  Object.freeze({side:'R',id:'pack-400-r',legacyId:'pack-trip-r',label:'PACK',rect:Object.freeze([701,862,180,66])})
 ]);
 // Plate-printed title lenses, with measured room above the two socket axes.
 // The former y=123 titles collided with OFF legends. Both are now above them.
 const labels=Object.freeze([
  Object.freeze({text:'L RECIRC FAN',kind:'title',rect:Object.freeze([105,28,284,64])}),
  Object.freeze({text:'R RECIRC FAN',kind:'title',rect:Object.freeze([709,28,321,64])}),
  Object.freeze({text:'OFF',kind:'detent',rect:Object.freeze([262,137,118,61])}),
  Object.freeze({text:'AUTO',kind:'detent',rect:Object.freeze([261,259,145,61])})
 ]);
 function geometry(placement){
  const {x,y,w,h}=placement;
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)throw Error('Invalid OH21 placement');
  return {
   point:([sx,sy])=>({x:x+w*sx/source.width,y:y+h*sy/source.height}),
   rect:([sx,sy,sw,sh])=>({x:x+w*sx/source.width,y:y+h*sy/source.height,w:w*sw/source.width,h:h*sh/source.height})
  };
 }
 function normalizeSwitch(value){return ['OFF','AUTO'].includes(value)?value:'AUTO';}
 function variant(family){return family==='B737-400'?'B737-400':'B737-300-500';}
 function validate(){
  const xs=switches.map(s=>s.sourcePoint[0]);
  if(xs[0]>=xs[1]||switches[1].id!=='recirc-fan'||packs.length!==2)throw Error('Invalid dual RECIRC installation');
  for(const c of [...packs,...labels]){const [x,y,w,h]=c.rect;if(x<0||y<0||x+w>source.width||y+h>source.height)throw Error('OH21 variant geometry exceeds source');}
  // Collision guard for original right hand OFF/AUTO legends and screw heads.
  const intersects=(a,b)=>a[0]<b[0]+b[2]&&a[0]+a[2]>b[0]&&a[1]<b[1]+b[3]&&a[1]+a[3]>b[1];
  const rightLegends=[[665,135,105,80],[662,268,153,80]],leftSocket=[121,169,128,145];
  for(const label of labels.filter(x=>x.kind==='title')){
   if(rightLegends.some(b=>intersects(label.rect,b))||intersects(label.rect,leftSocket))
    throw Error('Air conditioning title collides with an existing legend or left socket: '+label.text);
  }
  for(const label of labels.filter(x=>x.kind==='detent')){
   if(intersects(label.rect,leftSocket))throw Error('Left recirc detent collides with socket: '+label.text);
  }
  return true;
 }
 return Object.freeze({source,switches,packs,labels,geometry,normalizeSwitch,variant,validate});
});
