"use strict";
const assert=require("node:assert/strict");
const {keyFor,suggestKey,validAudioFile}=require("../audio-lab/real-audio-bank.js");
const tests=[
  ["altitude","Altitude Alert","Momentary tone","ALTITUDE ACQUISITION"],
  ["intermittentHorn","Takeoff Config","Intermittent horn",null],
  ["intermittentHorn","Cabin Altitude","Same horn",null],
  ["gearHorn","Landing Gear","Steady horn",null],
  ["fireBell","Fire Warning","Bell",null],
  ["overspeed","Mach/Airspeed","Clacker",null],
  ["shaker","Stall","Shaker",null],
  ["apDisconnect","Autopilot Disconnect","Tone",null],
  ["atDisconnect","Autothrottle Disconnect","Tone",null],
  ["gpws","EGPWS · PULL UP","Voice","PULL UP"],
  ["gpws","EGPWS · SINK RATE","Voice","SINK RATE"],
  ["gpws","EGPWS · WINDSHEAR","Voice","WINDSHEAR"],
  ["tcas","TCAS · TRAFFIC","Voice","TRAFFIC TRAFFIC"]
];
assert.equal(keyFor("intermittentHorn",null),"intermittentHorn");
assert.equal(keyFor("gpws","pull up"),"gpws|PULL UP");
assert.equal(keyFor("radioAltitude","500"),"radioAltitude|500");
assert.equal(suggestKey("fire bell.wav",tests),"fireBell");
assert.equal(suggestKey("stall_warning.wav",tests),"shaker");
assert.equal(suggestKey("takeoff_config.wav",tests),"intermittentHorn");
assert.equal(suggestKey("overspeed-clacker.mp3",tests),"overspeed");
assert.equal(suggestKey("autopilot_disconnect.wav",tests),"apDisconnect");
assert.equal(suggestKey("silent.wav",tests),null);
assert.equal(validAudioFile({name:"fire-bell.wav",size:1234}),true);
assert.equal(validAudioFile({name:"fire-bell.mp4",size:1234}),false);
assert.equal(validAudioFile({name:"fire-bell.wav",size:0}),false);
assert.equal(validAudioFile({name:"fire-bell.wav",size:41*1024*1024}),false);
console.log("13 real-audio import registry tests passed");
