(function (win, doc) {
  'use strict';

  const dialog = doc.getElementById('crewRoomDialog');
  if (!dialog) return;

  const roles = {captain: 'Captain', firstOfficer: 'First Officer', instructor: 'Instructor', observer: 'Observer'};
  const seats = {...roles, captain: 'Captain (Left Seat)', firstOfficer: 'First Officer (Right Seat)'};
  const api = '/api/crew';
  const tokenPattern = /^[A-Za-z0-9_-]{32}$/;
  const initialInvitation = new URLSearchParams(win.location.hash.slice(1)).get('crew');
  let invitation = tokenPattern.test(initialInvitation ?? '') ? initialInvitation : undefined;
  const cockpitRoom = new URLSearchParams(win.location.search).get('crewRoom');
  let user = null;
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
  const role = find('[data-crew-join] select');
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

  function render() {
    linkEntry.hidden = !!room?.role || !!(room && invitation);
    account.hidden = !!user;
    guestAccount.hidden = !user?.owner;
    find('[data-crew-user]').textContent = user ? 'Signed in as ' + user.username : '';
    find('[data-crew-logout]').hidden = !user || !!user.gateway;
    find('[data-crew-create]').hidden = !user?.owner || !!room;
    roster.hidden = !room;
    find('[data-crew-join]').hidden = !user || !room || !!room.role;
    role.hidden = !room?.manager;
    find('[data-crew-enter]').hidden = !room?.role || !!cockpitRoom;
    find('[data-crew-duties]').hidden = !(room?.manager || room?.role === 'instructor');
    find('[data-crew-leave]').hidden = !room?.role;
    invitePanel.hidden = !room?.manager;
    if (!room) linkBox.hidden = true;
    if (!room) return;
    for (const [key, label] of Object.entries(seats)) {
      const count = room.counts[key];
      const reserved = room.reserved[key];
      find('[data-crew-count="' + key + '"]').textContent = key === 'observer' ? String(count) : count + ' / 1';
      find('[data-crew-seat="' + key + '"]').textContent = key !== 'observer' && reserved ? label + ' · Reconnecting' : label;
      const option = role.querySelector('option[value="' + key + '"]');
      option.disabled = key !== 'observer' && !!(count || reserved) && room.role !== key;
    }
    online.replaceChildren(...(room.online ?? []).map(member => {
      const item = doc.createElement('li');
      item.textContent = member.username + ' · ' + seats[member.role];
      return item;
    }));
    online.hidden = !online.childElementCount;
    if (role.selectedOptions[0]?.disabled) role.value = [...role.options].find(option => !option.disabled).value;
    find('[data-crew-flying]').value = room.flying;
    const pm = room.flying === 'captain' ? 'firstOfficer' : 'captain';
    find('[data-crew-flight-duties]').textContent = 'PF: ' + roles[room.flying] + ' · PM: ' + roles[pm];
    find('[data-crew-seat-status]').textContent = room.role ? 'Your role: ' + roles[room.role] :
      room.invitedRole ? 'Invited as ' + roles[room.invitedRole] : '';
    find('[data-crew-confirm]').textContent = room.invitedRole ? 'Join as ' + roles[room.invitedRole] : 'Join Room';
    find('[data-crew-confirm]').disabled = !!room.invitedRole && room.invitedRole !== 'observer' &&
      !!(room.counts[room.invitedRole] || room.reserved[room.invitedRole]);
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
    } else if (id && dialog.open) {
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
    if (!dialog.open) dialog.showModal();
    return busy(async () => {
      ({user} = await request());
      await inspectRoom();
    });
  }

  for (const button of doc.querySelectorAll('[data-crew-open]')) button.addEventListener('click', open);
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
      if (!user) username.focus();
    });
  });

  account.addEventListener('submit', event => {
    event.preventDefault();
    busy(async () => {
      ({user} = await request('login', {username: username.value.trim(), password: password.value}));
      password.value = '';
      await inspectRoom();
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

  find('[data-crew-create]').addEventListener('click', () => busy(async () => {
    room = await request('create', {});
    trackRoster();
  }));

  find('[data-crew-confirm]').addEventListener('click', () => busy(async () => {
    room = await request('join', {roomId: room.roomId, role: role.value, invite: invitation});
    trackRoster();
  }));

  find('[data-crew-flying]').addEventListener('change', event => busy(async () => {
    room = await request('assignFlying', {roomId: room.roomId, role: event.target.value});
  }));

  find('[data-crew-enter]').addEventListener('click', () => busy(async () => {
    const url = new URL('/panel-mosaic-lab/unified/', win.location.href);
    url.searchParams.set('crewRoom', room.roomId);
    if (invitation) sessionStorage.setItem('unified-crew-invite', invitation);
    win.location.assign(url);
  }));

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

  invitePanel.addEventListener('click', event => {
    const button = event.target.closest('[data-crew-invite]');
    if (!button) return;
    busy(async () => {
      const {invite} = await request('invite', {
        roomId: room.roomId,
        role: button.dataset.crewInvite,
        username: find('[data-crew-assignee]').value.trim()
      });
      const url = new URL('/crew/', win.location.href);
      url.hash = new URLSearchParams({crew: invite});
      linkOutput.value = url.href;
      find('[data-crew-invite-role]').textContent = roles[button.dataset.crewInvite] + ' invitation';
      qrCanvas.hidden = true;
      linkBox.hidden = false;
      try {
        await showQr(url.href);
        message('Scan the QR code or copy the invitation link.');
      } catch {
        message('QR code unavailable. Use Copy Link to share this invitation.');
      }
      linkBox.scrollIntoView({block: 'nearest'});
    });
  });

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
  if (invitation || doc.body.hasAttribute('data-crew-entry')) open();
})(window, document);
