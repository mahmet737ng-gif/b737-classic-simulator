'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const isn=read('panel-mosaic-lab/cockpit/isn-cockpit.js');
const overhead=read('panel-mosaic-lab/cockpit/overhead-bridge.js');
test('ISN readiness waits for actual Overhead physical packet, never the optional APU startup preset',()=>{
 assert.match(isn,/startupSynchronized:\\(\\)=>liveGateway\\.initialized&&!!lastPhysicalPacket/);
 assert.doesNotMatch(isn,/startupSynchronized:()=>liveGateway\.initialized&&apuDefaultBootChecked/);
 assert.match(isn,/getStartupReadiness:()=>\(\{/);
 assert.match(isn,/ownerBatteryMounted:!!ownerElectricalGuards\(\)\['battery-master'\]/);
 assert.match(isn,/apuDefaultBootChecked,/);
 assert.match(isn,/lastPhysicalPacket=e\.data;\s+liveGateway\.synchronize\(mergeOwnerGuards\(e\.data\)\)/);
});
test('Overhead already supports a safe, non-mutating rebroadcast of its actual state',()=>{
 assert.match(overhead,/d\.action==='crew-sync-request'\)\{lastControlsPayload='';report\(\);return;/);
 assert.match(overhead,/send\(\{kind:'controls-state',\.\.\.controls,context:s\.context\}\)/);
 assert.match(isn,/action:'crew-sync-request'/);
 assert.match(isn,/source:'ISN_ECU_STARTUP_HANDSHAKE'/);
 assert.match(isn,/overheadSnapshotPoll=setInterval\(requestInitialOverheadSnapshot,750\)/);
});
test('lost initial postMessage triggers repeated requests until a genuine gateway synchronization',()=>{
 const start=isn.indexOf(' function requestInitialOverheadSnapshot(){');
 const end=isn.indexOf("\n window.addEventListener('message',e=>{",start);
 assert.ok(start>0&&end>start,'receiver must install actual snapshot requester');
 const functionSource=isn.slice(start,end);
 const sent=[];let stopped=[];
 const child={postMessage:(message,origin)=>sent.push({message,origin})};
 const bridge={initialized:false};
 const context={liveGateway:bridge,byId:()=>({contentWindow:child}),location:{origin:'https://sim.test'},
  clearInterval:id=>stopped.push(id)};
 vm.runInNewContext(`let overheadSnapshotPoll=99;
 let overheadSnapshotRequests=0; ${functionSource}
 this.request=requestInitialOverheadSnapshot;
 this.result=()=>({requests:overheadSnapshotRequests,poll:overheadSnapshotPoll});`,context);
 const f=context;
 f.request();f.request();
 assert.equal(sent.length,2);
 assert.deepEqual(Array.from(sent, ({message})=>message.action),['crew-sync-request','crew-sync-request']);
 assert.equal(sent[0].origin,'https://sim.test');
 assert.equal(f.result().requests,2);
 bridge.initialized=true;
 f.request();assert.equal(sent.length,2,'Stop when a genuine packet is accepted');
 assert.deepEqual(stopped,[99]);assert.equal(f.result().poll,null);
});
test('bootstrap handshake is set up after the Overhead event receiver rather than before it',()=>{
 const receiver=isn.indexOf("window.addEventListener('message',e=>{\n  if(e.origin!==location.origin||e.source!==byId('overheadFrame')");
 const trigger=isn.indexOf('overheadSnapshotPoll=setInterval(requestInitialOverheadSnapshot,750);');
 assert.ok(receiver>0&&trigger>receiver);
 assert.match(isn,/if\(overheadSnapshotPoll!==null\)\{clearInterval\(overheadSnapshotPoll\);overheadSnapshotPoll=null;\}/);
});
