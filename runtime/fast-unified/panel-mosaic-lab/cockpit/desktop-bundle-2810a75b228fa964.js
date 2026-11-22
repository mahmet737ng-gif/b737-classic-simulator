(async()=>{
;
/* ./crew-room-v1.js?v=CREW-HOST-SYNC-0006 */
try{
(function (win, doc) {
  'use strict';

  const dialog = doc.getElementById('crewRoomDialog');
  if (!dialog) return;

  const roles = {captain: 'Captain', firstOfficer: 'First Officer', instructor: 'Instructor', observer: 'Observer'};
  const seats = {...roles, captain: 'Captain (Left Seat)', firstOfficer: 'First Officer (Right Seat)'};
  const api = '/api/crew';
  const standalone = doc.body.hasAttribute('data-crew-page');
  const tokenPattern = /^[A-Za-z0-9_-]{32}$/;
  const initialInvitation = new URLSearchParams(win.location.hash.slice(1)).get('crew');
  let invitation = tokenPattern.test(initialInvitation ?? '') ? initialInvitation : undefined;
  const cockpitRoom = new URLSearchParams(win.location.search).get('crewRoom');
  let user = null;
  let sessionReady = false;
  let room = null;
  let events = null;
  let refreshTimer = null;
  let working = false;
  let qrLoading;
  const find = selector => dialog.querySelector(selector);
  const status = find('[role="status"]');
  const account = find('[data-crew-login]');
  const guestAccount = find('[data-crew-accounts]');
  const username = account.elements.username;
  const password = account.elements.password;
  const role = account.elements.role;
  const hostRole = find('[data-crew-host-role]');
  const submit = find('[data-crew-confirm]');
  const roster = find('[data-crew-roster]');
  const online = find('[data-crew-online]');
  const invitePanel = find('[data-crew-invitations]');
  const linkEntry = find('[data-crew-link-entry]');
  const linkBox = find('[data-crew-link]');
  const linkOutput = linkBox.querySelector('input');
  const qrCanvas = find('[data-crew-qr]');

  function message(text, error = false) {
    status.textContent = text;
    status.dataset.error = String(error);
  }

  function inviteToken(value) {
    let url;
    try { url = new URL(value.trim()); } catch {}
    const tokens = url && new URLSearchParams(url.hash.slice(1)).getAll('crew');
    if (url?.origin !== win.location.origin || url.username || url.password ||
        !['/crew', '/crew/'].includes(url.pathname) || tokens.length !== 1 || !tokenPattern.test(tokens[0])) {
      throw Error('Enter a valid Unified Private Room invitation link.');
    }
    return tokens[0];
  }

  function loadQrEncoder() {
    if (typeof win.qrcode === 'function') return Promise.resolve();
    if (qrLoading) return qrLoading;
    qrLoading = new Promise((resolve, reject) => {
      const script = doc.createElement('script');
      script.src = doc.body.hasAttribute('data-crew-entry') ?
        '/crew/qrcode.js' : new URL('./vendor/qrcode-generator-2.0.4.js', doc.baseURI).href;
      script.onload = () => typeof win.qrcode === 'function' ? resolve() : reject(Error('QR encoder unavailable'));
      script.onerror = () => {
        script.remove();
        reject(Error('QR encoder unavailable'));
      };
      doc.head.append(script);
    }).catch(error => {
      qrLoading = null;
      throw error;
    });
    return qrLoading;
  }

  async function showQr(link) {
    await loadQrEncoder();
    const qr = win.qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    const count = qr.getModuleCount(), quiet = 4, scale = 5;
    qrCanvas.width = qrCanvas.height = (count + quiet * 2) * scale;
    const ctx = qrCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, qrCanvas.width, qrCanvas.height);
    ctx.fillStyle = '#000';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
      }
    }
    qrCanvas.hidden = false;
  }

  async function request(action, body) {
    const response = await fetch(action ? api + '/' + action : api, action ? {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    } : {cache: 'no-store'});
    if (!response.headers.get('content-type')?.startsWith('application/json')) {
      throw Error('Crew Rooms service is unavailable on this deployment.');
    }
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Crew Rooms service is unavailable.');
    return data;
  }

  function updateRoles(select, requiredRole) {
    for (const option of select.options) {
      const key = option.value;
      if (!key) continue;
      const occupied = key !== 'observer' && !!(room?.counts[key] || room?.reserved[key]) && room?.role !== key;
      option.disabled = occupied || !!(requiredRole && key !== requiredRole);
    }
    if (requiredRole) select.value = requiredRole;
    else if (select.selectedOptions[0]?.disabled) select.value = '';
  }

  function render() {
    const invited = !!(room && invitation && !cockpitRoom);
    linkEntry.hidden = !!room?.role || invited;
    account.hidden = !sessionReady || (!invited && !!user);
    find('[data-crew-credentials]').hidden = !!user;
    username.disabled = password.disabled = !!user;
    find('[data-crew-join]').hidden = role.disabled = !invited;
    submit.textContent = invited ? 'Join Room' : 'Sign In';
    guestAccount.hidden = !user?.owner;
    find('[data-crew-host]').hidden = !user?.owner || invited;
    hostRole.value = room?.role ?? '';
    updateRoles(hostRole);
    updateRoles(role, invited ? room.invitedRole : null);
    if (!invited) role.value = '';
    else if (room.role && !role.value) role.value = room.role;
    submit.disabled = invited && !!role.value && role.selectedOptions[0]?.disabled;
    find('[data-crew-close]').hidden = standalone;
    find('[data-crew-back]').hidden = !standalone;
    find('[data-crew-user]').textContent = user ? 'Signed in as ' + user.username : '';
    find('[data-crew-logout]').hidden = !user || !!user.gateway;
    roster.hidden = !room;
    find('[data-crew-enter]').hidden = !room?.role || !!cockpitRoom || invited;
    find('[data-crew-duties]').hidden = !(room?.manager || room?.role === 'instructor');
    find('[data-crew-leave]').hidden = !room?.role;
    invitePanel.hidden = !room?.manager || !room?.roomInvite;
    if (!room) return;
    for (const [key, label] of Object.entries(seats)) {
      const count = room.counts[key];
      const reserved = room.reserved[key];
      find('[data-crew-count="' + key + '"]').textContent = key === 'observer' ? String(count) : count + ' / 1';
      find('[data-crew-seat="' + key + '"]').textContent = key !== 'observer' && reserved ? label + ' · Reconnecting' : label;
    }
    online.replaceChildren(...(room.online ?? []).map(member => {
      const item = doc.createElement('li');
      item.textContent = member.username + ' · ' + seats[member.role];
      return item;
    }));
    online.hidden = !online.childElementCount;
    find('[data-crew-flying]').value = room.flying;
    const pm = room.flying === 'captain' ? 'firstOfficer' : 'captain';
    find('[data-crew-flight-duties]').textContent = 'PF: ' + roles[room.flying] + ' · PM: ' + roles[pm];
    find('[data-crew-seat-status]').textContent = room.role ? 'Your role: ' + roles[room.role] :
      room.invitedRole ? 'Invited as ' + roles[room.invitedRole] : invited ? 'Choose an available role.' : '';
  }

  const AIRCRAFT_PROFILE_KEY = 'b737classic.aircraft-profile.v1';
  function hostAircraftProfile() {
    try {
      return win.B737AircraftProfileStore?.get() ??
        JSON.parse(win.localStorage.getItem(AIRCRAFT_PROFILE_KEY) || 'null');
    } catch { return null; }
  }
  function savedHostOverhead() {
    // The host's cockpit may have navigated to /crew/ before the other pilot
    // joins. Switch models persist on this same origin; seed the room now.
    try {
      const toggles = JSON.parse(win.localStorage.getItem('b737-overhead-toggles-TGL-0001') || 'null');
      const rotary = JSON.parse(win.localStorage.getItem('b737-overhead-rotary-guards-RG-0006-GUARDS-CLEARED') || 'null');
      if (!toggles || !rotary?.rotaries || !rotary?.guards) return null;
      const overhead = {toggles, rotaries: rotary.rotaries, guards: rotary.guards};
      return JSON.stringify(overhead).length <= 10000 ? overhead : null;
    } catch { return null; }
  }
  function enterCockpit() {
    // Apply the host profile BEFORE navigation, so initial image selection,
    // Overhead, EIS/Non-EIS and CPCS/DCPCS boot from the same airframe.
    if (room?.profile) {
      try { win.localStorage.setItem(AIRCRAFT_PROFILE_KEY, JSON.stringify(room.profile)); }
      catch { message('Unable to apply the host aircraft configuration.', true); return; }
    }
    const url = new URL('/panel-mosaic-lab/unified/', win.location.href);
    url.searchParams.set('crewRoom', room.roomId);
    if (invitation) sessionStorage.setItem('unified-crew-invite', invitation);
    win.location.assign(url);
  }

  async function showRoomInvite() {
    if (!room?.manager || !room.roomInvite) return;
    const url = new URL('/crew/', win.location.href);
    url.hash = new URLSearchParams({crew: room.roomInvite});
    if (qrCanvas.hidden || url.href !== linkOutput.value) {
      linkOutput.value = url.href;
      qrCanvas.hidden = true;
      linkBox.hidden = false;
      render();
      try {
        await showQr(url.href);
      } catch {
        message('QR code unavailable. Use Copy Link to share this invitation.');
      }
    }
  }

  function trackRoster() {
    const id = room?.roomId;
    events?.close();
    events = null;
    clearInterval(refreshTimer);
    if (room?.role) {
      const url = new URL(api + '/events', win.location.href);
      url.searchParams.set('room', id);
      events = new EventSource(url);
      events.addEventListener('roster', event => {
        const state = JSON.parse(event.data);
        if (room?.roomId !== state.roomId) return;
        Object.assign(room, state);
        if (status.dataset.error === 'reconnecting') message('');
        render();
      });
      events.addEventListener('error', () => {
        if (status.textContent && status.dataset.error !== 'reconnecting') return;
        message('Reconnecting to Crew Room…');
        status.dataset.error = 'reconnecting';
      });
    } else if (id && (standalone || dialog.open)) {
      refreshTimer = setInterval(async () => {
        if (working) return;
        try {
          const state = await request('inspect', {invite: invitation, roomId: id});
          if (room?.roomId === id && !room.role && !working) {
            room = state;
            render();
          }
        } catch (error) {
          clearInterval(refreshTimer);
          message(error.message, true);
        }
      }, 3000);
    }
  }

  async function inspectRoom() {
    if (room || invitation || cockpitRoom) {
      room = await request('inspect', {invite: invitation, roomId: room?.roomId ?? cockpitRoom ?? undefined});
      trackRoster();
    }
    render();
  }

  async function busy(task) {
    if (working) return;
    working = true;
    dialog.setAttribute('aria-busy', 'true');
    message('');
    try {
      await task();
    } catch (error) {
      message(error.message, true);
    } finally {
      working = false;
      dialog.removeAttribute('aria-busy');
      render();
    }
  }

  function open() {
    if (!standalone && !dialog.open) dialog.showModal();
    return busy(async () => {
      const session = await request();
      user = session.user;
      sessionReady = true;
      if (!invitation && !cockpitRoom) room = session.hostedRoom ?? room;
      await inspectRoom();
      await showRoomInvite();
    });
  }

  for (const button of doc.querySelectorAll('[data-crew-open]')) {
    button.addEventListener('click', () => {
      if (cockpitRoom || standalone) open();
      else win.location.assign('/crew/');
    });
  }
  find('[data-crew-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => clearInterval(refreshTimer));

  linkEntry.addEventListener('submit', event => {
    event.preventDefault();
    busy(async () => {
      const next = inviteToken(linkEntry.elements.url.value);
      const state = await request('inspect', {invite: next});
      invitation = next;
      room = state;
      const url = new URL(win.location.href);
      const hash = new URLSearchParams(url.hash.slice(1));
      hash.set('crew', next);
      url.hash = hash;
      win.history.replaceState(win.history.state, '', url);
      linkEntry.reset();
      trackRoster();
      render();
      if (!user) username.focus();
      else role.focus();
    });
  });

  account.addEventListener('submit', event => {
    event.preventDefault();
    busy(async () => {
      const selectedRole = role.value;
      if (!user) {
        ({user} = await request('login', {username: username.value.trim(), password: password.value}));
        password.value = '';
      }
      if (invitation && room) {
        room = await request('join', {roomId: room.roomId, role: selectedRole, invite: invitation});
        enterCockpit();
        return;
      }
      await inspectRoom();
      await showRoomInvite();
    });
  });

  guestAccount.addEventListener('submit', event => {
    event.preventDefault();
    busy(async () => {
      const {username, password} = guestAccount.elements;
      const created = await request('accounts', {username: username.value.trim(), password: password.value});
      guestAccount.reset();
      message('Account created for ' + created.username + '.');
    });
  });

  hostRole.addEventListener('change', () => {
    const selectedRole = hostRole.value;
    if (!selectedRole) { render(); return; }
    busy(async () => {
      room = await request('create', {role: selectedRole, ...(hostAircraftProfile() ? {profile: hostAircraftProfile()} : {})});
      const overhead = savedHostOverhead();
      if (overhead) {
        try {
          await request('snapshot', {roomId: room.roomId, client: 'unified-host-lobby', overhead});
        } catch (error) {
          console.warn('Crew initial overhead snapshot unavailable', error.message);
        }
      }
      trackRoster();
      await showRoomInvite();
    });
  });

  find('[data-crew-flying]').addEventListener('change', event => busy(async () => {
    room = await request('assignFlying', {roomId: room.roomId, role: event.target.value});
  }));

  find('[data-crew-enter]').addEventListener('click', enterCockpit);

  find('[data-crew-leave]').addEventListener('click', () => busy(async () => {
    if (cockpitRoom) {
      await request('leave', {roomId: cockpitRoom});
      const saved = sessionStorage.getItem('unified-crew-invite');
      win.location.assign(user?.owner ? '/panel-mosaic-lab/unified/' : '/crew/' + (saved ? '#crew=' + saved : ''));
      return;
    }
    room = await request('leave', {roomId: room.roomId, invite: invitation});
    trackRoster();
  }));

  find('[data-crew-logout]').addEventListener('click', () => busy(async () => {
    await request('logout', {});
    user = null;
    room = null;
    trackRoster();
    await inspectRoom();
  }));

  find('[data-crew-copy]').addEventListener('click', () => {
    busy(async () => {
      const copied = await win.navigator.clipboard?.writeText(linkOutput.value).then(() => true, () => false);
      if (copied) {
        message('Invitation link copied.');
        return;
      }
      linkOutput.focus();
      linkOutput.select();
      message('Invitation link selected. Use your browser’s Copy command.');
    });
  });

  render();
  // Opening an invitation from an already-open lobby can change only the URL fragment.
  if (standalone) win.addEventListener('hashchange', () => win.location.reload());
  if (invitation || doc.body.hasAttribute('data-crew-entry')) open();
})(window, document);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./crew-cockpit-v1.js?v=CREW-HOST-SYNC-0002 */
try{
(function (win, doc) {
  'use strict';

  const roomId = new URLSearchParams(win.location.search).get('crewRoom');
  if (!/^[A-Za-z0-9_-]{32}$/.test(roomId ?? '')) return;

  const byId = id => doc.getElementById(id);
  const client = Array.from(crypto.getRandomValues(new Uint8Array(16)),
    n => n.toString(16).padStart(2, '0')).join('');
  const labels = {captain: 'Captain · Left Seat', firstOfficer: 'First Officer · Right Seat',
    instructor: 'Instructor', observer: 'Observer · View Only'};
  const hooked = new WeakSet();
  const queue = [];
  let role = null;
  let controller = null;
  let online = false;
  let replay = false;
  let lastSequence = 0;
  let latestFlight;
  let commandWrites = Promise.resolve();
  let flightWrite = false;
  let flightChangedAt = 0;
  let roster = null;
  let currentOverhead = null;
  let lastPublishedOverhead = null;
  let lastReceivedOverhead = null;
  let snapshotTimer = null;
  doc.documentElement.dataset.crewRole = 'pending';

  const status = doc.createElement('span');
  status.id = 'crewCockpitStatus';
  status.setAttribute('role', 'status');
  status.textContent = 'Connecting to Crew Room…';
  doc.querySelector('.unified-minimal-header .header-settings')?.append(status);

  function guardInput(event, nested) {
    if (role && role !== 'observer' && (role === 'instructor' || !event.target.closest?.(
      '#workspaceLabsToggle,#workspaceLabsMenu,#failuresHeaderOpen,#failuresHeaderPopover'))) return;
    const source = event.target;
    if (!source.closest) return;
    // Every crew member sees the host's aircraft installation; a guest
    // cannot change just their local EIS/CPCS/737 family and diverge.
    if (role && !roster?.manager && source.closest('#aircraftSettingsOpen,#aircraftSettingsDialog')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!nested && source.closest('#crewRoomDialog,[data-crew-open],[data-focus],#zoomIn,#zoomOut,#zoomReset,#fit,#zoom,#unifiedWelcomeRetry')) return;
    const control = source.closest('button,input,select,textarea,a[href],[role="button"],[role="switch"],[role="slider"],[tabindex]:not([id="viewport"])');
    if (event.type === 'wheel' && (event.ctrlKey || event.metaKey || !control)) return;
    if (event.type === 'touchstart' && event.touches.length > 1) return;
    const keyboard = event.type === 'keydown' || event.type === 'keyup';
    if (!control && !(nested && event.type === 'click')) return;
    if (keyboard && ['Tab', 'Escape'].includes(event.key)) return;
    if (event.type === 'wheel' && /zoom/i.test(control?.id || '')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function protect(document, nested = false) {
    if (hooked.has(document)) return;
    hooked.add(document);
    for (const type of ['click', 'dblclick', 'pointerdown', 'pointerup', 'touchstart', 'wheel', 'keydown', 'keyup', 'change', 'submit']) {
      document.addEventListener(type, event => guardInput(event, nested), {capture: true, passive: false});
    }
  }

  function syncLabAccess() {
    const labs = byId('workspaceLabsToggle');
    if (labs && role) labs.hidden = role !== 'instructor';
  }

  function bindFrames() {
    for (const frame of doc.querySelectorAll('iframe')) {
      try {
        if (frame.contentDocument) protect(frame.contentDocument, true);
      } catch {}
    }
  }
  protect(doc);
  doc.addEventListener('load', event => {
    if (event.target.tagName === 'IFRAME') bindFrames();
  }, true);

  function refreshStatus(message) {
    if (message) {
      status.textContent = message;
      return;
    }
    const duty = role === roster?.flying ? ' · PF' :
      ['captain', 'firstOfficer'].includes(role) ? ' · PM' : '';
    const pending = queue.filter(entry => entry.client !== client).length;
    const connection = !online ? ' · Reconnecting…' : pending ? ' · Sync pending (' + pending + ')' : ' · Connected';
    const next = (labels[role] ?? 'Crew Room') + duty + connection;
    if (status.textContent !== next) status.textContent = next;
  }

  async function send(action, body = {}) {
    const reply = await fetch('/api/crew/' + action, {method: 'POST', cache: 'no-store',
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({roomId, client, ...body})});
    if (!reply.ok) {
      const failure = await reply.json().catch(() => ({}));
      throw Error(failure.error || 'Crew Room connection unavailable.');
    }
    return reply.json();
  }

  function command(type, id, value) {
    if (!online || role === 'observer' || replay || value === undefined || value === null) return;
    commandWrites = commandWrites.then(() => send('command', {command: {type, id, value}}))
      .catch(error => refreshStatus(error.message));
  }
  function publishHostSnapshot() {
    if (snapshotTimer || !roster?.manager || !online || !currentOverhead) return;
    snapshotTimer = setTimeout(() => {
      snapshotTimer = null;
      if (!roster?.manager || !online || !currentOverhead) return;
      const overhead = currentOverhead;
      const serialized = JSON.stringify(overhead);
      if (serialized === lastPublishedOverhead) return;
      lastPublishedOverhead = serialized;
      // Preserve ordering with all interactive changes already accepted locally.
      commandWrites = commandWrites.then(() => send('snapshot', {overhead}))
        .catch(error => { lastPublishedOverhead = null; refreshStatus(error.message); });
    }, 350);
  }

  const flight = () => win.B737UnifiedFlightScenarioV1;
  const radio = () => win.B737UnifiedVHFDualV1;
  function available(entry) {
    if (['toggle', 'rotary', 'guard'].includes(entry.type)) {
      return byId('overheadFrame')?.contentWindow?.B737CrewOverheadV1?.ready();
    }
    if (['loadFlight', 'flightTargets', 'pauseFlight', 'stopFlight'].includes(entry.type)) return flight();
    if (entry.type === 'profile') return win.B737AircraftProfileStore;
    if (entry.type === 'cdu') return byId('cduFrame' + entry.id)?.contentWindow?.B737CrewCduV1;
    if (entry.type === 'frequency') return radio()?.getState(entry.id);
    if (entry.type === 'commTransfer') return win.B737UnifiedVHFCommTFRV1;
    if (entry.type === 'navMode') return win.B737UnifiedVHFNavControlsV1;
    if (entry.type === 'firePanel') return typeof win.B737UnifiedFireLights?.dispatch === 'function';
    if (entry.type === 'efis') return typeof win.B737UnifiedEFISPedestalV1?.operate === 'function';
    if (entry.type === 'mcpValue') return typeof win.B737McpVisualV3?.setValue === 'function';
    if (entry.type === 'mcpHardware') return typeof win.B737McpHardwareV1?.setState === 'function';
    if (entry.type === 'mcpMode') return typeof win.B737McpAFDSBridgeV1?.press === 'function';
    if (entry.type === 'autobrake') return typeof win.B737AutobrakeUnified?.setSelector === 'function';
    if (entry.type === 'trim') return typeof win.B737StabilizerTrim?.set === 'function';
    if (entry.type === 'cb') return typeof win.B737UnifiedCB?.snapshot === 'function' &&
      !!win.B737UnifiedCircuitGatesV1?.STORAGE;
    if (entry.type === 'flap') return win.B737FlapVisualTest?.ready();
    if (entry.type === 'speedbrake') return win.B737SpeedbrakeLever?.mounted();
    if (entry.type === 'throttle') return win.B737ThrottlePositions?.mounted();
    if (entry.type === 'startLever') return win.B737EngineStartLevers;
    if (entry.type === 'gear') return win.B737LandingGearUnifiedV1;
    if (entry.type === 'failure' || entry.type === 'failureScenario') {
      return win.B737UnifiedInstructorNonNormalV1 && win.B737UnifiedAdvancedInstructorV1;
    }
    return true;
  }

  function apply(entry) {
    const {type, id, value} = entry;
    switch (type) {
      case 'toggle':
      case 'rotary':
      case 'guard':
        return byId('overheadFrame').contentWindow.B737CrewOverheadV1.apply(type, id, value);
      case 'profile': win.B737AircraftProfileStore.set(value); break;
      case 'cdu': byId('cduFrame' + id).contentWindow.B737CrewCduV1.press(value); break;
      case 'efis': {
        const [seat, key] = id.split('.');
        win.B737UnifiedEFISPedestalV1.operate(seat, key, value);
        break;
      }
      case 'frequency': radio().setFrequency(id, value); break;
      case 'commTransfer': win.B737UnifiedVHFCommTFRV1.setActive(id, value); break;
      case 'navMode': win.B737UnifiedVHFNavControlsV1.setMode(id, value); break;
      case 'autobrake': win.B737AutobrakeUnified?.setSelector(value); break;
      case 'trim': win.B737StabilizerTrim?.set(value, id); break;
      case 'firePanel':
        if (['SELECT_LOOP','PULL','ROTATE','OVERRIDE','BELL_CUTOUT','TEST','EXT_TEST'].includes(id)) {
          const native = {...value, type: id};
          if (value.released) native.value = null;
          win.B737UnifiedFireLights.dispatch(native);
        }
        break;
      case 'cb': {
        const current = win.B737UnifiedCB?.snapshot();
        const key = win.B737UnifiedCircuitGatesV1?.STORAGE;
        if (!current || !key) return false;
        const old = current.breakers.find(entry => entry.id === id);
        if (old && !value && old.fault) break;
        if (value) lastBreakers.add(id);
        else lastBreakers.delete(id);
        current.breakers = current.breakers.filter(entry => entry.id !== id);
        if (value) current.breakers.push({id, pulled: true, tripped: old?.tripped ?? false, fault: old?.fault ?? null});
        localStorage.setItem(key, JSON.stringify(current));
        win.B737UnifiedCB.refresh();
        break;
      }
      case 'mcpValue': win.B737McpVisualV3?.setValue(id, value); break;
      case 'mcpHardware': win.B737McpHardwareV1?.setState(id, value); break;
      case 'mcpMode': win.B737McpAFDSBridgeV1?.press(id); break;
      case 'throttle': win.B737ThrottlePositions.set(Number(id), value); break;
      case 'flap': win.B737FlapVisualTest.request(value); break;
      case 'gear': win.B737LandingGearUnifiedV1.select(id, {lockOverride: value}); break;
      case 'speedbrake': win.B737SpeedbrakeLever.set(value); break;
      case 'startLever': win.B737EngineStartLevers.request(id, value); break;
      case 'toga': win.dispatchEvent(new CustomEvent('b737:toga-request', {detail: {source: id}})); break;
      case 'loadFlight': flight().loadScenario(value); break;
      case 'flightTargets':
        if (flight().getState()) {
          flight().command({type: 'SPEED', value: value.speedKt});
          flight().command({type: 'HEADING', value: value.headingDeg});
          if (Math.abs(flight().getState().altitudeFt - value.altitudeFt) > 50) {
            flight().command({type: 'ALTITUDE', value: value.altitudeFt});
          }
        }
        break;
      case 'pauseFlight': flight().pause(value); break;
      case 'stopFlight': flight().stop(); break;
      case 'failure': {
        const [group, fault] = id.split('.');
        if (group === 'advanced') win.B737UnifiedAdvancedInstructorV1.setFailure(id.slice(9), value);
        else if (fault) win.B737UnifiedInstructorNonNormalV1.toggle(group, fault, value);
        break;
      }
      case 'failureScenario':
        if (id.startsWith('advanced.')) win.B737UnifiedAdvancedInstructorV1.launchScenario(id.slice(9), value);
        else win.B737UnifiedInstructorNonNormalV1.startScenario(id, value);
        break;
      default: return false;
    }
    return true;
  }

  function receiveHostSnapshot(snapshot) {
    if (snapshot.client === client || !Number.isSafeInteger(snapshot.sequence) ||
        snapshot.sequence < lastSequence || !snapshot.overhead) return;
    const {toggles, rotaries, guards} = snapshot.overhead;
    if (!toggles || !rotaries || !guards) return;
    // A snapshot covers overhead only. It must never discard pending MCP,
    // flight or CDU commands waiting for independent instruments to hydrate.
    lastSequence = Math.max(lastSequence, snapshot.sequence);
    const previous = lastReceivedOverhead;
    for (const [type, group] of [['guard', guards], ['rotary', rotaries], ['toggle', toggles]]) {
      const groupName = type === 'guard' ? 'guards' : type === 'rotary' ? 'rotaries' : 'toggles';
      for (const [id, value] of Object.entries(group)) {
        if (previous && JSON.stringify(previous[groupName]?.[id]) === JSON.stringify(value)) continue;
        for (let i = queue.length - 1; i >= 0; i--) {
          if (queue[i].type === type && queue[i].id === id &&
              (queue[i].sequence === undefined || queue[i].sequence <= snapshot.sequence)) {
            queue.splice(i, 1);
          }
        }
        queue.push({type, id, value: type === 'guard' ?
          {open: value.guard === 'open', value: value.value} : value});
      }
    }
    lastReceivedOverhead = snapshot.overhead;
    drain();
  }

  function receiveFlight() {
    if (!latestFlight || !flight() || queue.some(entry =>
      ['profile', 'loadFlight', 'flightTargets', 'pauseFlight', 'stopFlight'].includes(entry.type))) return;
    const update = latestFlight;
    latestFlight = null;
    if (update.client !== client && role !== controller) flight().followCrew(update.state, update.paused);
  }

  function drain() {
    // Do not lose a remote command because its instrument has not mounted.
    // Commands for unrelated controls may pass a pending instrument.
    const blocked = new Set();
    let changed = false;
    for (let index = 0; index < queue.length;) {
      const entry = queue[index];
      const key = entry.type + ':' + entry.id;
      if (entry.client === client) {
        queue.splice(index, 1);
        changed = true;
        continue;
      }
      if (blocked.has(key) || (entry.retryAt && performance.now() < entry.retryAt) || !available(entry)) {
        blocked.add(key);
        index++;
        continue;
      }
      replay = true;
      try {
        if (apply(entry) === false) throw Error('Control declined the remote value');
        queue.splice(index, 1);
        changed = true;
      } catch (error) {
        const now = performance.now();
        entry.retryAt = now + 400;
        if (!entry.lastWarning || now - entry.lastWarning > 10000) {
          entry.lastWarning = now;
          console.warn('Crew cockpit command pending; will retry', entry.type, entry.id, error.message);
        }
        blocked.add(key);
        index++;
      } finally {
        replay = false;
      }
    }
    receiveFlight();
    if (changed) refreshStatus();
  }

  function readRoster(data) {
    roster = {...roster, ...data};
    controller = data.controller;
    flight()?.crewFollower(role !== controller);
    refreshStatus();
    syncLabAccess();
    publishHostSnapshot();
  }

  win.addEventListener('message', event => {
    if (event.origin !== win.location.origin) return;
    const data = event.data;
    if (data?.type === 'b737:cockpit-overhead' && data.kind === 'controls-state' &&
        event.source === byId('overheadFrame')?.contentWindow) {
      if (data.toggles && data.rotaries && data.guards) {
        currentOverhead = {toggles: data.toggles, rotaries: data.rotaries, guards: data.guards};
        if (!replay) publishHostSnapshot();
      }
      return;
    }
    if (data?.type === 'b737:cb-state-changed' && event.source === byId('cbPanelFrame')?.contentWindow) {
      const state = win.B737UnifiedCB?.snapshot();
      const next = new Set(state?.breakers.filter(entry => entry.pulled || entry.tripped).map(entry => entry.id));
      for (const id of next) if (!lastBreakers.has(id)) command('cb', id, true);
      for (const id of lastBreakers) if (!next.has(id)) command('cb', id, false);
      lastBreakers = next;
      return;
    }
    if (data?.type === 'b737:unified-cdu' && data.kind === 'crew-key' &&
        ['CAPT', 'FO'].includes(data.seat) && event.source === byId('cduFrame' + data.seat)?.contentWindow) {
      command('cdu', data.seat, data.key);
      return;
    }
    if (event.source !== byId('overheadFrame')?.contentWindow) return;
    if (data?.kind === 'ready') drain();
    if (data?.type !== 'b737:cockpit-overhead' || data.kind !== 'control-event' || data.crewReplay) return;
    const {kind, id, next, reason} = data.event ?? {};
    if (['meter-owner-sync', 'aircon-variant-change', 'ISN03_STARTER_CUTOUT', 'flight-scenario-instructor'].includes(reason)) return;
    if (kind === 'guarded' && next) command('guard', id, {open: next.guard === 'open', value: next.value});
    if (kind === 'toggle' || kind === 'rotary') command(kind, id, next);
  });

  const listen = (target, name, project) => target.addEventListener(name, event => project(event.detail ?? {}));
  listen(win, 'b737:aircraft-profile-change', d => {
    if (d.reason === 'updated' && roster?.manager) {
      command('profile', 'aircraft', d.profile);
      // The newly selected airframe may alter valid Overhead detents/artwork.
      // Re-publish its settled switches after the profile command.
      lastPublishedOverhead = null;
      publishHostSnapshot();
    }
  });
  listen(win, 'b737:unified-efis-control', d => {
    const key = d.control;
    if (key && key !== 'engine-view') command('efis', d.seat + '.' + key,
      key === 'rst' ? true : d.state[key] ?? d.state.brightness[key] ?? d.state.options[key]);
  });
  let lastBreakers = new Set((win.B737UnifiedCB?.snapshot?.()?.breakers || []).map(entry => entry.id));
  let lastAutobrake = win.B737AutobrakeUnified?.getState?.()?.selector;
  listen(win, 'b737:autobrake-state', d => {
    if (d.selector !== lastAutobrake) command('autobrake', 'selector', d.selector);
    lastAutobrake = d.selector;
  });
  listen(win, 'b737:stabilizer-trim-position', d => {
    if (['MANUAL', 'MAIN_ELECTRIC'].includes(d.source)) command('trim', d.source, d.units);
  });
  listen(win, 'b737:unified-vhf-frequency', d => {
    if (d.part !== 'external') command('frequency', d.id, d.frequencyKhz);
  });
  listen(win, 'b737:vhf-comm-tfr', d => {
    if (d.reason === 'transfer') command('commTransfer', d.seat, d.activeSide);
  });
  listen(win, 'b737:vhf-nav-mode', d => {
    if (d.reason === 'select') command('navMode', d.seat, d.mode);
  });
  listen(win, 'b737:crew-fire-panel-command', d => {
    const {type, ...native} = d;
    if (native.value === null) {
      delete native.value;
      native.released = true;
    }
    command('firePanel', type, native);
  });
  listen(win, 'b737:mcp-value-change', d => {
    if (d.method !== 'external') command('mcpValue', d.control, d.value);
  });
  listen(win, 'b737:mcp-hardware-change', d => {
    if (d.method !== 'external') command('mcpHardware', d.id, d.value);
  });
  listen(win, 'b737:mcp-button-request', d => command('mcpMode', d.id, true));
  listen(doc, 'b737:throttle-position', d => command('throttle', String(d.engine), d.percent));
  listen(doc, 'b737:flap-lever-command', d => command('flap', 'flap', d.detent));
  listen(doc, 'b737:speedbrake-position', d => command('speedbrake', 'speedbrake', d.position));
  listen(win, 'b737:landing-gear-command', d => command('gear', d.position, d.lockOverride));
  listen(win, 'b737:engine-start-lever-command', d => command('startLever', d.device, d.position));
  listen(win, 'b737:toga-request', d => command('toga', d.source, true));
  listen(win, 'b737:crew-flight-command', d => command(d.type, 'flight', d.value));
  listen(win, 'b737:instructor-failure-change', d => {
    if (role === 'instructor') command('failure', d.group + '.' + d.id, d.active);
  });
  let advancedFaults = new Set();
  listen(win, 'b737:advanced-failures-changed', d => {
    const next = new Set(d.failures);
    if (role === 'instructor') {
      for (const id of next) if (!advancedFaults.has(id)) command('failure', 'advanced.' + id, true);
      for (const id of advancedFaults) if (!next.has(id)) command('failure', 'advanced.' + id, false);
    }
    advancedFaults = next;
  });
  listen(win, 'b737:instructor-scenario-loaded', d => {
    if (role !== 'instructor' || !d.id) return;
    command('failureScenario', 'advanced.' + d.id, {...(d.cause && {cause: d.cause}),
      ...(d.severity && {severity: d.severity})});
  });
  listen(win, 'b737:instructor-scenario-change', d => {
    const names = {EMERGENCY_DESCENT: 'emergency', BOTH_BUS_OFF_CLIMB: 'bothBus', HYDRAULIC_LOSS_CRUISE: 'hydraulic'};
    if (role !== 'instructor' || !names[d.id]) return;
    command('failureScenario', names[d.id], {...(d.cause && {cause: d.cause}),
      ...(d.severity && {severity: d.severity}), ...(d.failure && {system: d.failure})});
  });
  listen(win, 'b737:flight-scenario-state', state => {
    const time = performance.now();
    if (!online || replay || role !== controller || !state?.target || flightWrite || time - flightChangedAt < 200) return;
    flightChangedAt = time;
    flightWrite = true;
    commandWrites.then(() => send('flight', {state, paused: flight().getDiagnostics().paused}))
      .catch(() => {}).finally(() => { flightWrite = false; });
  });

  async function connect() {
    try {
      const data = await send('cockpit');
      role = data.role;
      doc.documentElement.dataset.crewRole = role;
      readRoster(data);
      const url = new URL('/api/crew/events', win.location.href);
      url.searchParams.set('room', roomId);
      url.searchParams.set('cockpit', '1');
      const feed = new EventSource(url);
      feed.addEventListener('open', () => {
        online = true; refreshStatus(); publishHostSnapshot();
      });
      feed.addEventListener('roster', event => readRoster(JSON.parse(event.data)));
      feed.addEventListener('snapshot', event => receiveHostSnapshot(JSON.parse(event.data)));
      feed.addEventListener('command', event => {
        const entry = JSON.parse(event.data);
        if (entry.sequence <= lastSequence) return;
        lastSequence = entry.sequence;
        queue.push(entry);
        drain();
      });
      feed.addEventListener('flight', event => {
        latestFlight = JSON.parse(event.data);
        receiveFlight();
      });
      feed.addEventListener('error', () => {
        online = false;refreshStatus();
        if (feed.readyState === EventSource.CLOSED) refreshStatus('Crew Room disconnected. Rejoin to continue.');
      });
      setInterval(() => {drain();syncLabAccess();}, 120);
      bindFrames();
    } catch (error) {
      refreshStatus(error.message);
    }
  }

  connect();
})(window, document);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./instructor-nonnormal-v1.js?v=INSTRUCTOR-NONNORMAL-0001 */
try{
/* Unified Instructor Non-Normal V1 — additive Failure / Scenario integration.
 * Training model only. Do not edit frozen OH artwork, guards, IRS display or instruments.
 */
(function (root) {
 'use strict';
 const doc=root.document;
 const KEY='b737classic.instructor-nonnormal.v1';
 const G={
  navigation:[
   ['irs.L','IRS LEFT FAILURE'],['irs.R','IRS RIGHT FAILURE'],['irs.BOTH','BOTH IRS FAILURE'],
   ['fmc.BOTH','BOTH FMC FAILURE']],
  instruments:['CAPT','FO'].flatMap(seat=>['EADI','EHSI','ASI','ALTIMETER','VSI','RDMI','IVSI'].map(id=>[seat+'.'+id,seat+' '+id+' FAILURE'])),
  air:[['autoFail','PRESSURIZATION AUTO FAIL'],['cargoDoor','CARGO DOOR PRESSURE LOSS']],
  engines:[['valve1','ENG 1 START VALVE STUCK OPEN'],['valve2','ENG 2 START VALVE STUCK OPEN']],
  hydraulics:[['lossA','HYDRAULIC SYSTEM A LOSS'],['lossB','HYDRAULIC SYSTEM B LOSS'],['lossBoth','BOTH HYDRAULIC SYSTEMS LOSS']],
  electrical:[['bothBus','BOTH GENERATOR BUSES OFF']]
 };
 const busy={navigation:new Set(),instruments:new Set(),air:new Set(),engines:new Set(),hydraulics:new Set(),electrical:new Set()};
 let previousIRS={},ownBuses=[],pressure=null,mode='AUTO',lastPerformance=0,installed=false,renderNeeded=true,advancedRetries=0;
 const $=id=>doc.getElementById(id);
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const pressurePsi=ft=>14.696*Math.pow(Math.max(.00001,1-.00000687535*clamp(ft,-1000,60000)),5.2559);
 const difference=(aircraft,cabin)=>Math.max(0,pressurePsi(cabin)-pressurePsi(aircraft));
 const active=(category,id)=>busy[category].has(id);
 const present=(category,id,value)=>{if(value)busy[category].add(id);else busy[category].delete(id);};
 const pressureState=()=>pressure?{...pressure}:null;
 const announce=(name,detail)=>root.dispatchEvent(new CustomEvent(name,{detail}));
 function overheadFault(id,on){
  // Use the existing overhead command receiver rather than modifying locked photo art.
  const frame=$('overheadFrame');
  if(frame?.contentWindow)frame.contentWindow.postMessage({
   type:'b737:cockpit-command',action:'fault',id,active:on},root.location.origin);
 }
 const status=(id,text,bad=false)=>{const node=$(id);if(node){node.textContent=text;node.dataset.error=String(bad);}};
 function persist(){try{root.sessionStorage.setItem(KEY,JSON.stringify({active:Object.fromEntries(Object.entries(busy).map(([k,v])=>[k,[...v]])),mode}));}catch(_){}}
 function busWrite(enabled){
  const bus=root.B737UnifiedBusFailureInjectionV1;
  if(!bus?.live?.get||!bus?.live?.write)throw Error('ELECTRICAL INJECTION SOURCE NOT READY');
  const keys=bus.live.get().offBusKeys.slice();
  const inject=['generator1@115VAC','generator2@115VAC'];
  const retained=keys.filter(k=>!ownBuses.includes(k));
  if(enabled){ownBuses=inject.filter(k=>!keys.includes(k));}
  const merged=enabled?[...new Set([...retained,...keys,...inject])]:retained;
  bus.live.write(bus.payload(merged));
 }
 function setIRS(which,on){
  const api=root.B737IRSTrainerUnified;
  if(!api?.setMode||!api?.getState)throw Error('IRS TRAINER NOT READY');
  const sides=which==='BOTH'?['L','R']:[which];
  for(const side of sides){
   if(on){if(previousIRS[side]===undefined)previousIRS[side]=api.getState().units[side]?.mode||'NAV';api.setMode(side,'OFF');}
   else if(previousIRS[side]!==undefined){
    const prior=previousIRS[side];delete previousIRS[side];
    try{api.setMode(side,prior);}catch(_){api.setMode(side,'OFF');}
   }
  }
 }
 function setHydraulic(id,on){
  const lab=root.B737HydraulicLabV1;
  if(!lab?.choosePreset)throw Error('HYDRAULIC LAB NOT READY');
  const which=id==='lossA'?'a-lost':id==='lossB'?'b-lost':'dual-lost';
  if(on){lab.choosePreset(which);lab.command?.({type:'SET_ENV',id:'onGround',value:false});lab.open?.();}
  else lab.choosePreset('airborne');
  announce('b737:instructor-hydraulic-failure',{id,active:on,origin:'ISOLATED_HYDRAULIC_LAB'});
 }
 function toggle(group,id,enabled){
  const on=enabled===undefined?!active(group,id):Boolean(enabled);
  try{
   if(group==='navigation'){
    if(id.startsWith('irs.'))setIRS(id.split('.')[1],on);
    else if(id==='fmc.BOTH'){
     if(typeof root.B737FmcSystemsBridgeV1?.setFailure!=='function')throw Error('FMC FAILURE BRIDGE NOT READY');
     root.B737FmcSystemsBridgeV1.setFailure(on);
     if(!on)root.B737FmcSystemsBridgeV1.acknowledgeRecovery?.();
    }
   }else if(group==='electrical'&&id==='bothBus')busWrite(on);
   else if(group==='hydraulics')setHydraulic(id,on);
   else if(group==='air'&&on){present('air',id,true);startPressure({cause:id,severity:'uncontrolled',loadFlight:false});}
   else if(group==='air'&&!on&&pressure?.cause===id){pressure=null;overheadFault(id==='autoFail'?'press-auto-fail':'door-fwd-cargo',false);}
   present(group,id,on);
   if(group==='hydraulics'&&on)for(const [other]of G.hydraulics)if(other!==id)present('hydraulics',other,false);
   if(group==='navigation'&&id==='irs.BOTH'){
    present(group,'irs.L',on);present(group,'irs.R',on);
   }
   if(group==='navigation'&&(id==='irs.L'||id==='irs.R')&&!on)present(group,'irs.BOTH',false);
   if(group==='engines')announce('b737:instructor-start-valve-failure',{engine:id==='valve1'?1:2,stuckOpen:on,starterCutoutN2:46,source:'INSTRUCTOR'});
   if(group==='instruments')announce('b737:instructor-instrument-failure',{seat:id.split('.')[0],instrument:id.split('.')[1],active:on});
   announce('b737:instructor-failure-change',{group,id,active:on});
   persist();renderNeeded=true;render();return true;
  }catch(error){status('instructorFailuresStatus',String(error.message||error),true);return false;}
 }
 function paintFailures(){
  for(const [group,ids]of Object.entries(G))for(const [id]of ids){
   const b=doc.querySelector('[data-instructor-group="'+group+'"][data-instructor-id="'+id+'"]');
   if(b){b.setAttribute('aria-pressed',String(active(group,id)));b.dataset.active=String(active(group,id));}
  }
 }
 function maskDisplays(){
  for(const seat of ['CAPT','FO'])for(const id of ['EADI','EHSI']){
   const selector=id==='EADI'?'[data-eadi-stage1-seat="'+seat+'"]':'[data-unified-ehsi-seat="'+seat+'"]';
   for(const node of doc.querySelectorAll(selector))node.dataset.instructorFailed=String(active('instruments',seat+'.'+id));
  }
  // Native photo-gauge SVGs retain their own scale and needles.
  // A fault adds/removes a black overlay on only the selected instrument glass.
  const ns='http://www.w3.org/2000/svg';
  for(const svg of doc.querySelectorAll('.texture-piece svg[data-gauge]')){
   const piece=svg.closest('.texture-piece')?.dataset.piece||'';
   const seat=piece==='captain'?'CAPT':piece.startsWith('fo-')?'FO':null;
   const id={airspeed:'ASI',altimeter:'ALTIMETER',rmi:'RDMI',ivsi:'IVSI'}[svg.dataset.gauge];
   if(!seat||!id)continue;
   const failed=active('instruments',seat+'.'+id)||
    (id==='IVSI'&&active('instruments',seat+'.VSI'));
   const old=svg.querySelector('[data-instructor-analog-cover]');
   if(failed&&!old){
    const cover=doc.createElementNS(ns,'rect');
    cover.setAttribute('x','0');cover.setAttribute('y','0');
    cover.setAttribute('width','100%');cover.setAttribute('height','100%');
    cover.setAttribute('fill','#010306');cover.setAttribute('pointer-events','none');
    cover.setAttribute('data-instructor-analog-cover','');
    svg.append(cover);
   }else if(!failed&&old)old.remove();
  }
  for(const n of [1,2]){
   const value=$('isnStartIndications')?.querySelector?.('[data-engine="engine'+n+'"] [data-field="valve"]');
   if(value&&active('engines','valve'+n)){
    value.textContent='OPEN · STUCK';value.dataset.amber='true';
   }
  }
 }
 function aircraftAltitude(){
  const s=root.B737UnifiedFlightScenarioV1?.getState?.();
  return Number.isFinite(s?.altitudeFt)?s.altitudeFt:31000;
 }
 function startPressure({cause='autoFail',severity='uncontrolled',loadFlight=true}={}){
  if(!['autoFail','cargoDoor'].includes(cause)||!['controlled','uncontrolled'].includes(severity))throw Error('INVALID PRESSURIZATION SCENARIO');
  const phase=root.B737UnifiedFlightScenarioV1;
  if(loadFlight){
   if(!phase?.loadScenario)throw Error('FLT PHASE ENGINE NOT READY');
   phase.loadScenario({airport:'OIMM',runway:'31R',preset:'MANUAL',altitudeFt:31000,
     headingDeg:310,speedKt:280,vsFpm:0,airborne:true});
  }
  const initialAlt=loadFlight?31000:aircraftAltitude();
  pressure={cause,severity,cabinAltitudeFt:Math.min(5500,initialAlt),cabinRateFtMin:0,
   aircraftAltitudeFt:initialAlt,differentialPsid:difference(initialAlt,Math.min(5500,initialAlt)),
   emergencyDescent:false,elapsedSec:0,manualControl:'NONE',state:'PRESSURE LOSS'};
  present('air','autoFail',cause==='autoFail');
  present('air','cargoDoor',cause==='cargoDoor');
  overheadFault('press-auto-fail',cause==='autoFail');
  overheadFault('door-fwd-cargo',cause==='cargoDoor');
  renderNeeded=true;persist();reportPressure();return pressureState();
 }
 function startScenario(which,opts={}){
  const flight=root.B737UnifiedFlightScenarioV1;
  if(!flight?.loadScenario)throw Error('FLT PHASE ENGINE NOT READY');
  if(which==='emergency'){
   const cause=opts.cause||$('instructorPressureCause')?.value||'autoFail';
   const severity=opts.severity||$('instructorPressureSeverity')?.value||'uncontrolled';
   startPressure({cause,severity,loadFlight:true});
   announce('b737:instructor-scenario-change',{id:'EMERGENCY_DESCENT',cause,severity});
   status('instructorScenarioStatus','EMERGENCY DESCENT · CRUISE 31,000 FT · CAB ALT 5,500 FT · PRESSURE LOSS ACTIVE');
  }else if(which==='bothBus'){
   if(pressure)pressure=null;
   flight.loadScenario({airport:'OIMM',runway:'31R',preset:'MANUAL',altitudeFt:12000,
     headingDeg:310,speedKt:260,vsFpm:1800,airborne:true});
   flight.command({type:'ALTITUDE',value:30000});
   flight.command({type:'VS',value:1800});
   toggle('electrical','bothBus',true);
   announce('b737:instructor-scenario-change',{id:'BOTH_BUS_OFF_CLIMB',altitudeFt:12000,targetFt:30000});
   status('instructorScenarioStatus','BOTH BUS OFF · CLIMB 12,000 FT → 30,000 FT · TWO GENERATOR BUSES FAILED');
  }else if(which==='hydraulic'){
   flight.loadScenario({airport:'OIMM',runway:'31R',preset:'MANUAL',altitudeFt:31000,
     headingDeg:310,speedKt:280,vsFpm:0,airborne:true});
   const id=opts.system||$('instructorHydraulicSystem')?.value||'lossA';
   toggle('hydraulics',id,true);
   announce('b737:instructor-scenario-change',{id:'HYDRAULIC_LOSS_CRUISE',failure:id});
   status('instructorScenarioStatus','HYDRAULIC LOSS · CRUISE · '+id+' · INDEPENDENT HYDRAULIC LAB');
  }else throw Error('UNKNOWN SCENARIO');
  renderNeeded=true;render();return true;
 }
 function manualControl(value){
  if(!pressure)throw Error('NO ACTIVE PRESSURIZATION SCENARIO');
  pressure.manualControl=value;mode=value==='CLOSE'?'MAN':'AUTO';renderNeeded=true;reportPressure();
 }
 function emergencyDescent(){
  if(!pressure)throw Error('NO ACTIVE PRESSURIZATION SCENARIO');
  const flight=root.B737UnifiedFlightScenarioV1;
  if(!flight?.command)throw Error('FLT PHASE ENGINE NOT READY');
  flight.command({type:'ALTITUDE',value:10000});
  flight.command({type:'VS',value:-3000});
  pressure.emergencyDescent=true;
  announce('b737:instructor-emergency-descent-request',{targetAltitudeFt:10000,trainingVerticalRateFtMin:-3000});
  status('instructorScenarioStatus','EMERGENCY DESCENT IN PROGRESS · TARGET 10,000 FT · TRAINING V/S −3,000 FT/MIN');
  return true;
 }
 function stepPressure(seconds){
  if(!pressure||seconds<=0)return pressureState();
  const s=pressure,aircraft=aircraftAltitude(),base=s.cabinAltitudeFt;
  // Pressure-loss training surrogate: relaxation toward ambient at a rate that
  // depends on the failure source, severity and (for controlled failures) recovery.
  // Never let pressure altitude exceed local aircraft ambient by model overshoot.
  const rate=s.cause==='cargoDoor'?(s.severity==='uncontrolled'?4800:1500):
                                      (s.severity==='uncontrolled'?3200:850);
  const recovery=s.severity==='controlled'&&s.manualControl==='CLOSE';
  const target=recovery?Math.min(5500,aircraft):aircraft;
  const maxStep=rate*seconds/60;
  const change=clamp(target-base,-maxStep,maxStep);
  s.cabinAltitudeFt=clamp(base+change,-1000,Math.max(0,aircraft));
  s.cabinRateFtMin=seconds?change*60/seconds:0;
  s.aircraftAltitudeFt=aircraft;
  s.differentialPsid=difference(aircraft,s.cabinAltitudeFt);
  s.elapsedSec+=seconds;
  s.state=s.cabinAltitudeFt>=10000?'CABIN ALTITUDE WARNING':
    s.severity==='uncontrolled'?'UNCONTROLLED DEPRESSURIZATION':'CONTROLLED PRESSURE LOSS';
  return pressureState();
 }
 function reportPressure(){
  if(!pressure)return;
  const p=pressureState();
  const system=root.B737AircraftProfileStore?.get?.()?.pressurization||'CPCS';
  root.B737UnifiedCabinNeedles?.setMeasuredReadings?.({
   cabinAltitudeFt:p.cabinAltitudeFt,differentialPsid:p.differentialPsid,
   cabinRateFtMin:p.cabinRateFtMin},system);
  const angle=clamp(Math.round(p.cabinRateFtMin/40),-145,145);
  root.B737UnifiedCabinRateNeedle?.setOffset?.(angle);
  announce('b737:instructor-cabin-pressure',{...p,source:'INSTRUCTOR_EDUCATIONAL_PLANT',
   cabinAltitudeWarning:p.cabinAltitudeFt>=10000,manualRecoveryAvailable:p.severity==='controlled'});
  const n=$('instructorCabinReadings');
  if(n)n.textContent='CAB ALT '+Math.round(p.cabinAltitudeFt).toLocaleString('en-US')+
    ' FT · CAB RATE '+Math.round(p.cabinRateFtMin).toLocaleString('en-US')+
    ' FT/MIN · DIFF '+p.differentialPsid.toFixed(2)+' PSI · '+p.state;
 }
 function render(){
  if(!installed)return;
  paintFailures();maskDisplays();
  const live=$('instructorCabinReadings');if(live&&!pressure)live.textContent='No active pressurization scenario';
 }
 function tick(){
  const t=root.performance.now();const elapsed=lastPerformance?clamp((t-lastPerformance)/1000,0,.5):0;lastPerformance=t;
  if(pressure){stepPressure(elapsed);reportPressure();}
  if(renderNeeded){render();renderNeeded=false;}
 }
 function create(tag,cls,txt,parent){
  const node=doc.createElement(tag);if(cls)node.className=cls;
  if(txt!==undefined)node.textContent=txt;if(parent)parent.append(node);return node;
 }
 function categoryUI(host,group,title){
  const d=create('details','instructor-category',undefined,host);
  const summary=create('summary','',title,d),body=create('div','instructor-options',undefined,d);
  for(const [id,label]of G[group]){
   const b=create('button','instructor-option',label,body);b.type='button';
   b.dataset.instructorGroup=group;b.dataset.instructorId=id;
   b.addEventListener('click',()=>toggle(group,id));
  }
  return {details:d,summary,body};
 }
 function installStyle(){
  if($('instructorNonnormalStyle'))return;
  const s=create('style','','',doc.head);s.id='instructorNonnormalStyle';
  s.textContent='#failuresHeaderPopover .instructor-category,#flightScenarioDialog .instructor-category{border:1px solid #36596d;border-radius:7px;margin-top:7px;overflow:hidden}' +
   '#failuresHeaderPopover .instructor-category>summary,#flightScenarioDialog .instructor-category>summary{background:#17394c;padding:9px;color:#c9e4f5;cursor:pointer;font-weight:650}' +
   '.instructor-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px}' +
   '.instructor-option{color:#dce8f4;background:#21394a;border:1px solid #4a6878;border-radius:5px;padding:8px;font:600 11px/1.35 system-ui;cursor:pointer;text-align:left}' +
   '.instructor-option[data-active="true"]{color:#ffc9ae;border-color:#ef926e;background:#5b302c}' +
   '.instructor-section{margin:12px 0;padding:10px;border:1px solid #38617b;border-radius:8px;color:#dcebf6;background:#0d2533;font:12px/1.5 system-ui}' +
   '.instructor-section label{display:flex;flex-direction:column;gap:3px;margin:7px 0;color:#cfdfeb}' +
   '.instructor-section select{background:#102635;color:#fff;border:1px solid #557589;border-radius:5px;padding:6px}' +
   '.instructor-section button{margin:4px;padding:7px 10px;color:#dff5ff;background:#24516c;border:1px solid #4c91b1;border-radius:5px;cursor:pointer}' +
   '[data-instructor-failed="true"]::after{content:"";display:block;position:absolute;inset:0;background:#010306;pointer-events:none;z-index:40}' +
   '#instructorScenarioStatus[data-error="true"],#instructorFailuresStatus[data-error="true"]{color:#ff9e9e}';
 }
 function mountAdvanced(){
  const branch=$('advancedFailureBranch'),scene=$('advancedScenarioBlock');
  if(!branch||!scene)return false;
  // A concurrently installed instructor menu already owns these two tabs.
  // Attach the actual system adapters to its controls instead of duplicating menus.
  const mapping={
   'irs.left':['navigation','irs.L'],'irs.right':['navigation','irs.R'],
   'irs.both':['navigation','irs.BOTH'],'fmc.both':['navigation','fmc.BOTH'],
   'air.autoFail':['air','autoFail'],'air.cargoDoor':['air','cargoDoor'],
   'engine.1.startValveOpen':['engines','valve1'],
   'engine.2.startValveOpen':['engines','valve2'],
   'hyd.a.loss':['hydraulics','lossA'],'hyd.b.loss':['hydraulics','lossB']
  };
  for(const seat of ['cpt','fo'])for(const unit of ['eadi','ehsi','asi','altimeter','vsi','rdmi','ivsi'])
   mapping[seat+'.'+unit]=['instruments',(seat==='cpt'?'CAPT':'FO')+'.'+unit.toUpperCase()];
  const extraHyd={'hyd.standbyPump':'STBY_PUMP_FAIL','hyd.ptu':'PTU_FAIL','hyd.lgtu':'LGTU_FAIL'};
  for(const input of doc.querySelectorAll('[data-advanced-failure]')){
   const id=input.dataset.advancedFailure;
   input.addEventListener('change',()=>{
    const pair=mapping[id];
    if(pair){if(!toggle(pair[0],pair[1],input.checked))input.checked=!input.checked;}
    else if(extraHyd[id]){
     const lab=root.B737HydraulicLabV1,code=extraHyd[id];
     if(!lab?.inject){status('advancedFailureFeedback','HYDRAULIC LAB NOT READY',true);return;}
     const present=lab.getState?.().faults?.includes(code)===true;
     if(present!==input.checked)lab.inject(code);
     announce('b737:instructor-hydraulic-failure',{id,active:input.checked,origin:'ISOLATED_HYDRAULIC_LAB'});
    }else if(id.startsWith('fmc.')){
     announce('b737:instructor-fmc-channel-request',{id,failed:input.checked,origin:'CHANNEL_ADAPTER_NOT_CONNECTED'});
     status('advancedFailureFeedback','Individual FMC failure: native channel adapter pending; BOTH FMC failure is live.');
    }
   });
  }
  const selected=$('advScenarioSelect');
  if(selected&&!selected.querySelector('option[value="hydraulic-both"]')){
   const option=create('option','','LOSS OF BOTH HYDRAULIC SYSTEMS',selected);option.value='hydraulic-both';
  }
  const launch=scene.querySelector('.adv-action');
  if(launch){
   launch.onclick=()=>{
    try{
     const kind=selected?.value||'emergency-descent';
     if(kind==='emergency-descent')startScenario('emergency',{
      cause:$('advCause')?.value||'autoFail',severity:$('advSeverity')?.value||'uncontrolled'
     });
     else if(kind==='both-bus-off-climb')startScenario('bothBus');
     else if(kind.startsWith('hydraulic-'))startScenario('hydraulic',{
      system:kind==='hydraulic-a'?'lossA':kind==='hydraulic-b'?'lossB':'lossBoth'
     });
     status('advancedScenarioStatus','SCENARIO LOADED INTO FLT PHASE · '+kind.toUpperCase());
    }catch(error){status('advancedScenarioStatus','SCENARIO FAILED: '+String(error.message||error),true);}
   };
  }
  const extras=create('div','instructor-section',undefined,scene);
  extras.id='instructorScenarioAdditions';
  create('strong','','PRESSURIZATION PROCEDURE CONTROLS',extras);
  const row=create('div','',undefined,extras);
  function action(title,fn){
   const b=create('button','',title,row);b.type='button';
   b.onclick=()=>{try{fn();status('advancedScenarioStatus',title+' APPLIED');}
    catch(error){status('advancedScenarioStatus','ACTION FAILED: '+String(error.message||error),true);}};
  }
  action('INITIATE EMERGENCY DESCENT',emergencyDescent);
  action('MANUAL VALVE CLOSE',()=>manualControl('CLOSE'));
  action('MANUAL VALVE NEUTRAL',()=>manualControl('NONE'));
  const output=create('output','',undefined,extras);
  output.id='instructorCabinReadings';output.textContent='No active pressurization scenario';
  create('p','','Cabin readings use an educational pressure-loss model. Hydraulic loss runs in the independent Hydraulic Lab.',extras);
  return true;
 }
 function mount(){
  if(installed)return true;
  const fail=$('failuresHeaderPopover'),flight=$('flightScenarioDialog');
  if(!fail||!flight)return false;
  // Advanced instructor mounts its scenario controls after the FLT PHASE dialog;
  // defer our bridge until that asynchronous DOM mount finishes.
  if(root.B737UnifiedAdvancedInstructorV1&&!$('advancedScenarioBlock')&&++advancedRetries<18){
   root.setTimeout(mount,300);return false;
  }
  installStyle();
  if(mountAdvanced()){
   installed=true;render();
   root.addEventListener('b737:cockpit-mounted',()=>{renderNeeded=true;});
   root.setInterval(tick,200);
   root.setInterval(maskDisplays,900);
   return true;
  }
  const branch=create('section','instructor-section',undefined,fail);branch.id='instructorFailureBranches';
  create('strong','','ADDITIONAL SYSTEM FAILURES · INSTRUCTOR',branch);
  for(const [group,label]of [['navigation','NAVIGATION / IRS / FMC'],['instruments','FLIGHT INSTRUMENTS · CAPT / FO'],['air','AIR SYSTEMS'],['engines','ENGINES · START VALVE'],['hydraulics','HYDRAULICS · FCOM / MRG LAB'],['electrical','ELECTRICAL · DUAL BUS']])categoryUI(branch,group,label);
  create('p','','Native adapters are used where available. Hydraulic and pressure-loss physics remain educational training models.',branch);
  const feedback=create('p','','Ready',branch);feedback.id='instructorFailuresStatus';feedback.setAttribute('role','status');
  const section=create('section','instructor-section',undefined,flight);section.id='instructorScenarioPresets';
  create('strong','','NON-NORMAL SCENARIOS',section);
  const cause=create('label','','Pressure loss cause',section);
  const cs=create('select','',undefined,cause);cs.id='instructorPressureCause';
  for(const [v,label]of [['autoFail','AUTO FAIL'],['cargoDoor','CARGO DOOR']]){const o=create('option','',label,cs);o.value=v;}
  const severity=create('label','','Cabin pressure response',section);
  const ss=create('select','',undefined,severity);ss.id='instructorPressureSeverity';
  for(const [v,label]of [['controlled','CONTROLLED'],['uncontrolled','UNCONTROLLED']]){const o=create('option','',label,ss);o.value=v;}
  const row=create('div','',undefined,section);
  function button(name,callback){
   const b=create('button','',name,row);b.type='button';b.addEventListener('click',()=>{
    try{callback();status('instructorFailuresStatus','INSTRUCTOR ACTION APPLIED');}
    catch(error){status('instructorScenarioStatus',String(error.message||error),true);}
   });return b;
  }
  button('LOAD EMERGENCY DESCENT',()=>startScenario('emergency'));
  button('INITIATE DESCENT',emergencyDescent);
  button('MANUAL VALVE CLOSE',()=>manualControl('CLOSE'));
  button('MANUAL VALVE NEUTRAL',()=>manualControl('NONE'));
  button('LOAD BOTH BUS OFF · 12,000 FT CLIMB',()=>startScenario('bothBus'));
  const hydlabel=create('label','','Hydraulic system loss',section);
  const hyd=create('select','',undefined,hydlabel);hyd.id='instructorHydraulicSystem';
  for(const [val,label]of [['lossA','SYSTEM A'],['lossB','SYSTEM B'],['lossBoth','BOTH A AND B']]){const o=create('option','',label,hyd);o.value=val;}
  button('LOAD HYDRAULIC LOSS',()=>startScenario('hydraulic'));
  button('OPEN HYDRAULIC TEST LAB',()=>{if(!root.B737HydraulicLabV1?.open)throw Error('HYDRAULIC TEST LAB NOT READY');root.B737HydraulicLabV1.open();});
  const output=create('output','',undefined,section);output.id='instructorCabinReadings';output.textContent='No active pressurization scenario';
  const stat=create('p','','Choose a scenario to load it into FLT PHASE.',section);stat.id='instructorScenarioStatus';stat.setAttribute('role','status');
  installed=true;render();
  root.addEventListener('b737:cockpit-mounted',()=>{renderNeeded=true;});
  root.setInterval(tick,200);
  root.setInterval(maskDisplays,900);
  return true;
 }
 const api=Object.freeze({version:'INSTRUCTOR-NONNORMAL-0001',catalog:G,toggle,startScenario,
  startPressure,stepPressure,pressureState,manualControl,emergencyDescent,
  getState:()=>({active:Object.fromEntries(Object.entries(busy).map(([k,v])=>[k,[...v]])),pressure:pressureState(),installed}),mount});
 root.B737UnifiedInstructorNonNormalV1=api;
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
