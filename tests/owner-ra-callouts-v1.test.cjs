"use strict";
const assert=require("node:assert/strict");
const {TIMELINE,keyFor,Player,URL_PATH}=require("../audio-lab/owner-ra-callouts-v1.js");
const expected=[
"radioAltitude|ONE THOUSAND","radioAltitude|500",
"minimums|APPROACHING MINIMUMS","minimums|MINIMUMS",
"radioAltitude|100","radioAltitude|50","radioAltitude|40",
"radioAltitude|30","radioAltitude|20","radioAltitude|10"
];
for(const key of expected)assert.ok(TIMELINE[key],key+" missing");
assert.equal(Object.keys(TIMELINE).length,11); // 10 individual voices + one collection preview
assert.equal(TIMELINE["radioAltitude|2500"],undefined);
assert.equal(TIMELINE["radioAltitude|COLLECTION"][1],10.5);
for(const key of expected){
 const [start,end]=TIMELINE[key];
 assert.ok(start>=0&&end>start&&end<10.6,"invalid segment "+key);
}
assert.equal(keyFor("minimums","approaching minimums"),"minimums|APPROACHING MINIMUMS");
const player=new Player("./assets/owner-ra-callouts-v1.ogg",()=>({
 pause(){},addEventListener(){},removeEventListener(){},preload:"",readyState:1,
 set currentTime(v){this._t=v;},get currentTime(){return this._t||0;},
 set volume(v){this._v=v;},get volume(){return this._v||0;},
 play(){return Promise.resolve();},load(){}
}));
assert.equal(player.has("minimums|MINIMUMS"),true);
assert.equal(player.has("radioAltitude|2500"),false);
assert.equal(player.has("gpws|PULL UP"),false);
player.stop();
assert.ok(URL_PATH.endsWith(".mp3"));
console.log("Owner RA sample map validated: 10 speech callouts; no trailing beep or 2500 assignment");