"use strict";
const assert = require("node:assert/strict");
const db = require("../engine/instruments/engine-indication-technical-db-v1.json");
const core = require("../engine/instruments/engine-indication-backend-v1.js");
const adapter = require("../engine/integration/engine-indication-live-adapter-v1.js");
const E = require("../engine/systems/electrical-v7.js");
assert.equal(core.validate(db), true);
assert.equal(Object.keys(db.instruments).length, 8);

const examples = {
 n1:[36,"%"], n2:[62,"%"], egt:[490,"°C"], fuelFlow:[2100,"kg/h"],
 oilPressure:[56,"psi"], oilTemperature:[85,"°C"],
 oilQuantity:[80,"%FULL"], vibration:[1.4,"units"]
};
const observed={engine1:{},engine2:{}};
for(const s of [1,2])for(const [p,[value,unit]] of Object.entries(examples))
 observed["engine"+s][p]={valid:true,value,unit,origin:"TEST"};

const buses={battery:true,dcStandby:true,dc1:true,dc2:true,transfer1:true,transfer2:true};
const normal=core.calculate(db,{mode:"CONVENTIONAL",observed,electrical:buses});
assert.equal(normal.engines.engine1.indications.n2.status,"VALID");
assert.equal(normal.engines.engine1.indications.oilQuantity.value,4.0);
const dc1=core.calculate(db,{mode:"CONVENTIONAL",observed,electrical:{...buses,dc1:false},previous:normal});
assert.equal(dc1.engines.engine1.indications.n2.status,"POWER_LOSS");
assert.equal(dc1.engines.engine1.indications.fuelFlow.status,"POWER_LOSS");
assert.equal(dc1.engines.engine2.indications.n2.status,"VALID");
const eis=core.calculate(db,{mode:"EIS",observed,electrical:{...buses,dc1:false}});
assert.equal(eis.engines.engine1.indications.n2.status,"VALID");
assert.equal(eis.engines.engine1.indications.fuelFlow.status,"VALID");

const conventionalOil=core.calculate(db,{
 mode:"CONVENTIONAL",electrical:{...buses,transfer1:false},observed,previous:normal
});
assert.equal(conventionalOil.engines.engine1.indications.oilPressure.pointer,"HOLD_LAST");
assert.equal(conventionalOil.engines.engine1.indications.oilPressure.value,56);
const secondary=core.calculate(db,{mode:"EIS",electrical:{...buses,transfer1:false},observed});
assert.equal(secondary.engines.engine1.indications.oilPressure.status,"POWER_EFFECT_UNVERIFIED");
assert.equal(secondary.engines.engine2.indications.oilPressure.status,"VALID");

const invalid=structuredClone(observed);
invalid.engine1.egt={valid:false,reason:"THERMOCOUPLE_OPEN"};
const t1=core.calculate(db,{mode:"EIS",electrical:buses,observed:invalid,dtMs:500});
assert.equal(t1.engines.engine1.indications.egt.status,"SENSOR_FAILURE_TRANSIENT");
const t2=core.calculate(db,{mode:"EIS",electrical:buses,observed:invalid,previous:t1,dtMs:1500});
assert.equal(t2.engines.engine1.indications.egt.status,"SENSOR_FAILED");
assert.equal(t2.engines.engine1.indications.egt.digital,"DASHES");
const unit=core.calculate(db,{mode:"EIS",electrical:buses,observed,faults:{eisPrimary:true}});
assert.equal(unit.engines.engine1.indications.n1.status,"UNIT_FAILED");
assert.equal(unit.engines.engine1.indications.oilPressure.status,"VALID");

const exceed=core.calculate(db,{mode:"EIS",electrical:buses,observed,
 limits:{n1:{1:{valid:true,value:35,origin:"TEST_APPROVED_LIMIT"}}}});
assert.equal(exceed.engines.engine1.warnings.n1Overlimit.state,"ON");
assert.equal(exceed.engines.engine2.warnings.n1Overlimit.state,"UNKNOWN");
const missing=core.calculate(db,{mode:"EIS",electrical:buses});
assert.equal(missing.engines.engine1.indications.n1.status,"NO_SENSOR_DATA");
assert.equal(missing.engines.engine1.warnings.lowOilPressure.state,"UNKNOWN");
const f=core.calculate(db,{mode:"CONVENTIONAL",electrical:buses,observed,dtMs:1000});
assert.equal(f.fuelUsedKg.engine1,0.58333);
assert.equal(core.calculate(db,{mode:"CONVENTIONAL",electrical:buses,observed,
 previous:f,dtMs:1000,resetFuelUsed:true}).fuelUsedKg.engine1,0);
assert.equal(core.calculate(db,{mode:"EIS",electrical:buses,observed}).bite.primaryEligible,false);

const electricalState=E.initialState({coldDark:true});
const ecu={
 start:{core:{pack:{electricalState}}},
 get(){return {quality:"TRAINING_SIMULATION_ONLY",timeMs:0,engines:{
  engine1:{n1Percent:0,n2Percent:0,egtC:20,fuelFlowKgHr:0,
    oil:{pressurePsi:0,temperatureC:20,quantityPct:85}}
 }}}
};
const linked=adapter.create({database:db,indications:core,electrical:E,ecu});
assert.equal(linked.calculate().indications.engines.engine1.indications.n1.powerBus,"battery");
linked.setMode("CONVENTIONAL");
assert.equal(linked.calculate().indications.mode,"CONVENTIONAL");
console.log("PASS: Classic engine indications DB/ECU/EL V7/Conventional/EIS/Fail states");
