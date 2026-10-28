const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('./asp-vbr-model-v1.js');
test('V/B/R uses the upper recessed notch and keeps independent hard stops per station',()=>{
 const s=model.create();
 assert.equal(s.read('CAPT').position,'B');assert.equal(s.read('CAPT').angle,0);
 assert.equal(s.select('CAPT',0).position,'V');assert.equal(s.read('CAPT').angle,-45);
 assert.equal(s.step('CAPT',-100).position,'V');
 assert.equal(s.step('CAPT',100).position,'R');assert.equal(s.read('CAPT').angle,45);
 assert.equal(s.read('FO').position,'B');assert.equal(s.read('OBS').position,'B');
 assert.equal(s.select('OBS',0).position,'V');assert.equal(s.read('CAPT').position,'R');
 assert.throws(()=>s.read('FA'),/Unknown/);assert.throws(()=>s.select('FO',NaN),/Invalid/);
});
test('VBR center is the actual fourth lower hole in both installed faceplates',()=>{
 for(const file of ['asp-bare-pedestal-v3.svg','asp-bare-aft-overhead-v3.svg']){
  const svg=fs.readFileSync(path.join(__dirname,'assets',file),'utf8');
  assert(svg.includes('cx="702" cy="747" r="31"'));
 }
 assert.deepEqual([model.socket.x,model.socket.y],[702,747]);
 const source=fs.readFileSync(path.join(__dirname,'assets/asp-vbr-v1/vbr-selector-owner.png'));
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'019d6417dd99cadda3db4c21e8b9339d845ed8844c3cf1e3332acd7f85c5f066');
 assert.equal(source.readUInt32BE(16),1254);assert.equal(source.readUInt32BE(20),1254);
});
test('Small Silver skin changes only ASP toggle pictures and retains original physical runtime',()=>{
 const css=fs.readFileSync(path.join(__dirname,'asp-vbr-small-silver-v1.css'),'utf8');
 assert(css.includes('Small_Silver_5Positions.webp'));
 for(const detent of ['UP','CENTER','DOWN'])assert(css.includes('[data-detent="'+detent+'"]'));
 assert(!css.includes('guard-owner'));assert(!css.includes('irs-'));
 for(const name of ['index.html','overhead-stage.html']){
  const html=fs.readFileSync(path.join(__dirname,name),'utf8');
  assert(html.includes('asp-vbr-selector-v1.js?v=ASP-VBR-SILVER-0001'));
  assert(html.includes('asp-physical-controls-v1.js?v=ASP-PHYSICAL-0001'));
 }
});
