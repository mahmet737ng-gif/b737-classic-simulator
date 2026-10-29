'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),cp=require('node:child_process');
const lock=JSON.parse(fs.readFileSync('engine/locks/le-photolens-runtime-v3-lock.json','utf8'));
const buf=fs.readFileSync(lock.asset);
const blob=bytes=>crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
assert.equal(blob(buf),lock.assetGitBlobSha,'Modified approved v3 lens runtime');
const code=buf.toString('utf8');
assert.ok(code.includes("for(const record of records)for(const node of record.addedNodes)mountAdded(node)"),'Must register ONLY new subtrees');
assert.ok(!code.includes("new MutationObserver(refresh)"),'Global full-document MutationObserver rescan forbidden');
assert.ok(code.includes("window.B737LEPhotoLensV3="),'v3 API not available');
assert.ok(code.includes("window.B737LEPhotoLensV2="),'compatibility alias not available');
const assembly=JSON.parse(fs.readFileSync('panel-mosaic-lab/cockpit/assembly.json','utf8'));
assert.match(assembly.regions.find(x=>x.id==='overhead').embeddedUrl,/LE-PHOTOLENS-0003/);
for(const name of ['panel-mosaic-lab/cockpit/overhead-stage.html','panel-mosaic-lab/le-devices/index.html'])
 assert.match(fs.readFileSync(name,'utf8'),/photo-lens-v3\.js\?v=LE-PHOTOLENS-0003/,'v3 not loaded by '+name);
assert.match(fs.readFileSync('panel-mosaic-lab/cockpit/pressurization-oh22.js','utf8'),/if\(!received\|\|!layer\?\.isConnected\|\|!caption\?\.isConnected\)return;/,'OH22 race guard missing');
cp.execFileSync(process.execPath,['engine/locks/verify-le-devices-photolens-v2.cjs','--negative-self-test'],{stdio:'inherit'});
console.log('PASS: immutable v3 observer, native v2 and LED core locks, 26 lenses, bounded registration, OH22 remount safety');
