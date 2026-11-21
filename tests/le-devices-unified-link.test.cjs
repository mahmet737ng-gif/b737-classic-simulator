const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const script=fs.readFileSync(path.resolve(__dirname,'../panel-mosaic-lab/cockpit/le-devices-live-link-v1.js'),'utf8');
function setup(){
 const listeners={},commands=[],lampPatches=[],needles=[];
 const contentWindow={postMessage:(payload,origin)=>commands.push({payload,origin})};
 const document={getElementById:(id)=>id==='overheadFrame'?{contentWindow}:null,
  addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn)};
 const window={addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn),
  B737FlapNeedles:{setCommon(v){needles.push(v);}},
  B737CockpitLights:{setInputs(p){lampPatches.push({...p});}}};
 const location={origin:'https://example.test'};
 vm.runInNewContext(script,{window,document,location,console},{filename:'link'});
 const signal=(event,detail)=>{for(const fn of listeners[event]||[])fn({detail});};
 const message=(kind,projection,origin=location.origin,source=contentWindow)=>{
  for(const fn of listeners.message||[])fn({origin,source,data:{type:'b737:cockpit-overhead',kind,projection}});
 };
 return {window,signal,message,commands,lampPatches,needles,contentWindow};
}
test('handle 15 -> 5 -> 1 -> UP synchronizes indicator and sends physical commands',()=>{
 const h=setup();
 h.message('ready');
 for(const d of [15,5,1,0])h.signal('b737:flap-detent-visual-test',{detent:d,visualOnly:true});
 assert.deepEqual(h.commands.map(x=>x.payload.command.value),[0,15,5,1,0]);
 assert.deepEqual(h.needles,[],'the lever must not drive measured needles instantly');
 assert.deepEqual(h.lampPatches.filter(p=>Object.hasOwn(p,'trailingFlaps')).map(p=>p.trailingFlaps),[15,5,1,0]);
 assert.equal(h.commands.every(x=>x.payload.action==='le-devices'&&x.origin==='https://example.test'),true);
});
test('panel projection controls both forward lamps using expected LE agreement',()=>{
 const h=setup();h.message('ready');
 h.signal('b737:flap-detent-visual-test',{detent:15,visualOnly:true});
 const base={revision:20,lever:15,mismatch:[],autoslatInhibit:false};
 h.message('le-devices-projection',{...base,center:{power:true,transit:true,extended:false}});
 assert.equal(h.lampPatches.at(-1).leadingEdge,'DISAGREE');
 h.message('le-devices-projection',{...base,revision:21,center:{power:true,transit:false,extended:true}});
 assert.equal(h.lampPatches.at(-1).leadingEdge,'FULL');
 h.signal('b737:flap-detent-visual-test',{detent:5,visualOnly:true});
 h.message('le-devices-projection',{...base,revision:22,lever:5,center:{power:true,transit:false,extended:true}});
 assert.equal(h.lampPatches.at(-1).leadingEdge,'INTERMEDIATE');
 h.message('le-devices-projection',{...base,revision:23,lever:5,center:{power:false,transit:false,extended:false}});
 assert.equal(h.lampPatches.at(-1).leCenterPowered,false);
});
test('reject unrelated iframe and stale projection',()=>{
 const h=setup();h.message('ready');h.signal('b737:flap-detent-visual-test',{detent:5,visualOnly:true});
 const p={revision:5,lever:5,mismatch:[],center:{power:true,transit:false,extended:true}};
 h.message('le-devices-projection',p,'https://malicious.example');
 assert.notEqual(h.lampPatches.at(-1).leadingEdge,'INTERMEDIATE');
 h.message('le-devices-projection',p);
 const length=h.lampPatches.length;
 h.message('le-devices-projection',{...p,revision:4});
 assert.equal(h.lampPatches.length,length);
 h.message('le-devices-projection',{...p,revision:6,lever:1},'https://example.test',{});
 assert.equal(h.lampPatches.length,length);
});

test('flap commands really originate on document, not window bubbling',()=>{
 const h=setup();h.message('ready');
 h.signal('b737:flap-ready',{position:5});
 assert.equal(h.commands.at(-1).payload.command.value,5);
 h.signal('b737:flap-detent-visual-test',{detent:15,visualOnly:true});
 assert.equal(h.commands.at(-1).payload.command.value,15);
 assert.equal(h.needles.length,0,'no immediate needle movement on commanded lever detent');
});

test('flap indicator remains on measured position during lever demand and follows gradual projections',()=>{
 const h=setup();h.message('ready');
 h.signal('b737:flap-detent-visual-test',{detent:1,visualOnly:true});
 assert.equal(h.needles.length,0,'needle must never jump to a new commanded detent');
 const base={revision:5,lever:1,mismatch:[],autoslatInhibit:false,
  center:{power:true,transit:true,extended:false}};
 h.message('le-devices-projection',{...base,tePosition:.25});
 assert.equal(h.needles.at(-1),.25);
 h.message('le-devices-projection',{...base,revision:6,tePosition:.5});
 assert.equal(h.needles.at(-1),.5);
 h.message('le-devices-projection',{...base,revision:7,tePosition:1,
  center:{power:true,transit:false,extended:true}});
 assert.equal(h.needles.at(-1),1);
 assert.equal(h.window.B737LEDevicesUnifiedLink.getState().actualTe,1);
});

test('up-to-40 initial intermediate stage uses center direct lamps, not the lever 40 shortcut',()=>{
 const h=setup();h.message('ready');
 h.signal('b737:flap-detent-visual-test',{detent:40,visualOnly:true});
 const s={lever:40,revision:40,leStage:'EXT',tePosition:1,
   center:{power:true,transit:false,extended:true},mismatch:[],autoslatInhibit:false};
 h.message('le-devices-projection',s);
 assert.equal(h.lampPatches.at(-1).leadingEdge,'INTERMEDIATE');
 assert.equal(h.lampPatches.at(-1).leDirectValid,true);
 assert.equal(h.lampPatches.at(-1).leDirectExtended,true);
 h.message('le-devices-projection',{...s,revision:41,leStage:'FULL',
   center:{power:true,transit:true,extended:false}});
 assert.equal(h.lampPatches.at(-1).leDirectTransit,true);
 assert.equal(h.lampPatches.at(-1).leDirectExtended,false);
});
