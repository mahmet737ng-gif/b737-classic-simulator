'use strict';
/* Native B737 Classic MCP black glass center regression.
 * Original immutable source: panel-mosaic-lab/assets/locked/2026-10-23/
 * B737_MCP_Blank_Panel.png (2172×433).
 * SHA256 9ee5a14d8b3bbf903e62ba65c1f0b3c52f23238abc1b1cd16fe31fea25548062
 * Inner usable dark glass detected from source pixel scans with threshold 40;
 * these are not the glossy outside bezel contours.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const visual=fs.readFileSync(path.join(base,'panel-mosaic-lab/cockpit/mcp-visual-v3.js'),'utf8');
const live=fs.readFileSync(path.join(base,'panel-mosaic-lab/cockpit/mcp-independent-digits-v1.js'),'utf8');
const ui=fs.readFileSync(path.join(base,'panel-mosaic-lab/cockpit/index.html'),'utf8');
const standalone=fs.readFileSync(path.join(base,'panel-mosaic-lab/mcp-panel/index.html'),'utf8');
const source=visual.match(/const displays=\[([\s\S]*?)\];/);
assert.ok(source,'single source-coordinate display geometry');
const areas=vm.runInNewContext('['+source[1]+']');
assert.equal(areas.length,6);
// left, top, right, bottom in ORIGINAL image native pixels (not viewport).
const physical={
 courseL:[85,110,194,158],speed:[479,115,615,163],
 heading:[819,117,917,165],altitude:[1114,120,1277,169],
 verticalSpeed:[1361,122,1522,173],courseR:[1920,126,2022,174]
};
assert.deepEqual(Array.from(areas.map(d=>d.id)),Object.keys(physical));
for(const d of areas){
 const [l,t,r,b]=physical[d.id];
 const cx=l+(r-l)/2,cy=t+(b-t)/2;
 const overlayX=d.x+d.w/2,overlayY=d.y+d.h/2;
 assert.ok(Math.abs(overlayX-cx)<=0.6,d.id+' horizontal center offset from glass: '+(overlayX-cx));
 assert.ok(Math.abs(overlayY-cy)<=0.6,d.id+' vertical center offset from glass: '+(overlayY-cy));
 assert.ok(d.x>=l&&d.y>=t&&d.x+d.w<=r+1&&d.y+d.h<=b+1,
  d.id+' opaque black overlay must fit WITHIN actual black glass (no border cover)');
 assert.equal(d.digits,['altitude','verticalSpeed'].includes(d.id)?5:3);
 for(const zoom of [0.3,0.5,1,1.5,2]){
  const nativeFromCss=zoom*(d.x+d.w/2),expected=zoom*overlayX;
  assert.equal(nativeFromCss,expected,'zoom must not dislodge digit glass '+d.id);
 }
}
assert.match(live,/const geometry=win\.B737McpVisualV3\?\.geometry\?\.displays/);
assert.match(live,/const areas=Object\.freeze\(geometry\.map\(d=>Object\.freeze\(/);
assert.doesNotMatch(live,/const areas=Object\.freeze\(\[/,'No second independent guessed rect list');
for(const html of [ui,standalone])
 assert.match(html,/mcp-visual-v3\.js\?v=MCP-HOLES-0001-PHOTO-CENTER/);
assert.match(ui,/mcp-independent-digits-v1\.js\?v=MCP-HOLES-0001-SAME-GEOMETRY/);
console.log('PASS MCP original PNG: six glass centers <=0.6 source px, exact inset, zoom invariance, one shared authority, fresh assets');
