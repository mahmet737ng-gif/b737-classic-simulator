'use strict';
// Contract: do not change accepted EFIS CP v3 without explicit owner approval.
// The original approved files are not modified by this test.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const dir='cdu-standalone-v6/efis-test';
const approved={
 // Existing English-only lab translation. Source plate, geometry, JS and CSS retain their original fingerprints.
 'index.html':'343e6288c27710815ee65a345af6b320e53dc965',
 'app.js':'a0fea4f3ade411bfc88e1707e798119386b35526',
 'style.css':'b1268d0a20980b15fa54bca51443498e4adb4310',
 'images.js':'0bac0b5c3a2f3a7b25a154b2fbfc1ea9da937944',
 'geometry-v3.json':'e5c5861cde257707989fd1f9d5729098bb079d4c'
};
for(const [file,want] of Object.entries(approved)){
 const bytes=fs.readFileSync(path.join(root,dir,file));
 const hash=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 assert.equal(hash,want,'LOCKED EFIS CP v3 file changed: '+file+'; explicit owner approval required before editing the accepted baseline.');
}
console.log('OWNER-APPROVED EFIS CP v3 unchanged: PASS (5 locked file hashes).');
