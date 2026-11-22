'use strict';

const {createHash, randomBytes, scrypt, timingSafeEqual} = require('node:crypto');
const {createServer} = require('node:http');
const {DatabaseSync} = require('node:sqlite');
const {promisify} = require('node:util');

const derive = promisify(scrypt);
const ROLES = Object.freeze(['captain', 'firstOfficer', 'instructor', 'observer']);
const PREFIX = '/api/crew';
const HOUR = 60 * 60 * 1000;
const SESSION_AGE = 12 * HOUR;
const ROOM_AGE = 12 * HOUR;
const SEAT_GRACE = 25 * 1000;
const randomToken = () => randomBytes(24).toString('base64url');
const hash = (text) => createHash('sha256').update(text).digest('hex');
const usernamePattern = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,39}$/;
const roleLabel = {captain: 'Captain', firstOfficer: 'First Officer', instructor: 'Instructor'};

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
    if (size > 4096) throw new RequestError(413, 'Request is too large.');
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

function frame(res, state) {
  if (!res.destroyed && !res.writableEnded && res.writableLength < 128 * 1024) {
    res.write(`event: roster\ndata: ${JSON.stringify(state)}\n\n`);
  } else {
    res.destroy();
  }
}

function createCrewRoomServer({origin, database, ownerUsername, ownerVerifier, staticHandler, now = Date.now}) {
  if (!origin || new URL(origin).origin !== origin ||
      (!origin.startsWith('https://') && new URL(origin).hostname !== '127.0.0.1')) {
    throw Error('CREW_ORIGIN must be an HTTPS origin or the loopback development origin.');
  }
  if (!usernamePattern.test(ownerUsername ?? '') || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(ownerVerifier ?? '')) {
    throw Error('Set CREW_OWNER_USERNAME and CREW_OWNER_VERIFIER.');
  }

  const loopback = origin === 'http://127.0.0.1';
  const db = new DatabaseSync(database);
  db.exec(`CREATE TABLE IF NOT EXISTS crew_accounts (
    username TEXT PRIMARY KEY COLLATE NOCASE,
    verifier TEXT NOT NULL
  )`);
  const getGuest = db.prepare('SELECT username, verifier FROM crew_accounts WHERE username = ?');
  const addGuest = db.prepare('INSERT OR IGNORE INTO crew_accounts VALUES (?, ?)');
  const owner = ownerUsername.toLowerCase();
  const dummyVerifier = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
  const rooms = new Map();
  const invites = new Map();
  const sessions = new Map();
  const rates = new Map();
  const cookieName = origin.startsWith('https://') ? '__Secure-unified_crew' : 'unified_crew';

  const cookie = (token, age) => `${cookieName}=${token}; Path=${PREFIX}; HttpOnly; SameSite=Strict; Max-Age=${age}` +
    (origin.startsWith('https://') ? '; Secure' : '');

  function session(req) {
    const item = (req.headers.cookie ?? '').split(';').map(x => x.trim())
      .find(value => value.startsWith(cookieName + '='));
    const key = item?.slice(cookieName.length + 1);
    const record = key && sessions.get(hash(key));
    return record && record.expires > now() ? record : null;
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
    for (const member of room.members.values()) {
      if (member.streams.size) counts[member.role]++;
      else if (member.lastSeen + SEAT_GRACE > now()) reserved[member.role]++;
    }
    return {roomId: room.id, counts, reserved};
  }

  function publish(room) {
    const state = roster(room);
    for (const member of room.members.values()) {
      for (const stream of member.streams.keys()) frame(stream, state);
    }
  }

  function closeMember(room, key, member) {
    room.members.delete(key);
    for (const stream of member.streams.keys()) stream.end();
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
    const member = {role, lastSeen: now(), streams: new Map()};
    room.members.set(key, member);
    publish(room);
    return member;
  }

  function resolveInvite(raw) {
    if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(raw)) return null;
    const invite = invites.get(hash(raw));
    return invite && invite.room.expires > now() ? invite : null;
  }

  function stateFor(room, user, invite) {
    const key = user?.username.toLowerCase();
    return {
      ...roster(room),
      role: room.members.get(key)?.role ?? null,
      invitedRole: invite?.role ?? null,
      manager: room.manager === key
    };
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

  async function account(req, res, body, user) {
    if (user) throw new RequestError(409, 'Sign out before switching accounts.');
    const {username, password, invite: rawInvite} = body;
    const setup = new URL(req.url, origin).pathname === PREFIX + '/activate';
    if (typeof username !== 'string' || !usernamePattern.test(username) ||
        typeof password !== 'string' || !password.length || password.length > 128) {
      throw new RequestError(400, 'Enter a valid username and password.');
    }
    const key = username.toLowerCase();
    if (!setup) {
      const guest = key === owner ? null : getGuest.get(key);
      const verifier = key === owner ? ownerVerifier : guest?.verifier ?? dummyVerifier;
      const verified = await checkCredential(key, () => verifyPassword(password, verifier));
      if (!verified || (key !== owner && !guest)) throw new RequestError(401, 'Incorrect username or password.');
      rates.delete(key);
      return openSession(res, key === owner ? ownerUsername : guest.username);
    }
    const invite = resolveInvite(rawInvite);
    if (!invite || invite.boundUser) throw new RequestError(404, 'Invitation is unavailable for account setup.');
    if (password.length < 12) throw new RequestError(400, 'Use at least 12 characters for your password.');
    if (key === owner) throw new RequestError(409, 'Username is already in use.');
    const verifier = await checkCredential(key, () => makeVerifier(password));
    if (invite.boundUser || !resolveInvite(rawInvite)) {
      throw new RequestError(409, 'Invitation is no longer available for account setup.');
    }
    if (!addGuest.run(username, verifier).changes) throw new RequestError(409, 'Username is already in use.');
    if (invite.role !== 'observer') invite.boundUser = key;
    rates.delete(key);
    openSession(res, username);
  }

  async function route(req, res) {
    const url = new URL(req.url, origin);
    const user = session(req);
    if (req.method === 'GET' && url.pathname === PREFIX) {
      return send(res, 200, {user: user ? {username: user.username, owner: user.owner} : null});
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
      res.on('close', () => {
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
    if (action === 'login' || action === 'activate') return account(req, res, data, user);

    const invite = resolveInvite(data.invite);
    if (action === 'inspect') {
      const room = readRoom(data.roomId ?? invite?.room.id, user, invite);
      return send(res, 200, stateFor(room, user, invite));
    }
    if (!user) throw new RequestError(401, 'Sign in to join the room.');

    if (action === 'logout') {
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
    if (action === 'create') {
      if (!user.owner) throw new RequestError(403, 'Only the Unified room host can create a room.');
      // Reopen the current room if a create response was lost or another tab already created it.
      let room = [...rooms.values()].find(item => item.manager === owner && item.expires > now());
      if (!room) {
        room = {id: randomToken(), manager: owner, expires: now() + ROOM_AGE, members: new Map(), links: new Map()};
        rooms.set(room.id, room);
      }
      return send(res, 200, stateFor(room, user));
    }

    const room = readRoom(data.roomId ?? invite?.room.id, user, invite);
    const key = user.username.toLowerCase();
    if (action === 'invite') {
      if (room.manager !== key || !ROLES.includes(data.role)) throw new RequestError(403, 'The room host issues invitations.');
      let token = room.links.get(data.role);
      if (!token) {
        token = randomToken();
        room.links.set(data.role, token);
        invites.set(hash(token), {room, role: data.role, boundUser: null});
      }
      return send(res, 200, {invite: token});
    }
    if (action === 'join') {
      if (room.manager !== key) {
        if (invite?.room !== room || (invite.boundUser && invite.boundUser !== key)) {
          throw new RequestError(403, 'Use the invitation assigned to your account.');
        }
        data.role = invite.role;
      }
      admission(room, user, data.role);
      if (room.manager !== key && invite.role !== 'observer') invite.boundUser = key;
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

  const server = createServer((req, res) => {
    if (!req.url.startsWith(PREFIX + '/') && req.url.split('?')[0] !== PREFIX) {
      if (staticHandler) return staticHandler(req, res);
      return send(res, 404, {error: 'Crew API only.'});
    }
    route(req, res).catch(error => {
      if (res.headersSent) return res.destroy();
      if (!(error instanceof RequestError)) console.error('Crew request failed', error.code ?? error.name);
      send(res, error.status ?? 500, {error: error.status ? error.message : 'Crew service unavailable.'});
    });
  });

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
  server.on('close', () => {
    clearInterval(heartbeat);
    db.close();
  });
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

module.exports = {createCrewRoomServer, makeVerifier};
