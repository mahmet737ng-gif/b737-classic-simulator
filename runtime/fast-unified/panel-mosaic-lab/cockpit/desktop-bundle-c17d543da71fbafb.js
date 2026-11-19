(async()=>{
;
/* ./engine-indication-mode-v1.js?v=CONV-FULL-0001 */
try{
/* CKP ENGINE DISPLAY MODE — FLAP / AUTO BRAKE PHOTO REGISTRATION.
 * Only the optional owner Conventional PNG is presented on a separate
 * noninteractive photographic overlay. The five source placements and
 * all Owner18 / IRS red-zone assets remain unchanged.
 */
(function(){
'use strict';
const ROOT=document.documentElement;
const ASSET='./assets/p2-conventional-full-owner-20261030.png?v=CONV-FULL-0001';
const VERSION='CONV-FULL-0001';
const W=1463,H=1075,FO_W=918,FO_H=1713;
// Full owner panorama, installed only when Conventional is selected.
let wrap=null,image=null,loaded=false,error=null,desired='EIS',geometry=null;
const store=()=>window.B737AircraftProfileStore;
const requested=()=>store()?.get()?.engineInstruments==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
function rect(node){if(!node)return null;const s=node.style;const r={x:parseFloat(s.left),y:parseFloat(s.top),w:parseFloat(s.width),h:parseFloat(s.height)};return Object.values(r).every(Number.isFinite)?r:null;}
function compute(engine,fo){
 if(!engine||!fo||fo.x<engine.x+engine.w-1||fo.x>engine.x+engine.w+1) return null;
 // Complete owner panorama: fuel quantity through landing gear, ending exactly
 // at the separately approved F/O flight panel. No guard control is moved.
 const left=engine.x,top=engine.y,right=1374,bottom=engine.y+engine.h;
 const sx=(right-left)/W,sy=(bottom-top)/H;
 const matrix=[sx,0,0,sy,0,0];
 return Object.freeze({version:VERSION,x:left,y:top,w:right-left,h:bottom-top,
  sourceWidth:W,sourceHeight:H,matrix:Object.freeze(matrix),
  cssMatrix:'matrix('+matrix.map(v=>Number(v.toFixed(8))).join(',')+')',
  redZone:'NO_GUARD_CONTROL_MODIFICATIONS'});
}
function mount(){
 const native=document.querySelector('#region-main .region-native');
 const e=native?.querySelector('.texture-piece[data-piece="engine"]');
 const fo=native?.querySelector('.texture-piece[data-piece="fo-inner"]');
 if(!native||!e||!fo)return false;
 const next=compute(rect(e),rect(fo));
 if(!next) {error='Engine and FO reference geometry not contiguous';return false;}
 geometry=next;
 if(!wrap){
  wrap=document.createElement('div');wrap.className='conventional-engine-photo-wrap-v1';
  wrap.setAttribute('aria-hidden','true');wrap.dataset.version=VERSION;
 }
 Object.assign(wrap.style,{left:next.x+'px',top:next.y+'px',width:next.w+'px',height:next.h+'px'});
 if(!image){
  image=document.createElement('img');image.className='conventional-engine-panel-v1';
  image.alt='';image.decoding='async';image.draggable=false;
  image.onload=()=>{loaded=true;error=null;window.B737ConventionalFullPaintV1?.apply(image);apply();};
  image.onerror=()=>{loaded=false;error='Conventional original PNG failed to load';apply();};
  image.src=new URL(ASSET,document.baseURI).href;
 }
 image.style.width=W+'px';image.style.height=H+'px';
 image.style.transform=next.cssMatrix;
 if(image.parentNode!==wrap)wrap.insertBefore(image,wrap.firstChild);
 if(wrap.parentNode!==native)native.appendChild(wrap);
 return true;
}
function apply(){
 desired=requested();
 // In EIS, do not download/decode/repaint the inactive Conventional panorama.
 // Selecting Conventional still uses the exact original mount and paint path.
 const mounted=desired==='CONVENTIONAL'?mount():!!wrap;
 const display=desired==='CONVENTIONAL'&&loaded&&mounted?'CONVENTIONAL':'EIS';
 ROOT.dataset.engineIndication=display;
 ROOT.dataset.engineIndicationRequested=desired;
 const engine=document.querySelector('#region-main .texture-piece[data-piece="engine"]');
 if(engine)engine.dataset.engineFace=display;
 const status=document.getElementById('activeProfileStatus');
 if(status&&error&&desired==='CONVENTIONAL')status.textContent='Engine display: Conventional image unavailable; EIS remains visible safely. '+error;
 window.dispatchEvent(new CustomEvent('b737:engine-indication-view',{detail:{requested:desired,display,assetLoaded:loaded,error,layout:geometry?.version||null}}));
}
window.addEventListener('b737:aircraft-profile-change',apply);
window.addEventListener('b737:cockpit-mounted',apply);
window.addEventListener('DOMContentLoaded',apply,{once:true});
window.B737EngineIndicationModeV1=Object.freeze({
 status:()=>Object.freeze({requested:desired,display:ROOT.dataset.engineIndication||'EIS',assetLoaded:loaded,
 asset:image?.src||null,version:VERSION,error,layout:geometry}),
 layout:()=>geometry,
 wrap:()=>wrap,
 setMode(mode){if(mode!=='EIS'&&mode!=='CONVENTIONAL')throw Error('Unsupported engine indication');
  const s=store();if(!s)throw Error('Settings registry not initialized');s.set({engineInstruments:mode});apply();}
});
apply();
})();
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/photo-detent-calibration-v1.js?v=CONV-PHOTO-DETENT-0001 */
try{
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
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/needle-photo-optical-v1.js?v=PHOTO-NEEDLE-OPTICS-0001 */
try{
/* Original ivory needle photographic optical-axis calibration.
 * The sprite's painted tip may not be exactly at x=40. Recover the visual
 * bearing from the actual same-origin WebP-in-SVG pixels; never alter photo,
 * needle asset, model scales, EIS, or approved N2 calibration.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737NeedlePhotoOpticsV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const VERSION='PHOTO-NEEDLE-OPTICS-0001',width=80,height=160,shaft={x:40,y:140};
 const valid=v=>typeof v==='number'&&Number.isFinite(v);
 function measure(frame){
  if(!frame||frame.width!==width||frame.height!==height||
    !frame.data||frame.data.length<width*height*4)
   throw Error('80x160 original photographic needle ImageData required');
  const rows=[];
  for(let y=7;y<75;y++){
   let weightedX=0,weight=0,number=0;
   for(let x=22;x<58;x++){
    const i=(y*width+x)*4;
    const [r,g,b,a]=[frame.data[i],frame.data[i+1],frame.data[i+2],frame.data[i+3]];
    // Distinct bright opaque ivory pixels are in the master pointer. Exclude
    // transparent anti-aliasing, dark shaft shadow and the pivot cap.
    if(a<125||r<155||g<150||b<125||Math.abs(r-g)>75||r<b-12)continue;
    const w=(a/255)*(r+g+b)/765;
    weightedX+=x*w;weight+=w;number++;
   }
   if(number>=1&&number<=19&&weight>0)rows.push({y,x:weightedX/weight,n:number});
  }
  if(rows.length<9)return Object.freeze({version:VERSION,status:'REVIEW_REQUIRED',
   reason:'NOT_ENOUGH_BRIGHT_TIP_PIXELS',sampleRows:rows.length,correctionDeg:0,tip:null});
  const selected=rows.slice(0,Math.min(30,rows.length));
  const xs=selected.map(p=>p.x).sort((a,b)=>a-b);
  const medianX=xs[Math.floor(xs.length/2)];
  const ys=selected.map(p=>p.y).sort((a,b)=>a-b);
  const medianY=ys[Math.floor(ys.length/2)];
  const degrees=Math.atan2(medianX-shaft.x,shaft.y-medianY)*180/Math.PI;
  if(!valid(degrees)||Math.abs(degrees)>6||medianY>55)
   return Object.freeze({version:VERSION,status:'REVIEW_REQUIRED',
    reason:'TIP_AXIS_OUTSIDE_MEASUREMENT_BOUNDS',sampleRows:rows.length,
    correctionDeg:0,tip:{x:medianX,y:medianY},measuredBiasDeg:degrees});
  return Object.freeze({version:VERSION,status:'PHOTO_VERIFIED',sampleRows:rows.length,
   tip:{x:medianX,y:medianY},masterPivot:{...shaft},
   measuredBiasDeg:degrees,correctionDeg:-degrees,
   evidence:'ORIGINAL_TRANSPARENT_PHOTO_IMAGE_PIXEL_CENTROID'});
 }
 const renderAngle=(calibrated,correction=0)=>{if(!valid(calibrated)||!valid(correction))throw Error('Nonfinite optical angle');return calibrated+correction;};
 const tipAt=(rotation,physicalRadius)=>({x:physicalRadius*Math.sin(rotation*Math.PI/180),
  y:-physicalRadius*Math.cos(rotation*Math.PI/180)});
 return Object.freeze({VERSION,measure,renderAngle,tipAt,shaft});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
