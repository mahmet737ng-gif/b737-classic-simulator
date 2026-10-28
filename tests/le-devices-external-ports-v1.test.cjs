const test=require('node:test'),assert=require('node:assert/strict');
const Ports=require('../engine/integrations/le-devices-external-ports-v1.js');
function stub(){
 const actions=[],pressure=[],electric=[];
 return {trainer:{
  dispatch:a=>actions.push(a),setHydraulicPressure:x=>pressure.push(x),
  setElectricalSnapshot:v=>electric.push(v)
 },actions,pressure,electric};
}
test('all four ports are explicit, non-autonomous, and leave approved logic untouched',()=>{
 const x=stub(),p=Ports.create(x.trainer);
 assert.equal(x.actions.length,0);assert.equal(x.electric.length,0);
 assert.deepEqual(p.description.channels,['hydraulics','electrical','circuitBreakers','aircraftDynamics']);
 assert.equal(p.snapshot().effectivePower,null);
 assert.throws(()=>p.setCircuitBreakers({overheadAnnunciator:false,centerAnnunciators:true}),/Electrical snapshot required/);
});
test('whole-channel electric and grouped CB gate combine with fail-closed three-value states',()=>{
 const x=stub(),p=Ports.create(x.trainer);
 assert.deepEqual(p.setElectrical({transfer1:true,dc1:true}),{transfer1:true,dc1:true});
 assert.deepEqual(p.setCircuitBreakers({overheadAnnunciator:false,centerAnnunciators:true}),{transfer1:false,dc1:true});
 assert.deepEqual(x.electric.at(-1).bus,{transfer1:false,dc1:true});
 assert.deepEqual(p.setElectrical({transfer1:null,dc1:false}),{transfer1:false,dc1:false});
 assert.deepEqual(p.setCircuitBreakers({overheadAnnunciator:true,centerAnnunciators:null}),{transfer1:null,dc1:false});
 assert.deepEqual(p.snapshot().effectivePower,{transfer1:null,dc1:false});
 assert.throws(()=>p.setCircuitBreakers({overheadAnnunciator:0,centerAnnunciators:true}));
});
test('hydraulic and dynamics snapshots route only through existing LE trainer actions',()=>{
 const x=stub(),p=Ports.create(x.trainer);
 p.setHydraulics({A:true,B:false,standby:true,ptuAvailable:false,pressurePsi:1700});
 assert.equal(x.actions.length,4);
 assert.deepEqual(x.actions[1],{type:'HYDRAULIC',system:'B',value:false});
 assert.deepEqual(x.actions[3],{type:'PTU',value:false});
 assert.deepEqual(x.pressure,[1700]);
 p.setAircraftDynamics({onGround:false,autoslatRequested:true});
 assert.deepEqual(x.actions.slice(-2),[{type:'GROUND',value:false},{type:'AUTOSLAT',value:true}]);
 assert.throws(()=>p.setHydraulics({A:true,B:true,standby:true,ptuAvailable:true,pressurePsi:-1}));
 assert.throws(()=>p.setAircraftDynamics({onGround:true,autoslatRequested:1}));
});
test('all input snapshots are copied and do not leak mutable internal state',()=>{
 const x=stub(),p=Ports.create(x.trainer);
 const snap={transfer1:true,dc1:true};p.setElectrical(snap);snap.dc1=false;
 const first=p.snapshot();first.electrical.dc1=false;
 assert.equal(p.snapshot().electrical.dc1,true);
});
