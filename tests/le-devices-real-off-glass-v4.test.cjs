'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const blob=buf=>crypto.createHash('sha1').update(Buffer.from('blob '+buf.length+'\0')).update(buf).digest('hex');

test('owner-authorized relock identifies the actual installed OFF-glass runtime',()=>{
 const lock=JSON.parse(read('engine/locks/le-photolens-runtime-v3-lock.json'));
 assert.match(lock.ownerAuthorization,/2026-10-30/);
 assert.match(lock.id,/V4-REAL-OPTICAL-GLASS/);
 const runtime=fs.readFileSync(path.join(root,lock.asset));
 assert.equal(blob(runtime),lock.assetGitBlobSha);
 const frozen=JSON.parse(read('engine/locks/le-devices-final-lock-v1.json'));
 const core=fs.readFileSync(path.join(root,'panel-mosaic-lab/le-devices/panel.js'));
 assert.equal(blob(core),frozen.frozenFiles['panel-mosaic-lab/le-devices/panel.js']);
});
test('every LE window has persistent light-proof OFF glass and an independently controlled illuminated face',()=>{
 const code=read('panel-mosaic-lab/le-devices/photo-lens-v3.js');
 assert.match(code,/const dark=svg\('path'/);
 assert.match(code,/insetPolygon\(aperture,0\.65\)/);
 assert.match(code,/data-optic-layer':'unlit-glass'/);
 assert.match(code,/data-optic-layer':'illuminated-glass'/);
 assert.match(code,/g\.append\(dark,face,sheen\)/);
 assert.match(code,/face\.style\.opacity=lit\?/);
 assert.doesNotMatch(code,/dark\.style\.opacity=/);
 const smooth=read('panel-mosaic-lab/le-devices/smooth-glass-v1.js');
 assert.match(smooth,/children\.length===3\?children\.slice\(1\):children/);
 for(const p of ['panel-mosaic-lab/le-devices/smooth-glass-v1.css','panel-mosaic-lab/le-devices/photometric-emission-v1.css']){
  const css=read(p);
  assert.doesNotMatch(css,/path:first-child/,'OFF glass must never carry a luminous halo');
  assert.match(css,/path\[data-optic-layer="illuminated-glass"\]/);
 }
});
test('Unified uses cache-busted actual LE runtime and preserves original source interaction',()=>{
 const assembly=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json'));
 assert.match(assembly.regions.find(r=>r.id==='overhead').embeddedUrl,/LE-OFFGLASS-0004/);
 for(const p of ['panel-mosaic-lab/cockpit/overhead-stage.html','panel-mosaic-lab/le-devices/index.html']){
  const html=read(p);
  assert.match(html,/photo-lens-v3\.js\?v=LE-PHOTOLENS-0003-OWNER-OFFGLASS-0004/);
  assert.match(html,/smooth-glass-v1\.js\?v=LE-SMOOTHGLASS-0001-OWNER-OFFGLASS-0004/);
  assert.match(html,/smooth-glass-v1\.css\?v=LE-SMOOTHGLASS-0001-OWNER-OFFGLASS-0004/);
 }
 const browser=read('tools/test-le-devices-photo-lens-browser-v2.cjs');
 assert.match(browser,/genuineOff/);
 assert.match(browser,/data-optic-layer="unlit-glass"/);
});
