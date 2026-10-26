/* Photo-MCP phase2 hardware contract checks. No cockpit assets are modified. */
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),vm=require("node:vm");
const root=__dirname;
const js=fs.readFileSync(path.join(root,"mcp-hardware-v1.js"),"utf8");
const css=fs.readFileSync(path.join(root,"mcp-hardware-v1.css"),"utf8");
const visual=fs.readFileSync(path.join(root,"mcp-visual-v3.js"),"utf8");
const unified=fs.readFileSync(path.join(root,"index.html"),"utf8");
const standalone=fs.readFileSync(path.join(root,"../mcp-panel/index.html"),"utf8");
for(const page of [unified,standalone]){
 assert.match(page,/mcp-hardware-v1\.js\?v=MCP-0006-SMALL-SILVER/);
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
assert.match(js,/mcp-hw-at-paddle/);
assert.match(js,/mcp-hw-fd-shaft/);
assert.doesNotMatch(js,/mcp-hw-toggle-foot/);
assert.match(reference,/\.mcp-hw-at-paddle/);
assert.match(reference,/\.mcp-hw-fd-shaft/);
assert.match(css,/mcp-hw-wheel-tread/);
assert.match(css,/mcp-hw-push-cap/);
assert.match(css,/mcp-v3-plain-face/);
console.log("MCP-0005 phase2 mechanical controls geometry, interaction and styling: PASS");
