/* B737-400 Environmental Control Panel: Unified-only, distinct OH20 overlay.
 * No physical source image or immutable atlas geometry is changed.
 * Screen geometry is calibrated in pixels of the owner's 1122x1402 PNG.
 * Zone caution states are external inputs; no synthetic failure rules invented.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Aircon400Model=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const source=Object.freeze({width:1122,height:1402,asset:'Boeing-Style Environmental Control Panel.png'});
 const precheck=Object.freeze({
  id:'air-temp-precheck',label:'AIR TEMP PRECHECK',type:'rotary',
  x:839,y:348,diameter:198,
  states:Object.freeze(['SUPPLY DUCT FWD','SUPPLY DUCT AFT','CONT CAB','PASS CAB FWD','PASS CAB AFT','PACK L','PACK R']),
  angles:Object.freeze([-130,-94,-45,0,45,91,130]),default:'PASS CAB FWD'
 });
 const temperatureStates=Object.freeze(['C','AUTO COOL','AUTO','AUTO WARM','W','OFF']);
 const temperatureAngles=Object.freeze([-128,-61,0,61,128,180]);
 const zoneKnobs=Object.freeze([
  Object.freeze({id:'cont-cab',label:'CONT CAB TEMPERATURE',type:'rotary',x:223,y:1092,diameter:200,states:temperatureStates,angles:temperatureAngles,default:'AUTO',mirror:'control-cabin-temp'}),
  Object.freeze({id:'fwd-cab',label:'FWD CAB TEMPERATURE',type:'rotary',x:560,y:1092,diameter:200,states:temperatureStates,angles:temperatureAngles,default:'AUTO'}),
  Object.freeze({id:'aft-cab',label:'AFT CAB TEMPERATURE',type:'rotary',x:897,y:1092,diameter:200,states:temperatureStates,angles:temperatureAngles,default:'AUTO',mirror:'pass-cabin-temp'})
 ]);
 const trim=Object.freeze({id:'trim-air',label:'TRIM AIR',type:'toggle',x:551,y:627,width:123,height:164,states:Object.freeze(['OFF','ON']),default:'OFF'});
 const lamps=Object.freeze([
  Object.freeze({id:'zone-temp-cont',zone:'cont-cab',label:'CONT CAB ZONE TEMP',rect:Object.freeze([114,776,216,83])}),
  Object.freeze({id:'zone-temp-fwd',zone:'fwd-cab',label:'FWD CAB ZONE TEMP',rect:Object.freeze([460,776,213,83])}),
  Object.freeze({id:'zone-temp-aft',zone:'aft-cab',label:'AFT CAB ZONE TEMP',rect:Object.freeze([789,776,217,83])})
 ]);
 const controls=Object.freeze([precheck,trim,...zoneKnobs]);
 const defaults=Object.freeze(Object.fromEntries(controls.map(c=>[c.id,c.default])));
 function normalize(input){
  const out={...defaults};
  for(const c of controls)if(c.states.includes(input?.[c.id]))out[c.id]=input[c.id];
  return out;
 }
 function step(c,value,delta){
  const current=c.states.indexOf(value);
  return c.states[Math.max(0,Math.min(c.states.length-1,current+Math.sign(delta)))];
 }
 function map(point,placement){
  const x=Number(placement.x),y=Number(placement.y),w=Number(placement.w),h=Number(placement.h);
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)throw Error('Invalid OH20 placement');
  return {x:x+point[0]*w/source.width,y:y+point[1]*h/source.height};
 }
 function rect(b,placement){
  const lt=map([b[0],b[1]],placement),rb=map([b[0]+b[2],b[1]+b[3]],placement);
  return {x:lt.x,y:lt.y,w:rb.x-lt.x,h:rb.y-lt.y};
 }
 function angle(c,state){return c.angles?.[c.states.indexOf(state)]??0;}
 function validate(){
  const ids=new Set();
  for(const c of controls){if(ids.has(c.id)||c.x<=0||c.y<=0||c.x>=source.width||c.y>=source.height||!c.states.includes(c.default))throw Error('Invalid 400 control '+c.id);ids.add(c.id);}
  for(const l of lamps){if(!ids.has(l.zone)||l.rect[0]<0||l.rect[1]<0||l.rect[0]+l.rect[2]>source.width||l.rect[1]+l.rect[3]>source.height)throw Error('Invalid 400 zone lamp '+l.id);}
  return true;
 }
 return Object.freeze({source,precheck,zoneKnobs,trim,lamps,controls,defaults,normalize,step,map,rect,angle,validate});
});
