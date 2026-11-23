'use strict';

const assert = require('node:assert/strict');
const {once} = require('node:events');
const {createReadStream,readFileSync} = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {createCrewRoomServer, makeVerifier} = require('../sync-server/crew-rooms');

const password = 'test-only-crew-pass';
const prefix = '/api/crew';

function fixture(req, res) {
  const cockpit = path.resolve(__dirname, '../panel-mosaic-lab/cockpit');
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname === '/crew/') {
    const source = readFileSync(path.join(cockpit, 'index.html'), 'utf8');
    const dialog = source.match(/<dialog id="crewRoomDialog"[^>]*>[\s\S]*?<\/dialog>/)[0];
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('<!doctype html><meta charset="utf-8"><title>Unified Crew Room</title><link rel="stylesheet" href="/crew/crew-room-v1.css">' +
      '<script src="/crew/crew-room-v1.js" defer></script><body data-crew-entry data-crew-page>' +
      dialog.replace(/^<dialog/, '<main').replace(/<\/dialog>$/, '</main>') + '</body>');
    return;
  }
  if (pathname === '/panel-mosaic-lab/cockpit/crew-overhead-test.html') {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(`<!doctype html><button id="battery">Battery master</button><script>
      window.switchState = {'battery-master':'OFF'};
      const report=()=>parent.postMessage({type:'b737:cockpit-overhead',
        kind:'controls-state',toggles:{...window.switchState},rotaries:{},guards:{}},location.origin);
      window.B737CrewOverheadV1 = {
        ready: () => true,
        snapshot:()=>({toggles:{...window.switchState},rotaries:{},guards:{}}),
        apply(type,id,value) {
          if(type !== 'toggle' || id !== 'battery-master') return false;
          window.switchState[id] = value;
          report();
          return true;
        }
      };
      window.addEventListener('message',event=>{
        if(event.origin===location.origin&&event.source===parent&&
          event.data?.action==='crew-sync-request') report();
      });
      setTimeout(()=>parent.postMessage({type:'b737:cockpit-overhead',kind:'ready'},location.origin),0);
      document.getElementById('battery').onclick = () => {
        const next = window.switchState['battery-master'] === 'ON' ? 'OFF' : 'ON';
        window.switchState['battery-master'] = next;
        parent.postMessage({type:'b737:cockpit-overhead',kind:'control-event',
          event:{kind:'toggle',id:'battery-master',next}},location.origin);
        report();
      };
    <\/script>`);
    return;
  }
  const file = pathname === '/crew/qrcode.js' ? 'qrcode-generator-2.0.4.js' :
    pathname.endsWith('/') ? 'index.html' : path.basename(pathname);
  const type = {'index.html': 'text/html', 'qrcode-generator-2.0.4.js': 'text/javascript', 'crew-cockpit-v1.js': 'text/javascript', 'crew-room-v1.js': 'text/javascript', 'crew-room-v1.css': 'text/css'}[file];
  if (!type) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader('Content-Type', type);
  if(pathname==='/panel-mosaic-lab/unified/'){
    res.end(`<!doctype html><header class="unified-minimal-header"><div class="header-settings">
      <button id="workspaceLabsToggle">Test Labs</button></div></header>
      <button id="pilotControl">Rotate heading</button><button id="phase">Load flight</button>
      <button id="zoomIn">Zoom</button>
      <iframe id="overheadFrame" src="/panel-mosaic-lab/cockpit/crew-overhead-test.html"></iframe>
      <script>
      window.calls=[];let sample=null,paused=false;
      window.B737McpVisualV3={setValue:(id,value)=>calls.push([id,value])};
      window.B737UnifiedFlightScenarioV1={
        loadScenario(value){calls.push(['load',value.preset]);},
        crewFollower(){},
        followCrew(value,next){calls.push(['flight',value.altitudeFt]);sample=value;paused=next;},
        getDiagnostics(){return {paused};},getState(){return sample;}
      };
      document.getElementById('pilotControl').onclick=()=>{
        calls.push(['heading',35]);
        dispatchEvent(new CustomEvent('b737:mcp-value-change',{detail:{control:'heading',value:35}}));
      };
      document.getElementById('phase').onclick=()=>{
        dispatchEvent(new CustomEvent('b737:crew-flight-command',{detail:{type:'loadFlight',value:{preset:'FINAL_10'}}}));
        setTimeout(()=>dispatchEvent(new CustomEvent('b737:flight-scenario-state',{detail:{target:{},altitudeFt:6820,iasKt:142}})),250);
      };
      document.getElementById('zoomIn').onclick=()=>calls.push(['zoom']);
      </script>
      <script src="/panel-mosaic-lab/cockpit/crew-cockpit-v1.js" defer></script>`);
    return;
  }
  const relative = file === 'qrcode-generator-2.0.4.js' ? 'vendor/' + file : file;
  createReadStream(path.join(cockpit, relative)).pipe(res);
}

async function start(t, auth = {}) {
  // Node's test/browser clients connect to loopback only. The production
  // server checks this Origin against its configured public HTTPS origin.
  const origin = 'http://127.0.0.1';
  const ownerVerifier = await makeVerifier(password);
  const server = createCrewRoomServer({origin, database: ':memory:', ownerUsername: 'TrainerOwner', ownerVerifier,
    staticHandler: fixture, ...auth});
  const listen = once(server.listen(0, '127.0.0.1'), 'listening');
  await listen;
  t.after(() => {
    server.closeAllConnections();
    return new Promise(resolve => server.close(resolve));
  });
  return {origin: origin + ':' + server.address().port};
}

function client(origin) {
  let cookie = '';
  return async (name, body) => {
    const response = await fetch(origin + prefix + (name ? '/' + name : ''), {
      method: body ? 'POST' : 'GET',
      headers: {Cookie: cookie, ...(body ? {Origin: origin, 'Content-Type': 'application/json'} : {})},
      body: body ? JSON.stringify(body) : undefined
    });
    const returnedCookie = response.headers.get('set-cookie')?.split(';', 1)[0];
    if (returnedCookie) cookie = returnedCookie;
    return {status: response.status, data: await response.json(), cookie};
  };
}

test('crew authorization, exclusive seats and reusable observer invitations', async t => {
  const {origin} = await start(t);
  const owner = client(origin);
  const firstOfficer = client(origin);
  const observerOne = client(origin);
  const observerTwo = client(origin);
  assert.equal((await owner('create', {})).status, 401);
  assert.equal((await owner('login', {username: 'TrainerOwner', password})).status, 200);
  const {data: {roomId}} = await owner('create', {});
  assert.equal((await owner('invite', {roomId, role: 'firstOfficer', username: 'Partner1'})).status, 400);
  const {data: {invite: observerInvite}} = await owner('invite', {roomId, role: 'observer'});
  assert.equal((await owner('invite', {roomId, role: 'observer'})).data.invite, observerInvite);
  assert.equal((await firstOfficer('login', {username: 'Partner1', password})).status, 401);
  assert.equal((await firstOfficer('activate', {username: 'Partner1', password, invite: observerInvite})).status, 401);
  for (const [guest, username] of [[firstOfficer, 'Partner1'], [observerOne, 'Observer1'], [observerTwo, 'Observer2']]) {
    assert.equal((await owner('accounts', {username, password})).status, 201);
    assert.equal((await guest('login', {username, password})).status, 200);
  }
  const {data: {invite: firstOfficerInvite}} = await owner('invite', {roomId, role: 'firstOfficer', username: 'Partner1'});
  assert.equal((await owner('accounts', {username: 'partner1', password})).status, 409);
  assert.equal((await firstOfficer('accounts', {username: 'NoSeat', password})).status, 403);
  assert.equal((await observerOne('invite', {roomId, role: 'instructor', invite: observerInvite})).status, 403);
  assert.equal((await observerOne('join', {roomId, role: 'instructor', invite: firstOfficerInvite})).status, 403);
  const seats = await Promise.all([
    owner('join', {roomId, role: 'firstOfficer'}),
    firstOfficer('join', {roomId, role: 'instructor', invite: firstOfficerInvite})
  ]);
  assert.deepEqual(seats.map(seat => seat.status).sort(), [200, 409]);
  assert.equal(seats.find(seat => seat.status === 200).data.role, 'firstOfficer');
  const observers = await Promise.all([
    observerOne('join', {roomId, role: 'captain', invite: observerInvite}),
    observerTwo('join', {roomId, role: 'instructor', invite: observerInvite})
  ]);
  assert.ok(observers.every(join => join.status === 200 && join.data.role === 'observer'));
  assert.equal((await observerOne('command', {roomId, client: 'observer-client', command: {
    type: 'mcpValue', id: 'heading', value: 90
  }})).status, 403);
  assert.equal((await observerOne('assignFlying', {roomId, role: 'firstOfficer'})).status, 403);
  assert.equal((await owner('assignFlying', {roomId, role: 'firstOfficer'})).data.flying, 'firstOfficer');
  const result = await owner('inspect', {roomId});
  assert.equal(result.data.reserved.firstOfficer, 1);
  assert.equal(result.data.reserved.observer, 2);
  const unauthorizedStream = await fetch(origin + prefix + '/events?room=' + roomId);
  assert.equal(unauthorizedStream.status, 401);
  await unauthorizedStream.text();
  await firstOfficer('logout', {});
  assert.equal((await firstOfficer('login', {username: 'Partner1', password})).status, 200);
});

test('room-wide invitation accepts guest-selected roles and enforces occupied seats', async t => {
  const {origin} = await start(t);
  const owner = client(origin);
  const guest = client(origin);
  await owner('login', {username: 'TrainerOwner', password});
  await owner('accounts', {username: 'GuestOne', password});
  const hosted = await owner('create', {role: 'captain'});
  assert.equal(hosted.data.role, 'captain');
  const {roomId, roomInvite: invite} = hosted.data;
  assert.match(invite, /^[A-Za-z0-9_-]{32}$/);
  assert.equal((await owner()).data.hostedRoom.roomInvite, invite);
  assert.equal((await guest('join', {roomId, role: 'firstOfficer', invite})).status, 401);
  await guest('login', {username: 'GuestOne', password});
  assert.equal((await guest('join', {roomId, role: 'firstOfficer'})).status, 404);
  const preview = await guest('inspect', {invite});
  assert.equal(preview.data.invitedRole, null);
  assert.equal(preview.data.roomInvite, undefined);
  assert.equal((await guest('join', {roomId, role: 'captain', invite})).status, 409);
  assert.equal((await guest('join', {roomId, role: 'firstOfficer', invite})).data.role, 'firstOfficer');
  const switched = await owner('create', {role: 'instructor'});
  assert.equal(switched.data.role, 'instructor');
  assert.equal(switched.data.roomInvite, invite);
  const secondRoom = await guest('create', {role: 'captain'});
  assert.equal(secondRoom.status, 200);
  assert.equal(secondRoom.data.manager, true);
  assert.notEqual(secondRoom.data.roomId, roomId);
  assert.notEqual(secondRoom.data.roomInvite, invite);
  assert.equal((await guest()).data.hostedRoom.roomId, secondRoom.data.roomId);
  assert.equal((await owner()).data.hostedRoom.roomId, roomId);
  assert.equal((await owner('inspect', {roomId: secondRoom.data.roomId})).status, 404);
});

test('host aircraft configuration and overhead state are authoritative for late joiners', async t => {
  const {origin} = await start(t);
  const host = client(origin);
  const guest = client(origin);
  await host('login', {username: 'TrainerOwner', password});
  await host('accounts', {username: 'ShayanTest', password});
  await guest('login', {username: 'ShayanTest', password});
  const profile = {
    schema: 'b737-classic-aircraft-profile/1', aircraftFamily: 'B737-400',
    aircraftModel: '737-400', engineVariant: 'CFM56-3B2',
    pressurization: 'CPCS', engineInstruments: 'CONVENTIONAL'
  };
  const created = await host('create', {role: 'captain', profile});
  assert.equal(created.status, 200);
  assert.deepEqual(created.data.profile, profile);
  const {roomId, roomInvite: invite} = created.data;
  const viewed = await guest('inspect', {roomId, invite});
  assert.deepEqual(viewed.data.profile, profile);
  const joined = await guest('join', {roomId, role: 'firstOfficer', invite});
  assert.deepEqual(joined.data.profile, profile);

  const overhead = {
    toggles: {'battery-master': 'ON', 'fuel-boost-left-aft': 'OFF'},
    rotaries: {'ignition-source': 'BOTH'},
    guards: {'passenger-oxygen': {guard: 'closed', value: 'NORMAL'}}
  };
  assert.equal((await guest('snapshot', {roomId, client: 'shayan-test-client', overhead})).status, 403);
  assert.equal((await host('snapshot', {roomId, client: 'owner-test-client', overhead})).status, 200);
  const stream = new AbortController();
  const cancel = setTimeout(() => stream.abort(), 3000);
  try {
    const response = await fetch(origin + prefix + '/events?room=' + roomId + '&cockpit=1', {
      headers: {Cookie: joined.cookie}, signal: stream.signal
    });
    assert.equal(response.status, 200);
    const chunks = [];
    const reader = response.body.getReader();
    while (!chunks.join('').includes('event: snapshot')) {
      const {value, done} = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value).toString('utf8'));
    }
    const result = chunks.join('');
    assert.match(result, /event: snapshot/);
    assert.match(result, /"battery-master":"ON"/);
    assert.match(result, /"sequence":0/);
  } finally {
    clearTimeout(cancel);
    stream.abort();
  }
  const updated = {...profile, aircraftFamily: 'B737-300-500',
    aircraftModel: '737-300', engineVariant: 'CFM56-3B3', pressurization: 'DCPCS', engineInstruments: 'EIS'};
  assert.equal((await host('command', {roomId, client: 'owner-test-client',
    command: {type: 'profile', id: 'aircraft', value: updated}})).status, 200);
  assert.deepEqual((await guest('inspect', {roomId, invite})).data.profile, updated);
});

test('room-wide invitations survive a fresh server and still expire', async t => {
  const {createHash} = require('node:crypto');
  const records = [];
  let time = Date.now();
  const roomStore = {
    async findHostedRoom(manager, at) {
      return records.find(record => record.manager === manager && record.expires > at);
    },
    async findInvitedRoom(hash, at) {
      return records.find(record => record.expires > at &&
        createHash('sha256').update(record.invitation).digest('hex') === hash);
    },
    async createRoom(record, hash, at) {
      const existing = await this.findHostedRoom(record.manager, at);
      if (existing) return existing;
      records.push(record);
      return record;
    }
  };
  const options = {roomStore, now: () => time};
  const first = await start(t, options);
  const host = client(first.origin);
  await host('login', {username: 'TrainerOwner', password});
  const hosted = await host('create', {role: 'captain'});
  assert.equal(hosted.status, 200);
  const {roomId, roomInvite: invite} = hosted.data;

  const second = await start(t, options);
  const guest = client(second.origin);
  const viewed = await guest('inspect', {invite});
  assert.equal(viewed.status, 200);
  assert.equal(viewed.data.roomId, roomId);
  assert.equal(viewed.data.roomInvite, undefined);
  const returningHost = client(second.origin);
  await returningHost('login', {username: 'TrainerOwner', password});
  assert.equal((await returningHost()).data.hostedRoom.roomInvite, invite);
  assert.equal((await returningHost('create', {role: 'captain'})).data.roomId, roomId);
  await returningHost('accounts', {username: 'GuestOne', password});
  await guest('login', {username: 'GuestOne', password});
  assert.equal((await guest('join', {invite, role: 'firstOfficer'})).data.roomId, roomId);
  time += 12 * 60 * 60 * 1000 + 1;
  assert.equal((await guest('inspect', {invite})).status, 404);
});

test('late-joiner receives earlier MCP state and live Overhead updates after host snapshot', async t => {
  const {origin} = await start(t);
  const host = client(origin);
  const guest = client(origin);
  await host('login', {username: 'TrainerOwner', password});
  await host('accounts', {username: 'GuestSync', password});
  await guest('login', {username: 'GuestSync', password});
  const hosted = await host('create', {role: 'captain'});
  const roomId = hosted.data.roomId;
  const joined = await guest('join', {roomId, role: 'firstOfficer', invite: hosted.data.roomInvite});
  assert.equal(joined.status, 200);
  const first = await host('command', {roomId, client: 'captain-sync-01',
    command: {type: 'mcpValue', id: 'heading', value: 137}});
  assert.equal(first.status, 200);
  const saved = await host('snapshot', {roomId, client: 'captain-sync-01', overhead: {
    toggles: {'battery-master': 'ON'}, rotaries: {}, guards: {}
  }});
  assert.equal(saved.status, 200);
  const second = await host('command', {roomId, client: 'captain-sync-01',
    command: {type: 'toggle', id: 'battery-master', value: 'OFF'}});
  assert.equal(second.status, 200);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);
  try {
    const response = await fetch(origin + prefix + '/events?room=' + roomId + '&cockpit=1',
      {headers: {Cookie: joined.cookie}, signal: abort.signal});
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    let body = '';
    while (!body.includes('"value":"OFF"')) {
      const {value, done} = await reader.read();
      if (done) break;
      body += Buffer.from(value).toString('utf8');
    }
    const mcpAt = body.indexOf('"type":"mcpValue"');
    const snapshotAt = body.indexOf('event: snapshot');
    const toggleAt = body.indexOf('"value":"OFF"');
    assert.ok(mcpAt >= 0 && snapshotAt > mcpAt && toggleAt > snapshotAt,
      'MCP replay must precede Overhead snapshot and newer switch events');
  } finally {
    clearTimeout(timer);
    abort.abort();
  }
});

test('Private Room opens after Welcome and admits signed-in and signed-out guests', {skip: !process.env.CHROME_PATH}, async t => {
  const {chromium} = require('playwright');
  const {origin} = await start(t);
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH});
  t.after(() => browser.close());

  async function credentials(page, username) {
    await page.getByLabel('Username', {exact: true}).fill(username);
    await page.getByLabel('Password', {exact: true}).fill(password);
  }
  async function signIn(page, username) {
    await credentials(page, username);
    await page.getByRole('button', {name: 'Sign In', exact: true}).click();
    await page.getByText('Signed in as ' + username, {exact: true}).waitFor();
  }
  async function count(page, role, value) {
    await page.waitForFunction(([role, value]) =>
      document.querySelector('[data-crew-count="' + role + '"]').textContent === value, [role, value]);
  }

  const admin = client(origin);
  await admin('login', {username: 'TrainerOwner', password});
  assert.equal((await admin('accounts', {username: 'ShayanTest', password})).status, 201);
  const host = await browser.newPage({viewport: {width: 1440, height: 900}});
  const cockpit = origin + '/panel-mosaic-lab/cockpit/';
  await host.goto(cockpit + '?welcomeTest=1');
  assert.equal(await host.locator('#unifiedWelcome [data-crew-open]').count(), 0);
  await host.goto(cockpit);
  await host.getByRole('button', {name: 'Private Room', exact: true}).click();
  await host.waitForURL(origin + '/crew/');
  await signIn(host, 'ShayanTest');
  assert.equal(await host.getByRole('button', {name: 'Create Guest Account'}).isVisible(), false);
  await host.getByLabel('Your Role').selectOption('captain');
  await count(host, 'captain', '1 / 1');
  const linkField = host.getByLabel('Invitation Link');
  await host.getByRole('img', {name: 'Private room invitation QR code'}).waitFor();
  const url = await linkField.inputValue();
  const invite = new URL(url);
  assert.equal(invite.pathname, '/crew/');
  assert.match(invite.hash, /^#crew=[A-Za-z0-9_-]{32}$/);
  await host.getByRole('button', {name: 'Copy Link', exact: true}).click();
  await host.getByText(/Invitation link (copied|selected)/).waitFor();
  await host.reload();
  await host.getByRole('img', {name: 'Private room invitation QR code'}).waitFor();
  assert.equal(await linkField.inputValue(), url);

  async function guest(role, username, alreadySignedIn = false) {
    assert.equal((await admin('accounts', {username, password})).status, 201);
    const page = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
    if (alreadySignedIn) {
      await page.goto(origin + '/crew/');
      await signIn(page, username);
    }
    await page.goto(url);
    await page.getByLabel('Guest Role').waitFor();
    const captain = page.getByLabel('Guest Role').locator('option[value="captain"]');
    assert.equal(await captain.evaluate(option => option.disabled), true);
    assert.equal(await page.getByLabel('Username', {exact: true}).isVisible(), !alreadySignedIn);
    if (!alreadySignedIn) await credentials(page, username);
    await page.getByLabel('Guest Role').selectOption(role);
    await page.getByRole('button', {name: 'Join Room', exact: true}).click();
    await page.waitForURL(new RegExp('/panel-mosaic-lab/unified/\\?crewRoom='));
    await page.getByText(/Connected$/).waitFor();
    return page;
  }

  const first = await guest('firstOfficer', 'RemotePartner');
  await count(host, 'firstOfficer', '1 / 1');
  await host.getByText('RemotePartner · First Officer (Right Seat)', {exact: true}).waitFor();
  const instructor = await guest('instructor', 'SimInstructor', true);
  await count(host, 'instructor', '1 / 1');
  const observer1 = await guest('observer', 'ClassObserver1');
  await count(host, 'observer', '1');
  await host.getByLabel('Pilot Flying').selectOption('firstOfficer');
  await host.getByText('PF: First Officer · PM: Captain').waitFor();
  await host.getByRole('button', {name: 'Enter Shared Cockpit'}).click();
  await host.getByText(/Connected$/).waitFor();
  assert.equal(await first.locator('#workspaceLabsToggle').isVisible(), false);
  assert.equal(await instructor.locator('#workspaceLabsToggle').isVisible(), true);
  await host.getByRole('button', {name: 'Rotate heading'}).click();
  await first.waitForFunction(() => calls.some(([key, value]) => key === 'heading' && value === 35));
  await observer1.waitForFunction(() => calls.some(([key, value]) => key === 'heading' && value === 35));
  // Both isolated browser contexts must receive commands in both directions.
  await first.getByRole('button', {name: 'Rotate heading'}).click();
  await host.waitForFunction(() => calls.filter(([key, value]) => key === 'heading' && value === 35).length === 2);
  await observer1.waitForFunction(() => calls.filter(([key, value]) => key === 'heading').length === 2);
  await observer1.getByRole('button', {name: 'Rotate heading'}).click();
  await observer1.getByRole('button', {name: 'Zoom'}).click();
  assert.deepEqual(await observer1.evaluate(() => calls), [['heading', 35], ['heading', 35], ['zoom']]);
  assert.deepEqual(await first.evaluate(() => calls), [['heading', 35], ['heading', 35]]);
  // Exercise the actual postMessage -> room command -> iframe bridge path.
  await host.frameLocator('#overheadFrame').getByRole('button', {name: 'Battery master'}).click();
  await first.waitForFunction(() => document.getElementById('overheadFrame')?.contentWindow
    ?.switchState['battery-master'] === 'ON');
  // Simulate a slow/hydrating Overhead iframe on FO after a synchronized
  // Captain switch. The fresh frame initially boots with BATTERY OFF.
  await first.waitForTimeout(700); // host snapshot debounce is 350ms
  await first.evaluate(() => new Promise(resolve => {
    const frame = document.getElementById('overheadFrame');
    frame.addEventListener('load', resolve, {once: true});
    frame.src = '/panel-mosaic-lab/cockpit/crew-overhead-test.html?reload=1';
  }));
  await first.waitForFunction(() => document.getElementById('overheadFrame')?.contentWindow
    ?.switchState['battery-master'] === 'ON', null, {timeout: 7000});
  await first.frameLocator('#overheadFrame').getByRole('button', {name: 'Battery master'}).click();
  await host.waitForFunction(() => document.getElementById('overheadFrame')?.contentWindow
    ?.switchState['battery-master'] === 'OFF');
  await first.getByRole('button', {name: 'Load flight'}).click();
  await host.waitForFunction(() => calls.some(([key, value]) => key === 'load' && value === 'FINAL_10'));
  await observer1.waitForFunction(() => calls.some(([key, value]) => key === 'flight' && value === 6820));

  // Reproduce a fast MCP rotation burst. Commands 66+ previously got 429
  // and were silently lost because the client had no retry policy.
  const beforeBurst = await first.evaluate(() => calls.filter(([key]) => key === 'heading').length);
  await host.evaluate(() => {
    for (let i = 0; i < 100; i++) {
      window.dispatchEvent(new CustomEvent('b737:mcp-value-change', {detail: {control: 'heading', value: i}}));
    }
  });
  await first.waitForFunction(expected =>
    calls.filter(([key]) => key === 'heading').length >= expected, beforeBurst + 100, {timeout: 20000});
  const observedBurst = await first.evaluate(() =>
    calls.filter(([key]) => key === 'heading').slice(-100).map(([, value]) => value));
  assert.deepEqual(observedBurst, Array.from({length: 100}, (_, i) => i),
    'All 100 rapid heading updates must arrive in original sequence despite server 429');
});
