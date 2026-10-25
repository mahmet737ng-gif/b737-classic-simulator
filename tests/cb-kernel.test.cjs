"use strict";
/* Node test suite: CB electrical guardrails, no aircraft wiring inferred. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {test}=require("node:test");
const {BreakerNetwork,keyFor}=require("../engine/cb/cb-kernel.js");
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../cb-panel-lab/catalog.js"),"utf8"),scope);
const catalog=scope.window.CB_CATALOG;
function make(){return new BreakerNetwork(catalog);}
const k=keyFor("P6-5","A1");
test("catalog contains 11 panels, unique IDs and candidate ratings",()=>{
const n=make();assert.equal(n.report().panels,11);
assert(n.report().breakers>400);
assert.equal(new Set(n.inventory.map(x=>x.id)).size,n.inventory.length);
assert(n.inventory.every(x=>x.rating>0&&x.label));
});
test("untraced route stays UNKNOWN and bogus wiring is refused",()=>{
const n=make();assert.equal(n.consumer("B737_INVERTER").status,"UNKNOWN");
assert.equal(n.addRoute({breaker:k,bus:"DC",consumer:"B737_INVERTER"}).reason,"UNVERIFIED_ROUTE_REJECTED");
assert.equal(n.addRoute({breaker:k,bus:"DC",consumer:"B737_INVERTER",mode:"VERIFIED"}).reason,"PROVENANCE_REQUIRED");
assert.equal(n.consumer("B737_INVERTER").status,"UNKNOWN");
});
test("only manually linked SANDBOX indicator obeys pull/push",()=>{
const n=make();
assert(n.addRoute({breaker:k,bus:"SANDBOX_28V",consumer:"SYNTHETIC_LAMP",mode:"SANDBOX"}).ok);
assert(n.setBus("SANDBOX_28V",true,"SANDBOX").ok);
assert.equal(n.consumer("SYNTHETIC_LAMP","SANDBOX").status,"POWERED");
assert(n.action(k,"PULL").ok);
assert.equal(n.consumer("SYNTHETIC_LAMP","SANDBOX").status,"UNPOWERED");
assert(n.action(k,"PUSH").ok);
assert.equal(n.consumer("SYNTHETIC_LAMP","SANDBOX").status,"POWERED");
assert.equal(n.consumer("SYNTHETIC_LAMP","VERIFIED").status,"UNKNOWN");
});
test("manual instructor trip latches until fault cleared",()=>{
const n=make();assert(n.action(k,"INJECT_TRIP","sandbox failure").ok);
assert(n.state(k).pulled);assert(n.state(k).tripped);
assert.equal(n.action(k,"PUSH").reason,"FAULT_ACTIVE");
assert(n.action(k,"CLEAR_FAULT").ok);
assert(n.state(k).pulled);
assert(n.action(k,"PUSH").ok);
assert(!n.state(k).tripped);assert(!n.state(k).pulled);
});
test("CPCS and DCPCS are mutually exclusive but retain independent states",()=>{
const n=make();
assert(n.action("P6-4|CPCS|F1","PULL").ok);
assert(n.setVariant("DCPCS").ok);
assert.equal(n.action("P6-4|CPCS|F1","PUSH").reason,"INACTIVE_VARIANT");
assert(n.action("P6-4|DCPCS|F1","PULL").ok);
assert(n.setVariant("CPCS").ok);
assert(n.state("P6-4|CPCS|F1").pulled);
assert(n.setVariant("DCPCS").ok);
assert(n.state("P6-4|DCPCS|F1").pulled);
});
test("snapshot is versioned, validated and deterministic",()=>{
const n=make();n.setVariant("DCPCS");n.action("P6-4|DCPCS|F1","PULL");
const s=n.snapshot(),n2=make();
assert(n2.restore(s).ok);
assert.equal(n2.snapshot().variant,"DCPCS");
assert.equal(n2.state("P6-4|DCPCS|F1").pulled,true);
assert.equal(n2.restore({...s,schema:500}).reason,"BAD_SNAPSHOT");
assert.equal(n2.state("P6-4|DCPCS|F1").pulled,true);
});
test("verified route requires manual, page and effectivity and external power source",()=>{
const n=make(),r={breaker:k,bus:"TRACED_BUS",consumer:"TRACED_ITEM",mode:"VERIFIED",provenance:{manual:"TEST_FIXTURE_NOT_FCOM",page:"TEST-1",effectivity:"SYNTHETIC"}};
assert(n.addRoute(r).ok);
assert.equal(n.consumer("TRACED_ITEM").status,"UNKNOWN");
n.setBus("TRACED_BUS",true,"SANDBOX");
assert.equal(n.consumer("TRACED_ITEM").status,"UNKNOWN");
n.setBus("TRACED_BUS",true,"EXTERNAL_AUTHORITY");
assert.equal(n.consumer("TRACED_ITEM").status,"POWERED");
n.action(k,"PULL");
assert.equal(n.consumer("TRACED_ITEM").status,"UNPOWERED");
});
test("reset does not invent electrical connections",()=>{
const n=make();n.action(k,"PULL");n.reset();
assert.equal(n.report().pulled,0);
assert.equal(n.consumer("ANY_AIRCRAFT_LOAD").status,"UNKNOWN");
});
