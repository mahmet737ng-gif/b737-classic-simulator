'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),
path=require('node:path'),vm=require('node:vm');
const stage6=fs.readFileSync(path.join(__dirname,'../stage6-selector.js'),'utf8');
const core=require('../engine/cdu-engine.js');

function boot({connected=false,parent=true,host='mahmet737ng-gif.github.io'}={}){
 const state=core.makeState('RTE');
 const bridge={isConnected:()=>connected,request:()=>Promise.reject(Error('Synthetic bridge'))};
 const root={location:{hostname:host,origin:'https://mahmet737ng-gif.github.io'},
  NPE_STAGE5_MODEL:{validate(){throw Error('Never execute test route')}},
  CDU_PAGES:{RTE:{},DEP_ARR:{},DEPARTURES:{},ARRIVALS:{}},
  updateStage5View(){}};
 if(parent)root.parent={location:{origin:root.location.origin},B737NavBridgeV1:bridge};
 const context={window:root,state,core,fetch(){throw Error('Public localhost fetch before consent')}};
 vm.runInNewContext(stage6,context,{timeout:1000});
 return {root,state,bridge};
}

test('public embedded CDU never auto-connects and requires explicit owner consent',()=>{
 const {root}=boot();
 assert.equal(root.CDU_STAGE6_API,undefined);
 assert.equal(root.B737CDUAttachPublicNavDataV1(),false);
 assert.equal(root.CDU_STAGE6_API,undefined);
});
test('public isolated CDU never mounts private bridge even if host matches',()=>{
 const {root}=boot({connected:true,parent:false});
 assert.equal(root.CDU_STAGE6_API,undefined);
 assert.equal(root.B737CDUAttachPublicNavDataV1,undefined);
});
test('owner connects and disconnects only read-only selector without clearing route fields',()=>{
 const {root,state,bridge}=boot({connected:true});
 state.active.ORIGIN='OIII';
 assert.equal(root.B737CDUAttachPublicNavDataV1(),true);
 assert.equal(typeof root.CDU_STAGE6_API.beforeKey,'function');
 assert.equal(root.B737CDUAttachPublicNavDataV1(),true);
 assert.equal(state.active.ORIGIN,'OIII');
 state.stage6View={mode:'CATALOG',referenceOnly:true};
 state.page='DEPARTURES';
 assert.equal(root.B737CDUDetachPublicNavDataV1(),true);
 assert.equal(root.CDU_STAGE6_API,undefined);
 assert.equal(state.page,'DEP_ARR');
 assert.equal(state.active.ORIGIN,'OIII');
});
test('unexpected public origin never mounts a private connector',()=>{
 const {root}=boot({connected:true});
 root.parent.location.origin='https://attacker.example';
 assert.equal(root.B737CDUAttachPublicNavDataV1(),false);
 assert.equal(root.CDU_STAGE6_API,undefined);
});
const connector=fs.readFileSync(path.join(__dirname,'../../panel-mosaic-lab/cockpit/navdata-public-connect-v1.js'),'utf8');
test('public connector carries no embedded NAVDATA or persistent token storage',()=>{
 assert.match(connector,/X-B737-Nav-Token/);
 assert.match(connector,/credentials:'omit'/);
 assert.match(connector,/method:'GET'/);
 assert.match(connector,/read|READ ONLY|READ_ONLY/);
 assert.doesNotMatch(connector,/localStorage|sessionStorage|document\.cookie|IndexedDB|\.sqlite|\.zip/);
 assert.match(connector,/B737CDUDetachPublicNavDataV1/);
});

test('Chapter 11 reads exact private source names and selects SID, runway and transition as reference only',async()=>{
 const make=require('../stage6-selector.js');
 const pages=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/page-definitions.json'),'utf8')).pages;
 const state=core.makeState('DEP_ARR');
 state.active.ORIGIN='OIII';state.active.DEST='OIMM';state.chapter11RoutePages=true;
 const urls=[];
 const fetcher=async(url)=>{
  urls.push(url);
  if(url.includes('/catalog?')){
   return {ok:true,json:async()=>({
    airac:'2610',airport:'OIII',kind:'SID',fmc_executable:false,
    items:[{ident:'TEST1A',runways:['29R'],transitions:['TESTFIX'],
      status:'SOURCE_ONLY_NOT_FMC_EXECUTABLE'}]
   })};
  }
  if(url.includes('/navdata?kind=runways')){
   return {ok:true,json:async()=>({
    airac:'2610',mode:'SOURCE_REFERENCE_ONLY',fmc_executable:false,
    lookup:{has_more:false,rows:[{runway_ident:'29R'}]}
   })};
  }
  throw Error('No unsupported requests: '+url);
 };
 const api=make({validate(){throw Error('Must not execute simulator navigation')}},state,core,pages,fetcher,()=>{});
 assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(state.page,'DEPARTURES');
 assert.equal(state.stage6View.mode,'CATALOG');
 assert.equal(api.chapter11CatalogView().rows[0].valueL,'TEST1A');
 assert.equal(api.chapter11CatalogView().rows[0].valueR,'29R');
 assert.equal(api.chapter11CatalogView().rows.length,6);
 assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);
 assert.equal(state.stage6View.mode,'RUNWAY');
 assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);
 assert.equal(state.stage6View.mode,'TRANSITION');
 assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);
 assert.equal(state.navdataReferenceProcedures['SID@OIII'].ident,'TEST1A');
 assert.equal(state.navdataReferenceProcedures['SID@OIII'].runway,'29R');
 assert.equal(state.navdataReferenceProcedures['SID@OIII'].transition,'TESTFIX');
 assert.equal(state.navdataReferenceProcedures['SID@OIII'].fmc_executable,false);
 assert.equal(state.stage6PendingPlan,undefined);
 assert.equal(state.routeActivated,undefined);
 assert.equal(urls.length,2);
});
