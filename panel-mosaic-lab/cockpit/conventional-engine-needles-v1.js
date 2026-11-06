/* CONV NEEDLES V1 — photo-derived ivory pointer mounted independently on
 * all sixteen conventional dial centers. Original EIS, protected cockpit
 * artwork, switches and instrument backend are never modified.
 */
(function(){
'use strict';
const svgNs='http://www.w3.org/2000/svg';
const getMount=()=>window.B737EngineIndicationModeV1?.wrap();
const getLayout=()=>window.B737EngineIndicationModeV1?.layout();
const PHOTO=new URL('./assets/conventional-needle-photo-v1.svg?v=CONV-NEEDLE-0001',document.baseURI).href;
const ROWS=Object.freeze([
 Object.freeze({key:'n1',label:'N1',y:309,min:0,max:120,primary:true,scale:1}),
 Object.freeze({key:'egt',label:'EGT',y:579,min:0,max:1000,primary:true,scale:1}),
 Object.freeze({key:'n2',label:'N2',y:849,min:0,max:120,primary:true,scale:1}),
 Object.freeze({key:'fuelFlow',label:'Fuel Flow',y:1112,min:0,max:12000,primary:true,scale:.9}),
 Object.freeze({key:'oilPressure',label:'Oil Pressure',y:309,min:0,max:100,primary:false,scale:.84}),
 Object.freeze({key:'oilTemp',label:'Oil Temperature',y:579,min:-50,max:200,primary:false,scale:.84}),
 Object.freeze({key:'oilQty',label:'Oil Quantity',y:849,min:0,max:4,primary:false,scale:.76}),
 Object.freeze({key:'vib',label:'Vibration',y:1112,min:0,max:5,primary:false,scale:.76})
]);
// Physical shaft centers measured in the final owner's 1182 x 1330 PNG.
const CENTERS=Object.freeze({
 n1:[[427,427],[600,427]], egt:[[427,596],[600,596]],
 n2:[[425,747],[600,747]], fuelFlow:[[426,910],[600,910]],
 oilPressure:[[805,431],[973,431]], oilTemp:[[805,591],[973,591]],
 oilQty:[[803,748],[970,748]], vib:[[803,909],[970,909]]
});
const SPECS=Object.freeze(ROWS.flatMap(row=>[1,2].map(engine=>Object.freeze({
 id:row.key+'_'+engine,signal:row.key,engine:'engine'+engine,
 cx:CENTERS[row.key][engine-1][0],cy:CENTERS[row.key][engine-1][1],
 min:row.min,max:row.max,primary:row.primary,scale:row.scale*.51
}))));
let layer=null;
const values=new Map();
const rotors=new Map();
const backendOwned=new Set(); // live ECU/failure-aware readings take priority over legacy start snapshots
const photoEngine=window.B737PhotoDetentCalibrationV1;
let registeredPhoto=null,photoEvidence=null;
function calibrateSourcePhoto(host){
 if(!photoEngine||typeof document.createElement!=='function'||!host?.querySelector)return;
 const image=host.querySelector('.conventional-engine-panel-v1');
 if(!image||!image.complete||image.naturalWidth!==1463||image.naturalHeight!==1075||registeredPhoto===image)return;
 let canvas,ctx,frame;
 try{
  canvas=document.createElement('canvas');canvas.width=1463;canvas.height=1075;
  ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return;
  ctx.drawImage(image,0,0,1463,1075);frame=ctx.getImageData(0,0,1463,1075);
 }catch(error){
  photoEvidence={status:'PHOTO_READ_FAILED',error:String(error)};return;
 }
 const scans=[];
 for(const signal of Object.keys(photoEngine.REFERENCE))
  for(const engine of ['engine1','engine2']){
   const s=photoEngine.photoScan(frame,signal,engine);
   photoEngine.applyPhotoScan(s);
   scans.push({signal,engine,passed:s.passed,confidence:s.confidence,angles:s.angles,
    status:photoEngine.getProfile(signal,engine).status});
  }
 registeredPhoto=image;
 photoEvidence={status:'SCANNED',scans};
 for(const spec of SPECS)paint(spec);
}

for(const spec of SPECS)values.set(spec.id,Object.freeze({value:0,source:'UNSOURCED_PARKED'}));
function node(parent,tag,attrs){
 const el=document.createElementNS(svgNs,tag);
 for(const [k,v] of Object.entries(attrs||{}))el.setAttribute(k,String(v));
 parent.appendChild(el);
 return el;
}
// Photo-calibrated primary dial: the printed numbers read 0,2,4,6,8,10,12.
 // These dial divisions are 45 degrees per 2 labeled units, measured clockwise
 // from the upper-right 0 mark (45°) to the upper-left 12 mark (315°).
 // The same raw ECU reading drives the digital readout and this physical pointer.
 const PRIMARY_UNITS_PER_TICK=Object.freeze({
  n1:10,       // %N1: dial 0..12 represents 0..120%
  egt:100,     // EGT: dial °C x 100, 0..12 represents 0..1200°C
  n2:10,       // %N2: dial 0..12 represents 0..120%
  fuelFlow:1000 // fuel flow: dial kg/h x 1000, 0..12 represents 0..12000 kg/h
 });
 const PRIMARY_TICK_ANGLES=Object.freeze([45,90,135,180,225,270,315]);
 // Major radial tick centres registered against the user's actual Conventional
 // dial screenshot. Values are degrees CLOCKWISE from the 12-o'clock axis.
 // N2 is owner-accepted and intentionally remains on PRIMARY_TICK_ANGLES.
 // Owner's November 6 source photograph: centres of EVERY radial white
 // graduation, 0 through the last physical scale mark. Angles use the same
 // needle rotation convention (clockwise degrees from 12 o'clock).
 // N1: 0..12 in 10% steps; EGT: 0..10 in 100°C steps (°C x 100).
 // Measured against actual photographed strokes, NOT assumed equal spacing.
 const PHOTO_PRIMARY_TICKS=Object.freeze({
  n1:Object.freeze([48.5,72.5,93.8,117.8,139,160.5,181.2,202.8,223.8,246,268.5,291.8,314.2]),
  egt:Object.freeze([48.8,87.5,110.5,133,157.2,181.2,204.2,227.8,251.2,276,318.2]),
  fuelFlow:Object.freeze([46,89,134,180,226,274,320])
 });
 const primaryAngles=signal=>signal==='n2'?PRIMARY_TICK_ANGLES:PHOTO_PRIMARY_TICKS[signal];
 const FULL_DETENT_STEPS=Object.freeze({n1:10,egt:100});
 // Secondary dial graduations: actual visible white radial strokes and printed
 // legends from the Classic photo, not the legacy arbitrary 65°-355° sweep.
 // Increasing angles may extend beyond 360° to preserve needle continuity.
 const SECONDARY_MARKS=Object.freeze({
  oilPressure:Object.freeze({values:[0,20,40,60,80,100],angles:[133,193,253,314,380,452]}),
  oilTemp:Object.freeze({values:[-50,0,50,100,150,200],angles:[101,158,219,273,315,353]}),
  oilQty:Object.freeze({values:[0,1,2,3,4],angles:[35,99,156,219,278]}),
  vib:Object.freeze({values:[0,1,2,3,4,5],angles:[225,270,315,360,405,450]})
 });
 function interpolateMarks(values,angles,input){
  const v=Math.max(values[0],Math.min(values[values.length-1],input));
  for(let i=0;i<values.length-1;i++){
   if(v<=values[i+1]){
    const f=(v-values[i])/(values[i+1]-values[i]);
    return angles[i]+(angles[i+1]-angles[i])*f;
   }
  }
  return angles[angles.length-1];
 }
 function angle(spec,value){
  // Live image-specific white-line calibration: both engines are independent.
  // N2 remains owner-locked in the engine and its pointer is never re-fit.
  if(photoEngine)return photoEngine.angle(spec.signal,spec.engine,value);
  if(spec.primary){
   const per=PRIMARY_UNITS_PER_TICK[spec.signal];
   if(!per)throw Error('Uncalibrated primary engine dial '+spec.signal);
   const ticks=primaryAngles(spec.signal);
   // N1/EGT must land EXACTLY on every printed white graduation,
   // with no snapping when between two adjacent ticks.
   const fullStep=FULL_DETENT_STEPS[spec.signal];
   if(fullStep){
    const marked=Math.max(0,Math.min(ticks.length-1,value/fullStep));
    const lower=Math.min(ticks.length-2,Math.floor(marked));
    return ticks[lower]+(ticks[lower+1]-ticks[lower])*(marked-lower);
   }
   // Existing accepted N2 and Fuel Flow motion is explicitly unchanged.
   const marked=Math.max(0,Math.min(12,value/per));
   const lower=Math.min(5,Math.floor(marked/2));
   const ratio=(marked-lower*2)/2;
   return ticks[lower]+(ticks[lower+1]-ticks[lower])*ratio;
  }
  // Every secondary display has its OWN printed physical tick table.
  const secondary=SECONDARY_MARKS[spec.signal];
  if(!secondary)throw Error('No measured Conventional dial marks: '+spec.signal);
  return interpolateMarks(secondary.values,secondary.angles,value);
 }
function paint(spec){
 const rotor=rotors.get(spec.id);
 if(!rotor)return;
 const reading=values.get(spec.id);
 const renderValue=reading.value===null?spec.min:reading.value;
 const a=angle(spec,renderValue);
 rotor.setAttribute('transform','translate('+spec.cx+' '+spec.cy+') rotate('+a.toFixed(3)+') scale('+spec.scale+')');
 rotor.dataset.renderAngle=a.toFixed(3);
 rotor.dataset.calibratedValue=String(renderValue);
 rotor.parentNode.dataset.source=reading.source;
 rotor.parentNode.dataset.state=reading.value===null?'BLANK':'TRACK';
 rotor.parentNode.dataset.value=reading.value===null?'BLANK':String(reading.value);
}
function mount(){
 const host=getMount(),layout=getLayout();
 if(!host||!layout)return false;
 calibrateSourcePhoto(host);
 if(layer?.parentNode===host){layer.style.transform=layout.cssMatrix;return true;}
 if(layer && layer.parentNode!==host){layer.remove();rotors.clear();}
 layer=node(host,'svg',{class:'conventional-engine-needle-layer-v1',
    'data-conventional-needles':'CONV-NEEDLE-FIT-0003',viewBox:'0 0 1463 1075',preserveAspectRatio:'none',
    'aria-label':'Sixteen independent conventional engine instrument needles',
    'aria-hidden':'true',focusable:'false'});
 layer.style.width='1463px';layer.style.height='1075px';
 layer.style.transform=layout.cssMatrix; // Identical photo+pointer transform: no needle drift.
 const defs=node(layer,'defs');
 for(const spec of SPECS){
  const clipId='conv-needle-clip-'+spec.id.replace(/[^a-z0-9-]/g,'-');
  const clip=node(defs,'clipPath',{id:clipId});
  node(clip,'circle',{cx:spec.cx,cy:spec.cy,r:65});
  const group=node(layer,'g',{'data-conventional-needle':spec.id,'clip-path':'url(#'+clipId+')'});
  const pivot=node(group,'g',{'data-needle-pivot':spec.id});
  node(pivot,'image',{href:PHOTO,x:-40,y:-140,width:80,height:160,'preserveAspectRatio':'xMidYMid meet',
   'data-needle-photo':'transparent-photo-master'});
  rotors.set(spec.id,pivot);
  paint(spec);
 }
 return true;
}
function update(engine,signal,reading,source){
 if(!['engine1','engine2'].includes(engine))throw Error('Unknown engine: '+engine);
 const spec=SPECS.find(p=>p.engine===engine&&p.signal===signal);
 if(!spec)throw Error('Unknown conventional instrument '+signal);
 if(reading!==null&&(typeof reading!=='number'||!Number.isFinite(reading)))
  throw Error('Non-finite instrument reading');
 // Distinguish electrically blank from a real zero-speed ECU reading.
 const bounded=reading===null?null:Math.max(spec.min,Math.min(spec.max,reading));
 values.set(spec.id,Object.freeze({value:bounded,source:source||'EXPLICIT'}));
 if(source==='ENGINE_INDICATION_BACKEND_V2'||source==='ENGINE_INDICATION_SYNC_V1')
  backendOwned.add(spec.id);
 paint(spec);
 return bounded;
}
function fromIsn(indications){
 for(const engine of ['engine1','engine2']){
  const e=indications?.engines?.[engine];
  if(!e)continue;
  for(const signal of ['n2','egt']){
   if(backendOwned.has(signal+'_'+engine.at(-1)))continue;
   const value=e[signal]?.value;
   if(typeof value==='number'&&Number.isFinite(value))
    update(engine,signal,value,'ISN_START_SOURCE');
  }
 }
}
window.addEventListener('b737:cockpit-mounted',mount);
window.addEventListener('DOMContentLoaded',mount,{once:true});
window.addEventListener('b737:engine-indication-view',mount);
window.addEventListener('b737:isn-start-indications',event=>{fromIsn(event.detail);mount();});
window.B737ConventionalNeedlesV1=Object.freeze({
 getSpecs:()=>SPECS.map(spec=>({...spec})),
 getPhotoDetentAudit:()=>photoEngine?{...photoEngine.inspectAll({samples:512}),
  photoEvidence}:null,
 getPhotoRegistration:()=>photoEngine?Object.fromEntries(SPECS.map(s=>{
  const p=photoEngine.getProfile(s.signal,s.engine);
  return[s.id,{zero:p.values[0],end:p.values.at(-1),
   zeroAngle:p.angles[0],endAngle:p.angles.at(-1),
   values:[...p.values],angles:[...p.angles],shaft:[s.cx,s.cy],source:p.status}];
 })):null,
 getDialCalibration:()=>photoEngine?Object.fromEntries(
  Object.keys(photoEngine.REFERENCE).map(signal=>{
   const p=photoEngine.getProfile(signal,'engine1');
   return[signal,{photoTickAngles:[...p.angles],dialLabels:p.values.map((_,i)=>i),
    detentValues:[...p.values],status:p.status}];
  })
 ):({
  ...Object.fromEntries(Object.entries(PRIMARY_UNITS_PER_TICK).map(([signal,unitsPerDial])=>[
   signal,{unitsPerDial,photoTickAngles:[...primaryAngles(signal)],
    dialLabels:FULL_DETENT_STEPS[signal]
     ?Array.from({length:primaryAngles(signal).length},(_,i)=>i)
     :[0,2,4,6,8,10,12],
    detentValues:FULL_DETENT_STEPS[signal]
     ?Array.from({length:primaryAngles(signal).length},(_,i)=>i*FULL_DETENT_STEPS[signal])
     :[0,2,4,6,8,10,12].map(i=>i*unitsPerDial)}
  ])),
  ...Object.fromEntries(Object.entries(SECONDARY_MARKS).map(([signal,mark])=>[
   signal,{dialLabels:[...mark.values],photoTickAngles:[...mark.angles]}
  ]))
 }),
 getAngle:(engine,signal,value)=>{
  const spec=SPECS.find(p=>p.engine===engine&&p.signal===signal);
  if(!spec||typeof value!=='number'||!Number.isFinite(value))throw Error('Known engine dial and finite reading required');
  return angle(spec,value);
 },
 getReadings:()=>Object.fromEntries([...values.entries()].map(([id,v])=>[id,{...v}])),
 setReading:(engine,signal,value,source='EXPLICIT_TRAINER_OR_SOURCE')=>update(engine,signal,value,source),
 resetParked:()=>{backendOwned.clear();for(const spec of SPECS){values.set(spec.id,Object.freeze({value:0,source:'UNSOURCED_PARKED'}));paint(spec);}},
 mount
});
mount();
})();