'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const m=require('./fo-owner-panel-v1.js');
assert.deepEqual(Object.keys(m.guards).sort(),['gpws-flap-inhibit','gpws-gear-inhibit','gpws-terrain-inhibit']);
const bytes=fs.readFileSync(__dirname+'/assets/fo-efis-rd-owner-20261030-v1.png');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),m.source.sha256,'Owner selected pixels must remain unchanged');
for(const box of Object.values(m.guards)){const p=m.placement(box);assert.equal(p.w,35*m.rect.w/m.source.width);assert.equal(p.h,66*m.rect.w/m.source.width);assert.ok(p.x>=m.rect.x&&p.x+p.w<m.rect.x+m.rect.w);assert.ok(p.y+p.h<m.rect.y+m.rect.h);}
assert.equal(m.rect.w/m.rect.h,m.source.width/m.source.height);
assert.equal((fs.readFileSync(__dirname+'/index.html','utf8').match(/fo-owner-panel-v1.js/g)||[]).length,1);
console.log('PASS: exact owner image; only three equal GPWS guard registrations; source aspect and single runtime mount');
