'use strict';

const assert = require('node:assert/strict');
const {once} = require('node:events');
const {createReadStream} = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {createCrewRoomServer, makeVerifier} = require('../sync-server/crew-rooms');

const password = 'test-only-crew-pass';
const prefix = '/api/crew';

function fixture(req, res) {
  const cockpit = path.resolve(__dirname, '../panel-mosaic-lab/cockpit');
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  const file = pathname.endsWith('/') ? 'index.html' : path.basename(pathname);
  const type = {'index.html': 'text/html', 'crew-room-v1.js': 'text/javascript', 'crew-room-v1.css': 'text/css'}[file];
  if (!type) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader('Content-Type', type);
  createReadStream(path.join(cockpit, file)).pipe(res);
}

async function start(t) {
  // Node's test/browser clients connect to loopback only. The production
  // server checks this Origin against its configured public HTTPS origin.
  const origin = 'http://127.0.0.1';
  const ownerVerifier = await makeVerifier(password);
  const server = createCrewRoomServer({origin, database: ':memory:', ownerUsername: 'TrainerOwner', ownerVerifier,
    staticHandler: fixture});
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
  const result = await owner('inspect', {roomId});
  assert.equal(result.data.reserved.firstOfficer, 1);
  assert.equal(result.data.reserved.observer, 2);
  const unauthorizedStream = await fetch(origin + prefix + '/events?room=' + roomId);
  assert.equal(unauthorizedStream.status, 401);
  await unauthorizedStream.text();
  await firstOfficer('logout', {});
  assert.equal((await firstOfficer('login', {username: 'Partner1', password})).status, 200);
});

test('Unified Welcome shows live role counts across independent browsers', {skip: !process.env.CHROME_PATH}, async t => {
  const {chromium} = require('playwright');
  const {origin} = await start(t);
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH});
  t.after(() => browser.close());
  const root = origin + '/panel-mosaic-lab/cockpit/?welcomeTest=1';
  async function signIn(page, username) {
    await page.getByLabel('Username', {exact: true}).fill(username);
    await page.getByLabel('Password', {exact: true}).fill(password);
    await page.getByRole('button', {name: 'Sign In', exact: true}).click();
    await page.getByText('Signed in as ' + username, {exact: true}).waitFor();
  }
  async function count(page, role, value) {
    await page.waitForFunction(([role, value]) =>
      document.querySelector('[data-crew-count="' + role + '"]').textContent === value, [role, value]);
  }

  const host = await browser.newPage({viewport: {width: 1440, height: 900}});
  await host.goto(root);
  await host.locator('#unifiedWelcome').getByRole('button', {name: 'Crew Room'}).click();
  await signIn(host, 'TrainerOwner');
  await host.getByRole('button', {name: 'Create Room', exact: true}).click();
  await host.getByRole('button', {name: 'Join Room', exact: true}).click();
  await count(host, 'captain', '1 / 1');

  async function invite(role, username) {
    await host.getByLabel('Assigned Username').fill(username ?? '');
    await host.locator('[data-crew-invite="' + role + '"]').click();
    await host.getByLabel('Invitation Link').waitFor();
    const label = {firstOfficer: 'First Officer', instructor: 'Instructor', observer: 'Observer'}[role];
    await host.getByText(new RegExp('^' + label + ' invite (copied|ready to copy)\\.$')).waitFor();
    return host.getByLabel('Invitation Link').inputValue();
  }
  async function guest(role, username, seat) {
    await host.getByLabel('Guest Username').fill(username);
    await host.getByLabel('Guest Password').fill(password);
    await host.getByRole('button', {name: 'Create Guest Account'}).click();
    await host.getByText('Account created for ' + username + '.').waitFor();
    const page = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
    await page.goto(await invite(role, username));
    await signIn(page, username);
    await page.getByRole('button', {name: 'Join as ' + seat, exact: true}).click();
    await page.getByText('Your role: ' + seat, {exact: true}).waitFor();
    return page;
  }

  const first = await guest('firstOfficer', 'RemotePartner', 'First Officer');
  await count(host, 'firstOfficer', '1 / 1');
  await host.getByText('RemotePartner · First Officer (Right Seat)', {exact: true}).waitFor();
  const instructor = await guest('instructor', 'SimInstructor', 'Instructor');
  await count(first, 'instructor', '1 / 1');
  const observer1 = await guest('observer', 'ClassObserver1', 'Observer');
  const observer2 = await guest('observer', 'ClassObserver2', 'Observer');
  await count(host, 'observer', '2');
  await count(first, 'observer', '2');
  await count(instructor, 'observer', '2');
  await count(observer1, 'observer', '2');
  await count(observer2, 'observer', '2');
  assert.equal(await observer1.locator('[data-crew-invitations]').isVisible(), false);
  await observer1.getByRole('button', {name: 'Leave Room', exact: true}).click();
  await count(host, 'observer', '1');
});
