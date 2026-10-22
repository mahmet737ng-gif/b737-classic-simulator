'use strict';
const assert=require('node:assert/strict');
const {evaluateElectricalPower:e}=require('../engine/network/electrical-power-pilot.cjs');
const {evaluateEngineFireDetection:fire}=require('../engine/network/fire-detection-pilot.cjs');
const base=()=>({
 phase:'AIR',busTransfer:'AUTO',standbySwitch:'AUTO',
 selected:{bus1:'GEN1',bus2:'GEN2'},
 available:{GEN1:true,GEN2:true,APU:false,EXT:false},
 batterySwitchOn:true,batteryUsable:true,inverterOperable:true,
 glideSlopeCaptured:false,groundPowerSwitchOn:false,groundServiceSwitchOn:false,
 trOperable:{TR1:true,TR2:true,TR3:true}
});
const withPatch=(patch={})=>e({...base(),...patch});
const loops={A:{healthy:true,overheat:false,fire:true},
 B:{healthy:true,overheat:false,fire:true}};
let r=withPatch();
assert.deepEqual(r.sourceAssignments,{bus1:'GEN1',bus2:'GEN2'});
assert.equal(r.buses.generator1,'POWERED');
assert.equal(r.buses.generator2,'POWERED');
assert.equal(r.buses.transfer1Feed,'BUS1');
assert.equal(r.buses.transfer2Feed,'BUS2');
assert.equal(r.buses.dcTie,'CONNECTED');
assert.equal(r.buses.dc1,'POWERED');
assert.equal(r.buses.dc2,'POWERED');
assert.equal(r.transformerRectifiers.TR3,'POWERED');
assert.equal(r.buses.standbySource,'NORMAL');
assert.equal(r.crossSystemEffects.length,0);

// GEN1 fail: generator/main bus1 OFF, transfer bus1 remains powered from side2.
r=withPatch({available:{...base().available,GEN1:false}});
assert.equal(r.documentedFailureCase,'GEN1_FAILED_FLIGHT_TRANSFER_NORMAL');
assert.equal(r.buses.generator1,'UNPOWERED');
assert.equal(r.buses.main1,'UNPOWERED');
assert.equal(r.buses.transfer1,'POWERED');
assert.equal(r.buses.transfer1Feed,'BUS2');
assert.equal(r.buses.dc1,'POWERED');
assert.equal(r.buses.acStandby,'POWERED');
assert.equal(r.galley,'SHED_SINGLE_GENERATOR');
assert.deepEqual(r.crossSystemEffects.map(x=>x.id).slice(0,3),
 ['FUEL.TANK1_FORWARD_PUMP','FUEL.CENTER_RIGHT_PUMP','HYD.SYSTEM_B_ELECTRIC_PUMP']);
assert.ok(r.crossSystemEffects.every(x=>x.source.pdfPage===1167));

// Power remains source-isolated, never silently parallel.
assert.equal(r.sourceAssignments.bus1,null);
assert.equal(r.sourceAssignments.bus2,'GEN2');

// GEN2 fail: transfer2 powered via bus1; TR3 loses its normal AC input.
r=withPatch({available:{...base().available,GEN2:false}});
assert.equal(r.documentedFailureCase,'GEN2_FAILED_FLIGHT_TRANSFER_NORMAL');
assert.equal(r.buses.main2,'UNPOWERED');
assert.equal(r.buses.transfer2Feed,'BUS1');
assert.equal(r.transformerRectifiers.TR3,'UNPOWERED');
assert.equal(r.buses.battery,'POWERED');
assert.ok(r.crossSystemEffects.some(x=>x.id==='HYD.SYSTEM_A_ELECTRIC_PUMP'));
assert.ok(r.crossSystemEffects.every(x=>x.source.pdfPage===1168));

// BUS TRANS OFF inhibits alternate power and DC parallel relay.
r=withPatch({busTransfer:'OFF',available:{...base().available,GEN1:false}});
assert.equal(r.buses.transfer1,'UNPOWERED');
assert.equal(r.buses.dcTie,'ISOLATED');
assert.equal(r.buses.dc1,'UNRESOLVED_TR3_BACKUP');
assert.equal(r.documentedFailureCase,null); // case tables assume normal transfers
assert.equal(r.crossSystemEffects.length,0);
assert.equal(r.buses.standbySource,'BATTERY_AUTO_AIR');

// ILS glide-slope capture isolates DC1 and DC2, not AC transfer buses.
r=withPatch({glideSlopeCaptured:true});
assert.equal(r.buses.dcTie,'ISOLATED');
assert.equal(r.buses.dc1,'POWERED');
assert.equal(r.buses.dc2,'POWERED');
assert.equal(r.buses.transfer1,'POWERED');

// With both normal AC sources lost in flight, usable battery feeds standby.
r=withPatch({available:{...base().available,GEN1:false,GEN2:false}});
assert.equal(r.buses.transfer1,'UNPOWERED');
assert.equal(r.buses.transfer2,'UNPOWERED');
assert.equal(r.buses.battery,'POWERED');
assert.equal(r.buses.hotBattery,'POWERED');
assert.equal(r.buses.acStandby,'POWERED');
assert.equal(r.buses.dcStandby,'POWERED');
assert.equal(r.buses.standbySource,'BATTERY_AUTO_AIR');
assert.equal(r.fireDetectionPower,'POWERED');
assert.equal(r.fireExtinguishingPower,'POWERED');
assert.equal(fire({selector:'NORMAL',power:r.fireDetectionPower,loops}).fireDetected,true);

// A depleted battery removes both battery bus and detector power in all-gen loss.
r=withPatch({batteryUsable:false,available:{...base().available,GEN1:false,GEN2:false}});
assert.equal(r.buses.hotBattery,'UNPOWERED');
assert.equal(r.buses.acStandby,'UNPOWERED');
assert.equal(r.buses.dcStandby,'UNPOWERED');
assert.equal(r.fireDetectionPower,'UNPOWERED');
assert.equal(fire({selector:'NORMAL',power:r.fireDetectionPower,loops}).fireDetected,null);

// Standby static inverter failure affects AC only, not DC standby.
r=withPatch({inverterOperable:false,available:{...base().available,GEN1:false,GEN2:false}});
assert.equal(r.buses.acStandby,'UNPOWERED');
assert.equal(r.buses.dcStandby,'POWERED');

// Ground AUTO inhibits emergency standby battery during total AC loss.
r=withPatch({phase:'GROUND',available:{...base().available,GEN1:false,GEN2:false}});
assert.equal(r.buses.acStandby,'UNPOWERED');
assert.equal(r.buses.dcStandby,'UNPOWERED');
assert.equal(r.buses.standbySource,'GROUND_AUTO_INHIBIT_ALL_AC_LOST');

// BAT manually bypasses ground inhibit, even if battery switch OFF.
r=withPatch({phase:'GROUND',batterySwitchOn:false,standbySwitch:'BAT',
 available:{...base().available,GEN1:false,GEN2:false}});
assert.equal(r.buses.acStandby,'POWERED');
assert.equal(r.buses.dcStandby,'POWERED');

// Standby switch OFF removes standby power even with normal generator AC.
r=withPatch({standbySwitch:'OFF'});
assert.equal(r.buses.acStandby,'UNPOWERED');
assert.equal(r.buses.dcStandby,'UNPOWERED');

// External ground power is battery-switch gated.
r=withPatch({phase:'GROUND',selected:{bus1:'EXT',bus2:'EXT'},
 available:{GEN1:false,GEN2:false,APU:false,EXT:true},groundPowerSwitchOn:true});
assert.equal(r.buses.generator1,'POWERED');
assert.equal(r.buses.generator2,'POWERED');
r=withPatch({phase:'GROUND',selected:{bus1:'EXT',bus2:'EXT'},
 available:{GEN1:false,GEN2:false,APU:false,EXT:true},
 batterySwitchOn:false,groundPowerSwitchOn:true});
assert.equal(r.buses.generator1,'UNPOWERED');
assert.equal(r.buses.generator2,'UNPOWERED');

// Ground-service-only mode must NOT energize both generator buses.
r=withPatch({phase:'GROUND',selected:{bus1:'NONE',bus2:'NONE'},
 available:{GEN1:false,GEN2:false,APU:false,EXT:true},
 groundServiceSwitchOn:true});
assert.equal(r.buses.groundService,'POWERED_EXTERNAL_GROUND_SERVICE_ONLY');
assert.equal(r.buses.generator1,'UNPOWERED');
assert.equal(r.buses.generator2,'UNPOWERED');

// APU on both sides permitted on ground, NOT in flight.
r=withPatch({phase:'GROUND',selected:{bus1:'APU',bus2:'APU'},
 available:{GEN1:false,GEN2:false,APU:true,EXT:false}});
assert.equal(r.buses.generator1,'POWERED');
assert.equal(r.buses.generator2,'POWERED');
assert.deepEqual(r.sourceAssignments,{bus1:'APU',bus2:'APU'});
assert.throws(()=>withPatch({selected:{bus1:'APU',bus2:'APU'},
 available:{GEN1:false,GEN2:false,APU:true,EXT:false}}),RangeError);

// In flight APU can back up exactly one gen side; two independent generators.
r=withPatch({selected:{bus1:'APU',bus2:'GEN2'},
 available:{GEN1:false,GEN2:true,APU:true,EXT:false}});
assert.equal(r.buses.generator1,'POWERED');
assert.equal(r.galley,'NOT_SHED_BY_SINGLE_GEN_RULE');
assert.equal(r.crossSystemEffects.length,0);

// Source quality and config validation.
assert.throws(()=>withPatch({selected:{bus1:'GEN2',bus2:'GEN1'}}),TypeError);
assert.throws(()=>withPatch({phase:'AIR',selected:{bus1:'EXT',bus2:'GEN2'}}),RangeError);
assert.throws(()=>withPatch({batteryUsable:'yes'}),TypeError);
assert.throws(()=>withPatch({busTransfer:'FAULT'}),TypeError);

// The DC1/DC2 tie remains powered with a single TR failure in normal mode.
r=withPatch({trOperable:{TR1:false,TR2:true,TR3:true}});
assert.equal(r.buses.dc1,'POWERED');
assert.equal(r.buses.dc2,'POWERED');

// No assumption about TR3 backup relay topology when both normal TRs fail.
r=withPatch({trOperable:{TR1:false,TR2:false,TR3:true}});
assert.equal(r.buses.dc1,'UNRESOLVED_TR3_BACKUP');
assert.equal(r.buses.dc2,'UNRESOLVED_TR3_BACKUP');

console.log('Electrical integration pilot: 20+ normal/fault/recovery/standby/cross-system assertions PASS');
