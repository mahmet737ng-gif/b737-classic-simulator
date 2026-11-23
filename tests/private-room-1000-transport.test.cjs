'use strict';
// Private Room transport stress test. This verifies the real room HTTP/SSE
// backend, not physical instrument fidelity or multi-device network latency.
const assert = require('node:assert/strict');
const {once} = require('node:events');
const {test} = require('node:test');
const {performance} = require('node:perf_hooks');
const {createCrewRoomServer, makeVerifier} = require('../sync-server/crew-rooms');

const PASSWORD = 'test-only-crew-pass';
const ORIGIN = 'http://127.0.0.1';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (numbers, fraction) => {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)].toFixed(2));
};

function agent(base) {
  let cookie = '';
  return {
    get cookie() { return cookie; },
    async request(action, data) {
      const response = await fetch(base + '/api/crew/' + action, {
        method: 'POST',
        headers: {'Origin': base, 'Content-Type': 'application/json', ...(cookie ? {Cookie: cookie} : {})},
        body: JSON.stringify(data),
        cache: 'no-store'
      });
      const next = response.headers.get('set-cookie')?.split(';', 1)[0];
      if (next) cookie = next;
      return {status: response.status, body: await response.json()};
    }
  };
}

async function stream(base, roomId, agent, label) {
  const abort = new AbortController();
  const response = await fetch(base + '/api/crew/events?room=' + roomId + '&cockpit=1', {
    headers: {Cookie: agent.cookie}, signal: abort.signal
  });
  assert.equal(response.status, 200, label + ' did not open cockpit SSE');
  const reader = response.body.getReader();
  const seen = new Map();
  const duplicated = new Set();
  const errors = [];
  const pending = new Map();
  const pump = (async () => {
    let buffer = '';
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += Buffer.from(value).toString('utf8');
        let index;
        while ((index = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          if (!raw.includes('event: command')) continue;
          const line = raw.split('\n').find(item => item.startsWith('data: '));
          if (!line) continue;
          let entry;
          try { entry = JSON.parse(line.slice(6)); } catch (error) { errors.push(error.message); continue; }
          if (seen.has(entry.sequence)) duplicated.add(entry.sequence);
          seen.set(entry.sequence, {entry, arrived: performance.now()});
          const waiter = pending.get(entry.sequence);
          if (waiter) {
            clearTimeout(waiter.timeout);
            pending.delete(entry.sequence);
            waiter.resolve(seen.get(entry.sequence));
          }
        }
      }
    } catch (error) {
      if (!abort.signal.aborted) errors.push(error.message);
    }
  })();
  return {
    label, seen, duplicated, errors,
    wait(sequence, timeout = 4000) {
      if (seen.has(sequence)) return Promise.resolve(seen.get(sequence));
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          pending.delete(sequence);
          reject(Error(label + ' missed SSE sequence ' + sequence));
        }, timeout);
        pending.set(sequence, {resolve, reject, timeout: timeoutId});
      });
    },
    async close() {
      abort.abort();
      for (const waiter of pending.values()) {
        clearTimeout(waiter.timeout);
        waiter.reject(Error('SSE closed'));
      }
      pending.clear();
      await pump;
    }
  };
}

function control(i) {
  const k = i % 100, group = Math.floor(i / 100);
  const alternating = k % 2 === 0;
  if (group === 0) return {category: 'Overhead Toggle A/B/A/B', role: alternating ? 'captain' : 'firstOfficer',
    command: {type: 'toggle', id: 'battery-master', value: alternating ? 'ON' : 'OFF'}};
  if (group === 1) return {category: 'Overhead Rotary A/B', role: alternating ? 'captain' : 'firstOfficer',
    command: {type: 'rotary', id: 'ignition-source', value: alternating ? 'BOTH' : 'L'}};
  if (group === 2) return {category: 'Overhead Guard A/B', role: alternating ? 'captain' : 'firstOfficer',
    command: {type: 'guard', id: 'passenger-oxygen', value: {open: alternating, value: alternating ? 'NORMAL' : 'ON'}}};
  if (group === 3) return {category: 'MCP Values', role: alternating ? 'captain' : 'firstOfficer',
    command: {type: 'mcpValue', id: 'heading', value: (k * 7) % 360}};
  if (group === 4) return {category: 'AFDS/FMA Command Delivery', role: alternating ? 'captain' : 'firstOfficer',
    command: {type: 'mcpMode', id: ['HDG_SEL', 'ALT_HLD', 'V_S', 'LVL_CHG'][k % 4], value: true}};
  if (group === 5) return {category: 'EFIS Command Delivery', role: alternating ? 'captain' : 'firstOfficer',
    command: {type: 'efis', id: alternating ? 'CPT.MODE' : 'FO.MODE', value: ['FULL', 'EXP', 'MAP', 'PLAN'][k % 4]}};
  if (group === 6) return {category: 'Flight Scenario/Targets', role: alternating ? 'captain' : 'firstOfficer',
    command: alternating ? {type: 'loadFlight', id: 'flight', value: {preset: 'FINAL_10'}} :
      {type: 'flightTargets', id: 'flight', value: {speedKt: 140 + (k % 20), headingDeg: (k * 3) % 360, altitudeFt: 3000 + k * 100}}};
  if (group === 7) return {category: 'Instructor Failures/Scenarios', role: 'instructor',
    command: alternating ? {type: 'failure', id: 'advanced.bothIRS', value: true} :
      {type: 'failureScenario', id: 'advanced.EMERGENCY_DESCENT', value: {cause: 'CABIN', severity: 'HIGH'}}};
  if (group === 8) {
    const variants = [
      {type: 'throttle', id: '1', value: k % 100},
      {type: 'flap', id: 'flap', value: 30},
      {type: 'gear', id: 'DOWN', value: false},
      {type: 'speedbrake', id: 'speedbrake', value: 'ARMED'},
      {type: 'startLever', id: '1', value: 'IDLE'}
    ];
    return {category: 'Engine/Flight Controls', role: alternating ? 'captain' : 'firstOfficer', command: variants[k % variants.length]};
  }
  const variants = [
    {type: 'frequency', id: 'VHF1', value: 121.5},
    {type: 'commTransfer', id: 'VHF1', value: 'LEFT'},
    {type: 'navMode', id: 'NAV1', value: 'AUTO'},
    {type: 'autobrake', id: 'autobrake', value: 2},
    {type: 'trim', id: 'manual', value: k},
    {type: 'cb', id: 'P18-2.A8-9', value: false},
    {type: 'firePanel', id: 'BELL_CUTOUT', value: {source: 'ENG1'}},
    {type: 'cdu', id: 'FO', value: 'RTE'},
    {type: 'toga', id: 'THROTTLE1', value: true},
    {type: 'mcpHardware', id: 'FD_L', value: true}
  ];
  return {category: 'Radio/CB/Fire/CDU/TOGA', role: alternating ? 'captain' : 'firstOfficer',
    command: variants[k % variants.length]};
}

test('1000 actual crew-room HTTP commands arrive identically at Captain, FO and Observer SSE sessions', {timeout: 150000}, async t => {
  const verifier = await makeVerifier(PASSWORD);
  const server = createCrewRoomServer({
    origin: ORIGIN, database: ':memory:', ownerUsername: 'TrainerOwner', ownerVerifier: verifier,
    staticHandler: (req, res) => { res.writeHead(404); res.end(); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const base = ORIGIN + ':' + server.address().port;
  const captain = agent(base), fo = agent(base), instructor = agent(base), observer = agent(base);
  const accounts = {captain, firstOfficer: fo, instructor, observer};
  assert.equal((await captain.request('login', {username: 'TrainerOwner', password: PASSWORD})).status, 200);
  for (const [name, username] of [['firstOfficer', 'FirstOfficerQA'], ['instructor', 'InstructorQA'], ['observer', 'ObserverQA']]) {
    assert.equal((await captain.request('accounts', {username, password: PASSWORD})).status, 201);
    assert.equal((await accounts[name].request('login', {username, password: PASSWORD})).status, 200);
  }
  const created = await captain.request('create', {role: 'captain'});
  assert.equal(created.status, 200);
  const roomId = created.body.roomId;
  const invite = created.body.roomInvite;
  for (const name of ['firstOfficer', 'instructor', 'observer']) {
    const joined = await accounts[name].request('join', {roomId, invite, role: name});
    assert.equal(joined.status, 200, name + ' unable to join');
  }
  const feeds = await Promise.all([
    stream(base, roomId, captain, 'Captain'),
    stream(base, roomId, fo, 'First Officer'),
    stream(base, roomId, observer, 'Observer')
  ]);
  const faults = [], categories = {}, latencies = [], starts = performance.now();
  let passed = 0;
  try {
    const illegal = await observer.request('command', {
      roomId, client: 'observer-qa-client', command: {type: 'mcpValue', id: 'heading', value: 99}
    });
    assert.equal(illegal.status, 403, 'Observer must be read-only');
    for (let i = 0; i < 1000; i++) {
      const spec = control(i);
      const group = categories[spec.category] ??= {passed: 0, failed: 0, responseMs: []};
      const sender = accounts[spec.role];
      const began = performance.now();
      const response = await sender.request('command', {
        roomId, client: spec.role + '-qa-client', command: spec.command
      });
      if (response.status !== 200) {
        group.failed++;
        faults.push({case: i + 1, category: spec.category, status: response.status, error: response.body.error});
      } else {
        const seq = response.body.sequence;
        try {
          const delivered = await Promise.all(feeds.map(feed => feed.wait(seq)));
          for (const actual of delivered) {
            assert.equal(actual.entry.sequence, seq);
            assert.deepEqual(
              {type: actual.entry.type, id: actual.entry.id, value: actual.entry.value},
              spec.command, actual.entry.client + ' mismatch'
            );
          }
          const responseMs = performance.now() - began;
          latencies.push(responseMs);
          group.responseMs.push(responseMs);
          group.passed++;
          passed++;
        } catch (error) {
          group.failed++;
          faults.push({case: i + 1, category: spec.category, error: error.message});
        }
      }
      // Production contract caps command bursts at 65 per second per seat.
      await pause(20);
    }
    for (const feed of feeds) {
      if (feed.errors.length || feed.duplicated.size) faults.push({
        feed: feed.label, readErrors: feed.errors, duplicateCount: feed.duplicated.size
      });
    }
    const result = {
      suite: 'PRIVATE_ROOM_1000_HTTP_SSE_TRANSPORT',
      attempted: 1000, passed, failed: 1000 - passed,
      durationMs: Math.round(performance.now() - starts),
      p50Ms: percentile(latencies, 0.50), p95Ms: percentile(latencies, 0.95),
      p99Ms: percentile(latencies, 0.99),
      categories: Object.fromEntries(Object.entries(categories).map(([name, s]) =>
        [name, {passed: s.passed, failed: s.failed, p95Ms: percentile(s.responseMs, 0.95)}])),
      faults: faults.slice(0, 30)
    };
    console.log('PRIVATE_ROOM_1000_RESULT ' + JSON.stringify(result));
    assert.equal(passed, 1000, 'Some Private Room transport commands did not reach every isolated SSE client');
    assert.equal(faults.length, 0, 'Duplicate messages or SSE reader errors');
    assert.equal(feeds[0].seen.size, 1000, 'Captain sequence count differs');
    assert.equal(feeds[1].seen.size, 1000, 'First Officer sequence count differs');
    assert.equal(feeds[2].seen.size, 1000, 'Observer sequence count differs');
  } finally {
    await Promise.all(feeds.map(feed => feed.close()));
  }
});
