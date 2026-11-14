const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const model=require('./asp-controls-model-v1.js');

test('each press latches until the same control is pressed again, independently per station and function',()=>{
 const s=model.create();
 assert.equal(s.toggle('CAPT','mic','VHF-1').selected,true);
 s.setVolume('CAPT','VHF-1',70);
 assert.equal(s.snapshot('CAPT','mic','VHF-1').selected,true);
 assert.equal(s.snapshot('CAPT','volume','VHF-1').selected,false);
 assert.equal(s.snapshot('FO','mic','VHF-1').selected,false);
 assert.equal(s.toggle('CAPT','mic','VHF-2').selected,true);
 assert.equal(s.snapshot('CAPT','mic','VHF-1').selected,true);
 assert.equal(s.toggle('CAPT','mic','VHF-1').selected,false);
 assert.equal(s.snapshot('CAPT','mic','VHF-2').selected,true);
 assert.equal(s.toggle('OBS','volume','SPKR').selected,true);
 s.setVolume('OBS','SPKR',0);
 assert.equal(s.snapshot('OBS','volume','SPKR').selected,true);
 assert.equal(s.toggle('OBS','volume','SPKR').selected,false);
});

test('270-degree clockwise travel has hard stops at 45 degrees below either horizontal',()=>{
 const s=model.create();
 assert.equal(s.setVolume('FO','NAV-1',-100).angle,45);
 assert.equal(s.setVolume('FO','NAV-1',50).angle,180);
 assert.equal(s.setVolume('FO','NAV-1',500).angle,315);
 assert.equal(315-45,270);
 const min=45*Math.PI/180,max=315*Math.PI/180;
 // Downward source arrow rotated clockwise: left/down then right/down.
 assert.ok(-Math.sin(min)<0&&Math.cos(min)>0);
 assert.ok(-Math.sin(max)>0&&Math.cos(max)>0);
 assert.equal(s.snapshot('CAPT','volume','NAV-1').volume,0);
 assert.equal(model.angularDelta(179,-179),2);
 assert.equal(model.angularDelta(-179,179),-2);
 assert.throws(()=>s.toggle('CAPT','mic','made-up'),/Unknown/);
});

test('all 20 centers come directly from the installed bare panel in both locations',()=>{
 for(const file of ['asp-bare-pedestal-v3.svg','asp-bare-aft-overhead-v3.svg']){
  const svg=fs.readFileSync(path.join(__dirname,'assets',file),'utf8');
  assert.equal(model.sockets.length,20);
  for(const slot of model.sockets){
   if(slot.kind==='mic')assert.ok(svg.includes('x="'+(slot.x-50)+'" y="114" width="100" height="104"'),slot.channel);
   else assert.ok(svg.includes('cx="'+slot.x+'" cy="'+slot.y+'" r="45"'),slot.channel);
  }
 }
});

test('approved PNGs retain original full resolution, alpha and exact source bytes',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'asp-controls-v1.json'),'utf8'));
 for(const [name,info]of Object.entries(manifest.assets)){
  const b=fs.readFileSync(path.join(__dirname,'assets/asp-controls-v1',name));
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),info.sha256);
  assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);
  assert.equal(b[25],6,'RGBA PNG required');
 }
});
