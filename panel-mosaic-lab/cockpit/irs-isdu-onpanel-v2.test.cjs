'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=__dirname;
const read=x=>fs.readFileSync(path.join(base,x),'utf8');
const html=read('index.html'),js=read('irs-isdu-onpanel-v2.js'),css=read('irs-isdu-onpanel-v2.css');
const photo=fs.readFileSync(path.join(base,'assets/irs-owner-keycaps-v3.avif'));
assert(photo.length>9000,'Owner photographic keypad missing');
assert.equal(photo.toString('ascii',4,12),'ftypavif');
const original=fs.readFileSync(path.join(base,'../assets/locked/2026-10-23/OH01-06-source-9d8ac0ac86bd.png'));
const sourceSha='9d8ac0ac86bdb92c040e9bdd97811ca381535d949bff94aa5b1a01e5de8e23df';
assert.equal(crypto.createHash('sha256').update(original).digest('hex'),sourceSha,'The owner-approved source must never change');
assert(js.includes(sourceSha),'ISDU calibration must record the correct frozen source checksum');
for(const [name,version] of [
 ['irs-isdu-onpanel-v2.js','IRS-UI-0004'],
 ['irs-isdu-onpanel-v2.css','IRS-UI-0004']
])assert(html.includes(name+'?v='+version),'Unified asset cache key missing: '+name);
assert.match(js,/const SRC='\.\/assets\/irs-owner-keycaps-v3\.avif'/);
assert.match(js,/IRS-ISDU-BEZEL-FIX-0004/);
assert.match(js,/const SOURCE_COLS=Object\.freeze\(\[638\.0,678\.5,720\.0\]\)/);
assert.match(js,/const SOURCE_ROWS=Object\.freeze\(\[343\.5,383\.5,425\.0,465\.5\]\)/);
assert.match(js,/const KEY_W=50\.4, KEY_H=44\.7/);
assert.match(js,/sourceToNativeX=x=>3\+x\*2214\/1731/);
assert.match(js,/sourceToNativeY=y=>3\+y\*1019\/909/);
assert.match(js,/const KEYS=Object\.freeze\(\[/);
assert.match(js,/irs-photo-key-bezel/);
assert.match(js,/irs-photo-key-cap/);
assert.match(js,/irs-photo-key-press/);
assert.match(js,/key\.append\(bezel,blackCap,press,fallback\)/);
assert.match(js,/press\.addEventListener\('pointerdown'/);
assert.match(js,/press\.addEventListener\('click'/);
assert.doesNotMatch(js,/key\.addEventListener\('click'/);
assert.match(js,/b737:irs-visual-key/);
assert.match(js,/setTimeout\(up,110\)/);
assert.match(js,/dataset\.backend='DISCONNECTED'/);
assert.match(css,/irs-photo-key-bezel\{z-index:1/);
assert.match(css,/irs-photo-key-cap\{z-index:2/);
assert.match(css,/irs-photo-key-press\{position:absolute;z-index:3/);
assert.match(css,/irs-key-fixed-metal-mask-v4\.svg/);
assert.match(css,/irs-key-black-cap-mask-v4\.svg/);
assert.match(css,/\.irs-photo-key-bezel\{[^\n]*transform:none!important/);
assert.match(css,/\.irs-photo-key\.is-depressed \.irs-photo-key-cap\{[^\n]*translate3d\(0,1\.65px,0\)/);
assert.doesNotMatch(css,/\.is-depressed\) \.irs-photo-key-bezel\{/);
assert.match(css,/\.irs-photo-key-press\{[^\n]*top:17%;bottom:17%;left:18%;right:18%/);
assert.match(css,/#irsIsduOpen\{display:none!important\}/);
const capMask=read('assets/irs-key-black-cap-mask-v4.svg');
const bezelMask=read('assets/irs-key-fixed-metal-mask-v4.svg');
assert.match(capMask,/<rect x="25" y="23" width="88" height="94" rx="12"/);
assert.match(bezelMask,/fill-rule="evenodd"/);
assert.match(bezelMask,/M37 23 H101/);
const cols=[638.0,678.5,720.0].map(x=>3+x*2214/1731);
const rows=[343.5,383.5,425.0,465.5].map(y=>3+y*1019/909);
const w=50.4,h=44.7;
const oh={x0:3+383*2214/1731,x1:3+771*2214/1731,y0:3+57*1019/909,y1:3+715*1019/909};
const darkXs=[[622,654],[663,694],[704,736]];
const darkYs=[[327,360],[368,400],[409,441],[449,481]];
for(let row=0;row<4;row++)for(let col=0;col<3;col++){
 const rect={x:cols[col]-w/2,y:rows[row]-h/2,w,h};
 assert(rect.x>=oh.x0&&rect.x+rect.w<=oh.x1&&rect.y>=oh.y0&&rect.y+h<=oh.y1,'Key leaves source OH02');
 for(let rr=0;rr<4;rr++)for(let cc=0;cc<3;cc++){
  if(rr===row&&cc===col)continue;
  const other={x:cols[cc]-w/2,y:rows[rr]-h/2};
  assert(rect.x+rect.w<=other.x||other.x+w<=rect.x||rect.y+rect.h<=other.y||other.y+h<=rect.y,'Interaction rectangles overlap');
 }
 // Because outer pixels of the owner keycap are 3px inset per 138px tile,
 // the actual 12 photo frames must still cover the unmodified black source well.
 const ratioX=1731/2214,ratioY=909/1019,visible=132/138;
 const left=([638,678.5,720][col])-(w*ratioX*visible)/2;
 const right=([638,678.5,720][col])+(w*ratioX*visible)/2;
 const top=([343.5,383.5,425,465.5][row])-(h*ratioY*visible)/2;
 const bottom=([343.5,383.5,425,465.5][row])+(h*ratioY*visible)/2;
 assert(left<=darkXs[col][0]&&right>=darkXs[col][1], 'Photo rim too small for original empty well X');
 assert(top<=darkYs[row][0]&&bottom>=darkYs[row][1], 'Photo rim too small for original empty well Y');
}
assert(!/B737ElectricalV7\.apply|B737FMC\.apply|IRSSystem\.apply/.test(js),'Visual stage must not drive IRS');
console.log('PASS IRS-OH02 V4: 12 source-pixel registered rims completely mask dark wells; no overlapping hitboxes; ONLY black cap moves; owner photo/guards frozen');
