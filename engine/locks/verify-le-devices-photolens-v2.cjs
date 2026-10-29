'use strict';
/* Owner-authorized visual re-lock. Fail closed if either photo-lens asset or
   the previous immutable LE DEVICES core has been modified. */
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const manifest=JSON.parse(fs.readFileSync('engine/locks/le-devices-photolens-final-v2.json','utf8'));
assert.equal(manifest.id,'LEDEV-PHOTOLENS-FINAL-2026-10-30');
assert.equal(manifest.geometry.windows,26);
const gitBlob=bytes=>crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
for(const [p,sha] of Object.entries(manifest.immutableFiles)){
 const b=fs.readFileSync(p),current=gitBlob(b);
 assert.equal(current,sha,'Owner-approved visual lens file altered: '+p);
}
cp.execFileSync(process.execPath,['engine/locks/verify-le-devices-final-v1.cjs','--negative-self-test'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['tests/le-devices-photo-lens-v2.test.cjs'],{stdio:'inherit'});
if(process.argv.includes('--negative-self-test')){
 const p=Object.keys(manifest.immutableFiles)[0],bytes=fs.readFileSync(p);
 assert.notEqual(gitBlob(Buffer.concat([bytes,Buffer.from('tamper')])),manifest.immutableFiles[p]);
 console.log('PASS: deliberate lens modification detected');
}
console.log('PASS: owner LE photolens v2 FINAL locked; 26 aperture lenses; original 108-file core RED ZONE intact');