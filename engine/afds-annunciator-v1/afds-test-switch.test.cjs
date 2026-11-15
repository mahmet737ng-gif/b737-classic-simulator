"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {test}=require("node:test");
const core=require("./afds-test-switch-core.js");
const root=path.resolve(__dirname,"../..");
test("Classic momentary switch has three detents and neutral reset",()=>{
 assert.deepEqual(core.DETENTS,["TEST_1","NEUTRAL","TEST_2"]);
 const s=core.initial();
 assert.equal(s.detent,"NEUTRAL");
 assert.deepEqual(core.lamps(s),{AP:"OFF",AT:"OFF",FMC:"OFF"});
 const one=core.reduce(s,{type:"PRESS_TEST",detent:"TEST_1"});
 assert.deepEqual(core.lamps(one),{AP:"STEADY_AMBER",AT:"STEADY_AMBER",FMC:"STEADY_AMBER"});
 const released=core.reduce(one,{type:"RELEASE_TEST"});
 assert.equal(released.detent,"NEUTRAL");
 const two=core.reduce(released,{type:"PRESS_TEST",detent:"TEST_2"});
 assert.deepEqual(core.lamps(two),{AP:"STEADY_RED",AT:"STEADY_RED",FMC:"STEADY_AMBER"});
 assert.deepEqual(core.lamps(core.reduce(two,{type:"CANCEL_TEST"})),core.lamps(s));
});
test("Test override does not clear or invent live system alerts",()=>{
 const current=core.reduce(core.initial(),{type:"SET_ALERT",id:"AP",status:"FLASH_RED"});
 const forced=core.reduce(current,{type:"PRESS_TEST",detent:"TEST_1"});
 assert.equal(core.lamps(forced).AP,"STEADY_AMBER");
 const restored=core.reduce(forced,{type:"RELEASE_TEST"});
 assert.equal(core.lamps(restored).AP,"FLASH_RED");
 assert.equal(core.reduce(restored,{type:"ACKNOWLEDGE",id:"AP"}).alerts.AP,"OFF");
 assert.equal(core.reduce(restored,{type:"SET_ALERT",id:"FMC",status:"STEADY_RED"}),restored);
 assert.equal(core.reduce(restored,{type:"PRESS_TEST",detent:"INVALID"}),restored);
});
test("Owner-selected Small Silver atlas is the only runtime sprite",()=>{
 const reg=JSON.parse(fs.readFileSync(path.resolve(__dirname,"classic-737-annunciator-source-register.json"),"utf8"));
 const v=reg.physical.testSwitch.visualSource;
 assert.equal(v.activeAtlas,"shared-assets/toggle-switch-small/Small_Silver_5Positions.webp");
 assert.equal(v.selection,"OWNER_EXPLICIT_SMALL_SILVER_2026-11-15");
 assert.deepEqual(v.activeAtlasPoseCellIndices,{TEST_1:3,NEUTRAL:1,TEST_2:4});
 assert.ok(fs.existsSync(path.resolve(root,v.activeAtlas)));
 const man=JSON.parse(fs.readFileSync(path.resolve(root,v.activeManifest),"utf8"));
 assert.equal(man.family,"Small");
 assert.equal(man.atlas.width,5120);
 assert.equal(man.atlas.cellWidth,1024);
 assert.equal(man.variants.find(x=>x.name==="Small Silver").asset,"Small_Silver_5Positions.webp");
 // No changes to the previous default asset family.
 assert.equal(JSON.parse(fs.readFileSync(path.resolve(root,"panel-mosaic-lab/assets/locked/2026-10-23/Switches/Toggle/toggle-standard.json"),"utf8")).status,"locked");
});
test("Unified has two independent three-position switches using photo bounding boxes",()=>{
 const vm=require("node:vm");
 const js=fs.readFileSync(path.resolve(root,"panel-mosaic-lab/cockpit/afds-annunciator-switch-v1.js"),"utf8");
 const css=fs.readFileSync(path.resolve(root,"panel-mosaic-lab/cockpit/afds-annunciator-switch-v1.css"),"utf8");
 const html=fs.readFileSync(path.resolve(root,"panel-mosaic-lab/cockpit/index.html"),"utf8");
 assert.match(html,/afds-annunciator-switch-v1\.js\?v=AFDS-ANN-UNIFIED-0003-FO-SOCKET-CENTER/);
 assert.match(html,/afds-annunciator-switch-v1\.css\?v=AFDS-ANN-UNIFIED-0002/);
 assert.match(js,/Small_Silver_5Positions\.webp/);
 assert.match(js,/backgroundPosition=POSE/);
 assert.match(js,/pointercancel/);
 assert.match(js,/lostpointercapture/);
 assert.match(js,/ArrowUp/);
 assert.match(js,/ArrowDown/);
 assert.match(css,/background-size:500% 100%/);
 assert.match(css,/background:transparent!important/);
 assert.doesNotMatch(css,/radial-gradient/);
 assert.doesNotMatch(js,/b737-toggle-(?:off|center|on)\.webp/);
 const listeners={};const win={B737AFDSAnnunciatorCoreV1:core,
  addEventListener:(id,fn)=>listeners[id]=fn,
  dispatchEvent:()=>{},
  document:{readyState:"loading",addEventListener:()=>{}}
 };
 vm.runInNewContext(js,{window:win,CustomEvent:class{constructor(x,o){this.type=x;this.detail=o.detail}}});
 const api=win.B737AFDSAnnunciatorUnifiedV1;
 assert.equal(api.VERSION,"AFDS-ANN-UNIFIED-0002");
 assert.deepEqual(Object.keys(api.INSTALL).sort(),["CAPT","FO"]);
 assert.equal(api.INSTALL.CAPT.toggle.cx,683.2,"Captain x must remain approved");
 assert.equal(api.INSTALL.CAPT.toggle.cy,212.9,"Captain y must remain approved");
 assert.equal(api.INSTALL.FO.toggle.cx,1532.4,"FO x must match corrected photo socket");
 assert.equal(api.INSTALL.FO.toggle.cy,226.5,"FO y must match corrected photo socket");
 assert.equal(api.INSTALL.FO.toggle.cell,44,"FO artwork size must not change");
 assert.equal(api.INSTALL.FO.toggle.hit,20.8,"FO hitbox size must not change");
 for(const seat of ["CAPT","FO"]){
  const cfg=api.INSTALL[seat];
  assert.deepEqual(Array.from(cfg.lamps,x=>x.id),["AP","AT","FMC"]);
  const left=seat==="CAPT"?35:1222,right=seat==="CAPT"?761:1594;
  for(const lamp of cfg.lamps){
   assert.ok(lamp.x>=left && lamp.x+lamp.w<right);
   assert.ok(lamp.y>=0&&lamp.y+lamp.h<920);
   assert.ok(lamp.w>20&&lamp.w<25);
  }
  assert.ok(cfg.toggle.cx>left&&cfg.toggle.cx<right);
 }
 api.press("TEST_1","CAPT");
 assert.equal(api.getState("CAPT").lamps.AP,"STEADY_AMBER");
 assert.equal(api.getState("FO").lamps.AP,"OFF");
 api.press("TEST_2","FO");
 assert.equal(api.getState("FO").lamps.AP,"STEADY_RED");
 assert.equal(api.getState("FO").lamps.FMC,"STEADY_AMBER");
 api.release("CAPT");api.release("FO");
 assert.equal(api.getState("CAPT").detent,"NEUTRAL");
 assert.equal(api.getState("FO").detent,"NEUTRAL");
 api.setAlert("AT","FLASH_RED");
 assert.equal(api.getState("CAPT").lamps.AT,"FLASH_RED");
 assert.equal(api.getState("FO").lamps.AT,"FLASH_RED");
 api.acknowledge("AT");
 assert.equal(api.getState("FO").lamps.AT,"OFF");
});
