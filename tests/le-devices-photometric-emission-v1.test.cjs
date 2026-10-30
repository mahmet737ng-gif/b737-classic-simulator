'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const blob=x=>crypto.createHash('sha1').update(Buffer.from('blob '+Buffer.byteLength(x)+'\0')).update(x).digest('hex');
test('LE lamp emission only changes inset lens optical grade; 26 source apertures remain locked',()=>{
 const base=JSON.parse(read('engine/locks/le-devices-final-lock-v1.json'));
 const original=read('panel-mosaic-lab/le-devices/panel.js');
 assert.equal(blob(original),base.frozenFiles['panel-mosaic-lab/le-devices/panel.js']);
 const css=read('panel-mosaic-lab/le-devices/photometric-emission-v1.css');
 const stops=[...css.matchAll(/linearGradient\[id\^="leph"\]\[id\$="([ag])"\] stop:nth-child\((\d)\)/g)];
 assert.equal(stops.length,8);
 assert.deepEqual([...new Set(stops.filter(x=>x[1]==='a').map(x=>+x[2]))],[1,2,3,4]);
 assert.deepEqual([...new Set(stops.filter(x=>x[1]==='g').map(x=>+x[2]))],[1,2,3,4]);
 assert.match(css,/data-lens-id\$="\|TRANSIT"/);
 assert.match(css,/data-lens-id\$="\|FULL_EXT"/);
 assert.ok(!/(?:\b(?:width|height|position|left|top|stroke-width|pointer-events)\s*:)/.test(css));
 for(const [file,target] of [
  ['panel-mosaic-lab/le-devices/index.html','./photometric-emission-v1.css?v=LE-EMISSION-0001'],
  ['panel-mosaic-lab/cockpit/overhead-stage.html','../le-devices/photometric-emission-v1.css?v=LE-EMISSION-0001']
 ])assert.ok(read(file).includes(target),file+' missing photometric grade');
 const assembly=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json'));
 assert.match(assembly.regions.find(x=>x.id==='overhead').embeddedUrl,/LE-EMISSION-0001/);
});
