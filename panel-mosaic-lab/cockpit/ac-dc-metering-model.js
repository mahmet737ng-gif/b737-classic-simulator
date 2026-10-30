(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737AcDcMeteringModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Display-centre candidates fit from intact OH10 original circular metal rims; 
 // 4 strong Hough thresholds give the same centre. DO NOT mistake a bezel 
 // centre for a photographed shaft: require arc/tip confirmation for release. 
 // See engine/instruments/native-bezel-centre-evidence-v1.json.
 // Initial angles now represent provisional cold-dark mechanical resting positions. 
 // DC AMPS is center-zero; unpowered AC/DC voltmeters rest at their leftmost stop pending exact source-tick survey.
 const source=Object.freeze({piece:'OH10',width:1095,height:1436,tipRadius:85,spriteTipRadius:216,registration:'OWNER_SCREENSHOT_RED_ARC_FIT_NOT_SHAFT_CERTIFIED'});
 const meters=Object.freeze([
  Object.freeze({id:'dcAmps',label:'DC AMPS',x:307.397,y:280.760,tipRadius:167.860,initialAngle:0}),
  Object.freeze({id:'cps',label:'CPS',x:781.896,y:261.228,tipRadius:148.530,initialAngle:-54.21}),
  Object.freeze({id:'dcVolts',label:'DC VOLTS',x:310.778,y:719.453,tipRadius:178.742,initialAngle:-45.50}),
  Object.freeze({id:'acVolts',label:'A.C.',x:785.318,y:706.045,tipRadius:156.828,initialAngle:-51.40})
 ]);

 // Source-original native OH10 white graduation intersections, not metal
 // bezel circles; 11 DC AMPS marks -50..+50 each 10 A, 11 DC VOLTS marks
 // 0..40 each 4 V. Separate 100..130 V AC scale remains manual QA-only until
 // its unpowered parked position and actual AC bus sensor feed are resolved.
 const photoScale=Object.freeze({
  // CPS end/center visual anchors are TRAINING PROVISIONAL until all native tick rays and its true shaft are audited.
  cps:Object.freeze({unit:'Hz',values:Object.freeze([360,380,400,410,420]),angles:Object.freeze([-54.21,-27.105,0,23.39,46.78]),readoutApprovedForPreview:false,accuracy:'PROVISIONAL_MANUAL_ANCHORS'}),
  dcAmps:Object.freeze({unit:'A',values:Object.freeze([-50,-40,-30,-20,-10,0,10,20,30,40,50]),angles:Object.freeze([-46.66,-37.3809,-28.3169,-19.2363,-9.8249,0,9.1325,17.9534,26.7118,35.2366,44.26]),readoutApprovedForPreview:true}),
  dcVolts:Object.freeze({unit:'V',values:Object.freeze([0,4,8,12,16,20,24,28,32,36,40]),angles:Object.freeze([-45.5,-36.1684,-27.4244,-18.5076,-9.6945,0,10.0057,18.8254,27.3445,35.6464,44.7]),readoutApprovedForPreview:true}),
  acVolts:Object.freeze({unit:'V',values:Object.freeze([100,102,104,106,108,110,112,114,116,118,120,122,124,126,128,130]),angles:Object.freeze([-51.4,-44.7535,-38.2574,-31.7398,-25.147,-18.0496,-10.2757,-3.5004,3.5478,10.1972,18.0981,25.2263,31.6363,37.9701,44.4344,51.16]),readoutApprovedForPreview:false,accuracy:'PHOTO_TICKS_UNVERIFIED_SHAFT_PARK'})
 });
 function bearingForReading(id,value){
  const sc=photoScale[id];if(!sc)throw Error('Unknown photographic OH10 scale '+id);
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('OH10 reading must be finite');
  const v=sc.values,a=sc.angles;
  if(value<v[0]||value>v[v.length-1])return null;
  for(let i=1;i<v.length;i++)if(value<=v[i]){
   return a[i-1]+(value-v[i-1])*(a[i]-a[i-1])/(v[i]-v[i-1]);
  }
  return a[a.length-1];
 }
 function readingForBearing(id,bearing){
  const sc=photoScale[id];if(!sc)throw Error('Unknown photographic OH10 scale '+id);
  if(typeof bearing!=='number'||!Number.isFinite(bearing))throw Error('OH10 bearing must be finite');
  const v=sc.values,a=sc.angles;
  if(bearing<a[0]-1e-8||bearing>a[a.length-1]+1e-8)return null;
  for(let i=1;i<a.length;i++)if(bearing<=a[i])
   return v[i-1]+(bearing-a[i-1])*(v[i]-v[i-1])/(a[i]-a[i-1]);
  return v[v.length-1];
 }
 // All four needles share the already-installed sprite. Treat no power / no
 // measurement as the photographed left mechanical rest, not as the lowest
 // printed live indication (especially AC 0V versus 100V and CPS 0Hz).
 function angleForIndication(id,reading){
  const meter=meters.find(m=>m.id===id);
  const sc=photoScale[id];
  if(!meter||!sc)throw Error('Unknown AC/DC metering indicator: '+id);
  if(reading===null||reading===undefined)return limitAngle(id,meter.initialAngle);
  if(typeof reading!=='number'||!Number.isFinite(reading))throw Error('Meter indication must be a finite numeric sample or null');
  if(reading<sc.values[0])return bounds(id).min;
  const limit=Math.min(sc.values[sc.values.length-1],reading);
  return bearingForReading(id,limit);
 }
 const indicationModes=Object.freeze({
  NORMAL:'NORMAL',RESIDUAL:'RESIDUAL'
 });
 function angleForAcVolts(value,{mode='NORMAL'}={}){
  if(!Object.values(indicationModes).includes(mode))throw Error('Invalid AC voltmeter mode');
  if(value===null||value===undefined)return angleForIndication('acVolts',null);
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('Invalid AC volts sample');
  // Lufthansa ATA24: residual scale is 0..30V. The scale-track equivalence to
  // normal 100..130V is provisional until its native ticks are signed off.
  if(mode==='RESIDUAL'){
   if(value<0)return bounds('acVolts').min;
   return angleForIndication('acVolts',100+Math.min(30,value));
  }
  return angleForIndication('acVolts',value);
 }
 
 // Native image: one immutable white pointer image with a 216px master pivot-to-tip
 // distance. Native per-meter tip radii are calibrated parameters pointing at the
 // INNER END of the existing white graduations; never redraw these graduations.
 function bounds(id){
  const sc=photoScale[id];
  if(!sc)throw Error('Unknown OH10 needle travel bounds: '+id);
  return Object.freeze({min:sc.angles[0],max:sc.angles[sc.angles.length-1]});
 }
 function limitAngle(id,value){
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('OH10 angle must be finite');
  const b=bounds(id);
  return Math.max(b.min,Math.min(b.max,value));
 }
 function tipPoint(id,bearing){
  const meter=meters.find(m=>m.id===id);
  if(!meter)throw Error('Unknown OH10 tip: '+id);
  const a=limitAngle(id,bearing)*Math.PI/180, r=meter.tipRadius||source.tipRadius;
  return Object.freeze({x:meter.x+r*Math.sin(a),y:meter.y-r*Math.cos(a),radius:r,angle:limitAngle(id,bearing)});
 }
 // User's screenshot measured four red inner-tick arcs. The cover is a
 // curved BLUE physical foreground. The existing white needle is clipped to
 // the black window and remains hidden below the photo's blue edge.
 // Screenshot/native registration is provisional; source bitmap is unchanged.
 const arcPhoto=Object.freeze({
  scaleX:0.902,scaleY:0.930,originX:216.8,originY:234,
  occlusion:Object.freeze({
   dcAmps:Object.freeze({mx:494.5,y:404.03,q:21.10,k:1.38}),
   cps:Object.freeze({mx:922,y:402.04,q:23.42,k:0.06}),
   dcVolts:Object.freeze({mx:494.5,y:807.03,q:22.32,k:2.88}),
   acVolts:Object.freeze({mx:921.5,y:805.67,q:26.53,k:-1.36})
  })
 });
 function blackWindowPath(id){
  const meter=meters.find(m=>m.id===id),edge=arcPhoto.occlusion[id];
  if(!meter||!edge)throw Error('Unknown gauge face occlusion: '+id);
  const scale=source.spriteTipRadius/meter.tipRadius,coords=[];
  // Native x to 512x512 centered sprite coordinates, sampling the traced
  // black/blue interface at 33 x positions (less than 0.1px curve error).
  for(let i=0;i<=64;i++){
   const spriteX=i*8,nativeX=meter.x+(spriteX-256)/scale;
   const screenX=arcPhoto.originX+arcPhoto.scaleX*nativeX;
   const t=(screenX-edge.mx)/110;
   const screenY=edge.y+edge.q*t*t+edge.k*t;
   const nativeY=(screenY-arcPhoto.originY)/arcPhoto.scaleY;
   coords.push([spriteX,256+(nativeY-meter.y)*scale]);
  }
  const bottom=coords.slice().reverse().map(p=>'L '+p[0].toFixed(3)+' '+p[1].toFixed(3)).join(' ');
  return 'M 0 0 L 512 0 '+bottom+' Z';
 }
 const motion=Object.freeze({maxSpeedDegPerSec:70,accelerationDegPerSec2:260,settleDeg:0.025,maxStepSeconds:0.05});
 function advanceNeedle(current,velocity,target,dtSeconds){
  if(![current,velocity,target,dtSeconds].every(v=>typeof v==='number'&&Number.isFinite(v)))throw Error('Non-finite OH10 animation argument');
  if(dtSeconds<0)throw Error('Negative needle animation time');
  const dt=Math.min(motion.maxStepSeconds,dtSeconds),dist=target-current,d=Math.abs(dist);
  if(d<=motion.settleDeg)return {angle:target,velocity:0,done:true};
  if(dt===0)return {angle:current,velocity:Math.min(motion.maxSpeedDegPerSec,Math.max(0,velocity)),done:false};
  const dir=Math.sign(dist),brakingDistance=velocity*velocity/(2*motion.accelerationDegPerSec2);
  const nextSpeed=Math.min(motion.maxSpeedDegPerSec,Math.max(5,velocity+(d<=brakingDistance+0.2?-motion.accelerationDegPerSec2:motion.accelerationDegPerSec2)*dt));
  const step=Math.min(d,nextSpeed*dt),next=current+dir*step;
  if(d-step<=motion.settleDeg)return {angle:target,velocity:0,done:true};
  return {angle:next,velocity:nextSpeed,done:false};
 }
 const angle=value=>{
  const n=Number(value);
  if(!Number.isFinite(n))throw Error('Meter needle angle must be finite');
  return Math.max(-70,Math.min(70,n));
 };
 function placement(piece,meter){
  if(!piece||!meters.includes(meter)||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH10 needle placement');
  const nativeSize=512*(meter.tipRadius||source.tipRadius)/source.spriteTipRadius;
  const sizeX=nativeSize*piece.w/source.width,sizeY=nativeSize*piece.h/source.height;
  return {x:piece.x+meter.x*piece.w/source.width,y:piece.y+meter.y*piece.h/source.height,size:sizeX,sizeX,sizeY};
 }
 return Object.freeze({source,meters,angle,placement,photoScale,bearingForReading,readingForBearing,angleForIndication,angleForAcVolts,indicationModes,bounds,limitAngle,tipPoint,motion,advanceNeedle,arcPhoto,blackWindowPath});
});
