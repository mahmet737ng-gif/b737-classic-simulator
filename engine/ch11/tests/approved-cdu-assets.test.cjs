'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ch11=path.resolve(__dirname,'..');
const root=path.resolve(ch11,'../..');
const source=path.join(root,'cdu-standalone-v6');
for(const name of ['cdu-approved-unlit.png','annunciator-call-on.png','annunciator-fail-on.png','annunciator-msg-on.png','annunciator-ofst-on.png','exec-off-plate.png']){
 const original=fs.readFileSync(path.join(source,'assets',name));
 const copied=fs.readFileSync(path.join(ch11,'assets',name));
 assert.equal(Buffer.compare(original,copied),0,'Approved image or sprite changed: '+name);
}
for(const name of ['cdu-map.json','cdu-map.js','buttons.csv']){
 assert.equal(Buffer.compare(fs.readFileSync(path.join(source,'data',name)),fs.readFileSync(path.join(ch11,'data',name))),0,'Approved map changed: '+name);
}
const map=JSON.parse(fs.readFileSync(path.join(ch11,'data/cdu-map.json'),'utf8'));
const artwork=fs.readFileSync(path.join(ch11,'assets/cdu-approved-unlit.png'));
assert.equal(crypto.createHash('sha256').update(artwork).digest('hex'),map.artwork_sha256,'CDU art checksum mismatch');
assert.deepEqual(map.artwork_pixels,[1199,1312]);
assert.equal(map.controls_count,70);assert.equal(map.controls.length,70);
assert.equal(map.outputs.length,5);assert.equal(map.output_annunciators_count,5);
assert.equal(new Set(map.controls.map(x=>x.id)).size,70);
for(const c of map.controls){
 const [x1,y1,x2,y2]=c.bbox_px;
 assert.ok(x1>=0&&y1>=0&&x2<=1199&&y2<=1312&&x2>x1&&y2>y1,c.id);
}
const js=fs.readFileSync(path.join(ch11,'data/cdu-map.js'),'utf8');
assert.ok(js.startsWith('window.CDU_MAP = '));
const parsed=JSON.parse(js.replace(/^window.CDU_MAP = /,'').replace(/;\s*$/,''));
assert.deepEqual(parsed,map);
console.log('PASS: exact approved CDU PNG + 5 sprites + 70 unchanged hitboxes + checksum + control-map parity');
