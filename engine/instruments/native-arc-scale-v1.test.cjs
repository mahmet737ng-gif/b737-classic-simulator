'use strict';
const test=require('node:test'),a=require('node:assert/strict');
const {centerFromRadialLines,enumerateGraduations}=require('./native-arc-scale-v1');
const sha='c'.repeat(64);
function create(segments=[{lo:10,hi:20,count:6,start:220,end:275},{lo:50,hi:100,count:6,start:290,end:345}]){
 const pivot={x:400,y:480}, r1=110,r2=138, marks=[];
 for(const seg of segments)for(let j=0;j<seg.count;j++){
  const deg=seg.start+(seg.end-seg.start)*j/(seg.count-1);
  const theta=deg*Math.PI/180;
  marks.push({inner:{x:pivot.x+r1*Math.sin(theta),y:pivot.y-r1*Math.cos(theta)},
   outer:{x:pivot.x+r2*Math.sin(theta),y:pivot.y-r2*Math.cos(theta)}});
 }
 return {marks,pivot};
}
test('intersection of native radial photo line segments estimates physical ARC center',()=>{
 const {marks,pivot}=create();
 const r=centerFromRadialLines(marks);
 a.ok(Math.abs(r.x-pivot.x)<1e-6&&Math.abs(r.y-pivot.y)<1e-6);
 a.ok(r.rmsResidualPx<1e-8);
 a.ok(r.arcSpanDeg>100);
 a.equal(r.geometryCertified,false);
});
test('10 to 20 with five divisions has 2 per small line; 50 to 100 with five has 10 each',()=>{
 const {marks,pivot}=create();
 const result=enumerateGraduations({photoHash:sha,sourceDimensions:[900,900],pivot,
  unit:'TEST',strokes:marks,printedNumberAnchors:[
   {tickIndex:0,value:10,evidence:'PHOTO_PRINTED_LABEL_VISUALLY_VERIFIED'},
   {tickIndex:5,value:20,evidence:'PHOTO_PRINTED_LABEL_VISUALLY_VERIFIED'},
   {tickIndex:6,value:50,evidence:'PHOTO_PRINTED_LABEL_VISUALLY_VERIFIED'},
   {tickIndex:11,value:100,evidence:'PHOTO_PRINTED_LABEL_VISUALLY_VERIFIED'}]});
 a.deepEqual(result.segments.map(s=>s.perIntervalIfEqual),[2,30,10]);
 a.deepEqual(result.segments.map(s=>s.observedIntervals),[5,1,5]);
 a.equal(result.ringStrokes[1].inferredValueIfEqual,12);
 a.equal(result.ringStrokes[9].inferredValueIfEqual,80);
 a.equal(result.ringStrokes[1].value,null);
 a.equal(result.ringStrokes[9].value,null);
 a.equal(result.unknownStrokeIndices.length,8);
 a.equal(result.allMinorValuesCertified,false);
});
test('rejects imaginary labels, unverified or contradictory intervals',()=>{
 const {marks,pivot}=create();
 const source={photoHash:sha,sourceDimensions:[900,900],pivot,unit:'PSI',strokes:marks,
 printedNumberAnchors:[{tickIndex:0,value:10,evidence:'PHOTO_PRINTED_LABEL_VISUALLY_VERIFIED'},
 {tickIndex:5,value:20,evidence:'GUESSED_OCR'}]};
 a.throws(()=>enumerateGraduations(source),/printed source label/);
 a.throws(()=>enumerateGraduations({...source,printedNumberAnchors:[{tickIndex:0,value:20,evidence:'PHOTO_PRINTED_LABEL_VISUALLY_VERIFIED'},{tickIndex:5,value:10,evidence:'PHOTO_PRINTED_LABEL_VISUALLY_VERIFIED'}]}),/nonincreasing/);
 a.throws(()=>centerFromRadialLines(marks.slice(0,3)),/five observed/);
});
test('rotated arc segments with measured nonuniform spacings remain unknown',()=>{
 const {marks,pivot}=create();
 // Distort one angular bearing by 20 degrees, retain a radial white tick.
 const deg=250*Math.PI/180;for(const r of [marks[2].inner,marks[2].outer]){
  const distance=Math.hypot(r.x-pivot.x,r.y-pivot.y);
  r.x=pivot.x+Math.sin(deg)*distance;r.y=pivot.y-Math.cos(deg)*distance;
 }
 const res=enumerateGraduations({photoHash:sha,sourceDimensions:[900,900],pivot,
 unit:'C',strokes:marks,printedNumberAnchors:[{tickIndex:0,value:10,evidence:'PHOTO_PRINTED_LABEL_VISUALLY_VERIFIED'},
 {tickIndex:5,value:20,evidence:'PHOTO_PRINTED_LABEL_VISUALLY_VERIFIED'}]});
 a.equal(res.segments[0].spacingConsistent,false);
 a.equal(res.ringStrokes[1].inferredValueIfEqual,null);
});
