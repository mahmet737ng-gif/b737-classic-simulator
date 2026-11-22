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
