'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Profile=require('../aircraft-profile-v1.js');
const Install=require('../cdu-ident-installation-v1.js');
const Preflight=require('../../ch11/cdu-preflight-evidence-v1.js');
const profileDefaults=Profile.DEFAULTS;
test('CFM56-3 B1/B3/C1 map to 18.5K/20K/23.5K exactly',()=>{
 for(const [engine,rating,lbf] of [
  ['CFM56-3B1','18.5K',18500],['CFM56-3B3','20K',20000],['CFM56-3C1','23.5K',23500]
 ]){
  const p=Profile.resolve({...profileDefaults,engineVariant:engine});
  const s=Install.select(p.profile);
  assert.equal(s.engineRating,rating);assert.equal(s.ratingLbf,lbf);
  assert.equal(Preflight.identValue('ENG_RATING',{ENG_RATING:s.ENG_RATING}),rating);
  assert.equal(Install.verify(s),true);
  assert.equal(s.provenance,'USER_SELECTED_TRAINER_CONFIGURATION');
 }
});
test('IDENT MODEL shows exact 737-300/400/500 variant instead of ambiguous 300/500 family',()=>{
 for(const m of Install.MODELS){
  const family=m==='737-400'?'B737-400':'B737-300-500';
  const selected=Install.select({...profileDefaults,aircraftModel:m,aircraftFamily:family});
  assert.equal(Preflight.identValue('MODEL',{MODEL:selected.MODEL}),m);
  assert.equal(selected.aircraftFamily,family);
 }
});
test('Bad rating or forged model from an iframe is rejected',()=>{
 const original=Install.select(profileDefaults);
 assert.equal(Install.verify({...original,engineRating:'23.5K'}),false);
 assert.equal(Install.verify({...original,MODEL:{...original.MODEL,value:'737-400'}}),false);
 assert.equal(Install.verify({...original,provenance:'VERIFIED_AIRCRAFT_INSTALLATION'}),false);
 assert.throws(()=>Install.select({...profileDefaults,aircraftModel:'737-400'}),/INCONSISTENT/);
});
test('Existing saved family 400 migrates correctly and new engine choice persists',()=>{
 const storage=new Map([['b737classic.aircraft-profile.v1',JSON.stringify({
  schema:Profile.SCHEMA,aircraftFamily:'B737-400',pressurization:'CPCS',engineInstruments:'CONVENTIONAL'
 })]]);
 const io={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 const store=Profile.createStore({storage:io});
 assert.equal(store.get().aircraftModel,'737-400');
 store.set({engineVariant:'CFM56-3C1'});
 const restored=Profile.createStore({storage:io});
 assert.equal(restored.resolve().engineVariant.rating,'23.5K');
 assert.equal(restored.get().aircraftModel,'737-400');
 store.set({aircraftFamily:'B737-300-500'});
 assert.equal(store.get().aircraftModel,'737-300');
 store.set({aircraftModel:'737-500'});
 assert.equal(store.get().aircraftFamily,'B737-300-500');
});
test('Both CDU seats accept a live parent-profile message and retain it after reset',()=>{
 const js=read('panel-mosaic-lab/cockpit/cdu-ident-profile-receiver-v1.js');
 for(const seat of ['CAPT','FO']){
  let updates=0;
  const listeners=new Map(),messages=[],parent={postMessage:(msg)=>messages.push(msg)};
  const ctx={parent,location:{search:'?seat='+seat,origin:'https://example.test'},
   B737CDUIdentInstallationV1:Install,state:{preflightEvidence:{}},
   update(){updates++;},
   addEventListener:(name,fn)=>listeners.set(name,fn)};
  ctx.window=ctx;ctx.URLSearchParams=URLSearchParams;
  vm.runInNewContext(js,ctx,{timeout:1000});
  assert.equal(messages[0].seat,seat);
  const installed=Install.select({...profileDefaults,engineVariant:'CFM56-3C1',aircraftModel:'737-500'});
  listeners.get('message')({origin:ctx.location.origin,source:parent,
   data:{type:'b737:cdu-installation-v1',seat,installation:installed}});
  assert.equal(ctx.state.preflightEvidence.ENG_RATING.value,'23.5K');
  assert.equal(ctx.state.preflightEvidence.MODEL.value,'737-500');
  ctx.state={preflightEvidence:{}};
  ctx.update();assert.equal(ctx.state.preflightEvidence.ENG_RATING.value,'23.5K');
  const before=updates;
  listeners.get('message')({origin:'https://untrusted.test',source:parent,
   data:{type:'b737:cdu-installation-v1',seat,installation:Install.select(profileDefaults)}});
  assert.equal(updates,before);
 }
});
test('Parent broadcasts selected engine to both mounted CDUs on change and request',()=>{
 const js=read('panel-mosaic-lab/cockpit/cdu-ident-profile-bridge-v1.js');
 const profiles=[{...profileDefaults}],events=new Map(),sent=[],subscribers=[];
 const frames=Object.fromEntries(['CAPT','FO'].map(seat=>['cduFrame'+seat,{contentWindow:{
  postMessage:(msg,origin)=>sent.push({seat,msg,origin})
 }}]));
 const ctx={B737CDUIdentInstallationV1:Install,
  B737AircraftProfileStore:{get:()=>profiles[0],subscribe:cb=>subscribers.push(cb)},
  document:{getElementById:id=>frames[id]||null,addEventListener:(k,cb)=>events.set('document-'+k,cb)},
  location:{origin:'https://example.test'},addEventListener:(k,cb)=>events.set(k,cb),
  console:{error:()=>{}}};ctx.window=ctx;
 vm.runInNewContext(js,ctx,{timeout:1000});
 assert.equal(sent.length,2);
 profiles[0]={...profileDefaults,engineVariant:'CFM56-3B3'};
 subscribers[0]();
 assert.equal(sent.length,4);
 assert.equal(sent[2].msg.installation.engineRating,'20K');
 const fromFO=frames.cduFrameFO.contentWindow;
 events.get('message')({origin:ctx.location.origin,source:fromFO,
  data:{type:'b737:cdu-installation-request-v1',seat:'FO'}});
 assert.equal(sent.at(-1).seat,'FO');
 assert.equal(sent.at(-1).msg.installation.MODEL.value,'737-300');
});
test('Settings form and both iframe scripts are actually wired',()=>{
 const settings=read('panel-mosaic-lab/cockpit/index.html');
 const stage=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 const manifest=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json'));
 for(const value of ['CFM56-3B1','CFM56-3B3','CFM56-3C1','737-300','737-400','737-500'])
  assert.match(settings,new RegExp('value="'+value+'"'));
 assert.ok(settings.indexOf('cdu-ident-installation-v1.js')<settings.indexOf('cdu-ident-profile-bridge-v1.js'));
 assert.ok(stage.indexOf('cdu-ident-installation-v1.js')<stage.indexOf('cdu-ident-profile-receiver-v1.js'));
 for(const seat of ['CAPT','FO']){
  const item=manifest.embeddedInstruments.find(i=>i.seat===seat);
  assert.match(item.embeddedUrl,/ENGINE-IDENT-0001$/);
 }
});
