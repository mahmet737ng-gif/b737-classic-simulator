/* Photo-MCP phase2 hardware contract checks. No cockpit assets are modified. */
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),vm=require("node:vm");
const root=__dirname;
const js=fs.readFileSync(path.join(root,"mcp-hardware-v1.js"),"utf8");
const css=fs.readFileSync(path.join(root,"mcp-hardware-v1.css"),"utf8");
const visual=fs.readFileSync(path.join(root,"mcp-visual-v3.js"),"utf8");
const unified=fs.readFileSync(path.join(root,"index.html"),"utf8");
const standalone=fs.readFileSync(path.join(root,"../mcp-panel/index.html"),"utf8");
for(const page of [unified,standalone]){
 assert.match(page,/mcp-hardware-v1\.js\?v=MCP-SPRITE-0002/);
 assert.match(page,/mcp-hardware-v1\.css\?v=MCP-0005-HARDWARE/);
 assert.match(page,/mcp-visual-v3\.js\?v=MCP-0005-PIXEL-QA/);
}
new vm.Script(js,{filename:"mcp-hardware-v1.js"});
new vm.Script(visual,{filename:"mcp-visual-v3.js"});
const contents=js.match(/const controls=Object\.freeze\(\[([\s\S]*?)\]\);/);
assert.ok(contents,"hardware geometry definition");
const controls=vm.runInNewContext("["+contents[1]+"]");
assert.equal(controls.length,7);
assert.deepEqual(Array.from(controls.map(c=>c.id)),["AT_ARM","FD_LEFT","FD_RIGHT","VS_WHEEL","CO","SPD_INTV","ALT_INTV"]);
for(const c of controls){
 assert.ok(["toggle","wheel","push"].includes(c.kind));
 assert.ok(c.x-c.w/2>=0&&c.y-c.h/2>=0&&c.x+c.w/2<=2172&&c.y+c.h/2<=433,c.id+" outside photo");
 assert.ok(c.w>0&&c.h>0);
}
assert.equal(controls.filter(c=>c.kind==="toggle").length,3);
assert.equal(controls.filter(c=>c.kind==="push").length,3);
assert.equal(controls.filter(c=>c.kind==="wheel").length,1);
assert.match(js,/window\.B737McpVisualV3\?\.setValue\("verticalSpeed",value\)/);
assert.match(js,/b737:mcp-hardware-change/);
assert.match(js,/pointermove/);
assert.match(js,/setPointerCapture/);
assert.match(js,/role",c\.kind==="wheel"\?"slider":"button"/);
const reference=fs.readFileSync(path.join(root,"mcp-toggle-reference-v2.css"),"utf8");
for(const page of [unified,standalone])assert.match(page,/mcp-toggle-reference-v2\.css\?v=MCP-0006-SMALL-SILVER/);
const toggles=Object.fromEntries(controls.filter(c=>c.kind==="toggle").map(c=>[c.id,c]));
assert.deepEqual([toggles.AT_ARM.x,toggles.AT_ARM.y,toggles.AT_ARM.w,toggles.AT_ARM.h],[357,181,66,68]);
assert.deepEqual([toggles.FD_LEFT.x,toggles.FD_LEFT.y,toggles.FD_LEFT.w,toggles.FD_LEFT.h],[203,321,36,51]);
assert.deepEqual([toggles.FD_RIGHT.x,toggles.FD_RIGHT.y,toggles.FD_RIGHT.w,toggles.FD_RIGHT.h],[1903,321,36,51]);
assert.match(js,/AT_ARM_OFF\.svg/);
assert.match(js,/AT_ARM_UP\.svg/);
assert.match(js,/mcp-hw-silver-atlas/);
assert.doesNotMatch(js,/mcp-hw-toggle-foot/);
assert.match(reference,/\.mcp-hw-at-paddle/);
assert.match(reference,/\.mcp-hw-fd-shaft/);
assert.match(css,/mcp-hw-wheel-tread/);
assert.match(css,/mcp-hw-push-cap/);
assert.match(css,/mcp-v3-plain-face/);
console.log("MCP-0005 phase2 mechanical controls geometry, interaction and styling: PASS");

const sprite=fs.readFileSync(path.join(root,"mcp-authentic-sprites-v2.css"),"utf8");
for(const page of [unified,standalone]){
 assert.match(page,/mcp-authentic-sprites-v2\.css\?v=MCP-SPRITE-0003/);
}
assert.match(sprite,/Small_Silver_5Positions\.webp/);
assert.match(sprite,/mcp-hw-at-off/);
assert.match(sprite,/mcp-hw-at-up/);
assert.match(sprite,/background-position:72\.1% center/);
assert.match(sprite,/background-position:94\.2% center/);
const frontRoot=path.join(root,"assets","mcp-switches");
for(const f of ["AT_ARM_OFF.svg","AT_ARM_UP.svg"]){
 const content=fs.readFileSync(path.join(frontRoot,f),"utf8");
 assert.match(content,/<svg/);
 assert.match(content,/width="256"/);
 assert.match(content,/height="260"/);
 assert.match(content,/linearGradient id="face"/);
}

// The user-approved original photo derivatives MUST be loaded after generic
// CSS. Otherwise the previous fake gradients can cover the reference art.
for(const page of [unified,standalone]){
 const authentic=page.indexOf('mcp-authentic-sprites-v2.css');
 const owner=page.indexOf('mcp-owner-photo-components-v1.css');
 const fake=page.indexOf('mcp-front-reference-v1.css');
 assert.ok(authentic>fake&&owner>authentic,'Original MCP photo modules should override generic procedural CSS');
 assert.match(page,/mcp-owner-photo-components-v1\.css\?v=MCP-PHOTO-0001/);
}
assert.match(js,/AT_ART_ROOT/);
const photo=fs.readFileSync(path.join(root,'mcp-owner-photo-components-v1.css'),'utf8');
for(const f of ['COURSE_PHOTO_80.webp','HEADING_PHOTO_80.webp','ALTITUDE_PHOTO_80.webp','ROUND_PUSH_80.webp'])assert.ok(photo.includes(f),'Missing original generated photo '+f);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'mcp-photo-asset-manifest-v1.json'),'utf8'));
assert.equal(manifest.referencePaths.length,4);
