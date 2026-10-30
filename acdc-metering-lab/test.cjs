"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root,"photo-geometry.v1.json"),"utf8"));
const html = fs.readFileSync(path.join(root,"photo-stage.html"),"utf8");
const code = fs.readFileSync(path.join(root,"photo-stage.js"),"utf8");
const imagePath = path.resolve(root,manifest.source.path);
const names = ["dcAmps","cpsFreq","dcVolts","acVolts","dcSelector","acSelector","battery","galley","residual"];
test("locked user-source image resolves to exact native PNG with immutable SHA256",()=>{
 assert.equal(manifest.source.nativeWidth,1095);
 assert.equal(manifest.source.nativeHeight,1436);
 assert.equal(manifest.source.immutable,true);
 assert.ok(fs.existsSync(imagePath),"source artwork must remain present");
 const b=fs.readFileSync(imagePath);
 assert.equal(b.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(b.readUInt32BE(16),1095);
 assert.equal(b.readUInt32BE(20),1436);
 assert.equal(crypto.createHash("sha256").update(b).digest("hex"),manifest.source.sha256);
});
test("all nine controls have finite native-image coordinates, safe radii and no approvals",()=>{
 assert.deepEqual(Object.keys(manifest.markers).sort(),names.slice().sort());
 for(const [name,p] of Object.entries(manifest.markers)){
  assert.equal(p.confidence,["dcAmps","cpsFreq","dcVolts","acVolts"].includes(name)?"SCREEN_RED_CIRCLE_PROJECTED_NATIVE_ELLIPSE_PROVISIONAL":"PROVISIONAL",name);
  if(p.type==="meter")assert.ok(Number.isFinite(p.rY)&&p.rY>4,"native Y radius required: "+name);
  assert.ok(p.x>=0&&p.x<=1095&&p.y>=0&&p.y<=1436,name);
  assert.ok(p.r>=5&&p.r<300,name);
  assert.equal(p.type,["dcAmps","cpsFreq","dcVolts","acVolts"].includes(name)?"meter":name.endsWith("Selector")?"rotary":name==="residual"?"momentary":"toggle");
 }
 assert.equal(manifest.verification.ownerApproved,false);
 assert.equal(manifest.verification.photoPixelAuditPassed,false);
 assert.equal(manifest.verification.unifiedMountAllowed,false);
 assert.ok(manifest.verification.acceptanceCenterMaxErrorPx<=0.5);
});
test("photo overlay preserves protected source and uses a temporary derived bitmap to remove baked pointer wedges",()=>{
 assert.match(html,/<image id="reference"[\s\S]*?href="\.\.\/panel-mosaic-lab\/assets\/locked\/2026-10-23\/OH10-ELEC-LOSSLESS-9a1ca4d6cfb2\.png"/);
 assert.match(html,/viewBox="0 0 1095 1436"/);
 assert.match(html,/<g id="artwork"><\/g><g id="calibration"><\/g>/);
 assert.match(html,/photo-stage\.js/);
 assert.match(html,/ac-dc-metering-model\.js/);
 assert.match(code,/ac-dc-metering-needle\.svg/);
 assert.match(html,/ac-dc-static-needle-cleaner\.js/);
 assert.match(code,/cleaner\.ensureDerivedUrl/);
 assert.match(code,/angleForIndication/);
 assert.match(code,/angleForAcVolts/);
 assert.match(code,/setPointerCapture\(ev\.pointerId\)/);
 assert.match(code,/\$\("board"\)\.addEventListener\("pointermove"/);
 assert.match(code,/unifiedMountAllowed:false/);
 assert.doesNotMatch(code,/\bfetch\([^)]*,\s*\{\s*method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)/i);
});
test("photo-real mode NEVER synthesizes fake gauge faces, numbers, bezels or metallic switch hardware",()=>{
 assert.doesNotMatch(html,/id="face"/);
 assert.doesNotMatch(html,/<(?:linearGradient|radialGradient|text)\b/);
 assert.match(html,/<input id="overlay" type="checkbox" checked>/);
 assert.match(html,/<input id="markers" type="checkbox">/);
 assert.match(code,/overlay:true,showMarkers:false/);
 for(const forbidden of ["function dialScale(","function rotary(","function toggle(","function residual(","function polar(","state.faces","state.showMarkers=true","fill:\"url(#silver)\""]){
  assert.ok(!code.includes(forbidden),"Artificial drawing/automatic guides disallowed: "+forbidden);
 }
 assert.match(code,/function photoHotspot\(id\)/);
 assert.match(code,/if\(!state.calibration\|\|!state.showMarkers\)return;/);
 assert.ok(code.includes('fill:"transparent",stroke:"none"'));
 assert.match(code,/ac-dc-metering-needle\.svg/);
 assert.match(html,/OH10-PHOTO-STAGE-CLEAN-0009/);
});
test("only electrical V7 state adapter is invoked, and no cockpit or locked geometry is altered",()=>{
 assert.match(html,/engine\/systems\/electrical-v7\.js/);
 assert.match(code,/window\.B737ElectricalV7/);
 assert.doesNotMatch(code,/\.github\/|createCommit|updateFile|push\(.*commit/);
 assert.doesNotMatch(code,/localStorage\.setItem\([^,]+,\s*[^)]*locked/i);
});
