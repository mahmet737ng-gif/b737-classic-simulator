'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const {createCrewRoomServer, makeVerifier} = require('../sync-server/crew-rooms');

test('authoritative crew room keeps latest FO overhead detent across stale host snapshot and replay cap', async t => {
  const password = 'test-only-crew-pass';
  const server = createCrewRoomServer({origin:'http://127.0.0.1',database:':memory:',
    ownerUsername:'TrainerOwner',ownerVerifier:await makeVerifier(password),
    staticHandler:(req,res)=>res.writeHead(404).end()});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const root='http://127.0.0.1:'+server.address().port;
  function client() {
    let cookie='';
    return async (action, body={})=>{
      const res=await fetch(root+'/api/crew/'+action,{method:'POST',
        headers:{'Content-Type':'application/json',Origin:root,...(cookie?{Cookie:cookie}:{})},
        body:JSON.stringify(body)});
      const set=res.headers.get('set-cookie')?.split(';',1)[0];if(set)cookie=set;
      return {status:res.status,data:await res.json()};
    };
  }
  const c=client(),fo=client(),obs=client();
  assert.equal((await c('login',{username:'TrainerOwner',password})).status,200);
  for(const username of ['FOSync','ObserverSync'])assert.equal(
    (await c('accounts',{username,password})).status,201);
  assert.equal((await fo('login',{username:'FOSync',password})).status,200);
  assert.equal((await obs('login',{username:'ObserverSync',password})).status,200);
  const {data:{roomId,roomInvite}}=await c('create',{role:'captain'});
  assert.equal((await fo('join',{roomId,invite:roomInvite,role:'firstOfficer'})).status,200);
  assert.equal((await obs('join',{roomId,invite:roomInvite,role:'observer'})).status,200);
  const capClient='captain-state-qa',foClient='firstofficer-state-qa';
  const on={toggles:{'battery-master':'ON'},rotaries:{'ignition-source':'BOTH'},guards:{}};
  assert.equal((await c('snapshot',{roomId,client:capClient,overhead:on})).status,200);
  const changed=await fo('command',{roomId,client:foClient,
    command:{type:'toggle',id:'battery-master',value:'OFF'}});
  assert.equal(changed.status,200);
  const idempotent='fo-verified-req-001';
  const same={roomId,client:foClient,requestId:idempotent,
    command:{type:'toggle',id:'battery-master',value:'OFF'}};
  const once=await fo('command',same);
  const twice=await fo('command',same);
  assert.equal(once.status,200);
  assert.equal(twice.status,200);
  assert.equal(twice.data.duplicate,true);
  assert.equal(twice.data.sequence,once.data.sequence,
    'Lost HTTP responses must not re-execute physical controls');
  assert.equal((await fo('command',{...same,
    command:{type:'toggle',id:'battery-master',value:'ON'}})).status,409);
  assert.equal((await c('snapshot',{roomId,client:capClient,overhead:on})).status,200);
  let state=(await fo('cockpit',{roomId,client:foClient})).data.shared;
  assert.equal(state.overhead.toggles['battery-master'],'OFF',
    'Newer FO command must defeat stale host snapshot');
  assert.equal(state.overhead.rotaries['ignition-source'],'BOTH');
  assert.equal(state.sequence,once.data.sequence);
  const issued=await c('command',{roomId,client:capClient,
    command:{type:'loadFlight',id:'flight',value:{airport:'OIII',runway:'29L',preset:'FINAL_10'}}});
  assert.equal(issued.status,200);
  const generation=issued.data.sequence;
  const status=async()=> (await fo('cockpit',{roomId,client:foClient})).data.scenario;
  assert.deepEqual((await status()).config,{airport:'OIII',runway:'29L',preset:'FINAL_10'});
  assert.equal((await status()).ready,false);
  assert.equal((await c('scenarioStatus',{roomId,client:capClient,generation,complete:true,missing:[]})).status,200);
  assert.equal((await status()).ready,false,'Captain alone must not arm START');
  assert.equal((await fo('scenarioStatus',{roomId,client:foClient,generation,complete:false,missing:['FLAP_ACTUAL_30']})).status,200);
  assert.equal((await status()).ready,false,'A physical flap disagreement blocks READY');
  assert.equal((await c('command',{roomId,client:capClient,
    command:{type:'pauseFlight',id:'flight',value:false}})).status,409,
    'Neither crew member may START until physical checks pass');
  assert.deepEqual((await status()).reports.firstOfficer.missing,['FLAP_ACTUAL_30']);
  assert.equal((await fo('scenarioStatus',{roomId,client:foClient,generation,complete:true,missing:[]})).status,200);
  assert.equal((await status()).ready,true);
  assert.equal((await c('command',{roomId,client:capClient,
    command:{type:'pauseFlight',id:'flight',value:false}})).status,200,
    'START is accepted only after Captain and FO readiness');
  assert.equal((await obs('scenarioStatus',{roomId,client:'observer-state-qa',generation,complete:true,missing:[]})).status,403);
  assert.equal((await fo('scenarioStatus',{roomId,client:foClient,generation:generation-1,complete:true,missing:[]})).status,409);
  assert.equal((await fo('scenarioStatus',{roomId,client:foClient,generation,complete:true,missing:['NOT VALID']})).status,400);
  assert.equal((await fo('applied',{roomId,client:foClient,sequence:changed.data.sequence,status:'VERIFIED'})).status,200);
  assert.equal((await obs('applied',{roomId,client:'observer-state-qa',sequence:changed.data.sequence,status:'VERIFIED'})).status,403);
  assert.equal((await c('command',{roomId,client:capClient,
    command:{type:'stopFlight',id:'flight',value:true}})).status,200);
  assert.equal((await status()).active,false,'STOP clears the generation');
});
