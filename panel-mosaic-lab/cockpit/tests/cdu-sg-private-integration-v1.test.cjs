'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const routeAPI=require('../cdu-sg-route-state-v1.js');
const makeSelector=require('../../../cdu-standalone-v6/cdu-sg-selector-v1.js');
const converter=require('../../../engine/fmc/sg-source-geometry-v1.js');
const root=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const status='UNSPECIFIED_IN_UPLOADED_FILES';
const procedure={airport:'OIII',kind:'SID',ident:'DAXI1A',fmc_executable:false,
 requires_runway_selection:false,requires_transition_selection:false,
 runway_options:['29L','29R'],transition_options:[]};
const geo={type:'FeatureCollection',metadata:{airport:'OIII',kind:'SID',ident:'DAXI1A',
 airac:status,fmc_executable:false,selected_runway:'29L',selected_transition:null},
 features:[{type:'Feature',geometry:{type:'LineString',
 coordinates:[[50.905,35.445],[49.581,34.859]]},
 properties:{render_style:'dashed_reference_not_actual_flight_path',fmc_executable:false}}]};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('shared route revisions preserve the approved source-only classification',()=>{
 const a=routeAPI.create(),events=[];a.subscribe(s=>events.push(s.revision));
 a.setConnected(true);a.setContext({origin:'OIII',destination:'OIMM'});
 const selection=a.select({airport:'OIII',kind:'SID',ident:'DAXI1A',runway:'29L',procedure,geometry:geo});
 assert.equal(selection.selections['SID@OIII'].ident,'DAXI1A');
 assert.equal(selection.fmcExecutable,false);
 assert.equal(selection.cycle,status);
 assert.deepEqual(selection.geometries['SID@OIII'].segments[0],geo.features[0].geometry.coordinates);
 assert.throws(()=>a.select({airport:'OIII',kind:'SID',ident:'DAXI1A',runway:'29R',procedure,geometry:geo}),/MISMATCH/);
 a.setContext({origin:'OISS',destination:'OIMM'});
 assert.deepEqual(a.snapshot().selections,{});
 a.setConnected(false);assert.equal(a.snapshot().connected,false);
 assert.ok(events.length>=4);
});
test('only published source runways and procedure variants can be referenced',()=>{
 const a=routeAPI.create();a.setConnected(true);a.setContext({origin:'OIII',destination:'OIMM'});
 assert.throws(()=>a.chooseRunway({airport:'OIII',runway:'11R',
  airportRecord:{icao:'OIII',runways:[{runway:'29R'}]}}),/VERIFIED/);
 a.chooseRunway({airport:'OIII',runway:'29L',
  airportRecord:{icao:'OIII',runways:[{runway:'29L'}]}});
 assert.equal(a.snapshot().runways.OIII,'29L');
 assert.throws(()=>a.select({airport:'OISS',kind:'SID',ident:'DAXI1A',runway:'29L',procedure,geometry:geo}),/NOT ON ROUTE/);
});
test('CDU stages runway and SID on both seats, executes and erases independently',async()=>{
 const shared=routeAPI.create();shared.setConnected(true);
 const states=[{page:'DEP_ARR',scratch:'',routeActivated:true,active:{ORIGIN:'OIII',DEST:'OIMM'}},
  {page:'IDENT',scratch:'',routeActivated:true,active:{ORIGIN:'OIII',DEST:'OIMM'}}];
 let refreshes=0;
 const core={readValue:(s,k)=>s.active[k]||'',choose:(s,_p,p)=>{s.page=p;s.message='';}};
 const calls=[];
 const response=async url=>{
  calls.push(url);let body;
  if(url.startsWith('/api/cdu/catalog?'))body={airport:'OIII',kind:'SID',cycle:status,fmc_executable:false,
   items:[{ident:'DAXI1A',runways:['29L','29R'],transitions:[],fmc_executable:false}]};
  else if(url.startsWith('/api/cdu/airport?'))body={icao:'OIII',
   published_runways:['29L','29R'],runways:[{runway:'29L'},{runway:'29R'}]};
  else if(url.startsWith('/api/cdu/procedure?'))body={...procedure,segments:[{events:[
   {kind:'FIX_PASSAGE',reference_status:'LOCAL_FIX_COORDINATE_VERIFIED',fix:{ident:'RUS',lat:35.445,lon:50.905}},
   {kind:'FIX_PASSAGE',reference_status:'LOCAL_FIX_COORDINATE_VERIFIED',fix:{ident:'DAXIL',lat:34.859,lon:49.581}}
  ]}]};
  else throw Error('Unexpected URL '+url);
  return {ok:true,json:async()=>body};
 };
 const bridge={isConnected:()=>true,request:response};
 const pages={DEP_ARR:{},DEPARTURES:{},ARRIVALS:{},RTE:{}};
 const a=makeSelector(states[0],core,pages,bridge,shared,()=>refreshes++,converter);
 const b=makeSelector(states[1],core,pages,bridge,shared,()=>refreshes++,converter);
 a.attach();b.attach();
 assert.equal(a.beforeKey('CDU_CAPT_LSK_L1'),true);
 await tick();await tick();
 assert.equal(states[0].page,'DEPARTURES');
 assert.equal(a.chapter11CatalogView().rows.length,6);
 assert.equal(a.chapter11CatalogView().rows[0].valueL,'DAXI1A');
 assert.equal(a.beforeKey('CDU_CAPT_LSK_L1'),true);assert.equal(states[0].cduSgView.mode,'RUNWAY');
 assert.equal(a.beforeKey('CDU_CAPT_LSK_L1'),true);await tick();await tick();
 assert.equal(shared.snapshot().selections['SID@OIII'].runway,'29L');
 assert.ok(refreshes>=3);
 // FO sees the exact same shared revision with independent page and scratchpad.
 assert.equal(states[1].page,'IDENT');assert.equal(states[1].scratch,'');
 assert.equal(shared.snapshot().geometries['SID@OIII'].segments.length,1);
 assert.equal(a.chapter11CatalogView().rows[0].valueL,'DAXI1A <SEL>');
 assert.equal(a.execLit(),true);
 b.afterKey('EXEC');assert.equal(a.chapter11CatalogView().rows[0].valueL,'DAXI1A <ACT>');
 assert.equal(a.execLit(),false);
 a.beforeKey('LSK_R2');assert.equal(shared.snapshot().modified.runways['DEP@OIII'],'29R');
 assert.equal(a.chapter11CatalogView().rows[5].valueL,'<ERASE');
 a.beforeKey('LSK_L6');assert.equal(shared.snapshot().runways['DEP@OIII'],'29L');
 assert.equal(shared.snapshot().modified,null);
 assert.ok(calls.some(s=>s.includes('runway=29L')));
 assert.equal(shared.snapshot().fmcExecutable,false);
 a.detach();b.detach();
});
test('SG preview only draws valid references and removes them after source loss',()=>{
 const renderer=require('../cdu-sg-ehsi-preview-v1.js');
 const a=routeAPI.create();a.setConnected(true);a.setContext({origin:'OIII',destination:'OIMM'});
 a.select({airport:'OIII',kind:'SID',ident:'DAXI1A',runway:'29L',procedure,geometry:geo});
 assert.equal(renderer.collect(a.snapshot()).length,1);
 assert.equal(renderer.collect({...a.snapshot(),connected:false}).length,0);
});
test('EHSI PLAN and MAP show a distinct pending and executed reference',()=>{
 const renderer=require('../cdu-sg-ehsi-preview-v1.js');
 const route=routeAPI.create();route.setConnected(true);route.setContext({origin:'OIII'});
 route.select({airport:'OIII',kind:'SID',ident:'DAXI1A',runway:'29L',procedure,geometry:geo});
 const nodes=[];
 const make=tag=>({tag,attrs:{},appendChild(){},remove(){nodes.splice(0);},
  setAttribute(key,value){this.attrs[key]=value;}});
 const svg={id:'cpt',ownerDocument:{createElementNS(_ns,tag){const el=make(tag);nodes.push(el);return el;}},
  appendChild(){},querySelector(){return nodes.find(n=>n.attrs['data-cdu-sg-reference']);}};
 const status=()=>nodes.find(n=>n.attrs['data-cdu-sg-status'])?.textContent;
 const offset=(a,b)=>({x:b.lon-a.lon,y:b.lat-a.lat});
 const project=(x,y)=>[250+x,290-y];
 assert.equal(renderer.draw(svg,route.snapshot(),'PLAN',40,true,offset,project),1);
 assert.equal(status(),'MOD REF');
 route.execute();
 const anchor={lon:50.905,lat:35.445};
 assert.equal(renderer.draw(svg,route.snapshot(),'MAP',40,true,offset,project,anchor),1);
 assert.equal(status(),'ACT REF');
 assert.equal(renderer.draw(svg,route.snapshot(),'MAP',40,false,offset,project,anchor),0);
 assert.equal(status(),undefined);
 assert.equal(renderer.draw(svg,route.snapshot(),'MAP',40,true,offset,project),0);
});
test('public cockpit and both CDU views share one opt-in connector but no data package',()=>{
 const html=read('panel-mosaic-lab/cockpit/index.html');
 const stage=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 const app=read('cdu-standalone-v6/app.js');
 assert.match(html,/cdu-sg-route-state-v1\.js/);
 assert.match(html,/cdu-sg-public-connect-v1\.js/);
 assert.match(html,/cdu-sg-ehsi-preview-v1\.js/);
 assert.match(stage,/cdu-sg-selector-v1\.js/);
 assert.match(app,/CDU_SG_API\?\.beforeKey/);
 assert.match(app,/CDU_SG_API\?\.chapter11CatalogView/);
 assert.match(read('panel-mosaic-lab/cockpit/ehsi-unified-v1.js'),/B737CduSgEHSIPreviewV1/);
 const adapter=read('panel-mosaic-lab/cockpit/cdu-sg-public-connect-v1.js');
 assert.match(adapter,/UNIFIED_LOCAL_NAVDATA/);
 assert.doesNotMatch(adapter,/location\.(?:assign|replace)|fetch\(|up\.railway\.app/);
 assert.match(html,/unified-gateway-entry-v1/);
 assert.match(read('panel-mosaic-lab/cockpit/cdu-session.js'),/function notify/);
 assert.match(read('panel-mosaic-lab/cockpit/app.js'),/fmcSession.subscribe/);
});

