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
    status.textContent = (labels[role] ?? 'Crew Room') + duty + (online ? ' · Connected' : ' · Reconnecting…');
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
    if (entry.type === 'firePanel') return win.B737UnifiedFireLights;
    if (entry.type === 'efis') return win.B737UnifiedEFISPedestalV1;
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
        byId('overheadFrame').contentWindow.B737CrewOverheadV1.apply(type, id, value);
        break;
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
        if (!current || !key) break;
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
    }
  }

  function receiveHostSnapshot(snapshot) {
    if (snapshot.client === client || !Number.isSafeInteger(snapshot.sequence) ||
        snapshot.sequence < lastSequence || !snapshot.overhead) return;
    const {toggles, rotaries, guards} = snapshot.overhead;
    if (!toggles || !rotaries || !guards) return;
    // The state represents every switch at sequence N. Commands <= N must
    // not be replayed after the state, or an old switch position would win.
    queue.length = 0;
    lastSequence = snapshot.sequence;
    // Guarded/interlocked controls need the host's guard state installed first.
    for (const [id, value] of Object.entries(guards)) {
      queue.push({type: 'guard', id, value: {open: value.guard === 'open', value: value.value}});
    }
    for (const [id, value] of Object.entries(rotaries)) queue.push({type: 'rotary', id, value});
    for (const [id, value] of Object.entries(toggles)) queue.push({type: 'toggle', id, value});
    drain();
  }

  function receiveFlight() {
    if (!latestFlight || !flight() || queue.length) return;
    const update = latestFlight;
    latestFlight = null;
    if (update.client !== client && role !== controller) flight().followCrew(update.state, update.paused);
  }

  function drain() {
    while (queue.length) {
      const entry = queue[0];
      if (!available(entry)) break;
      queue.shift();
      if (entry.client === client) continue;
      replay = true;
      try { apply(entry); }
      catch (error) { console.warn('Crew cockpit command rejected', entry.type, error.message); }
      finally { replay = false; }
    }
    receiveFlight();
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
  let lastBreakers = new Set(win.B737UnifiedCB?.snapshot().breakers.map(entry => entry.id));
  let lastAutobrake = win.B737AutobrakeUnified?.getState().selector;
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
