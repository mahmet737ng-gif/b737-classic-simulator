'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Profile=require('../aircraft-profile-v1.js');
const Install=require('../cdu-ident-installation-v1.js');
const Preflight=require('../../ch11/cdu-preflight-evidence-v1.js');
test('737-300/500 family automatically selects 737-300 / 20K and 737-400 selects 737-400 / 22K',()=>{
 for(const [family,model,engine,rating,thrust] of [
  ['B737-300-500','737-300','CFM56-3B3','20K',20000],
  ['B737-400','737-400','CFM56-3B2','22K',22000]
 ]){
  const profile=Profile.resolve({...Profile.DEFAULTS,aircraftFamily:family,aircraftModel:'737-500',engineVariant:'CFM56-3C1'});
  const selected=Install.select(profile.profile);
  assert.equal(selected.aircraftModel,model);
  assert.equal(selected.engineVariant,engine);
  assert.equal(selected.engineRating,rating);
  assert.equal(selected.ratingLbf,thrust);
  assert.equal(selected.provenance,'FAMILY_DERIVED_TRAINER_CONFIGURATION');
  assert.equal(Preflight.identValue('ENG_RATING',{ENG_RATING:selected.ENG_RATING}),rating);
  assert.equal(Preflight.identValue('MODEL',{MODEL:selected.MODEL}),model);
  assert.equal(Install.verify(selected),true);
 }
});
test('Reject forged or manually selected engine ratings and 737-500 IDENT variant',()=>{
 const original=Install.select(Profile.DEFAULTS);
 assert.equal(Install.verify({...original,engineRating:'23.5K'}),false);
 assert.equal(Install.verify({...original,MODEL:{...original.MODEL,value:'737-400'}}),false);
 assert.equal(Install.verify({...original,provenance:'USER_SELECTED_TRAINER_CONFIGURATION'}),false);
 assert.throws(()=>Install.select({...Profile.DEFAULTS,aircraftModel:'737-400'}),/INCONSISTENT/);
 assert.throws(()=>Install.select({...Profile.DEFAULTS,engineVariant:'CFM56-3C1'}),/ENGINE_RATING/);
 assert.throws(()=>Install.select({...Profile.DEFAULTS,aircraftModel:'737-500'}),/737-300/);
});
test('Legacy persisted exact model and thrust are migrated to automatic family mapping',()=>{
 const storage=new Map([['b737classic.aircraft-profile.v1',JSON.stringify({
  schema:Profile.SCHEMA,aircraftFamily:'B737-400',aircraftModel:'737-500',
  engineVariant:'CFM56-3C1',pressurization:'CPCS',engineInstruments:'CONVENTIONAL'
 })]]);
 const io={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 const store=Profile.createStore({storage:io});
 assert.equal(store.get().aircraftModel,'737-400');
 assert.equal(store.resolve().engineVariant.rating,'22K');
 store.set({engineVariant:'CFM56-3C1'}); // programmatic attempts cannot override family.
 assert.equal(store.resolve().engineVariant.rating,'22K');
 store.set({aircraftFamily:'B737-300-500'});
 assert.equal(store.get().aircraftModel,'737-300');
 assert.equal(store.resolve().engineVariant.rating,'20K');
 store.set({aircraftModel:'737-500'});
 assert.equal(store.get().aircraftFamily,'B737-300-500');
 assert.equal(store.get().aircraftModel,'737-300');
});
test('Both CDU seats accept parent-profile installation and retain it after reset',()=>{
 const js=read('panel-mosaic-lab/cockpit/cdu-ident-profile-receiver-v1.js');
 for(const seat of ['CAPT','FO']){
  let updates=0;
  const listeners=new Map(),messages=[],parent={postMessage:msg=>messages.push(msg)};
  const ctx={parent,location:{search:'?seat='+seat,origin:'https://example.test'},
   B737CDUIdentInstallationV1:Install,state:{preflightEvidence:{}},
   update(){updates++;},addEventListener:(name,fn)=>listeners.set(name,fn)};
  ctx.window=ctx;ctx.URLSearchParams=URLSearchParams;
  vm.runInNewContext(js,ctx,{timeout:1000});
  assert.equal(messages[0].seat,seat);
  const installed=Install.select(Profile.resolve({...Profile.DEFAULTS,aircraftFamily:'B737-400'}).profile);
  listeners.get('message')({origin:ctx.location.origin,source:parent,
   data:{type:'b737:cdu-installation-v1',seat,installation:installed}});
  assert.equal(ctx.state.preflightEvidence.ENG_RATING.value,'22K');
  assert.equal(ctx.state.preflightEvidence.MODEL.value,'737-400');
  ctx.state={preflightEvidence:{}};ctx.update();
  assert.equal(ctx.state.preflightEvidence.ENG_RATING.value,'22K');
  const before=updates;
  listeners.get('message')({origin:'https://untrusted.test',source:parent,
   data:{type:'b737:cdu-installation-v1',seat,installation:Install.select(Profile.DEFAULTS)}});
  assert.equal(updates,before);
 }
});
test('Parent broadcasts family-derived IDENT installation to both mounted CDUs',()=>{
 const js=read('panel-mosaic-lab/cockpit/cdu-ident-profile-bridge-v1.js');
 const profiles=[{...Profile.DEFAULTS}],events=new Map(),sent=[],subscribers=[];
 const frames=Object.fromEntries(['CAPT','FO'].map(seat=>['cduFrame'+seat,{contentWindow:{
  postMessage:(msg,origin)=>sent.push({seat,msg,origin})}}]));
 const ctx={B737CDUIdentInstallationV1:Install,
  B737AircraftProfileStore:{get:()=>profiles[0],subscribe:cb=>subscribers.push(cb)},
  document:{getElementById:id=>frames[id]||null,addEventListener:(k,cb)=>events.set('document-'+k,cb)},
  location:{origin:'https://example.test'},addEventListener:(k,cb)=>events.set(k,cb),console:{error:()=>{}}};
 ctx.window=ctx;
 vm.runInNewContext(js,ctx,{timeout:1000});
 assert.equal(sent.length,2);
 profiles[0]=Profile.resolve({...Profile.DEFAULTS,aircraftFamily:'B737-400'}).profile;
 subscribers[0]();
 assert.equal(sent.length,4);
 assert.equal(sent[2].msg.installation.engineRating,'22K');
 assert.equal(sent[3].msg.installation.MODEL.value,'737-400');
 const fromFO=frames.cduFrameFO.contentWindow;
 events.get('message')({origin:ctx.location.origin,source:fromFO,
  data:{type:'b737:cdu-installation-request-v1',seat:'FO'}});
 assert.equal(sent.at(-1).seat,'FO');
});
test('Settings exposes only family selection; CDU script order remains valid',()=>{
 const settings=read('panel-mosaic-lab/cockpit/index.html');
 const stage=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 const manifest=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json'));
 for(const family of ['B737-300-500','B737-400'])
  assert.match(settings,new RegExp('value="'+family+'"'));
 for(const field of ['engineVariant','aircraftModel'])assert.doesNotMatch(settings,new RegExp('name="'+field+'"'));
 assert.ok(settings.indexOf('cdu-ident-installation-v1.js')<settings.indexOf('cdu-ident-profile-bridge-v1.js'));
 assert.ok(stage.indexOf('cdu-ident-installation-v1.js')<stage.indexOf('cdu-ident-profile-receiver-v1.js'));
 for(const seat of ['CAPT','FO']){
  const item=manifest.embeddedInstruments.find(i=>i.seat===seat);
  assert.ok(item.embeddedUrl.includes('ENGINE-IDENT-0001-AIRAC-2611-0001'));
 }
});
