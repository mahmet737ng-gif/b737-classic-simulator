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
  Object.freeze({id:'recirc-fan-l',label:'L RECIRC FAN',sourcePoint:Object.freeze([185.13,269.33]),states:Object.freeze(['OFF','AUTO']),default:'AUTO'}),
  Object.freeze({id:'recirc-fan',label:'R RECIRC FAN',sourcePoint:Object.freeze([860.57,269.33]),states:Object.freeze(['OFF','AUTO']),default:'AUTO',existing:true})
 ]);
 const packs=Object.freeze([
  Object.freeze({side:'L',id:'pack-400-l',legacyId:'pack-trip-l',label:'PACK',rect:Object.freeze([243,862,180,66])}),
  Object.freeze({side:'R',id:'pack-400-r',legacyId:'pack-trip-r',label:'PACK',rect:Object.freeze([701,862,180,66])})
 ]);
 // Pixel-calibrated matched placards. Dimensions are OH21 source pixels.
 // Both headings share exactly the same width/height and font treatment.
 const labels=Object.freeze([
  Object.freeze({id:'title-l',text:'L RECIRC FAN',kind:'title',rect:Object.freeze([30,120,325,50])}),
  Object.freeze({id:'title-r',text:'R RECIRC FAN',kind:'title',rect:Object.freeze([700,120,325,50])}),
  Object.freeze({id:'off-l',text:'OFF',kind:'detent',rect:Object.freeze([256,178,120,56])}),
  Object.freeze({id:'auto-l',text:'AUTO',kind:'detent',rect:Object.freeze([256,252,120,56])}),
  Object.freeze({id:'off-r',text:'OFF',kind:'detent',rect:Object.freeze([700,178,120,56])}),
  Object.freeze({id:'auto-r',text:'AUTO',kind:'detent',rect:Object.freeze([700,252,120,56])})
 ]);
 // Variant-only skin over the 300/500 RECIRC title, switch, and detents
 // before repainting both 400 switch positions. Never change locked source.
 const nativeRightCover=Object.freeze([677,113,350,228]);

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
  const intersects=(a,b)=>a[0]<b[0]+b[2]&&a[0]+a[2]>b[0]&&a[1]<b[1]+b[3]&&a[1]+a[3]>b[1];
  const headers=labels.filter(x=>x.kind==='title');
  const detents=labels.filter(x=>x.kind==='detent');
  if(headers.length!==2||headers[0].rect[2]!==headers[1].rect[2]||headers[0].rect[3]!==headers[1].rect[3]||headers[0].rect[1]!==headers[1].rect[1])
   throw Error('737-400 dual RECIRC headings must have identical box dimensions');
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
   if(intersects(labels[i].rect,labels[j].rect))throw Error('Intersecting RECIRC placards: '+labels[i].id+' and '+labels[j].id);
  }
  for(const toggle of switches){
   // Envelope includes bezel and the full raised/upper actuator at OFF.
   const [x,y]=toggle.sourcePoint;
   const lever=[x-60,y-85,120,145];
   if(headers.some(h=>intersects(lever,h.rect)))throw Error('Toggle actuator enters RECIRC heading: '+toggle.id);
   // Detent placards are outside the lever's narrow central stem.
   const stem=[x-21,y-75,42,140];
   if(detents.some(h=>intersects(stem,h.rect)))throw Error('Toggle actuator enters detent legend: '+toggle.id);
  }

  return true;
 }
 return Object.freeze({source,switches,packs,labels,nativeRightCover,geometry,normalizeSwitch,variant,validate});
});
