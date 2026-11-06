/* Conventional photographic radial-scale calibration (trainer only).
 * Source pixels: owner's 1463x1075 conventional full-panel photograph.
 * No simulator plant, CB, EIS, guarded-switch or approved N2 model changes.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737PhotoDetentCalibrationV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='CONV-PHOTO-DETENT-0001';
 const def=(values,angles,status,unit)=>Object.freeze({
  values:Object.freeze([...values]),angles:Object.freeze([...angles]),status,unit
 });
 // Angles are clockwise degrees from the 12-o'clock ray. These primary
 // positions were independently extracted from the uploaded photo's white
 // radial strokes; not inferred from equally spaced dial numbers.
 const REFERENCE=Object.freeze({
  n1:def(Array.from({length:13},(_,i)=>i*10),
   [48.8,72,92.5,115.8,137,158.5,179.8,201.5,223,246.5,269.2,293.8,316.5],
   'PHOTO_MEASURED','percent'),
  egt:def(Array.from({length:11},(_,i)=>i*100),
   [53.2,91.2,112.8,134.2,156.2,179.5,200.2,223.2,246.8,271.8,317.2],
   'PHOTO_MEASURED','degC'),
  // Preserve the previously owner-approved N2 calibration byte-for-byte.
  n2:def([0,20,40,60,80,100,120],[45,90,135,180,225,270,315],
   'OWNER_LOCKED','percent'),
  fuelFlow:def([0,2000,4000,6000,8000,10000,12000],[46,89,134,180,226,274,320],
   'PRELIMINARY_PHOTO','kg/h'),
  oilPressure:def([0,20,40,60,80,100],[133,193,253,314,380,452],
   'PRELIMINARY_PHOTO','psi'),
  oilTemp:def([-50,0,50,100,150,200],[101,158,219,273,315,353],
   'PRELIMINARY_PHOTO','degC'),
  oilQty:def([0,1,2,3,4],[35,99,156,219,278],
   'PRELIMINARY_PHOTO','gallons'),
  vib:def([0,1,2,3,4,5],[225,270,315,360,405,450],
   'PRELIMINARY_PHOTO','vibration')
 });
 const CENTERS=Object.freeze({
  n1:[[427,427],[600,427]],egt:[[427,596],[600,596]],
  n2:[[425,747],[600,747]],fuelFlow:[[426,910],[600,910]],
  oilPressure:[[805,431],[973,431]],oilTemp:[[805,591],[973,591]],
  oilQty:[[803,748],[970,748]],vib:[[803,909],[970,909]]
 });
 const active=new Map(),evidence=new Map();
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 function assertProfile(p){
  if(!p||p.values.length<2||p.values.length!==p.angles.length)throw Error('Calibration marks must be paired');
  for(let i=0;i<p.values.length;i++){
   if(!finite(p.values[i])||!finite(p.angles[i]))throw Error('Nonfinite photo mark');
   if(i&&!(p.values[i]>p.values[i-1]&&p.angles[i]>p.angles[i-1]))throw Error('Calibration marks must increase');
  }
  return p;
 }
 for(const profile of Object.values(REFERENCE))assertProfile(profile);
 function getProfile(signal,engine='engine1'){
  if(!REFERENCE[signal])throw Error('Unknown photographed engine gauge '+signal);
  if(!['engine1','engine2'].includes(engine))throw Error('Unknown engine '+engine);
  return active.get(signal+':'+engine)||REFERENCE[signal];
 }
 function interpolate(xs,ys,input){
  if(!finite(input))throw Error('Nonfinite instrument reading');
  if(input<=xs[0])return ys[0];
  const last=xs.length-1;if(input>=xs[last])return ys[last];
  let low=0,high=last;
  while(high-low>1){const mid=(low+high)>>1;if(input<xs[mid])high=mid;else low=mid;}
  return ys[low]+(ys[high]-ys[low])*(input-xs[low])/(xs[high]-xs[low]);
 }
 const angle=(signal,engine,value)=>{const p=getProfile(signal,engine);return interpolate(p.values,p.angles,value);};
 const valueAt=(signal,engine,degrees)=>{const p=getProfile(signal,engine);return interpolate(p.angles,p.values,degrees);};
 function detents(signal,engine='engine1',fractions=4){
  if(!Number.isInteger(fractions)||fractions<1||fractions>100)throw Error('Invalid minor-division count');
  const p=getProfile(signal,engine),out=[];
  for(let i=0;i<p.values.length-1;i++)for(let j=0;j<fractions;j++){
   const t=j/fractions;
   out.push(Object.freeze({value:p.values[i]+(p.values[i+1]-p.values[i])*t,
    angle:p.angles[i]+(p.angles[i+1]-p.angles[i])*t,major:j===0}));
  }
  out.push(Object.freeze({value:p.values.at(-1),angle:p.angles.at(-1),major:true}));
  return out;
 }
 // White/silver paint detection: sample radial strokes, not the black ring,
 // coloured arcs, numerals or the moveable needle image.
 function rayScore(frame,cx,cy,deg,rMin,rMax){
  const {width,height,data}=frame;const t=deg*Math.PI/180;
  const sin=Math.sin(t),cos=Math.cos(t);
  let hit=0,total=0;
  for(let r=rMin;r<=rMax;r+=1.25){
   const x=Math.round(cx+r*sin),y=Math.round(cy-r*cos);
   if(x<0||y<0||x>=width||y>=height)continue;
   const i=(y*width+x)*4,R=data[i],G=data[i+1],B=data[i+2];
   const high=Math.max(R,G,B),low=Math.min(R,G,B);
   if(low>150&&high-low<42)hit++;
   total++;
  }
  return total?hit/total:0;
 }
 function photoScan(frame,signal,engine='engine1',options={}){
  const reference=REFERENCE[signal];
  if(!reference)throw Error('Unknown instrument '+signal);
  if(!frame||!frame.data||!frame.width||!frame.height)throw Error('ImageData required');
  const center=CENTERS[signal][engine==='engine1'?0:1];
  const bands=options.bands||[[52,65],[47,61],[43,57],[55,69]];
  const tolerance=options.maxSearchDegrees??8.0;
  const traces=bands.map(([rMin,rMax])=>reference.angles.map(guess=>{
   let best={angle:guess,score:-1};
   for(let a=guess-tolerance;a<=guess+tolerance;a+=.5){
    const score=rayScore(frame,center[0],center[1],a,rMin,rMax);
    if(score>best.score)best={angle:Math.round(a*10)/10,score};
   }
   return best;
  }));
  const candidates=traces.map((points,index)=>({
   band:bands[index],points,
   quality:points.filter(p=>p.score>=.17).length,
   signalToNoise:points.reduce((sum,p)=>sum+p.score,0)/points.length
  })).sort((a,b)=>b.quality-a.quality||b.signalToNoise-a.signalToNoise);
  const selected=candidates[0];
  const angles=selected.points.map(p=>p.angle);
  const score=selected.points.reduce((s,p)=>s+p.score,0)/angles.length;
  // Refuse ambiguous profiles. A missing white stroke must never be silently
  // converted into a made-up correction.
  const monotonic=angles.every((a,i)=>!i||a>angles[i-1]+4);
  const matched=selected.points.every(p=>p.score>=.17);
  const pass=monotonic&&matched;
  return Object.freeze({signal,engine,center:[...center],angles,
   scores:selected.points.map(p=>p.score),band:selected.band,
   confidence:score,passed:pass,status:pass?'MEASURED':'REVIEW_REQUIRED'});
 }
 function applyPhotoScan(result){
  if(!result||!result.signal||!['engine1','engine2'].includes(result.engine))throw Error('Invalid photo scan');
  const key=result.signal+':'+result.engine;
  evidence.set(key,result);
  // Owner-approved N2 is audited but never re-registered.
  if(result.signal==='n2')return false;
  if(!result.passed)return false;
  const ref=REFERENCE[result.signal];
  const p=assertProfile(def(ref.values,result.angles,'PHOTO_VERIFIED',ref.unit));
  active.set(key,p);return true;
 }
 function audit(signal,engine='engine1',{count=256,seed=17437}={}){
  if(!Number.isInteger(count)||count<1||count>20000)throw Error('Invalid audit count');
  const p=getProfile(signal,engine),values=[...p.values];
  for(const d of detents(signal,engine,4))values.push(d.value);
  let state=(seed>>>0)||1;
  for(let i=0;i<count;i++){
   state=(Math.imul(1664525,state)+1013904223)>>>0;
   values.push(p.values[0]+(state/4294967296)*(p.values.at(-1)-p.values[0]));
  }
  let maxValueError=0,maxAngleError=0;
  for(const v of values){
   const a=angle(signal,engine,v),recovered=valueAt(signal,engine,a);
   maxValueError=Math.max(maxValueError,Math.abs(recovered-v));
   maxAngleError=Math.max(maxAngleError,Math.abs(angle(signal,engine,recovered)-a));
  }
  return Object.freeze({signal,engine,checks:values.length,maxValueError,maxAngleError,
   firstLineAngle:p.angles[0],lastLineAngle:p.angles.at(-1),
   status:p.status,pass:maxValueError<1e-6&&maxAngleError<1e-7});
 }
 function inspectAll({samples=256}={}){
  const rows=[];
  for(const signal of Object.keys(REFERENCE))for(const engine of ['engine1','engine2'])
   rows.push(audit(signal,engine,{count:samples,seed:17437+(engine==='engine2'?1:0)}));
  return Object.freeze({version:VERSION,pass:rows.every(r=>r.pass),rows});
 }
 const getEvidence=()=>Object.fromEntries(evidence);
 return Object.freeze({VERSION,REFERENCE,CENTERS,getProfile,angle,valueAt,detents,
  photoScan,applyPhotoScan,audit,inspectAll,getEvidence,assertProfile});
});