'use strict';
/* MCP-KNOB-HOLE-0001 — source PNG radial edge and alpha photo coverage.
 * 2172x433 approved B737_MCP_Blank_Panel.png
 * SHA256 9ee5a14d8b3bbf903e62ba65c1f0b3c52f23238abc1b1cd16fe31fea25548062
 * Radial dark-to-bright transition: L (90,242,r54),
 * IAS/MACH (562,276,r47), R (2018,249,r49).
 * Photographic alpha occupancy from source 480x480 files at A>=32.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/mcp-socket-registration-v2.js'),'utf8');
const css=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/mcp-knob-retina-v1.css'),'utf8');
const html=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/index.html'),'utf8');
const expected={
 courseL:{x:90,y:242,r:54,alphaCount:113176,bbox:[63,21,440,404]},
 speed:{x:562,y:276,r:47,alphaCount:139783,bbox:[27,18,453,460]},
 courseR:{x:2018,y:249,r:49,alphaCount:113176,bbox:[63,21,440,404]}
};
const env={
 document:{readyState:'loading',addEventListener(){},querySelectorAll(){return[]}},
 window:{addEventListener(){}},MutationObserver:class{},
 location:{search:''}
};
vm.runInNewContext(code,env);
const registrar=env.window.B737McpSocketRegistrationV2;
assert.ok(registrar,'source registration loaded');
const result=[];
for(const [id,e] of Object.entries(expected)){
 const [x,y,w,h]=registrar.knobRects[id],f=registrar.knobPhotoFits[id];
 const center=[x+w/2,y+h/2];
 assert.deepEqual(center,[e.x,e.y],id+' must match image's dark circular center');
 assert.equal(w,h,id+' socket is circular');
 assert.equal(w,2*e.r,id+' source hole diameter');
 assert.equal(f.alphaFraction,e.alphaCount/(480*480));
 const visibleArea=f.alphaFraction*f.factor*f.factor*w*w;
 const holeArea=Math.PI*e.r*e.r;
 assert.ok(Math.abs(visibleArea-holeArea)<.01,id+' image alpha area != hole aperture area');
 const imageVisibleX=(f.imageLeftPct/100+f.factor*(e.bbox[0]+e.bbox[2])/960)*w;
 const imageVisibleY=(f.imageTopPct/100+f.factor*(e.bbox[1]+e.bbox[3])/960)*h;
 assert.ok(Math.abs(imageVisibleX-w/2)<.001,id+' alpha optical center x mismatch');
 assert.ok(Math.abs(imageVisibleY-h/2)<.001,id+' alpha optical center y mismatch');
 assert.ok(f.factor>1,id+' requires transparency compensation');
 result.push({id,center,r:e.r,holeArea:+holeArea.toFixed(2),
  opaqueArea:+visibleArea.toFixed(2),alphaScale:+f.factor.toFixed(4)});
}
assert.deepEqual(Array.from(registrar.knobRects.heading),[823,194,81,86]);
assert.deepEqual(Array.from(registrar.knobRects.altitude),[1157,193,86,86]);
assert.match(code,/el\.style\.height=percent\(diameter,H\)/);
assert.match(code,/el\.dataset\.mcpHoleCenter/);
assert.match(css,/--mcp-knob-photo-fill/);
assert.match(css,/--mcp-knob-photo-left/);
assert.match(css,/--mcp-knob-photo-top/);
assert.match(html,/mcp-socket-registration-v2\.js\?v=MCP-KNOB-HOLE-0001/);
assert.match(html,/mcp-knob-retina-v1\.css\?v=MCP-KNOB-HOLE-0001/);
console.log('MCP measured knob sockets/photo area/centers PASS',JSON.stringify(result));
