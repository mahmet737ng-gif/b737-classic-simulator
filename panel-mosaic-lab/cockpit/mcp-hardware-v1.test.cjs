/* Photo-MCP phase2 hardware contract checks. No cockpit assets are modified. */
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),vm=require("node:vm");
const root=__dirname;
const js=fs.readFileSync(path.join(root,"mcp-hardware-v1.js"),"utf8");
const css=fs.readFileSync(path.join(root,"mcp-hardware-v1.css"),"utf8");
const visual=fs.readFileSync(path.join(root,"mcp-visual-v3.js"),"utf8");
const unified=fs.readFileSync(path.join(root,"index.html"),"utf8");
const standalone=fs.readFileSync(path.join(root,"../mcp-panel/index.html"),"utf8");
for(const page of [unified,standalone]){
 assert.match(page,/mcp-hardware-v1\.js\?v=MCP-0005-HARDWARE/);
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
assert.match(css,/mcp-hw-toggle-head/);
assert.match(css,/mcp-hw-wheel-tread/);
assert.match(css,/mcp-hw-push-cap/);
assert.match(css,/mcp-v3-plain-face/);
console.log("MCP-0005 phase2 mechanical controls geometry, interaction and styling: PASS");
