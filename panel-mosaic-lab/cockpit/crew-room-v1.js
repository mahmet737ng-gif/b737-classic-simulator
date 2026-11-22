(function (win, doc) {
  'use strict';

  const dialog = doc.getElementById('crewRoomDialog');
  if (!dialog) return;

  const roles = {captain: 'Captain', firstOfficer: 'First Officer', instructor: 'Instructor', observer: 'Observer'};
  const api = '/api/crew';
  const params = new URLSearchParams(win.location.hash.slice(1));
  const invitation = params.get('crew') || undefined;
  let user = null;
  let room = null;
  let events = null;
  let refreshTimer = null;
  let working = false;
  const find = selector => dialog.querySelector(selector);
  const status = find('[role="status"]');
  const account = find('form');
  const username = account.elements.username;
  const password = account.elements.password;
  const role = find('select');
  const roster = find('[data-crew-roster]');
  const invitePanel = find('[data-crew-invitations]');
  const linkBox = find('[data-crew-link]');

  function message(text, error = false) {
    status.textContent = text;
    status.dataset.error = String(error);
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
    account.hidden = !!user;
    find('[data-crew-activate]').hidden = !invitation;
    find('[data-crew-user]').textContent = user ? 'Signed in as ' + user.username : '';
    find('[data-crew-logout]').hidden = !user;
    find('[data-crew-create]').hidden = !user?.owner || !!room;
    roster.hidden = !room;
    find('[data-crew-join]').hidden = !user || !room || !!room.role;
    role.hidden = !room?.manager;
    find('[data-crew-leave]').hidden = !room?.role;
    invitePanel.hidden = !room?.manager;
    if (!room) linkBox.hidden = true;
    if (!room) return;
    for (const [key, label] of Object.entries(roles)) {
      const count = room.counts[key];
      const reserved = room.reserved[key];
      find('[data-crew-count="' + key + '"]').textContent = key === 'observer' ? String(count) : count + ' / 1';
      find('[data-crew-seat="' + key + '"]').textContent = key !== 'observer' && reserved ? label + ' · Reconnecting' : label;
      const option = role.querySelector('option[value="' + key + '"]');
      option.disabled = key !== 'observer' && !!(count || reserved) && room.role !== key;
    }
    if (role.selectedOptions[0]?.disabled) role.value = [...role.options].find(option => !option.disabled).value;
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
    if (room || invitation) {
      room = await request('inspect', {invite: invitation, roomId: room?.roomId});
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

  account.addEventListener('submit', event => {
    event.preventDefault();
    busy(async () => {
      const action = event.submitter?.dataset.crewActivate === undefined ? 'login' : 'activate';
      ({user} = await request(action, {username: username.value.trim(), password: password.value, invite: invitation}));
      password.value = '';
      await inspectRoom();
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

  find('[data-crew-leave]').addEventListener('click', () => busy(async () => {
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
      const {invite} = await request('invite', {roomId: room.roomId, role: button.dataset.crewInvite});
      const url = new URL(win.location.href);
      url.hash = new URLSearchParams({crew: invite});
      const input = linkBox.querySelector('input');
      input.value = url.href;
      linkBox.hidden = false;
      input.focus();
      input.select();
      let copied = false;
      if (win.navigator.clipboard?.writeText) {
        copied = await win.navigator.clipboard.writeText(url.href).then(() => true, () => false);
      }
      message(roles[button.dataset.crewInvite] + (copied ? ' invite copied.' : ' invite ready to copy.'));
    });
  });

  render();
  if (invitation) open();
})(window, document);
