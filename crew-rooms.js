'use strict';

const {createHash, randomBytes, scrypt, timingSafeEqual} = require('node:crypto');
const {createServer} = require('node:http');
const {promisify} = require('node:util');

const derive = promisify(scrypt);
const ROLES = Object.freeze(['captain', 'firstOfficer', 'instructor', 'observer']);
const PREFIX = '/api/crew';
const HOUR = 60 * 60 * 1000;
const SESSION_AGE = 12 * HOUR;
const ROOM_AGE = 12 * HOUR;
const SEAT_GRACE = 60 * 1000;
const randomToken = () => randomBytes(24).toString('base64url');
const hash = (text) => createHash('sha256').update(text).digest('hex');
const usernamePattern = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,39}$/;
const roleLabel = {captain: 'Captain', firstOfficer: 'First Officer', instructor: 'Instructor'};

const FLIGHT_ROLES = ['captain', 'firstOfficer'];
const DEFAULT_AIRCRAFT_PROFILE = Object.freeze({
  schema: 'b737-classic-aircraft-profile/1', aircraftFamily: 'B737-300-500',
  aircraftModel: '737-300', engineVariant: 'CFM56-3B3',
  pressurization: 'DCPCS', engineInstruments: 'EIS'
});
function aircraftProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.schema !== DEFAULT_AIRCRAFT_PROFILE.schema ||
      !['B737-300-500', 'B737-400'].includes(value.aircraftFamily) ||
      !['CPCS', 'DCPCS'].includes(value.pressurization) ||
      !['EIS', 'CONVENTIONAL'].includes(value.engineInstruments)) {
    throw new RequestError(400, 'Invalid shared aircraft configuration.');
  }
  const family400 = value.aircraftFamily === 'B737-400';
  return {
    schema: DEFAULT_AIRCRAFT_PROFILE.schema,
    aircraftFamily: value.aircraftFamily,
    aircraftModel: family400 ? '737-400' : '737-300',
    engineVariant: family400 ? 'CFM56-3B2' : 'CFM56-3B3',
    pressurization: value.pressurization,
    engineInstruments: value.engineInstruments
  };
}
function overheadSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestError(400, 'Invalid overhead snapshot.');
  }
  const plain = (source, max, guard = false) => {
    if (!source || typeof source !== 'object' || Array.isArray(source) ||
        Object.keys(source).length > max) throw new RequestError(400, 'Invalid overhead controls.');
    const result = {};
    for (const [id, item] of Object.entries(source)) {
      if (!CONTROL_ID.test(id)) throw new RequestError(400, 'Invalid overhead control ID.');
      if (guard) {
        if (!item || typeof item !== 'object' || Array.isArray(item) ||
            !['open', 'closed'].includes(item.guard) || !controlValue(item.value)) {
          throw new RequestError(400, 'Invalid guard state.');
        }
        result[id] = {guard: item.guard, value: item.value};
      } else if (controlValue(item)) result[id] = item;
      else throw new RequestError(400, 'Invalid overhead control value.');
    }
    return result;
  };
  return {
    toggles: plain(value.toggles, 120),
    rotaries: plain(value.rotaries, 100),
    guards: plain(value.guards, 50, true)
  };
}
const CLIENT_ID = /^[a-zA-Z0-9_-]{12,64}$/;
const CONTROL_ID = /^[a-zA-Z0-9_.|:-]{1,72}$/;
const CONTROL_TYPES = new Set([
  'toggle', 'rotary', 'guard', 'mcpValue', 'mcpHardware', 'mcpMode',
  'gear', 'throttle', 'flap', 'speedbrake', 'startLever', 'toga',
  'loadFlight', 'flightTargets', 'pauseFlight', 'stopFlight',
  'failure', 'failureScenario', 'profile', 'efis', 'cdu',
  'frequency', 'commTransfer', 'navMode', 'autobrake', 'trim', 'firePanel', 'cb'
]);
const FLIGHT_COMMANDS = new Set(['loadFlight', 'flightTargets', 'pauseFlight', 'stopFlight', 'failureScenario']);
const SCENARIO_COMMANDS = new Set(['loadFlight', 'stopFlight', 'failureScenario']);

function controlValue(value) {
  return typeof value === 'boolean' || Number.isFinite(value) ||
    typeof value === 'string' && value.length <= 72;
}

function crewCommand(data) {
  const {type, id, value} = data ?? {};
  if (!CONTROL_TYPES.has(type) || typeof id !== 'string' || !CONTROL_ID.test(id)) {
    throw new RequestError(400, 'Unknown cockpit command.');
  }
  if (controlValue(value)) return {type, id, value};
  if (type === 'guard' && typeof value?.open === 'boolean' && controlValue(value.value)) {
    return {type, id, value: {open: value.open, value: value.value}};
  }
  if (['loadFlight', 'flightTargets', 'failureScenario', 'profile', 'firePanel'].includes(type) &&
      value && !Array.isArray(value) && typeof value === 'object' &&
      Object.keys(value).length <= 12 && Object.entries(value).every(([key, item]) =>
        CONTROL_ID.test(key) && controlValue(item))) return {type, id, value};
  throw new RequestError(400, 'Invalid cockpit value.');
}

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function makeVerifier(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, verifier) {
  const [salt, key] = verifier.split(':');
  const actual = await derive(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(key, 'hex'));
}

function send(res, status, fields, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(JSON.stringify(fields));
}

async function readBody(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new RequestError(415, 'Send JSON.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12288) throw new RequestError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
    return data;
  } catch {
    throw new RequestError(400, 'Invalid request.');
  }
}

function frame(res, state, event = 'roster') {
  if (!res.destroyed && !res.writableEnded && res.writableLength < 1024 * 1024) {
    res.write(`${event === 'command' ? 'id: ' + state.sequence + '\n' : ''}event: ${event}\ndata: ${JSON.stringify(state)}\n\n`);
  } else {
    res.destroy();
  }
}

function createCrewRoomHandler({origin, database, accounts, roomStore, ownerUsername, ownerVerifier, gatewayIdentity, gatewayLogin,
  reservedUsernames = [], staticHandler, now = Date.now}) {
  if (!origin || new URL(origin).origin !== origin ||
      (!origin.startsWith('https://') && new URL(origin).hostname !== '127.0.0.1')) {
    throw Error('CREW_ORIGIN must be an HTTPS origin or the loopback development origin.');
  }
  if (!usernamePattern.test(ownerUsername ?? '') ||
      (!gatewayIdentity && !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(ownerVerifier ?? ''))) {
    throw Error('Set CREW_OWNER_USERNAME and CREW_OWNER_VERIFIER.');
  }

  const loopback = origin === 'http://127.0.0.1';
  const db = accounts ? null : new (require('node:sqlite').DatabaseSync)(database);
  db?.exec(`CREATE TABLE IF NOT EXISTS crew_accounts (
    username TEXT PRIMARY KEY COLLATE NOCASE,
    verifier TEXT NOT NULL
  )`);
  const getGuest = db?.prepare('SELECT username, verifier FROM crew_accounts WHERE username = ?');
  const addGuest = db?.prepare('INSERT OR IGNORE INTO crew_accounts VALUES (?, ?)');
  const getAccount = key => accounts ? accounts.get(key) : getGuest.get(key);
  const owner = ownerUsername.toLowerCase();
  const reservedNames = new Set([owner, ...reservedUsernames.map(name => name.toLowerCase())]);
  const dummyVerifier = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
  const rooms = new Map();
  const invites = new Map();
  const sessions = new Map();
  const rates = new Map();
  const cookieName = origin.startsWith('https://') ? '__Secure-unified_crew' : 'unified_crew';

  const cookie = (token, age) => `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}` +
    (origin.startsWith('https://') ? '; Secure' : '');

  function session(req) {
    const item = (req.headers.cookie ?? '').split(';').map(x => x.trim())
      .find(value => value.startsWith(cookieName + '='));
    const key = item?.slice(cookieName.length + 1);
    const record = key && sessions.get(hash(key));
    return record && record.expires > now() ? record : null;
  }

  function cockpitAccess(req) {
    const user = session(req);
    if (!user) return null;
    const key = user.username.toLowerCase();
    for (const room of rooms.values()) {
      const member = room.members.get(key);
      if (room.expires > now() && member && (member.streams.size || member.lastSeen + SEAT_GRACE > now())) {
        return {roomId: room.id, role: member.role, username: user.username};
      }
    }
    return null;
  }

  function openSession(res, username) {
    const token = randomToken();
    const user = {username, owner: username.toLowerCase() === owner};
    sessions.set(hash(token), {...user, expires: now() + SESSION_AGE});
    send(res, 200, {user}, {'Set-Cookie': cookie(token, SESSION_AGE / 1000)});
  }

  function roster(room) {
    const counts = Object.fromEntries(ROLES.map(role => [role, 0]));
    const reserved = {...counts};
    const online = [];
    for (const member of room.members.values()) {
      if (member.streams.size) {
        counts[member.role]++;
        online.push({username: member.username, role: member.role});
      } else if (member.lastSeen + SEAT_GRACE > now()) reserved[member.role]++;
    }
    const available = role => [...room.members.values()].some(member =>
      member.role === role && [...member.streams.keys()].some(stream => room.cockpits.has(stream)));
    const controller = [room.flying, ...FLIGHT_ROLES, 'instructor'].find(available) ?? null;
    if (!room.flightReady) {
      const peers = [...room.members.values()].filter(member => member.role !== 'observer' &&
        [...member.streams.keys()].some(stream => room.flightPeers.has(stream)));
      if (peers.length && peers.every(member => member.readyScenario === room.scenarioSequence)) room.flightReady = true;
    }
    return {roomId: room.id, counts, reserved, online, flying: room.flying, controller,
      flightRevision: room.flightRevision, scenarioSequence: room.scenarioSequence, flightReady: room.flightReady};
  }

  function publish(room) {
    const state = roster(room);
    for (const member of room.members.values()) {
      for (const stream of member.streams.keys()) frame(stream, state);
    }
  }

  function broadcast(room, event, payload) {
    for (const stream of room.cockpits) frame(stream, payload, event);
  }

  function closeMember(room, key, member) {
    room.members.delete(key);
    for (const stream of member.streams.keys()) {
      room.cockpits.delete(stream);
      stream.end();
    }
    member.streams.clear();
  }

  function purge(room) {
    for (const [key, member] of room.members) {
      if (!member.streams.size && member.lastSeen + SEAT_GRACE <= now()) {
        closeMember(room, key, member);
      }
    }
  }

  function admission(room, user, role) {
    if (!ROLES.includes(role)) throw new RequestError(400, 'Choose a crew role.');
    purge(room);
    const key = user.username.toLowerCase();
    const previous = room.members.get(key);
    if (previous?.role === role) {
      previous.lastSeen = now();
      return previous;
    }
    if (role !== 'observer' && [...room.members.values()].some(member => member.role === role)) {
      throw new RequestError(409, `${roleLabel[role]} seat is already occupied.`);
    }
    if (previous) closeMember(room, key, previous);
    const member = {role, username: user.username, lastSeen: now(), streams: new Map()};
    room.members.set(key, member);
    publish(room);
    return member;
  }

  async function resolveInvite(raw) {
    if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(raw)) return null;
    const key = hash(raw);
    let invite = invites.get(key);
    if (!invite && roomStore) {
      const record = await roomStore.findInvitedRoom(key, now());
      if (record) restoreRoom(record);
      invite = invites.get(key);
    }
    return invite && invite.room.expires > now() ? invite : null;
  }

  function roomInvite(room) {
    if (!room.invitation) {
      room.invitation = randomToken();
      invites.set(hash(room.invitation), {room, chooseRole: true});
    }
    return room.invitation;
  }

  function stateFor(room, user, invite) {
    const key = user?.username.toLowerCase();
    const {online, ...counts} = roster(room);
    const manager = room.manager === key;
    return {
      ...counts,
      online: room.manager === key || room.members.has(key) ? online : [],
      role: room.members.get(key)?.role ?? null,
      invitedRole: invite?.role ?? null,
      manager,
      profile: room.profile,
      ...(manager && room.invitation ? {roomInvite: room.invitation} : {})
    };
  }

  function findHostedRoom(key) {
    return [...rooms.values()].find(room => room.manager === key && room.expires > now());
  }

  function restoreRoom(record) {
    const existing = rooms.get(record.id);
    if (existing) return existing;
    const room = {
      ...record, members: new Map(), links: new Map(), cockpits: new Set(), commands: [],
      sequence: 0, flying: 'captain', snapshot: null, flight: null,
      flightRevision: 0, scenarioSequence: 0, flightReady: true, flightPeers: new Map()
    };
    rooms.set(room.id, room);
    if (room.invitation) invites.set(hash(room.invitation), {room, chooseRole: true});
    return room;
  }

  function readRoom(id, user, invite) {
    const room = rooms.get(id);
    const key = user?.username.toLowerCase();
    if (!room || room.expires <= now() ||
        !(invite?.room === room || room.manager === key || (key && room.members.has(key)))) {
      throw new RequestError(404, 'Room or invitation is unavailable.');
    }
    return room;
  }

  let credentialChecks = 0;

  async function checkCredential(username, task) {
    const current = rates.get(username);
    const bucket = current?.until > now() ? current : {count: 0, until: now() + 10 * 60 * 1000};
    if (bucket.count >= 12 || (!current && rates.size >= 20000) || credentialChecks >= 12) {
      throw new RequestError(429, 'Too many attempts. Try again later.');
    }
    bucket.count++;
    rates.set(username, bucket);
    credentialChecks++;
    try {
      return await task();
    } finally {
      credentialChecks--;
    }
  }

  function credentials({username, password}) {
    if (typeof username !== 'string' || !usernamePattern.test(username) ||
        typeof password !== 'string' || !password.length || password.length > 128) {
      throw new RequestError(400, 'Enter a valid username and password.');
    }
    return username.toLowerCase();
  }

  async function login(req, res, body, user) {
    if (user) throw new RequestError(409, 'Sign out before switching accounts.');
    const key = credentials(body);
    if (gatewayLogin && reservedNames.has(key)) {
      const {username, cookies} = await gatewayLogin(req, body.username, body.password);
      return send(res, 200, {user: {username, owner: username.toLowerCase() === owner, gateway: true}},
        {'Set-Cookie': cookies});
    }
    const guest = reservedNames.has(key) ? null : await getAccount(key);
    const localOwner = key === owner && !gatewayIdentity;
    const verifier = localOwner ? ownerVerifier : guest?.verifier ?? dummyVerifier;
    const verified = await checkCredential(key, () => verifyPassword(body.password, verifier));
    if (!verified || (!localOwner && !guest)) throw new RequestError(401, 'Incorrect username or password.');
    rates.delete(key);
    return openSession(res, localOwner ? ownerUsername : guest.username);
  }

  async function createAccount(res, body, user) {
    if (!user.owner) throw new RequestError(403, 'Only the Unified room host can create accounts.');
    const key = credentials(body);
    if (reservedNames.has(key)) throw new RequestError(409, 'Username is already in use.');
    if (body.password.length < 12) throw new RequestError(400, 'Use at least 12 characters for the password.');
    const verifier = await checkCredential('create:' + owner, () => makeVerifier(body.password));
    const added = accounts ? await accounts.add(key, body.username, verifier) : addGuest.run(body.username, verifier).changes;
    if (!added) throw new RequestError(409, 'Username is already in use.');
    return send(res, 201, {username: body.username});
  }

  async function route(req, res) {
    const url = new URL(req.url, origin);
    let user = session(req);
    if (!user && gatewayIdentity) {
      const username = await gatewayIdentity(req);
      if (username) user = {username, owner: username.toLowerCase() === owner, gateway: true, expires: Infinity};
    }
    if (req.method === 'GET' && url.pathname === PREFIX) {
      const account = user ? {username: user.username, owner: user.owner, gateway: !!user.gateway} : null;
      const key = user?.username.toLowerCase();
      let hosted = key && findHostedRoom(key);
      if (key && !hosted && roomStore) {
        const record = await roomStore.findHostedRoom(key, now());
        if (record) hosted = restoreRoom(record);
      }
      return send(res, 200, {user: account, ...(hosted ? {hostedRoom: stateFor(hosted, user)} : {})});
    }
    if (req.method === 'GET' && url.pathname === PREFIX + '/events') {
      if (!user) throw new RequestError(401, 'Sign in to join the room.');
      const room = readRoom(url.searchParams.get('room'), user);
      const key = user.username.toLowerCase();
      const member = room.members.get(key);
      if (!member) throw new RequestError(403, 'Choose a seat first.');
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no'
      });
      req.socket.setNoDelay(true);
      res.write('retry: 1500\n\n');
      member.streams.set(res, user);
      if (url.searchParams.get('cockpit') === '1') {
        const after = Math.max(0, Number(req.headers['last-event-id'] ?? url.searchParams.get('after')) || 0);
        room.cockpits.add(res);
        const client = url.searchParams.get('client');
        if (CLIENT_ID.test(client ?? '')) room.flightPeers.set(res, client);
        // A late joiner must receive the host's current controls before any
        // commands newer than that snapshot (rather than replay stale history).
        // The snapshot covers the Overhead only. Replay earlier MCP, CDU,
        // profile and flight commands BEFORE that snapshot, or new crew
        // members lose all non-Overhead cockpit state.
        const snapshotSequence = room.snapshot?.sequence ?? 0;
        if (room.snapshot) {
          for (const command of room.commands) {
            if (command.sequence > after && command.sequence <= snapshotSequence &&
                !['toggle', 'rotary', 'guard'].includes(command.type)) {
              frame(res, command, 'command');
            }
          }
          frame(res, room.snapshot, 'snapshot');
        }
        const replayFrom = Math.max(after, snapshotSequence);
        for (const command of room.commands) {
          if (command.sequence > replayFrom) frame(res, command, 'command');
        }
        if (room.flight) frame(res, room.flight, 'flight');
      }
      res.on('close', () => {
        room.cockpits.delete(res);
        room.flightPeers.delete(res);
        member.streams.delete(res);
        member.lastSeen = now();
        publish(room);
      });
      publish(room);
      return;
    }
    const requestOrigin = loopback && req.socket.localPort !== 80 ? origin + ':' + req.socket.localPort : origin;
    if (req.method !== 'POST' || req.headers.origin !== requestOrigin) {
      throw new RequestError(403, 'Use the Unified crew panel to access this service.');
    }
    const data = await readBody(req);
    const action = url.pathname.slice(PREFIX.length + 1);
    if (action === 'login') return login(req, res, data, user);

    const invite = await resolveInvite(data.invite);
    if (action === 'inspect') {
      const room = readRoom(data.roomId ?? invite?.room.id, user, invite);
      return send(res, 200, stateFor(room, user, invite));
    }
    if (!user) throw new RequestError(401, 'Sign in to join the room.');

    if (action === 'accounts') return createAccount(res, data, user);

    if (action === 'logout') {
      if (user.gateway) throw new RequestError(409, 'Sign out from Unified to end your session.');
      const key = user.username.toLowerCase();
      for (const [id, record] of sessions) {
        if (record === user) sessions.delete(id);
      }
      for (const room of rooms.values()) {
        const member = room.members.get(key);
        if (!member) continue;
        for (const [stream, record] of member.streams) {
          if (record === user) {
            member.streams.delete(stream);
            stream.end();
          }
        }
        if (!member.streams.size) closeMember(room, key, member);
        publish(room);
      }
      return send(res, 200, {}, {'Set-Cookie': cookie('', 0)});
    }
    const key = user.username.toLowerCase();
    if (action === 'create') {
      if (data.role !== undefined && !ROLES.includes(data.role)) throw new RequestError(400, 'Choose a crew role.');
      // Reopen the current room if a create response was lost or another tab already created it.
      let room = findHostedRoom(key);
      if (!room) {
        const at = now();
        const record = {
          id: randomToken(), manager: key, expires: at + ROOM_AGE,
          profile: aircraftProfile(data.profile || DEFAULT_AIRCRAFT_PROFILE)
        };
        if (roomStore) {
          record.invitation = randomToken();
          room = restoreRoom(await roomStore.createRoom(record, hash(record.invitation), at));
        } else {
          room = restoreRoom(record);
        }
      }
      if (data.profile) {
        const next = aircraftProfile(data.profile);
        if (JSON.stringify(next) !== JSON.stringify(room.profile)) room.snapshot = null;
        room.profile = next;
      }
      if (data.role !== undefined) {
        admission(room, user, data.role);
        roomInvite(room);
      }
      return send(res, 200, stateFor(room, user));
    }

    const room = readRoom(data.roomId ?? invite?.room.id, user, invite);
    if (action === 'assignFlying') {
      if (room.manager !== key && room.members.get(key)?.role !== 'instructor') {
        throw new RequestError(403, 'Only the host or Instructor can assign PF.');
      }
      if (!FLIGHT_ROLES.includes(data.role)) throw new RequestError(400, 'Choose Captain or First Officer.');
      room.flying = data.role;
      publish(room);
      return send(res, 200, stateFor(room, user));
    }
    if (['cockpit', 'command', 'flight', 'snapshot', 'scenarioReady', 'receipt'].includes(action)) {
      purge(room);
      const member = room.members.get(key);
      if (!member) throw new RequestError(403, 'Join the room before opening the cockpit.');
      member.lastSeen = now();
      if (action === 'cockpit') return send(res, 200, stateFor(room, user));
      if (member.role === 'observer') throw new RequestError(403, 'Observer is read-only.');
      if (typeof data.client !== 'string' || !CLIENT_ID.test(data.client)) {
        throw new RequestError(400, 'Invalid cockpit connection.');
      }
      if (action === 'scenarioReady' || action === 'receipt') {
        const linked = [...member.streams.keys()].some(stream => room.flightPeers.get(stream) === data.client);
        if (!linked) throw new RequestError(409, 'Cockpit stream is reconnecting.');
        if (action === 'scenarioReady') {
          if (data.scenarioSequence === room.scenarioSequence && member.readyScenario !== data.scenarioSequence) {
            member.readyScenario = data.scenarioSequence;
            publish(room);
          }
        } else {
          if (!Array.isArray(data.applied) || data.applied.length > 40 ||
              !data.applied.every(sequence => Number.isSafeInteger(sequence) && sequence > 0 && sequence <= room.sequence)) {
            throw new RequestError(400, 'Invalid cockpit receipt.');
          }
          broadcast(room, 'receipt', {role: member.role, client: data.client, applied: data.applied});
        }
        return send(res, 200, {});
      }
      if (action === 'snapshot') {
        if (room.manager !== key) throw new RequestError(403, 'Only the host publishes the shared cockpit snapshot.');
        const overhead = overheadSnapshot(data.overhead);
        room.snapshot = {sequence: room.sequence, client: data.client, overhead};
        broadcast(room, 'snapshot', room.snapshot);
        return send(res, 200, {sequence: room.sequence});
      }
      if (action === 'flight') {
        const active = roster(room);
        if (active.controller !== member.role) throw new RequestError(403, 'Only the active flight controller publishes state.');
        if ((data.flightRevision ?? 0) !== room.flightRevision || !active.flightReady) {
          return send(res, 200, {accepted: false});
        }
        if (member.flightAt !== undefined && now() - member.flightAt < 120) return send(res, 429, {error: 'Flight update too fast.'});
        if (!data.state || typeof data.state !== 'object' || !Number.isFinite(data.state.altitudeFt) ||
            !Number.isFinite(data.state.iasKt) || typeof data.paused !== 'boolean') {
          throw new RequestError(400, 'Invalid flight state.');
        }
        member.flightAt = now();
        room.flight = {state: data.state, paused: data.paused, client: data.client, role: member.role,
          flightRevision: room.flightRevision};
        broadcast(room, 'flight', room.flight);
        return send(res, 200, {});
      }
      const command = crewCommand(data.command);
      const commandId = data.commandId;
      if (commandId !== undefined) {
        if (!Number.isSafeInteger(commandId) || commandId <= 0) throw new RequestError(400, 'Invalid cockpit command ID.');
        const previous = room.commands.find(entry => entry.client === data.client && entry.commandId === commandId);
        if (previous) return send(res, 200, {sequence: previous.sequence});
      }
      if (['failure', 'failureScenario'].includes(command.type) && member.role !== 'instructor') {
        throw new RequestError(403, 'Only Instructor can send failures.');
      }
      if (command.type === 'profile' && room.manager !== key) {
        throw new RequestError(403, 'Only the host can configure the shared aircraft.');
      }
      if (command.type === 'profile') {
        room.profile = aircraftProfile(command.value);
        room.snapshot = null;
      }
      if (!member.commandAt || now() - member.commandAt > 1000) {
        member.commandAt = now();
        member.commandCount = 0;
      }
      if (++member.commandCount > 65) throw new RequestError(429, 'Too many cockpit commands.');
      const entry = {...command, sequence: ++room.sequence, client: data.client, commandId};
      if (FLIGHT_COMMANDS.has(command.type)) {
        room.flight = null;
        // Legacy cockpit pages have no revision field. A versioned flight
        // transaction prevents their late samples from overwriting the load.
        if (commandId !== undefined || room.flightRevision !== 0) room.flightRevision = entry.sequence;
        if (SCENARIO_COMMANDS.has(command.type)) {
          room.scenarioSequence = room.flightRevision;
          room.flightReady = command.type !== 'loadFlight' || commandId === undefined;
        }
        entry.flightRevision = room.flightRevision;
        entry.scenarioSequence = room.scenarioSequence;
        entry.flightReady = room.flightReady;
      }
      room.commands.push(entry);
      if (room.commands.length > 2400) room.commands.shift();
      broadcast(room, 'command', entry);
      return send(res, 200, {sequence: entry.sequence});
    }
    if (action === 'invite') {
      if (room.manager !== key || !ROLES.includes(data.role)) throw new RequestError(403, 'The room host issues invitations.');
      const boundUser = data.role === 'observer' ? null :
        typeof data.username === 'string' && usernamePattern.test(data.username) ? data.username.toLowerCase() : null;
      if (data.role !== 'observer' && (!boundUser || (!await getAccount(boundUser) && !reservedNames.has(boundUser)))) {
        throw new RequestError(400, 'Enter the username of an existing guest account.');
      }
      const assignment = data.role + ':' + (boundUser ?? '');
      let token = room.links.get(assignment);
      if (!token) {
        token = randomToken();
        room.links.set(assignment, token);
        invites.set(hash(token), {room, role: data.role, boundUser});
      }
      return send(res, 200, {invite: token});
    }
    if (action === 'join') {
      if (room.manager !== key) {
        if (invite?.room !== room || (invite.boundUser && invite.boundUser !== key)) {
          throw new RequestError(403, 'Use the invitation assigned to your account.');
        }
        if (!invite.chooseRole) data.role = invite.role;
      }
      admission(room, user, data.role);
      return send(res, 200, stateFor(room, user, invite));
    }
    if (action === 'leave') {
      const member = room.members.get(key);
      if (member) closeMember(room, key, member);
      publish(room);
      return send(res, 200, stateFor(room, user, invite));
    }
    throw new RequestError(404, 'Unknown crew action.');
  }

  function handle(req, res) {
    if (!req.url.startsWith(PREFIX + '/') && req.url.split('?')[0] !== PREFIX) {
      if (staticHandler) return staticHandler(req, res);
      return send(res, 404, {error: 'Crew API only.'});
    }
    route(req, res).catch(error => {
      if (res.headersSent) return res.destroy();
      if (!(error instanceof RequestError)) console.error('Crew request failed', error.code ?? error.name);
      send(res, error.status ?? 500, {error: error.status ? error.message : 'Crew service unavailable.'});
    });
  }

  const heartbeat = setInterval(() => {
    for (const [key, record] of sessions) if (record.expires <= now()) sessions.delete(key);
    for (const [key, bucket] of rates) if (bucket.until <= now()) rates.delete(key);
    for (const [id, room] of rooms) {
      for (const member of room.members.values()) {
        for (const [stream, record] of member.streams) {
          if (record.expires <= now()) {
            member.streams.delete(stream);
            stream.end();
          }
        }
      }
      purge(room);
      if (room.expires <= now()) {
        for (const [key, member] of room.members) closeMember(room, key, member);
        rooms.delete(id);
        for (const [key, invite] of invites) if (invite.room === room) invites.delete(key);
      } else {
        publish(room);
      }
    }
  }, 15 * 1000);
  heartbeat.unref();
  return {handle, cockpitAccess, close() {
    clearInterval(heartbeat);
    db?.close();
  }};
}

function createCrewRoomServer(options) {
  const crew = createCrewRoomHandler(options);
  const server = createServer(crew.handle);
  server.on('close', crew.close);
  return server;
}

if (require.main === module) {
  const server = createCrewRoomServer({
    origin: process.env.CREW_ORIGIN,
    database: process.env.CREW_DATABASE_PATH ?? 'crew-accounts.sqlite',
    ownerUsername: process.env.CREW_OWNER_USERNAME,
    ownerVerifier: process.env.CREW_OWNER_VERIFIER
  });
  server.listen(Number(process.env.PORT || 8789), process.env.BIND_ADDRESS || '127.0.0.1');
}

module.exports = {createCrewRoomHandler, createCrewRoomServer, makeVerifier};
