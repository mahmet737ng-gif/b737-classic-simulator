'use strict';
/* Owner MCP 13-source preview acceptance:
 * image identity, exact filename mapping, immutable base artwork, native DOM
 * centering and stateful presentation. Not an image-space aperture proof. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const p=part=>path.join(root,'panel-mosaic-lab/cockpit/assets/mcp-switches/owner13-photo-part'+part+'.b64');
const b64=[0,1,2,3].map(i=>fs.readFileSync(p(i),'utf8').trim()).join('');
assert.equal(b64.length,15724,'owner artwork base64 transfer length changed');
const bytes=Buffer.from(b64,'base64');
assert.equal(bytes.length,11792,'owner artwork transfer truncated');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
  'e0a7bc4f9f264c301c852d286fd6ff57160636ae0e9c30dc463eaa8fcb0b095d',
  'owner source derivative altered or damaged during upload');
assert.equal(bytes.toString('ascii',0,4),'RIFF');
assert.equal(bytes.toString('ascii',8,12),'WEBP');
assert.equal(bytes.toString('ascii',12,16),'VP8X');
const src=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/mcp-owner13-v1.js'),'utf8');
const style=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/mcp-owner13-v1.css'),'utf8');
const map=JSON.parse(fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/mcp-owner13-source-map.json'),'utf8'));
new (require('node:vm').Script)(src);
assert.equal(map.originalFiles.length,13);
assert.equal(map.map.speed,4,'IAS selector must be actual uploaded airspeed photo');
assert.equal(map.map.heading,10);
assert.equal(map.map.headingSEL,11);
assert.equal(map.map.bankRing,12);
assert.equal(map.map.atDown,2);
assert.equal(map.map.atUp,3);
assert.equal(map.map.fdOff,8);
assert.equal(map.map.fdOn,9);
assert.equal(map.map.courseL,0);
assert.equal(map.map.courseR,0);
assert.match(src,/const W=2172,H=433/);
assert.match(src,/bankRing:\{x:860,y:245,d:112\}/);
assert.match(src,/pendingOwnerArtwork/);
assert.match(style,/--owner-bsize/);
assert.match(style,/mcp-owner13-push/);
assert.match(src,/const photoZoom/);
assert.match(src,/function addPushButtons/);
assert.match(style,/pointer-events:none/);
for(const file of ['panel-mosaic-lab/cockpit/index.html','panel-mosaic-lab/mcp-panel/index.html']){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 assert.match(html,/mcp-owner13-v1\.js\?v=OWNER13-0002/);
 assert.match(html,/mcp-owner13-v1\.css\?v=OWNER13-0002/);
}
console.log(JSON.stringify({status:'PASS',sourceNames:13,previewAtlasPixels:[192,192],transparentParts:4,
 verifiedSHA256:true,immutableMcpBackground:true,previewOnly:true,sourceCutoutAudit:'NOT_YET_CERTIFIED'}));
