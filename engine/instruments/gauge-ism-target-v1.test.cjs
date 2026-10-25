const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compile}=require('./gauge-scale-engine-v2.js');
const {make,canonicalUnit}=require('./gauge-ism-target-v1.js');
const point=(value,angle)=>({
 value,x:150+100*Math.sin(angle*Math.PI/180),
 y:150-100*Math.cos(angle*Math.PI/180),evidence:'measured_source_pixels'});
const spec={id:'unit.test',kind:'rotary',unit:'psi',
 source:{asset:'test',width:301,height:301,sha256:'b'.repeat(64)},
 pivot:{x:150,y:150},min:0,max:100,direction:'clockwise',
 marks:[point(0,-90),point(50,0),point(100,90)],
 status:'verified',review:{approved:true}};
test('ISM pressure increasing moves CW; decreasing moves CCW on same pointer',()=>{
 const d=make({id:'ductL',calibration:compile(spec),
 motion:{mode:'slew',degreesPerSecond:30}});
 let s=d.advance({value:0,unit:'psi',valid:true,powered:true},0);
 assert.equal(s.angleDeg,-90);
 s=d.advance({value:100,unit:'PSI',valid:true,powered:true},1);
 assert.equal(s.angleDeg,-60);assert.equal(s.targetAngleDeg,90);
 assert.equal(s.motionDirection,'clockwise');
 s=d.advance({value:0,unit:'psi',valid:true,powered:true},0.5);
 assert.equal(s.angleDeg,-75);assert.equal(s.motionDirection,'counterclockwise');
 s=d.advance({value:0,unit:'psi',valid:true,powered:true},0.5);
 assert.equal(s.angleDeg,-90);assert.equal(s.motionDirection,'stopped');
 s=d.advance({value:0,unit:'psi',valid:true,powered:true},1);
 assert.equal(s.angleDeg,-90);
});
test('No valid sensor or mismatched unit silently changes needle',()=>{
 const d=make({id:'ductL',calibration:compile(spec),motion:{mode:'direct'}});
 d.advance({value:20,unit:'psi',valid:true,powered:true});
 const last=d.read().angleDeg;
 assert.equal(d.advance({value:50,unit:'kpa',valid:true,powered:true}).reason,'unit_mismatch');
 assert.equal(d.advance({value:50,unit:'psi',valid:false,powered:true}).reason,'invalid_sensor');
 assert.equal(d.advance({value:50,unit:'psi',valid:true,powered:false}).reason,'power_unconfirmed');
 assert.equal(d.read().angleDeg,last);
});
test('A 1-second sensor lag eases both ways without overshooting',()=>{
 const d=make({id:'ductL',calibration:compile(spec),motion:{mode:'first_order',tauSeconds:1}});
 d.advance({value:0,unit:'psi',valid:true,powered:true});
 const x=d.advance({value:100,unit:'psi',valid:true,powered:true},1);
 assert.ok(x.angleDeg>-90&&x.angleDeg<90);
 const y=d.advance({value:0,unit:'psi',valid:true,powered:true},1);
 assert.ok(y.angleDeg>-90&&y.angleDeg<x.angleDeg);
});
test('A draft scale cannot be driven from ISM in production',()=>{
 const d=make({id:'dc',calibration:compile({...spec,status:'draft'}),
 motion:{mode:'direct'}});
 const s=d.advance({value:10,unit:'psi',valid:true,powered:true});
 assert.equal(s.status,'blocked');assert.equal(d.read().angleDeg,null);
});
test('CPS and hertz are equivalent; temperature and voltage are distinct',()=>{
 assert.equal(canonicalUnit('CPS'),canonicalUnit('Hz'));
 assert.equal(canonicalUnit('°C'),'°C');
 assert.notEqual(canonicalUnit('V'),canonicalUnit('Hz'));
});
