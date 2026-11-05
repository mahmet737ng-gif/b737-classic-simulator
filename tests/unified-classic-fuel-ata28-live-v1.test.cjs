'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const F=require('../engine/systems/classic-fuel-system-v1');
const Runtime=require('../engine/integration/isn-09-12-runtime-v1');
const mkFuel=(q={main1:3500,center:1000,main2:3500})=>new Runtime.FuelNetwork({initialFuelKg:q});
const ids=Object.keys(F.PUMPS);
function pumps(on=[]){return Object.fromEntries(ids.map(id=>[id,{switchOn:on.includes(id),operating:on.includes(id),failed:false,powerEvidence:'TEST_SENSOR'}]));}
const mainL='fuel.main1FwdPump',centerL='fuel.centerLeftPump',centerR='fuel.centerRightPump';
{
 const f=mkFuel(),c=new F.Controller({fuel:f});
 assert.equal(c.get(pumps()).totalFuelKg,8000);
 assert.equal(c.get(pumps()).lamps['fuel-1-fwd'],true,'main OFF is low pressure');
 assert.equal(c.get(pumps()).lamps['fuel-center-l'],false,'center OFF extinguishes LP');
 assert.equal(c.get(pumps()).caution.masterCaution,true,'both main OFF -> FUEL caution');
 assert.equal(c.get(pumps()).caution.recall,true);
 assert.equal(c.effectivePumps(pumps([mainL]))[mainL].operating,true);
 assert.equal(c.get(pumps([mainL])).lamps['fuel-1-fwd'],false);
 // Physical crossfeed detent cannot bypass an unpowered DC motor.
 c.commandCrossfeed('OPEN');
 c.advance(1000,pumps([mainL]),{batteryPowered:false});
 assert.equal(f.crossfeed,'CLOSED');
 assert.equal(c.get().valves.crossfeed.lamp,'BRIGHT_BLUE');
 c.advance(400,pumps([mainL]),{batteryPowered:true});
 assert.equal(f.crossfeed,'CLOSED');
 c.advance(420,pumps([mainL]),{batteryPowered:true});
 assert.equal(f.crossfeed,'OPEN');
 assert.equal(c.get().valves.crossfeed.lamp,'DIM_BLUE');
 const supply=f.supply('engine2',c.effectivePumps(pumps([mainL])),{fuelStartLever:'IDLE'});
 assert.equal(supply.reason,'OTHER_MAIN_CROSSFEED');
 c.commandCrossfeed('CLOSED');c.advance(1000,pumps([mainL]),{batteryPowered:true});
 assert.equal(f.crossfeed,'CLOSED');assert.equal(c.get().valves.crossfeed.lamp,'OFF');
}
{
 const f=mkFuel({main1:4000,center:1000,main2:4000}),c=new F.Controller({fuel:f});
 const all=pumps([mainL,centerL,centerR]);
 c.advance(1000,all,{batteryPowered:true});
 assert.equal(c.get(all).scavenge.armed,true);
 // Turning both center switches OFF opens the classical 20-minute window.
 const off=pumps([mainL]);
 c.advance(1000,off,{batteryPowered:true});
 const before=c.get(off).totalFuelKg;
 c.advance(60000,off,{batteryPowered:true});
 assert.equal(c.get(off).scavenge.active,true);
 assert.ok(c.get(off).scavenge.transferredKg>0);
 assert.ok(c.get(off).tanksKg.main1>4000);
 assert.ok(c.get(off).tanksKg.center<1000);
 assert.ok(Math.abs(c.get(off).totalFuelKg-before)<1e-8,'scavenge conserves mass');
 for(let i=0;i<13;i++)c.advance(100000,off,{batteryPowered:true});
 assert.equal(c.get(off).scavenge.active,false);
 assert.equal(c.get(off).scavenge.flowKgHr,0);
}
{
 const f=mkFuel({main1:100,center:0,main2:100}),c=new F.Controller({fuel:f});
 const on=pumps([centerL]);
 assert.equal(c.effectivePumps(on)[centerL].operating,false,'empty center cannot feed a running motor');
 assert.equal(c.effectivePumps(on)[centerL].lowPressure,true);
 c.advance(2500,on,{batteryPowered:true});
 c.advance(2500,on,{batteryPowered:true});
 assert.equal(c.get(on).pumps[centerL].autoStopped,true);
 f.setTank('center',200);
 assert.equal(c.effectivePumps(on)[centerL].operating,false,'auto-stop latched until switch reset');
 c.advance(100,pumps([]),{batteryPowered:true});
 c.advance(100,pumps([centerL]),{batteryPowered:true});
 assert.equal(c.get(pumps([centerL])).pumps[centerL].autoStopped,false);
 assert.equal(c.effectivePumps(pumps([centerL]))[centerL].operating,true);
 // Instructor cannot exceed usable-tank capacity or refuel in flight.
 assert.throws(()=>c.service({tank:'center',quantityKg:7030}),/capacity/);
 assert.throws(()=>c.service({tank:'main1',quantityKg:100,onGround:false}),/ground/);
 c.service({tank:'main1',quantityKg:4555,onGround:true});
 assert.equal(c.get().tanksKg.main1,4555);
}
{
 // No shadow fuel tanks in Unified: ECU and controller share the same ledger.
 const Electrical=require('../engine/systems/electrical-v7');
 const Loads=require('../engine/systems/electrical-loads-v8');
 const TrainerCore=require('../engine/trainer/core');
 const {WarningEngine}=require('../audio/warning-engine');
 const Pneumatics=require('../engine/systems/pneumatics-v6');
 const Pack=require('../engine/integration/isn-electrical-pack-v1');
 const EngineAPU=require('../engine/integration/isn-engine-apu-v1');
 const Start=require('../engine/integration/isn-start-sequence-v1');
 const Chain=require('../engine/integration/isn-apu-start-chain-v1');
 const ThrustPlanner=require('../engine/integration/isn-thrust-performance-v1');
 const ECU=require('../engine/integration/isn-13-18-ecu-testbench-v1');
 const e=new ECU.Testbench({Electrical,Loads,TrainerCore,WarningEngine,Pneumatics,Pack,EngineAPU,
  Start,Chain,ThrustPlanner,FuelRuntime:Runtime,FuelSystem:F,timingProfile:'CLASSROOM_COMPRESSED'});
 assert.equal(e.core.fuelSystem.fuel,e.core.fuel,'must share tank ledger instance');
 assert.equal(e.get().fuel.system.schema,F.VERSION);
 assert.equal(e.get().fuel.system.tanksKg.main1,e.get().fuel.tanksKg.main1);
 e.core.fuelSystem.service({tank:'main1',quantityKg:1000});
 assert.equal(e.get().fuel.system.tanksKg.main1,1000);
 e.core.fuelSystem.commandCrossfeed('OPEN');
 e.advance(1000);assert.equal(e.get().fuel.system.valves.crossfeed.position,'CLOSED','Battery off forbids motor');
 e.battery(true);e.advance(1000);
 assert.equal(e.get().fuel.system.valves.crossfeed.position,'OPEN');
}
{
 const cockpit=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/index.html'),'utf8');
 const gateway=fs.readFileSync(path.join(__dirname,'../engine/runtime/unified-live-gateway-v1.js'),'utf8');
 assert.match(cockpit,/FuelSystem:window.B737ClassicFuelSystemV1/);
 assert.match(cockpit,/lamps\['crossfeed-valve'\]=actualFuel.valves.crossfeed.lamp/);
 assert.match(cockpit,/fuelTrainerAction:command/);
 assert.match(html,/fuel-system-live-unified-v1\.js/);
 assert.match(gateway,/fuel:copy\(e\.fuel\)/);
}
console.log('PASS Unified ATA28: shared fuel ledger, six pump source gates, crossfeed valve travel, center dry auto-stop, 20-min scavenge, ground fueling caps, ECU and cockpit bridge.');
