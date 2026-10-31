'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
class Event{constructor(type,{detail}={}){this.type=type;this.detail=detail;}}
function eventRoot(){const events=new Map();return {document:{readyState:'complete',addEventListener(){}},console,
 addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn);},
 dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event);},setInterval(){},events};}
test('nested avionics events batch once; same-turn reads flush latest state immediately',()=>{
 const w=eventRoot(),tasks=[];let reads=0,left=false;
 Object.assign(w,{B737AvionicsDataNetworkV1:require('../engine/runtime/avionics-data-network-v1.js'),
  B737AvionicsFmcComputerV1:require('../engine/integration/avionics-fmc-computer-v1.js'),queueMicrotask:fn=>tasks.push(fn),
  B737ISNCockpitV1:{getState:()=>{reads++;return {state:{electrical:{schema:'B737_ELECTRICAL_V7_RESULT',revision:1,bus:{dc1:true}}}};}},
  B737McpAFDSBridgeV1:{getOutput:()=>({schema:'B737_MCP_AFDS_OUTPUT_V1',power:null,powerEvidence:'UNVERIFIED',
   controls:{atArm:false,fd:{left,right:false}},values:{altitude:31000,speed:250,heading:123,verticalSpeed:0},modes:{lateral:null,vertical:null,thrust:null,autopilot:null}})}});
 vm.runInNewContext(fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/avionics-network-runtime-v1.js'),'utf8'),{window:w,CustomEvent:Event});
 const n=w.B737UnifiedAvionicsNetworkV1;reads=0;left=true;
 for(const type of ['b737:mcp-afds-state','b737:fmc-systems-state','b737:isn-start-indications'])w.dispatchEvent({type});
 assert.equal(tasks.length,1);assert.equal(reads,0);
 assert.equal(n.getSignal('afds.state').value.fdLeft,true);
 const after=reads;assert.ok(after>0);tasks.shift()();assert.equal(reads,after,'Getter already flushed the pending turn');
 left=false;w.dispatchEvent({type:'b737:mcp-afds-state'});tasks.shift()();assert.equal(n.getSignal('afds.state').value.fdLeft,false);
});
test('unchanged feed does not repaint CDU; real feed changes and ready/reload handshake always deliver',()=>{
 const w=eventRoot(),sent=[],frames={};for(const seat of ['CAPT','FO'])frames['cduFrame'+seat]={contentWindow:{postMessage:packet=>sent.push(packet)}};
 w.B737FmcSystemsV1=require('../engine/ch11/fmc-systems-network-v1.js');
 w.document.getElementById=id=>frames[id]||null;w.document.querySelector=()=>null;
 const origin='https://example.test';vm.runInNewContext(fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/fmc-systems-bridge-v1.js'),'utf8'),{window:w,document:w.document,location:{origin},performance:{now:()=>1000},CustomEvent:Event});
 assert.equal(sent.length,2);
 for(let i=0;i<100;i++)w.dispatchEvent(new Event('b737:mcp-afds-state',{detail:{power:null,controls:{atArm:false},modes:{}}}));
 assert.equal(sent.length,2);
 w.B737FmcSystemsBridgeV1.setVerifiedFeed('CDU_CAPT','PRESENT');assert.equal(sent.length,3);assert.equal(sent[2].feed,'PRESENT');
 const message={type:'message',origin,source:frames.cduFrameFO.contentWindow,data:{type:'b737:fmc-cdu-power-ready',seat:'FO'}};
 w.dispatchEvent(message);assert.equal(sent.length,4);assert.equal(sent[3].seat,'FO');
 w.dispatchEvent({...message,source:{}});assert.equal(sent.length,4,'Untrusted handshake must not trigger a resend');
});
