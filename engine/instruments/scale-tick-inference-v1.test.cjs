const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inferTicks,mapValue,denseTable,lengthClasses}=require('./scale-tick-inference-v1.js');
const angles=[-60,-40,-20,0,20,40,60];
const photoTicks=angles.map((angleDeg,i)=>({
  angleDeg,lengthPx:i%2===0?17:7,labelValue:i%2===0?(i/2)*10:null
}));
test('GEN DRIVE OIL TEMP RISE: one short tick between 0/10/20/30 is 5/15/25',()=>{
 const x=inferTicks({direction:'clockwise',ticks:photoTicks,
 positionOrigin:'zoomed_screenshot_candidate'});
 assert.deepEqual(x.marks.map(m=>m.value),[0,5,10,15,20,25,30]);
 assert.deepEqual(x.marks.map(m=>m.tickClass),['long','short','long','short','long','short','long']);
 assert.deepEqual(x.intervals.map(p=>p.increment),[5,5,5]);
 assert.equal(x.visualApproved,false);
 assert.equal(mapValue(x,23).angleDeg,32);
 assert.equal(mapValue(x,28).angleDeg,52);
 assert.equal(mapValue(x,30,{outOfRange:'reject'}).status,'ok');
 assert.equal(mapValue(x,45,{outOfRange:'reject'}).status,'out_of_range');
});
test('Same physical GEN DRIVE ticks are distinct IN 60/80/120/160 values',()=>{
 const ticks=angles.map((angleDeg,i)=>({
  angleDeg,lengthPx:i%2===0?17:7,
  labelValue:i%2===0?[60,80,120,160][i/2]:null
 }));
 const s=inferTicks({direction:'clockwise',ticks});
 assert.deepEqual(s.marks.map(m=>m.value),[60,70,80,100,120,140,160]);
 assert.deepEqual(s.intervals.map(i=>i.increment),[10,20,20]);
 assert.equal(mapValue(s,90).angleDeg,-10);
 assert.equal(mapValue(s,130).angleDeg,30);
});
test('20 to 40 with one or three short ticks means 30 or 25/30/35',()=>{
 function t(labels){return labels.map((labelValue,i)=>({angleDeg:i*14,lengthPx:labelValue===null?4:12,labelValue}));}
 let x=inferTicks({direction:'clockwise',ticks:t([20,null,40])});
 assert.deepEqual(x.marks.map(x=>x.value),[20,30,40]);
 x=inferTicks({direction:'clockwise',ticks:t([20,null,null,null,40])});
 assert.deepEqual(x.marks.map(x=>x.value),[20,25,30,35,40]);
 const y=inferTicks({direction:'clockwise',ticks:t([30,null,null,null,40])});
 assert.deepEqual(y.marks.map(x=>x.value),[30,32.5,35,37.5,40]);
});
test('Major/short strokes are not assumed to mean a globally fixed 10 or 5 units',()=>{
 const x=inferTicks({direction:'clockwise',
 ticks:[{angleDeg:-30,lengthPx:14,labelValue:100},
        {angleDeg:-20,lengthPx:5,labelValue:null},
        {angleDeg: -5,lengthPx:14,labelValue:110},
        {angleDeg: 10,lengthPx:6,labelValue:null},
        {angleDeg: 20,lengthPx:14,labelValue:130}]});
 assert.deepEqual(x.marks.map(x=>x.value),[100,105,110,120,130]);
 assert.deepEqual(x.intervals.map(i=>i.increment),[5,10]);
 assert.equal(x.marks[1].tickClass,'short');
 assert.equal(x.marks[3].tickClass,'short');
});
test('Increasing CCW scale reverses pointer geometry; decreasing returns clockwise',()=>{
 const x=inferTicks({direction:'counterclockwise',
 ticks:[{angleDeg:60,labelValue:0},{angleDeg:30,labelValue:50},{angleDeg:0,labelValue:100}]});
 assert.equal(mapValue(x,75).angleDeg,15);
 assert.equal(mapValue(x,25).angleDeg,45);
});
test('Position interpolates using measured local tick angles, not one global linear angular assumption',()=>{
 const x=inferTicks({direction:'clockwise',
 ticks:[{angleDeg:-60,labelValue:0},{angleDeg:-54,labelValue:10},
 {angleDeg:-38,labelValue:20},{angleDeg:14,labelValue:30}]});
 assert.equal(mapValue(x,15).angleDeg,-46);
 assert.equal(mapValue(x,25).angleDeg,-12);
});
test('Fuel Temperature -40..40 has 81 integer targets, not 81 printed ticks',()=>{
 const values=[-40,-30,-20,-10,0,10,20,30,40];
 const x=inferTicks({direction:'clockwise',
 positionOrigin:'legacy_angle_preview_not_native_image',
 ticks:values.map((v,i)=>({angleDeg:-70+17.5*i,labelValue:v,lengthPx:20}))});
 const table=denseTable(x,{min:-40,max:40,step:1});
 assert.equal(table.length,81);
 assert.equal(table[0].value,-40);
 assert.equal(table[40].value,0);
 assert.equal(table[80].value,40);
 assert.equal(table[15].value,-25);
 assert.equal(table[55].value,15);
 assert.equal(table[15].angleDeg,-43.75);
 assert.equal(table[55].angleDeg,26.25);
 assert.equal(table[0].precision,'unverified_until_image_QA');
});
test('Rejects unlabeled end limits, reversed values, and nonfinite signal',()=>{
 assert.throws(()=>inferTicks({direction:'clockwise',ticks:[
  {angleDeg:0,labelValue:null},{angleDeg:40,labelValue:10}]}),/First and last/);
 assert.throws(()=>inferTicks({direction:'clockwise',ticks:[
  {angleDeg:0,labelValue:20},{angleDeg:40,labelValue:10}]}),/increase/);
 const s=inferTicks({direction:'clockwise',ticks:[
  {angleDeg:0,labelValue:0},{angleDeg:40,labelValue:10}]});
 assert.throws(()=>mapValue(s,NaN),/finite/);
 assert.deepEqual(lengthClasses([{lengthPx:7},{lengthPx:7}]),['similar','similar']);
});
