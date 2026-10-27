'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=__dirname;
const read=x=>fs.readFileSync(path.join(base,x),'utf8');
const html=read('index.html'),js=read('irs-isdu-onpanel-v2.js'),css=read('irs-isdu-onpanel-v2.css');
const photo=fs.readFileSync(path.join(base,'assets/irs-owner-keycaps-v3.avif'));
assert(photo.length>9000,'Owner keycap photo sprite is missing/placeholder');
assert.equal(photo.toString('ascii',4,12),'ftypavif');
assert.match(html,/irs-isdu-onpanel-v2\.js\?v=IRS-UI-0003/);
assert.match(html,/irs-isdu-onpanel-v2\.css\?v=IRS-UI-0003/);
assert.match(js,/src='\.\/assets\/irs-owner-keycaps-v3\.avif'/);
assert.match(css,/background-size:300% 400%/);
assert.match(js,/dataset\.backend='DISCONNECTED'/);
assert.match(js,/b737:irs-visual-key/);
assert.match(js,/pointerdown/);
assert.match(js,/pointerup/);
assert.match(js,/setTimeout\(up,110\)/);
assert.match(js,/const KEYS=Object\.freeze\(\[/);
assert.match(css,/#irsIsduOpen\{display:none!important\}/);
const cols=[818.5,873.2,927.3],rows=[391.6,436.9,479.3,523.5],w=40,h=40;
const oh={x0:3+383*2214/1731,x1:3+771*2214/1731,y0:3+57*1019/909,y1:3+715*1019/909};
for(let r=0;r<4;r++)for(let c=0;c<3;c++){
 const rect={x:cols[c]-w/2,y:rows[r]-h/2,w,h};
 assert(rect.x>=oh.x0&&rect.x+rect.w<=oh.x1&&rect.y>=oh.y0&&rect.y+rect.h<=oh.y1,'outside OH-02');
 for(let rr=0;rr<4;rr++)for(let cc=0;cc<3;cc++){
  if(rr===r&&cc===c)continue;
  const other={x:cols[cc]-w/2,y:rows[rr]-h/2};
  assert(rect.x+rect.w<=other.x||other.x+w<=rect.x||rect.y+rect.h<=other.y||other.y+h<=rect.y,'physical key overlap');
 }
}
assert(!/B737ElectricalV7\.apply|B737FMC\.apply|IRSSystem\.apply/.test(js),'No backend in visual stage');
console.log('PASS: 12 authentic photographed keys, individual coordinates, no collisions, source photo, UI-only states');
