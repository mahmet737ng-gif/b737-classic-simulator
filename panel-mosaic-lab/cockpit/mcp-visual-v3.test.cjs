/* MCP-0003 static geometry and behavioral contracts. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=__dirname;
const script=fs.readFileSync(path.join(root,'mcp-visual-v3.js'),'utf8');
const css=fs.readFileSync(path.join(root,'mcp-visual-v3.css'),'utf8');
const unified=fs.readFileSync(path.join(root,'index.html'),'utf8');
const standalone=fs.readFileSync(path.join(root,'../mcp-panel/index.html'),'utf8');
for(const p of [unified,standalone]){
 assert.match(p,/mcp-visual-v3\.js\?v=MCP-0003/);
 assert.match(p,/mcp-visual-v3\.css\?v=MCP-0003/);
 assert.doesNotMatch(p,/src="[^"]*mcp-ias-mach-knob\.js/);
}
assert.match(script,/W=2172,H=433/);
assert.match(script,/source:"MCP-0003"/);
assert.match(script,/role:"button"/);
assert.match(script,/MCP-0003: source-coordinate/);
assert.equal((script.match(/\{id:"(?:courseL|courseR|speed|heading|altitude)"/g)||[]).length,11);
assert.match(css,/\.mcp-v3-overlay/);
assert.match(css,/pointer-events:auto/);
console.log('MCP-0003 visual mounts and calibration contracts: PASS');
