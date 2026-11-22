"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {keyFor,validAudioFile}=require("../audio-lab/real-audio-bank.js");

assert.equal(keyFor("intermittentHorn",null),"intermittentHorn");
assert.equal(keyFor("gpws","pull up"),"gpws|PULL UP");
assert.equal(keyFor("radioAltitude","500"),"radioAltitude|500");
assert.equal(keyFor("altitude","ALTITUDE ACQUISITION"),"altitude|ALTITUDE ACQUISITION");
assert.equal(keyFor("altitude","ALTITUDE DEVIATION"),"altitude|ALTITUDE DEVIATION");
assert.equal(validAudioFile({name:"fire-bell.wav",size:1234}),true);
assert.equal(validAudioFile({name:"fire-bell.mp4",size:1234}),false);
assert.equal(validAudioFile({name:"fire-bell.wav",size:0}),false);
assert.equal(validAudioFile({name:"fire-bell.wav",size:41*1024*1024}),false);

const lab=fs.readFileSync(require.resolve("../audio-lab/lab.js"),"utf8");
const bank=fs.readFileSync(require.resolve("../audio-lab/real-audio-bank.js"),"utf8");
for(const forbidden of ["createOscillator(","createBufferSource(","SpeechSynthesisUtterance","speechSynthesis.speak","suggestKey("]) {
  assert.equal(lab.includes(forbidden),false,"generated audio / auto mapping remains in lab: "+forbidden);
}
assert.equal(bank.includes("suggestKey("),false,"filename-based audio assignment must remain disabled");
assert.ok(bank.includes("b737cl-real-audio-bank-v2-owner-map"),"new clean browser audio bank must be used");
assert.ok(lab.includes("NO SOUND ASSIGNED"),"unassigned warnings must remain silent");
console.log("Manual audio assignment and silent-default tests passed");
