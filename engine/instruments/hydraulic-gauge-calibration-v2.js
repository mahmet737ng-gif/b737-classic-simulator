/* HYD-GAUGE-CAL-V2 — photo-registered, non-linear analog pointer calibration.
 * Gauges A/B share a photographed dual face but have distinct source pivots.
 * Conventional engine photo: 1235x1274 native pixels.
 * FO brake photo: 918x1713 native pixels.
 * Direction: 0° is 12 o'clock; clockwise positive. Absolute SVG rotation,
 * never add a mystery 90° offset to a pointer whose base points UP.
 * Image-based calibration for this instructional simulator, not certified
 * FCOM pointer tolerances. Do not change locked source artwork.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737HydraulicGaugeCalibrationV2=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const config={
  A:{
   panel:'ENGINE',photoKind:'HYD_DUAL',face:'eng.hyd_pressure.a',
   native:{w:1235,h:1274},viewport:{x:907,y:921,w:150,h:204},
   pivot:{x:982,y:991},qtyWindow:{x:990,y:1085},
   needleLength:40,
   detents:[{psi:0,angle:132},{psi:1000,angle:180},
    {psi:2000,angle:234},{psi:3000,angle:319},{psi:4000,angle:409}]
  },
  B:{
   panel:'ENGINE',photoKind:'HYD_DUAL',face:'eng.hyd_pressure.b',
   native:{w:1235,h:1274},viewport:{x:1043,y:921,w:150,h:204},
   pivot:{x:1118,y:991},qtyWindow:{x:1096,y:1085},
   needleLength:40,
   detents:[{psi:0,angle:133},{psi:1000,angle:180},
    {psi:2000,angle:233},{psi:3000,angle:318},{psi:4000,angle:409}]
  },
  BRAKE:{
   panel:'FO-INNER',photoKind:'BRAKE',face:'fo.hyd_brake_pressure',
   native:{w:918,h:1713},viewport:{x:385,y:480,w:176,h:176},
   pivot:{x:473,y:568},qtyWindow:null,needleLength:66,
   // 0 must point at the printed lower-right zero, approximately 3:30.
   detents:[{psi:0,angle:110},{psi:1000,angle:180},
    {psi:2000,angle:269},{psi:3000,angle:358},{psi:4000,angle:425}]
  }
 };
 const frozen=Object.freeze(Object.fromEntries(Object.entries(config).map(([id,c])=>
  [id,Object.freeze({...c,native:Object.freeze(c.native),viewport:Object.freeze(c.viewport),
   pivot:Object.freeze(c.pivot),qtyWindow:c.qtyWindow?Object.freeze(c.qtyWindow):null,
   detents:Object.freeze(c.detents.map(x=>Object.freeze(x)))})])));
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 function gauge(id){
  const g=frozen[id];
  if(!g)throw Error('Unknown hydraulic gauge '+id);
  return g;
 }
 function angle(id,psi){
  const g=gauge(id),t=g.detents;
  if(!Number.isFinite(psi))return null;
  const v=clamp(psi,t[0].psi,t[t.length-1].psi);
  for(let i=1;i<t.length;i++){
   if(v<=t[i].psi){
    const prev=t[i-1],next=t[i],ratio=(v-prev.psi)/(next.psi-prev.psi);
    return prev.angle+(next.angle-prev.angle)*ratio;
   }
  }
  return t[t.length-1].angle;
 }
 function polar(angleDeg,length){
  if(!Number.isFinite(angleDeg)||!Number.isFinite(length))return null;
  const r=angleDeg*Math.PI/180;
  return {dx:Math.sin(r)*length,dy:-Math.cos(r)*length};
 }
 function local(id){
  const g=gauge(id);
  return {x:g.pivot.x-g.viewport.x,y:g.pivot.y-g.viewport.y};
 }
 function qtyLocal(id){
  const g=gauge(id);
  return g.qtyWindow?{x:g.qtyWindow.x-g.viewport.x,y:g.qtyWindow.y-g.viewport.y}:null;
 }
 function validate(){
  for(const [id,g] of Object.entries(frozen)){
   const v=g.viewport,p=local(id);
   if(p.x<0||p.y<0||p.x>v.w||p.y>v.h)throw Error(id+' pivot outside source crop');
   if(v.x<0||v.y<0||v.x+v.w>g.native.w||v.y+v.h>g.native.h)
    throw Error(id+' crop outside source artwork');
   if(g.qtyWindow){
    const q=qtyLocal(id);
    if(q.x<5||q.y<5||q.x>v.w-5||q.y>v.h-5)throw Error(id+' quantity window outside crop');
   }
   if(g.detents.length!==5)throw Error(id+' missing 0-4 detents');
   for(let i=1;i<g.detents.length;i++)
    if(g.detents[i].psi<=g.detents[i-1].psi||g.detents[i].angle<=g.detents[i-1].angle)
     throw Error(id+' non-monotonic pressure calibration');
  }
  return true;
 }
 validate();
 return Object.freeze({VERSION:'HYD-GAUGE-CAL-V2',GAUGES:frozen,gauge,angle,polar,local,qtyLocal,validate});
});
