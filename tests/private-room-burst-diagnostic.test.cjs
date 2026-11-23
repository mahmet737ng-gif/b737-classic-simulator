'use strict';
const assert = require('node:assert/strict');
const {once} = require('node:events');
const {test} = require('node:test');
const {createCrewRoomServer, makeVerifier} = require('../sync-server/crew-rooms');

test('diagnostic: 100 rapid commands in a single rate-limit window cause explicit 429 and require client retry', async t => {
  const password = 'test-only-crew-pass';
  const ownerVerifier = await makeVerifier(password);
  const origin = 'http://127.0.0.1';
  const fixedTime = Date.now();
  const server = createCrewRoomServer({
    origin, database: ':memory:', ownerUsername: 'TrainerOwner', ownerVerifier,
    now: () => fixedTime, staticHandler: (req, res) => res.writeHead(404).end()
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const base = origin + ':' + server.address().port;
  let cookie = '';
  async function request(path, data) {
    const res = await fetch(base + '/api/crew/' + path, {
      method: 'POST',
      headers: {Origin: base, 'Content-Type': 'application/json', ...(cookie && {Cookie: cookie})},
      body: JSON.stringify(data)
    });
    const newCookie = res.headers.get('set-cookie')?.split(';', 1)[0];
    if (newCookie) cookie = newCookie;
    return {status: res.status, body: await res.json()};
  }
  assert.equal((await request('login', {username: 'TrainerOwner', password})).status, 200);
  const created = await request('create', {role: 'captain'});
  assert.equal(created.status, 200);
  const roomId = created.body.roomId;
  const counts = {accepted: 0, limited: 0, other: 0};
  for (let i = 0; i < 100; i++) {
    const result = await request('command', {
      roomId, client: 'captain-burst-diagnostic',
      command: {type: 'mcpValue', id: 'heading', value: i}
    });
    if (result.status === 200) counts.accepted++;
    else if (result.status === 429) counts.limited++;
    else counts.other++;
  }
  console.log('PRIVATE_ROOM_BURST_DIAGNOSTIC ' + JSON.stringify(counts));
  assert.deepEqual(counts, {accepted: 65, limited: 35, other: 0});
});
