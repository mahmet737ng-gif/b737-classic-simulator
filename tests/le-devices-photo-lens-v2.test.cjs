'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(p,'utf8');
const panel=read('panel-mosaic-lab/le-devices/panel.js');
const script=read('panel-mosaic-lab/le-devices/photo-lens-v3.js');
const style=read('panel-mosaic-lab/le-devices/photo-lens-v2.css');
const fixed=JSON.parse(read('engine/locks/le-devices-final-lock-v1.json'));
const digest=bytes=>crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
assert.equal(digest(Buffer.from(panel)),fixed.frozenFiles['panel-mosaic-lab/le-devices/panel.js'],'OWNER ORIGINAL MUST STAY LOCKED');
const specs=JSON.parse(panel.match(/const windowSpecs=(\[[^\n]+\]);/)[1]);
assert.equal(specs.length,26);
const context={window:{},document:{readyState:'loading',addEventListener(){}},MutationObserver:class{}};
vm.runInNewContext(script,context,{filename:'photo-lens-v3.js'});
const inset=context.window.B737LEPhotoLensV2.insetPolygon;
const box=q=>({minX:Math.min(...q.map(p=>p[0])),maxX:Math.max(...q.map(p=>p[0])),minY:Math.min(...q.map(p=>p[1])),maxY:Math.max(...q.map(p=>p[1]))});
const area=q=>Math.abs(q.reduce((v,p,i)=>v+p[0]*q[(i+1)%q.length][1]-q[(i+1)%q.length][0]*p[1],0)/2);
for(const x of specs){
 const src=x.polygon,original=src.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')+' Z';
 const result=inset(original);
 const pts=[...result.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m=>[+m[1],+m[2]]);
 assert.equal(pts.length,4,'4 corners: '+x.device+' '+x.level);
 assert.ok(area(pts)>100 && area(pts)<area(src)*.95,'optical lens strictly inset: '+x.device+' '+x.level);
 const a=box(src),b=box(pts);
 assert.ok(b.minX>a.minX&&b.maxX<a.maxX&&b.minY>a.minY&&b.maxY<a.maxY,'inside painted aperture');
}
assert.match(script,/MutationObserver\(sync\)/,'live lamp state must synchronize');
assert.match(style,/fill:transparent\s*!important/,'flat source fill must not bleed through');
assert.match(style,/focus-visible/,'original keyboard focus must remain visible');
for(const hex of ['#ffd22a','#3ce5aa'])assert.ok(!script.includes(hex),'old neon color forbidden: '+hex);
for(const path of ['panel-mosaic-lab/cockpit/overhead-stage.html','panel-mosaic-lab/le-devices/index.html']){
 const html=read(path);assert.match(html,/photo-lens-v3\.js\?v=LE-PHOTOLENS-0003/);
 assert.match(html,/photo-lens-v2\.css\?v=LE-PHOTOLENS-0002/);
}
const assembly=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json'));
assert.match(assembly.regions.find(r=>r.id==='overhead').embeddedUrl,/LE-PHOTOLENS-0003/);
console.log('PASS: 26/26 inset lens quads, owner core immutable, no neon fill, inputs preserved, both mounts versioned');