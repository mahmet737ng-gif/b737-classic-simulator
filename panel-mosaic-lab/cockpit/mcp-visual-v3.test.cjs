/* MCP-0003 static geometry and behavioral contracts. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=__dirname;
const script=fs.readFileSync(path.join(root,'mcp-visual-v3.js'),'utf8');
const css=fs.readFileSync(path.join(root,'mcp-visual-v3.css'),'utf8');
const unified=fs.readFileSync(path.join(root,'index.html'),'utf8');
const standalone=fs.readFileSync(path.join(root,'../mcp-panel/index.html'),'utf8');
for(const p of [unified,standalone]){
 assert.match(p,/mcp-visual-v3\.js\?v=MCP-0005-PIXEL-QA/);
 assert.match(p,/mcp-visual-v3\.css\?v=MCP-0003/);
 assert.doesNotMatch(p,/src="[^"]*mcp-ias-mach-knob\.js/);
}
assert.match(script,/W=2172,H=433/);
assert.match(script,/source:"MCP-0003"/);
assert.match(script,/role:"button"/);
assert.match(script,/MCP-0003: source-coordinate/);
assert.equal((script.match(/\{id:"(?:courseL|courseR|speed|heading|altitude)"/g)||[]).length,10);
assert.match(css,/\.mcp-v3-overlay/);
assert.match(css,/pointer-events:auto/);

const vm=require("node:vm");
function geometry(name){
 const m=script.match(new RegExp("const "+name+"=\\[([\\s\\S]*?)\\];"));
 assert.ok(m,"missing "+name+" geometry");
 return vm.runInNewContext("["+m[1]+"]");
}
const displays=geometry("displays"),lamps=geometry("lamps"),knobs=geometry("knobs");
assert.equal(displays.length,6);
assert.equal(lamps.length,14);
assert.equal(knobs.length,5);
for(const item of [...displays,...lamps])assert.ok(item.x>=0&&item.y>=0&&item.x+item.w<=2172&&item.y+item.h<=433,item.id+" out of source");
for(const item of knobs)assert.ok(item.x-item.d/2>=0&&item.y-item.d/2>=0&&item.x+item.d/2<=2172&&item.y+item.d/2<=433,item.id+" rotation outside source");
const screenshotCenters={courseL:[88,252],speed:[558,275],heading:[860,245],altitude:[1198,244],courseR:[2110,249]};
for(const [id,[x,y]] of Object.entries(screenshotCenters)){
 const n=knobs.find(v=>v.id===id);assert.ok(n,id+" missing pivot");
 assert.ok(Math.hypot(n.x-x,n.y-y)<=3,id+" not aligned to physical hole");
}
const windows={
 courseL:[75,110,205,178],speed:[465,110,650,178],heading:[802,110,970,178],
 altitude:[1115,110,1309,178],verticalSpeed:[1360,110,1560,178],courseR:[1830,110,2040,178]
};
for(const d of displays){
 const [l,t,r,b]=windows[d.id];
 assert.ok(d.x>=l&&d.y>=t&&d.x+d.w<=r&&d.y+d.h<=b,d.id+" LCD exceeds socket");
}
const buttonBounds={
 N1:[236,350,330,398], SPEED:[375,350,453,398], LVL_CHG:[683,350,775,398],
 HDG_SEL:[837,350,920,398], APP:[986,350,1074,398], ALT_HLD:[1167,350,1252,398],
 VS:[1298,350,1384,398], VNAV:[690,135,784,185], LNAV:[976,135,1070,185],
 CMD_A:[1615,160,1702,201], CMD_B:[1786,160,1885,201],
 CWS_A:[1615,257,1702,309], CWS_B:[1786,257,1885,309],
 AT_ARM:[306,114,380,155]
};
for(const l of lamps){
 const box=buttonBounds[l.id];assert.ok(box,"missing "+l.id+" target lens");
 assert.ok(l.x>=box[0]&&l.y>=box[1]&&l.x+l.w<=box[2]&&l.y+l.h<=box[3],l.id+" light is outside its button");
}
assert.match(script,/one exact clipping boundary for black LCD glass/);
assert.match(script,/mcp-v5-/);
assert.match(script,/map\(k=>\[k,false\]\)/);
assert.match(script,/b737:visual-test/);
console.log('MCP screenshot-calibrated six windows, fourteen lenses, five hole centers: PASS');

console.log('MCP-0005 visual mounts and calibration contracts: PASS');
