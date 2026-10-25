'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {subdivide,inferInterval,oneUnitGrid,needleMotion}=require('./tick-inference-v1.js');
test('three equally spaced minor marks in 30..40 are 32.5,35,37.5',()=>{
 const rows=subdivide(30,40,[.25,.5,.75],{equalSubdivisions:true});
 assert.deepEqual(rows.map(r=>r.value),[32.5,35,37.5]);
});
test('one minor line is 30 between 20 and 40',()=>{
 assert.deepEqual(subdivide(20,40,[.5],{equalSubdivisions:true}).map(r=>r.value),[30]);
});
test('long and short strokes do not imply value until anchor interval is known',()=>{
 assert.deepEqual(subdivide(20,40,[.25,.5,.75]).map(r=>r.value),[null,null,null]);
});
test('reject unequal geometry as an invented equal scale',()=>{
 assert.throws(()=>subdivide(30,40,[.15,.45,.8],{equalSubdivisions:true}),/Unequal/);
});
test('infer measured clockwise source angles; interpolate unequal numeric ranges separately',()=>{
 const r=inferInterval({value:20,angle:-70},{value:40,angle:-10},[
  {angle:-50,classification:'short'},{angle:-30,classification:'long'}
 ],{direction:'clockwise',equalSubdivisions:true});
 assert.deepEqual(r.map(p=>p.value),[26.6666666667,33.3333333333]);
 assert.deepEqual(r.map(p=>p.classification),['short','long']);
});
test('clockwise increasing gauge reverses on decreasing indication',()=>{
 assert.equal(needleMotion(20,30,'clockwise'),'clockwise');
 assert.equal(needleMotion(30,20,'clockwise'),'counterclockwise');
 assert.equal(needleMotion(30,30,'clockwise'),'hold');
 assert.equal(needleMotion(20,30,'counterclockwise'),'counterclockwise');
 assert.equal(needleMotion(30,20,'counterclockwise'),'clockwise');
});
test('fuel −40..+40 has 81 integer positions including zero',()=>{
 const grid=oneUnitGrid(-40,40,v=>-70+(v+40)*140/80,{
   source:'legacy_linear_angular_preview_NOT_measured'});
 assert.equal(grid.length,81);assert.equal(grid[0].value,-40);
 assert.equal(grid[40].value,0);assert.equal(grid[80].value,40);
 assert.equal(grid[40].angleDeg,0);
 assert.equal(grid[80].angleDeg,70);
 assert.equal(grid[10].value,-30);
 assert.ok(grid.every((p,i)=>p.value===i-40));
 assert.ok(grid.every(p=>p.source.includes('NOT_measured')));
});
test('guard against false measurements',()=>{
 assert.throws(()=>oneUnitGrid(-40,40,()=>NaN),/Invalid/);
 assert.throws(()=>subdivide(10,20,[.5,.5],{equalSubdivisions:true}),/Duplicate/);
 assert.throws(()=>needleMotion(20,30,'unknown'),/Direction/);
});