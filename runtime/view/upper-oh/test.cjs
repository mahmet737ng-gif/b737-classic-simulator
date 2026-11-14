'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const base=__dirname,geometry=JSON.parse(fs.readFileSync(path.join(base,'geometry.json'),'utf8'));
const source=path.resolve(base,geometry.source);
assert.ok(fs.existsSync(source),'immutable uploaded source required');
const hash=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
assert.equal(hash,'9d8ac0ac86bdb92c040e9bdd97811ca381535d949bff94aa5b1a01e5de8e23df','LOCKED SOURCE WAS ALTERED');
assert.equal(geometry.parts.length,6);assert.equal(new Set(geometry.parts.map(p=>p.id)).size,6);
for(const p of geometry.parts){assert.match(p.id,/^OH-0[1-6]$/);for(const poly of p.polygons){assert.ok(poly.length>=3);for(const [x,y] of poly){assert.ok(x>=0&&x<=1731&&y>=0&&y<=909,`invalid vertex ${p.id}`);}}}
const js=fs.readFileSync(path.join(base,'stage.js'),'utf8');new (require('node:vm').Script)(js,{filename:'stage.js'});
console.log('OH01..06 immutable PNG hash and six selectable polygons: PASS');