'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Nav=require('../navdata-store.js');
const fixture={
 schema:'CDU_SG_CATALOG_V1',source_cycle:'UNSPECIFIED_IN_UPLOADED_FILES',
 reference_only:true,fmc_executable:false,airports:{}};
for(const icao of Nav.AIRPORTS){
 fixture.airports[icao]={airport:{icao,published_runways:['29L'],runways:[{
  runway:'29L',threshold_lat:35.7,threshold_lon:51.3}]},
  catalogs:{},procedures:{},local_fixes:[]};
 for(const k of Nav.KINDS){
  fixture.airports[icao].catalogs[k]={airport:icao,kind:k,cycle:Nav.CYCLE,
   fmc_executable:false,items:[{ident:'TEST1A',runways:['29L'],transitions:[],
    fmc_executable:false}]};
  fixture.airports[icao].procedures[k]=[{airport:icao,kind:k,ident:'TEST1A',
   fmc_executable:false,requires_runway_selection:true,
   requires_transition_selection:false,runway_options:['29L'],
   transition_options:[],transitions:[],variants:[{runway:'29L',refs:[
    {ident:'AAA',lat:35.7,lon:51.3,role:'ROUTE_POINT'},
    {ident:'BBB',lat:35.8,lon:51.4,role:'ROUTE_POINT'}]}]}];
 }
}
test('private import rejects missing airports / invalid cycle / executable source',()=>{
 assert.throws(()=>Nav.validate({...fixture,source_cycle:'2610'}),/INVALID/);
 assert.throws(()=>Nav.validate({...fixture,fmc_executable:true}),/INVALID/);
 assert.throws(()=>Nav.validate({...fixture,airports:{}}),/INVALID/);
});
test('authenticated private store serves published SID/STAR/APP and reference chords only',async()=>{
 let saved;const pool={query:async(sql,args)=>{
  if(sql.startsWith('CREATE TABLE'))return {rowCount:0};
  if(sql.startsWith('INSERT')){saved=JSON.parse(args[0]);return {rowCount:1};}
  return saved?{rowCount:1,rows:[{payload:saved}]}:{rowCount:0,rows:[]};
 }};
 const store=Nav.create(pool);await store.initialize();
 assert.equal((await store.lookup(new URL('http://localhost/api/source/status'))).status,503);
 await store.importData(fixture);
 assert.equal((await store.lookup(new URL('http://localhost/api/source/status'))).body.status,'SOURCE_CONNECTED_READ_ONLY');
 const cat=await store.lookup(new URL('http://localhost/api/cdu/catalog?airport=OIII&kind=SID'));
 assert.equal(cat.body.items[0].ident,'TEST1A');
 const proc=await store.lookup(new URL('http://localhost/api/cdu/procedure?airport=OIII&kind=SID&ident=TEST1A&runway=29L'));
 assert.equal(proc.body.variants.length,1);
 const geo=await store.lookup(new URL('http://localhost/api/sg/procedure.geojson?airport=OIII&kind=SID&ident=TEST1A&runway=29L'));
 assert.equal(geo.body.features.length,1);
 assert.deepEqual(geo.body.features[0].geometry.coordinates,[[51.3,35.7],[51.4,35.8]]);
 assert.equal(geo.body.features[0].properties.fmc_executable,false);
});
