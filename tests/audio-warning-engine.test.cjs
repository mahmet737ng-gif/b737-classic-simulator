/* node tests/audio-warning-engine.test.cjs */
const assert = require("node:assert/strict");
const { WarningEngine } = require("../audio/warning-engine.js");
const baseline = Object.freeze({
  onGround: false, flaps: 5, gearDownLocked: true,
  pressureAltitudeFt: 8000, selectedAltitudeFt: 10000,
  radioAltitudeFt: 1300, cabinAltitudeFt: 5000,
  thrustLever1Angle: 45, thrustLever2Angle: 45,
  iasKt: 250, vmoKt: 340, mach: .65, mmo: .82,
  leadingEdgeTakeoff: true, speedbrakeDown: true,
  parkingBrakeSet: false, stabilizerTrimTakeoff: true
});
const run = (e, more) => e.update({ ...baseline, ...more });
const has = (out, id) => out.active.some(a => a.id === id);
const event = (out, id, message) => out.events.some(a => a.id === id && (!message || a.message === message));
let n = 0;
const test = (name, cb) => { cb(); console.log("✓ " + name); n++; };

test("900ft altitude acquisition", () => {
  const e = new WarningEngine({variant:"737-300"});
  run(e, {pressureAltitudeFt: 8000});
  assert.ok(event(run(e, {pressureAltitudeFt: 9150}), "altitude", "ALTITUDE ACQUISITION"));
});
test("no duplicate altitude acquisition", () => {
  const e = new WarningEngine();
  run(e, {pressureAltitudeFt: 8000});
  run(e, {pressureAltitudeFt: 9150});
  assert.equal(event(run(e, {pressureAltitudeFt: 9200}), "altitude"), false);
});
test("altitude deviation after 300ft acquisition", () => {
  const e = new WarningEngine();
  run(e, {pressureAltitudeFt: 9760});
  assert.ok(event(run(e, {pressureAltitudeFt: 9600}), "altitude", "ALTITUDE DEVIATION"));
});
test("altitude alert inhibited with flaps 25", () => {
  const e = new WarningEngine();
  run(e, {pressureAltitudeFt: 8000});
  const v=run(e, {pressureAltitudeFt: 9150, flaps: 25});
  assert.equal(event(v, "altitude"), false);
});
test("cabin horn triggers above 10,000 ft", () => {
  const e = new WarningEngine();
  const v=run(e, {cabinAltitudeFt: 10001});
  assert.ok(v.lamps.cabinAltitude && has(v,"intermittentHorn"));
});
test("cabin cutout leaves cabin lamp illuminated", () => {
  const e = new WarningEngine();
  run(e, {cabinAltitudeFt: 12000}); e.cutoutCabin();
  const v=run(e, {cabinAltitudeFt:12000});
  assert.ok(v.lamps.cabinAltitude && !has(v, "intermittentHorn"));
});
test("cabin cutout resets on depressurization recovery", () => {
  const e = new WarningEngine();
  run(e, {cabinAltitudeFt:12000}); e.cutoutCabin(); run(e, {cabinAltitudeFt:9000});
  assert.ok(has(run(e,{cabinAltitudeFt:12000}),"intermittentHorn"));
});
test("shared cabin/takeoff horn only emits one instance", () => {
  const e = new WarningEngine({variant:"737-300"});
  const v=run(e,{onGround:true,takeoffThrust:true,flaps:0,cabinAltitudeFt:12000});
  assert.equal(v.active.filter(a=>a.id==="intermittentHorn").length,1);
  assert.ok(v.lamps.cabinAltitude && v.lamps.takeoffConfig);
});
test("737-300 permitted flap 1 for takeoff", () => {
  const e = new WarningEngine({variant:"737-300"});
  assert.equal(run(e,{onGround:true,takeoffThrust:true,flaps:1}).lamps.takeoffConfig,false);
});
test("737-500 minimum takeoff flap 5", () => {
  const e = new WarningEngine({variant:"737-500"});
  assert.equal(run(e,{onGround:true,takeoffThrust:true,flaps:1}).lamps.takeoffConfig,true);
});
test("737-400 takeoff config remains unverified", () => {
  const e = new WarningEngine({variant:"737-400"});
  assert.equal(run(e,{onGround:true,takeoffThrust:true,flaps:0}).status.takeoffConfigEvaluated,false);
});
test("landing gear horn with flaps >15 cannot cut out", () => {
  const e = new WarningEngine();
  assert.ok(has(run(e,{flaps:30,gearDownLocked:false}),"gearHorn"));
  e.cutoutGear();
  assert.ok(has(run(e,{flaps:30,gearDownLocked:false}),"gearHorn"));
});
test("landing gear cutout at flaps 5, idle", () => {
  const e = new WarningEngine();
  run(e,{flaps:5,gearDownLocked:false,thrustLever1Angle:5});
  e.cutoutGear();
  assert.equal(has(run(e,{flaps:5,gearDownLocked:false,thrustLever1Angle:5}),"gearHorn"),false);
});
test("no landing gear horn with down locked", () => {
  const e = new WarningEngine();
  assert.equal(has(run(e,{flaps:30,gearDownLocked:true}),"gearHorn"),false);
});
test("overspeed warning when IAS > input VMO", () => {
  const e = new WarningEngine();
  assert.ok(has(run(e,{iasKt:345}),"overspeed"));
});
test("stall shaker inhibited on ground", () => {
  const e = new WarningEngine();
  assert.equal(has(run(e,{stallWarning:true,onGround:true}),"shaker"),false);
  assert.ok(has(run(e,{stallWarning:true,onGround:false}),"shaker"));
});
test("fire warning and fire warning cutout", () => {
  const e = new WarningEngine();
  assert.ok(has(run(e,{engine1Fire:true}),"fireBell"));
  e.acknowledgeFire();
  const v=run(e,{engine1Fire:true});
  assert.equal(v.lamps.fireWarn,false);
  assert.equal(has(v,"fireBell"),false);
});
test("new simultaneous fire warning re-arms bell", () => {
  const e = new WarningEngine();
  run(e,{engine1Fire:true});e.acknowledgeFire();
  run(e,{engine1Fire:true});
  assert.ok(has(run(e,{engine1Fire:true,apuFire:true}),"fireBell"));
});
test("radio altitude callout on downward 500 crossing", () => {
  const e = new WarningEngine();
  run(e,{radioAltitudeFt:600,approachActive:true});
  assert.ok(event(run(e,{radioAltitudeFt:495,approachActive:true}),"radioAltitude","500"));
});
test("GPWS phrase originates from discrete source", () => {
  const e = new WarningEngine();
  assert.ok(event(run(e,{egpwsMessage:"PULL UP"}),"gpws","PULL UP"));
  assert.equal(event(run(e,{egpwsMessage:"PULL UP"}),"gpws"),false);
});
console.log(n + " audio-engine assertions passed");
