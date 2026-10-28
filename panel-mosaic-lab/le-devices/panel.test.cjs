const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const crypto=require('node:crypto');
const dir=__dirname;
function runtime(){
 const events=[],listeners={};const parent={};
 const window={addEventListener(n,cb){listeners[n]=cb;},dispatchEvent(ev){events.push(ev);}};
 const document={currentScript:{src:'https://example.org/le-devices/panel.js'},readyState:'loading',addEventListener(){}};
 const CustomEvent=class{constructor(type,args){this.type=type;this.detail=args.detail;}};
 vm.runInNewContext(fs.readFileSync(path.join(dir,'panel.js'),'utf8'),{window,document,URL,CustomEvent,parent,location:{origin:'https://example.org'}});
 return {api:window.B737LeadingEdgeDevices,events,listeners,parent};
}
test('approved layout has six slats, four flaps and 26 independent windows',()=>{
 const {api}=runtime();assert.equal(api.devices.length,10);assert.equal(api.snapshot().windows,26);
 assert.equal(api.hasWindow('FLAP_1','EXT'),false);assert.equal(api.hasWindow('FLAP_1','FULL_EXT'),true);
 assert.equal(api.hasWindow('SLAT_6','EXT'),true);assert.equal(api.hasWindow('SLAT_7','EXT'),false);
 assert.equal(api.setWindow('FLAP_1','EXT',true),false);assert.equal(api.setDevice('SLAT_7','EXT'),false);
 for(const id of api.devices){assert.equal(api.setDevice(id,'TRANSIT'),true);assert.equal(api.setDevice(id,'RETRACTED'),true);}
});
test('momentary test restores device states and independent lamp overrides; global test remains independent',()=>{
 const {api,events}=runtime();api.setDevice('FLAP_1','FULL_EXT');api.setDevice('SLAT_1','EXT');api.setWindow('SLAT_2','FULL_EXT',true);
 const before=JSON.stringify({devices:api.snapshot().devices,overrides:api.snapshot().windowOverrides});
 api.setLampTest(true);assert.equal(api.snapshot().effectiveLampTest,true);
 api.setGlobalLampTest(true);api.setLampTest(false);
 assert.equal(api.snapshot().lampTest,false);assert.equal(api.snapshot().effectiveLampTest,true);
 api.setGlobalLampTest(false);assert.equal(api.snapshot().effectiveLampTest,false);
 assert.equal(JSON.stringify({devices:api.snapshot().devices,overrides:api.snapshot().windowOverrides}),before);
 assert.ok(events.some(x=>x.type==='b737:le-devices-lamp-test'&&x.detail.pressed&&x.detail.windows===26));
});
test('global test accepts only same-origin parent commands and restores local selection',()=>{
 const {api,listeners,parent}=runtime();api.setWindow('SLAT_4','EXT',true);
 const command={source:parent,origin:'https://example.org',data:{type:'b737:cockpit-command',action:'visual-test',active:true}};
 listeners.message({...command,origin:'https://untrusted.example'});assert.equal(api.snapshot().globalLampTest,false);
 listeners.message({...command,source:{}});assert.equal(api.snapshot().globalLampTest,false);
 listeners.message(command);assert.equal(api.snapshot().globalLampTest,true);
 listeners.message({...command,data:{...command.data,active:false}});assert.equal(api.snapshot().globalLampTest,false);
 assert.equal(api.snapshot().windowOverrides['SLAT_4|EXT'],true);
});
test('approved PNG bytes, exact aperture polygons and physical plate registration are retained',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
 const positions=JSON.parse(fs.readFileSync(path.join(dir,'panel-owner-positions-v6.json')));
 const bytes=fs.readFileSync(path.join(dir,manifest.background));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.qa.imageSha256);
 assert.equal(manifest.windowCount,26);assert.equal(manifest.windows.length,26);
 assert.equal(new Set(manifest.windows.map(w=>w.id)).size,26);
 assert.equal(manifest.windows.filter(w=>w.color==='AMBER').length,10);
 assert.equal(manifest.windows.filter(w=>w.color==='GREEN').length,16);
 for(const c of positions.indicators){
  const id='LE_'+c.id.replace(/^(FLAP_\d+)_EXT$/,'$1_FULL_EXT');
  const m=manifest.windows.find(w=>w.id===id);assert.ok(m,id);assert.deepEqual(m.polygon,c.polygon_px);
 }
 const {api}=runtime();assert.deepEqual(JSON.parse(JSON.stringify(api.snapshot().placement.nativePanelRect)),{x:3,y:540,w:383,h:188,sourceWidth:1731,sourceHeight:909});
 const js=fs.readFileSync(path.join(dir,'panel.js'),'utf8');assert.ok(js.includes('panel-owner-restored-v6.png?v=LEDEV-0006'));
 assert.ok(js.includes("new URL('recessed-test-button.svg?v=LEDEV-0006'"));
 assert.ok(js.includes("['pointerup','pointercancel','lostpointercapture']"));assert.ok(js.includes("test.addEventListener('blur'"));
 assert.ok(!js.includes("stroke:'#fafafa'"),'fixed white artwork must not be redrawn by lamp masks');
});
