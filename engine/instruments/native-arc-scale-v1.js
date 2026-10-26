/* Native photo arc scanner calibration engine.
 * No OCR labels, no pixels invented, no implicit equipment certification.
 * Only source-image coordinates and independently verified number anchors count.
 */
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const ok=(condition,msg)=>{if(!condition)throw Error('ARC_PHOTO_QA: '+msg)};
const hypot=(a,b)=>Math.hypot(a,b);
const angularGap=(a,b)=>((b-a)%360+360)%360;
function centerFromRadialLines(lines){
 ok(Array.isArray(lines)&&lines.length>=5,'at least five observed source-native strokes required');
 let a=0,b=0,c=0,dx=0,dy=0;const used=[];
 for(const [index,segment] of lines.entries()){
  const p=segment?.inner,q=segment?.outer;
  ok(p&&q&&[p.x,p.y,q.x,q.y].every(finite),'bad source stroke '+index);
  const ux=q.x-p.x,uy=q.y-p.y,length=hypot(ux,uy);
  ok(length>=3,'source stroke too short '+index);
  const nx=-uy/length,ny=ux/length,d=nx*p.x+ny*p.y;
  a+=nx*nx;b+=nx*ny;c+=ny*ny;dx+=nx*d;dy+=ny*d;
  used.push({p,q,nx,ny,d});
 }
 const determinant=a*c-b*b;
 ok(determinant>0.02,'parallel / insufficiently dispersed source strokes');
 const x=(dx*c-dy*b)/determinant;
 const y=(dy*a-dx*b)/determinant;
 const residuals=used.map(l=>Math.abs(l.nx*x+l.ny*y-l.d));
 const radial=used.map(l=>hypot(l.p.x-x,l.p.y-y));
 const angles=used.map(l=>((Math.atan2(l.p.x-x,y-l.p.y)*180/Math.PI)%360+360)%360);
 const ordered=angles.map((v,i)=>({i,v})).sort((p,q)=>p.v-q.v);
 const gaps=ordered.map((o,i)=>angularGap(o.v,ordered[(i+1)%ordered.length].v));
 const arcSpanDeg=360-Math.max(...gaps);
 return Object.freeze({x,y,rmsResidualPx:Math.sqrt(residuals.reduce((n,v)=>n+v*v,0)/residuals.length),
  maxResidualPx:Math.max(...residuals),
  radialDistancePx:{min:Math.min(...radial),max:Math.max(...radial)},
  arcSpanDeg,sourceStrokes:lines.length,
  geometryCertified:false});
}
function enumerateGraduations({photoHash,sourceDimensions,pivot,strokes,printedNumberAnchors,
  unit,clockwise=true,maxAngleDeviationFraction=.3,maxRadialErrorPx=3}){
 ok(/^[a-f0-9]{64}$/i.test(photoHash||''),'original artwork hash required');
 ok(Array.isArray(sourceDimensions)&&sourceDimensions.length===2&&sourceDimensions.every(x=>Number.isInteger(x)&&x>0),'photo size');
 ok(pivot&&finite(pivot.x)&&finite(pivot.y),'real radial hub candidate');
 ok(typeof unit==='string'&&unit.length>0,'unit required');
 ok(Array.isArray(strokes)&&strokes.length>=2,'measured tick strokes required');
 ok(Array.isArray(printedNumberAnchors)&&printedNumberAnchors.length>=2,'printed numbers and their real stroke indices required');
 const bearing=p=>((Math.atan2(p.x-pivot.x,pivot.y-p.y)*180/Math.PI)%360+360)%360;
 const rows=strokes.map((s,i)=>{
  const a=s?.inner,b=s?.outer;
  ok(a&&b&&[a.x,a.y,b.x,b.y].every(finite),'missing observed stroke endpoints '+i);
  for(const p of [a,b])ok(p.x>=0&&p.x<sourceDimensions[0]&&p.y>=0&&p.y<sourceDimensions[1],'source coordinate out of bounds');
  const r1=hypot(a.x-pivot.x,a.y-pivot.y),r2=hypot(b.x-pivot.x,b.y-pivot.y);
  ok(r2>r1&&r2-r1>=3,'tick radial endpoints are reversed or too close '+i);
  const phi=bearing(a),phi2=bearing(b);
  const radialMismatch=Math.min(angularGap(phi,phi2),angularGap(phi2,phi));
  ok(radialMismatch<=maxRadialErrorPx*180/(Math.PI*r1),'off-axis tick '+i);
  return {index:i,bearingDeg:phi,rInnerPx:r1,rOuterPx:r2,degreeFromSource:true,
   classified:'UNLABELED_SOURCE_STROKE',value:null};
 });
 const dir=clockwise?1:-1;
 const unwrapped=[rows[0].bearingDeg];
 for(let i=1;i<rows.length;i++){
  const gap=dir===1?angularGap(rows[i-1].bearingDeg,rows[i].bearingDeg):
   angularGap(rows[i].bearingDeg,rows[i-1].bearingDeg);
  ok(gap>0.01&&gap<90,'non-monotonic or implausible source photo radial arc '+i);
  unwrapped.push(unwrapped[i-1]+gap);
 }
 const defs=printedNumberAnchors.slice().sort((x,y)=>x.tickIndex-y.tickIndex);
 let prior=-1,priorValue=-Infinity;
 for(const a of defs){
  ok(Number.isInteger(a.tickIndex)&&a.tickIndex>=0&&a.tickIndex<rows.length&&a.tickIndex>prior,'duplicate/out-of-order numeric anchor');
  ok(finite(a.value)&&a.value>priorValue,'nonincreasing printed value');
  ok(a.evidence==='PHOTO_PRINTED_LABEL_VISUALLY_VERIFIED','printed source label must be human/photo verified');
  prior=a.tickIndex;priorValue=a.value;
  rows[a.tickIndex]={...rows[a.tickIndex],value:a.value,classified:'PRINTED_NUMBER_VERIFIED'};
 }
 const unknown=[],segments=[];
 for(let k=1;k<defs.length;k++){
  const lo=defs[k-1],hi=defs[k],steps=hi.tickIndex-lo.tickIndex;
  ok(steps>0,'zero tick steps');
  const arcs=[];
  for(let i=lo.tickIndex;i<hi.tickIndex;i++)arcs.push(unwrapped[i+1]-unwrapped[i]);
  const mean=arcs.reduce((a,b)=>a+b,0)/arcs.length;
  const variation=Math.max(...arcs.map(x=>Math.abs(x-mean)/mean));
  const usable=variation<=maxAngleDeviationFraction;
  segments.push({fromValue:lo.value,toValue:hi.value,fromIndex:lo.tickIndex,toIndex:hi.tickIndex,
   observedIntervals:steps,perIntervalIfEqual:(hi.value-lo.value)/steps,
   angularVariationFraction:Number(variation.toFixed(4)),
   spacingConsistent:usable,independentlyNumberVerified:false});
  for(let i=lo.tickIndex+1;i<hi.tickIndex;i++){
   rows[i].classified=usable?'INFERRED_UNIFORM_BETWEEN_PHOTO_LABELS':'UNKNOWN_NONUNIFORM_SOURCE_STROKE';
   // Separate a hypothesis from a photo-verified label. Consumers cannot
   // inadvertently treat the hypothesis as approved tick value.
   rows[i].inferredValueIfEqual=usable?lo.value+(hi.value-lo.value)*(i-lo.tickIndex)/steps:null;
   rows[i].value=null;
   unknown.push(i);
  }
 }
 for(let i=0;i<rows.length;i++)
  if(rows[i].value===null&&!unknown.includes(i))unknown.push(i);
 return Object.freeze({sourceHash:photoHash,pivot:{x:pivot.x,y:pivot.y},
  unit,ringStrokes:rows,printedAnchors:defs,segments,
  unknownStrokeIndices:unknown,allMinorValuesCertified:unknown.length===0,
  mechanicalPivotCertified:false,operationalMotionReleased:false});
}
module.exports=Object.freeze({centerFromRadialLines,enumerateGraduations});
