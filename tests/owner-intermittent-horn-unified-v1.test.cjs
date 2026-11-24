/* No synthetic audio is permitted. Test the actual owner-shipped MP4
 * and the Unified wiring / safety invariants before publishing Pages. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'audio/owner-intermittent-horn-clip-v1.js'),'utf8');
const encoded=source.match(/base64:\s*"([^"]+)"/)?.[1];
assert.ok(encoded,'missing owner-supplied aural warning sample');
const file=Buffer.from(encoded,'base64');
assert.equal(file.length,5338,'owner audio file must be complete, not truncated');
assert.equal(file.toString('ascii',4,8),'ftyp','asset must decode as MP4 audio');
let cursor=0,atoms=[];
while(cursor<file.length){
 assert.ok(cursor+8<=file.length,'incomplete MP4 atom header');
 const length=file.readUInt32BE(cursor),type=file.toString('ascii',cursor+4,cursor+8);
 assert.ok(length>=8&&cursor+length<=file.length,'invalid MP4 atom '+type);
 atoms.push(type);cursor+=length;
}
assert.equal(cursor,file.length,'MP4 atom table must cover entire owner clip');
for(const name of ['ftyp','mdat','moov'])assert.ok(atoms.includes(name),'missing MP4 box '+name);
const html=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/index.html'),'utf8');
const runtime=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/intermittent-horn-audio-unified-v1.js'),'utf8');
const isn=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
const controller=fs.readFileSync(path.join(root,'engine/integration/isn-electrical-pack-v1.js'),'utf8');
assert.ok(html.includes('owner-intermittent-horn-clip-v1.js'));
assert.ok(html.includes('intermittent-horn-audio-unified-v1.js'));
assert.ok(runtime.includes('node.loop=true'),'owner beep must repeat until condition clears');
assert.ok(runtime.includes('old.stop(now+.010)'),'horn must stop without waiting for file loop');
assert.ok(runtime.includes("a.id==='intermittentHorn'"),'must observe common ISN warning demand');
assert.ok(runtime.includes('B737ISNCockpitV1'),'no independent duplicate warning engine');
assert.ok(runtime.includes('b737:pressurization-state'),'cabin pressure state must resync');
assert.ok(runtime.includes('b737:flap-detent-visual-test'),'physical flap source must resync');
assert.ok(runtime.includes("brake.stops?.find(s=>s.key==='DOWN')"),'speedbrake DOWN must be the top detent');
assert.ok(isn.includes('getWarningSnapshot'),'cheap authoritative ISN snapshot must exist');
assert.ok(controller.includes("command.type === 'WARNING_SENSORS'"),'atomic sensor updates must exist');
const {WarningEngine}=require('../audio/warning-engine.js');
const common={onGround:true,takeoffThrust:true,flaps:0,leadingEdgeTakeoff:true,
 speedbrakeDown:true,parkingBrakeSet:false,stabilizerTrimTakeoff:true,cabinAltitudeFt:5000};
const engine=new WarningEngine({variant:'737-400'});
const audible=s=>engine.update({...common,...s}).active.filter(v=>v.id==='intermittentHorn').length;
assert.equal(audible({}),1,'invalid takeoff flaps should sound');
assert.equal(audible({flaps:5}),0,'valid takeoff must silence immediately');
assert.equal(audible({flaps:5,cabinAltitudeFt:12000}),1,'cabin altitude must sound');
engine.cutoutCabin();
assert.equal(audible({flaps:5,cabinAltitudeFt:12000}),0,'ALT HORN CUTOUT must silence cabin');
assert.equal(audible({flaps:0,cabinAltitudeFt:12000}),1,'cutout must not silence takeoff config');
assert.equal(audible({flaps:0,cabinAltitudeFt:12000}),1,'two simultaneous sources must use one horn');
assert.equal(audible({flaps:5,cabinAltitudeFt:9000}),0,'clearing all demands must stop immediately');
console.log('Owner intermittent horn: MP4 atoms, installation, one horn, cutout and immediate-clear checks passed');
