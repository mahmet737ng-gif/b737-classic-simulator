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

test('native ASP: one capture owner, immediate release, single redraw, and immediate next tap',()=>{
 const vm=require('node:vm');
 const src=fs.readFileSync(path.join(__dirname,'asp-controls-v1.js'),'utf8');
 assert.match(src,/ASP_VOLUME_DRAG_START_PX=12/);
 assert.doesNotMatch(src,/suppressClickUntil=performance\.now\(\)\+450/,
  'No global post-gesture selection cooldown is permitted');
 const start=src.indexOf(' function wire(button){');
 const end=src.indexOf(' function sizeControls(host){',start);
 assert.ok(start>=0&&end>start,'Physical ASP handler present');
 const callbacks=new Map(),windowCallbacks=new Map(),frames=new Map();
 let nextFrame=1,selected=false,value=40,updates=0,allReleased=true;
 const button={
  dataset:{seat:'CAPT',kind:'volume',channel:'VHF-1'},
  captured:null,
  addEventListener(type,fn){if(!callbacks.has(type))callbacks.set(type,[]);callbacks.get(type).push(fn)},
  setPointerCapture(id){this.captured=id},
  hasPointerCapture(id){return this.captured===id},
  releasePointerCapture(id){if(this.captured===id)this.captured=null}
 };
 const root={
  addEventListener(type,fn){windowCallbacks.set(type,fn)},
  requestAnimationFrame(fn){const id=nextFrame++;frames.set(id,fn);return id},
  cancelAnimationFrame(id){frames.delete(id)}
 };
 const context={
  root,ASP_VOLUME_DRAG_START_PX:12,ASP_VOLUME_PIXELS_PER_PERCENT:7,
  state:{snapshot(){return {volume:value}}},
  preventPan(e){e.stopPropagation?.()},
  performance:{now:()=>1000},
  toggle(){selected=!selected},
  volume(_button,next){updates++;value=next;allReleased&&=(button.captured===null)}
 };
 const wire=require('node:vm').runInNewContext(src.slice(start,end)+'\nwire',context);
 wire(button);
 const fire=(kind,detail={})=>{
  const e={pointerId:1,pointerType:'touch',button:0,clientX:40,clientY:40,
   timeStamp:1000,cancelable:true,detail:1,
   preventDefault(){this.prevented=true},
   stopPropagation(){this.stopped=true},...detail};
  for(const fn of callbacks.get(kind)||[])fn(e);
  return e;
 };
 fire('pointerdown');
 assert.equal(button.captured,1);
 fire('pointermove',{clientX:60,clientY:40,timeStamp:1016});
 fire('pointermove',{clientX:79,clientY:40,timeStamp:1028});
 assert.equal(frames.size,1,'Many fast pointermoves must produce only one scheduled paint');
 assert.equal(updates,0,'No paint storm during fast knob movement');
 fire('pointerup',{clientX:79,clientY:40,timeStamp:1032});
 assert.equal(button.captured,null,'Release pointer synchronously on finger-up');
 assert.equal(button.dataset.aspGesture,'IDLE');
 assert.equal(frames.size,0,'No pending RAF work after finger-up');
 assert.equal(updates,1,'Commit exactly one final volume update');
 assert.equal(allReleased,true,'Backend must update AFTER pointer capture release');
 assert.ok(value>40);
 fire('click',{pointerId:1,timeStamp:1033});
 assert.equal(selected,false,'Ghost click after drag cannot toggle receiver');
 const afterDrag=value;
 fire('pointerdown',{pointerId:2,timeStamp:1034});
 fire('pointerup',{pointerId:2,timeStamp:1050});
 fire('click',{pointerId:2,timeStamp:1051});
 assert.equal(selected,true,'Immediate next tap still selects the receiver');
 assert.equal(value,afterDrag,'Tap never changes volume');
 fire('pointerdown',{pointerId:3,timeStamp:1060});
 fire('pointermove',{pointerId:3,clientX:47,clientY:46,timeStamp:1065});
 fire('pointerup',{pointerId:3,timeStamp:1075});
 fire('click',{pointerId:3,timeStamp:1076});
 assert.equal(selected,false,'Movement inside 12px dead-zone remains a tap');
 assert.equal(value,afterDrag,'Finger jitter cannot rotate a knob');
 fire('pointerdown',{pointerId:4,timeStamp:1080});
 fire('pointermove',{pointerId:4,clientX:80,timeStamp:1090});
 assert.equal(frames.size,1);
 fire('pointercancel',{pointerId:4,timeStamp:1092});
 assert.equal(button.captured,null);
 assert.equal(frames.size,0,'Cancellation drops pending volume work');
 assert.equal(value,afterDrag);
 fire('pointerdown',{pointerId:5,timeStamp:1100});
 windowCallbacks.get('blur')();
 assert.equal(button.captured,null,'Window blur must release any missing pointerup');
 assert.equal(button.dataset.aspGesture,'IDLE');
 fire('pointerdown',{pointerId:6,timeStamp:1110});
 fire('lostpointercapture',{pointerId:6,timeStamp:1112});
 assert.equal(button.dataset.aspGesture,'IDLE');
 assert.equal(frames.size,0);
});
