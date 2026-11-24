(function (win, doc) {
  'use strict';

  const by = id => doc.getElementById(id);
  const welcome = by('unifiedWelcome');
  const stage = doc.documentElement.dataset;
  if (stage.unifiedWelcome !== 'active') return;

  const introTitle = welcome.querySelector('.welcome-brand');
  const progress = by('unifiedWelcomeStatus');
  const start = by('unifiedWelcomeStart');
  const retry = by('unifiedWelcomeRetry');
  const error = by('unifiedWelcomeError');
  const aircraft = by('unifiedWelcomeAircraft');
  const flight = by('unifiedWelcomeFlight');
  const manual = by('unifiedWelcomeManual');
  const cockpit = [...doc.querySelectorAll('body > header, body > main')];
  const moved = [];
  const decoded = new WeakMap();
  let setup = false;
  let pendingEngineScenario = () => false;
  let restoreWelcomeLocation = () => {};
  let startRequested = new URLSearchParams(win.location.search).has('crewRoom');
  let lastProgressAt = performance.now();
  let currentStage = '';
  let currentLabel = '';
  let labelIndex = 0;
  let labelChangedAt = 0;
  let readySince = null;
  let scenarioStarted = false;
  let scenarioStartedAt = null;
  let directorPaintBaseline = null;
  let latestReadiness = null;
  const STABLE_MS = 500;
  const mainPaints = () => ['CAPT', 'FO'].map(seat =>
    Number(doc.querySelector('[data-eadi-stage1-seat="'+seat+'"]')?.dataset.eadiPaintCount)||0);
  // Accessible on the live page without opening the instrument controls.
  win.B737UnifiedWelcomeGateV2 = Object.freeze({
    snapshot: () => latestReadiness ? JSON.parse(JSON.stringify({
      ...latestReadiness,scenarioStarted,stableSinceMs:readySince,
      scenarioStartedAt
    })) : null
  });

  function mark(name) {
    performance.mark('b737:welcome-' + name);
  }

  function imagesReady(scope, selector, count = 1) {
    const images = [...(scope?.querySelectorAll(selector) || [])];
    const readiness = images.map(image => {
      if (!image.complete || !image.naturalWidth) return false;
      const src = image.currentSrc;
      let state = decoded.get(image);
      if (state?.src !== src) {
        state = {src, ready: false};
        decoded.set(image, state);
        image.decode().then(() => { state.ready = true; }, () => {
          if (decoded.get(image) === state) decoded.delete(image);
        });
      }
      return state.ready;
    });
    return images.length >= count && readiness.every(Boolean);
  }

  function relocate(node, target) {
    const anchor = doc.createComment('Unified startup field');
    node.before(anchor);
    moved.push([node, anchor]);
    target.append(node);
  }

  function showSetup() {
    const form = by('aircraftSettingsForm');
    if (!form || !win.B737UnifiedFlightScenarioV1?.startFromSelection ||
        !win.B737AircraftProfileStore || !by('flightRunway')?.options.length) return;
    const fields = [...form.querySelectorAll('fieldset')];
    for (const item of fields.slice(0, 3)) relocate(item, aircraft);
    const current = win.B737AircraftProfileStore.get();
    for (const input of aircraft.querySelectorAll('input[name]')) {
      input.checked = input.value === current[input.name];
    }
    const locationGrid = by('flightAirport').closest('.flight-grid');
    const locationSelect = by('flightPreset');
    const setupRoot = by('flightSetupTabs');
    const setupButtons = [...(setupRoot?.querySelectorAll('button[aria-controls]') || [])];
    const locationButton = setupButtons.find(b => b.getAttribute('aria-controls') === 'flightLocationGrid');
    const generalButton = setupButtons.find(b => b.getAttribute('aria-controls') === 'flightGeneralSetup');
    // Move only the location controls; leave the in-cockpit tabs and ground services intact.
    relocate(locationGrid, flight);
    const remove5 = [...locationSelect.options].find(o => o.value === 'FINAL_5');
    if (remove5) {
      if (locationSelect.value === 'FINAL_5') locationSelect.value = 'FINAL_10';
      remove5.remove();
    }
    for (const o of locationSelect.options) {
      if (o.value === 'RUNWAY_READY') o.textContent = 'ON THRESHOLD';
      if (o.value === 'FINAL_10') o.textContent = '10 NM FINAL';
      if (o.value === 'MANUAL') o.textContent = 'MANUAL';
    }
    flight.querySelector('h2').textContent = 'Location and Weather';
    const stripRunwayHeadings = () => {
      for (const o of by('flightRunway').options) o.textContent = 'RWY ' + o.value;
    };
    stripRunwayHeadings();
    by('flightAirport').addEventListener('change', stripRunwayHeadings);
    const layoutStyle = doc.createElement('style');
    layoutStyle.textContent = `
      #unifiedWelcome[data-stage="setup"] .welcome-card{width:min(100%,1180px)}
      #unifiedWelcome #unifiedWelcomeSetup{grid-template-columns:repeat(3,minmax(0,1fr));align-items:start;gap:14px}
      #unifiedWelcome .welcome-section{min-width:0;box-sizing:border-box;box-shadow:0 10px 24px #0003}
      #unifiedWelcome .welcome-section h2{margin-top:0}
      #unifiedWelcome .welcome-subheading{font-size:14px;font-weight:700;margin:15px 0 9px;padding-top:14px;border-top:1px solid #334952;color:#e4f4fa}
      #unifiedWelcome .welcome-choice{display:flex;align-items:center;gap:8px;border:1px solid #365564;border-radius:7px;padding:9px 10px;margin:7px 0;background:#142731}
      #unifiedWelcome .welcome-choice:has(input:checked){border-color:#65e0d3;background:#17413f}
      #unifiedWelcome .welcome-choice:has(input:disabled){opacity:.56}
      #unifiedWelcome .welcome-choice small{margin-left:auto;color:#a7b8c0;font-size:10px;text-align:right}
      #unifiedWelcome .welcome-note{font-size:12px;color:#a8c2cd;margin:8px 0 0}
      #unifiedWelcome .welcome-failure-options{margin:0 0 12px 18px;padding:4px 10px 8px;border:1px solid #365564;border-radius:7px;min-width:0}
      #unifiedWelcome .welcome-failure-options[hidden]{display:none!important}
      #unifiedWelcome .welcome-failure-options legend{font-size:12px;color:#a8c2cd;padding:0 5px}
      #unifiedWelcome .welcome-failure-options .welcome-choice{padding:6px 8px;margin:5px 0;font-size:12px}
      #unifiedWelcome .welcome-weather{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      #unifiedWelcome input:disabled,#unifiedWelcome select:disabled{opacity:.6}
      @media(max-width:900px){#unifiedWelcome #unifiedWelcomeSetup{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:680px){#unifiedWelcome #unifiedWelcomeSetup{grid-template-columns:minmax(0,1fr)}}
    `;
    doc.head.append(layoutStyle);
    const general = doc.createElement('div');
    general.id = 'welcomeGeneralState';
    general.innerHTML = '<h3 class="welcome-subheading">Aircraft General State</h3>' +
      '<label class="welcome-choice"><input id="welcomeColdDark" type="checkbox"> <span>COLD &amp; DARK</span><small>AVAILABLE</small></label>' +
      '<label class="welcome-choice"><input type="radio" disabled> <span>READY FOR START</span><small>COMING SOON</small></label>' +
      '<label class="welcome-choice"><input type="radio" disabled> <span>READY FOR TAKEOFF</span><small>COMING SOON</small></label>' +
      '<p class="welcome-note" id="welcomeGeneralNote">Optional: existing flight-location presets are retained when no general state is selected.</p>';
    aircraft.append(general);
    const cold = by('welcomeColdDark');
    cold.disabled = !locationButton || !generalButton;
    if (cold.disabled) by('welcomeGeneralNote').textContent = 'Cold & Dark owner selector unavailable.';
    const scenarios = doc.createElement('section');
    scenarios.className = 'welcome-section';
    scenarios.id = 'unifiedWelcomeScenarios';
    const engineFailureTypes = [
      ['FLAME_OUT', 'FLAME OUT'], ['FIRE', 'FIRE'],
      ['SEVERE_DAMAGE', 'SEVERE DAMAGE'], ['SEPARATION', 'SEPARATION']
    ];
    const abnormalStartTypes = [
      ['HOT_START', 'HOT START'], ['HUNG_START', 'HUNG START'],
      ['WET_START', 'WET START'], ['OIL_PRESSURE', 'OIL PRESSURE']
    ];
    const engineScenarios = [
      ['ENGINE_FAILURE_V1', 'ENGINE FAILURE AT V1', engineFailureTypes],
      ['ENGINE_FAILURE_FINAL', 'ENGINE FAILURE ON FINAL', engineFailureTypes],
      ['ENGINE_FAILURE_CRUISE', 'ENGINE FAILURE IN CRUISE', engineFailureTypes],
      ['ABNORMAL_ENGINE_START', 'ABNORMAL ENGINE START', abnormalStartTypes]
    ];
    scenarios.innerHTML = '<h2>Scenarios</h2>' +
      '<label class="welcome-choice"><input type="radio" name="welcomeScenario" value="NONE" checked> <span>NORMAL FLIGHT</span></label>' +
      '<h3 class="welcome-subheading">Engine Failure</h3>' +
      engineScenarios.map(([id, title, types]) =>
        '<label class="welcome-choice"><input type="radio" name="welcomeScenario" value="' + id +
        '" aria-controls="welcomeFailure_' + id + '" aria-expanded="false"> <span>' + title + '</span><small>SETUP ONLY</small></label>' +
        '<fieldset class="welcome-failure-options" id="welcomeFailure_' + id + '" hidden disabled><legend>Failure Type</legend>' +
        types.map(([value, label]) => '<label class="welcome-choice"><input type="radio" name="welcomeFailure_' +
          id + '" value="' + value + '"> <span>' + label + '</span></label>').join('') + '</fieldset>'
      ).join('') +
      '<h3 class="welcome-subheading">Special Operations</h3>' +
      '<label class="welcome-choice"><input type="radio" name="welcomeScenario" disabled> <span>RAPID DECOMPRESSION</span><small>COMING SOON</small></label>' +
      '<label class="welcome-choice"><input type="radio" name="welcomeScenario" disabled> <span>EMERGENCY DESCENT</span><small>COMING SOON</small></label>' +
      '<p class="welcome-note" id="welcomeScenarioNote" role="status">Normal Flight available. Engine scenario behavior is not yet configured.</p>';
    by('unifiedWelcomeSetup').append(scenarios);
    pendingEngineScenario = () => scenarios.querySelector('input[name="welcomeScenario"]:checked')?.value !== 'NONE';
    const syncEngineScenario = () => {
      const selected = scenarios.querySelector('input[name="welcomeScenario"]:checked')?.value;
      for (const [id] of engineScenarios) {
        const group = by('welcomeFailure_' + id);
        const active = selected === id;
        group.hidden = !active;
        group.disabled = !active;
        scenarios.querySelector('input[name="welcomeScenario"][value="' + id + '"]').setAttribute('aria-expanded', String(active));
        if (!active) group.querySelectorAll('input').forEach(input => { input.checked = false; });
      }
      const pending = pendingEngineScenario();
      const subtype = pending ? by('welcomeFailure_' + selected)?.querySelector('input:checked') : null;
      by('welcomeScenarioNote').textContent = pending
        ? (subtype ? 'Failure type selected. Scenario execution is not configured yet.' : 'Select a failure type. Scenario execution is not configured yet.')
        : 'Normal Flight available. Engine scenario behavior is not yet configured.';
      if (!startRequested) start.disabled = pending;
    };
    scenarios.addEventListener('change', syncEngineScenario);
    syncEngineScenario();
    flight.append(manual);
    relocate(by('flightAlt').closest('.flight-grid'), manual);
    const weather = doc.createElement('div');
    weather.id = 'welcomeOnlineWeather';
    weather.innerHTML = '<h3 class="welcome-subheading">Weather Online</h3>' +
      '<label class="welcome-choice"><input type="checkbox" disabled> <span>LIVE METAR</span><small>NOT CONNECTED</small></label>' +
      '<div class="welcome-weather"><label>Temperature (°C)<input type="number" disabled placeholder="—"></label>' +
      '<label>QNH (hPa)<input type="number" disabled placeholder="—"></label></div>' +
      '<p class="welcome-note">No verified weather-to-aircraft connection. Simulator defaults remain unchanged.</p>';
    flight.append(weather);
    let syncing = false;
    const setManualVisibility = () => { manual.hidden = locationSelect.value !== 'MANUAL'; };
    const syncGeneral = () => {
      if (syncing) return;
      syncing = true;
      try {
        const ground = locationSelect.value === 'RUNWAY_READY';
        if (!ground) cold.checked = false;
        cold.disabled = !ground || !locationButton || !generalButton;
        const target = cold.checked ? generalButton : locationButton;
        if (target && target.getAttribute('aria-pressed') !== 'true') target.click();
        locationGrid.hidden = false;
        locationGrid.style.display = '';
        setManualVisibility();
        if (ground && !cold.disabled) by('welcomeGeneralNote').textContent = 'Optional: no selection retains the existing flight-location preset.';
        else if (!ground) by('welcomeGeneralNote').textContent = 'Cold & Dark requires ON THRESHOLD. No airborne power-off preset is applied.';
      } finally { syncing = false; }
    };
    cold.addEventListener('change', syncGeneral);
    locationSelect.addEventListener('change', syncGeneral);
    locationSelect.dispatchEvent(new Event('change', {bubbles:true}));
    syncGeneral();
    // Restore the original dialog visibility and listeners when entering the cockpit.
    restoreWelcomeLocation = () => {
      locationSelect.removeEventListener('change', syncGeneral);
      by('flightAirport').removeEventListener('change', stripRunwayHeadings);
      const isGeneral = generalButton?.getAttribute('aria-pressed') === 'true';
      locationGrid.hidden = isGeneral;
      locationGrid.style.display = isGeneral ? 'none' : '';
    };
    aircraft.addEventListener('change', () => {
      const changes = Object.fromEntries([...aircraft.querySelectorAll('input[name]:checked')]
        .map(input => [input.name, input.value]));
      win.B737AircraftProfileStore.set(changes);
      lastProgressAt = performance.now();
      retry.hidden = true;
    });
    welcome.dataset.stage = 'setup';
    by('unifiedWelcomeSetup').hidden = false;
    start.hidden = false;
    setup = true;
    mark('settings-ready');
    by('unifiedWelcomeTitle').focus({preventScroll: true});
  }

  function panelReadiness() {
    const profile = win.B737AircraftProfileStore?.get();
    const overhead = by('overheadFrame')?.contentDocument;
    const atlas = overhead?.getElementById('atlasAbsolute');
    const pieces = [...(atlas?.querySelectorAll('.atlas-piece') || [])];
    const nativeMain = doc.querySelector('#region-main .region-native');
    const main = Boolean(stage.unifiedMainVisualMountMs) &&
      imagesReady(nativeMain, '.texture-piece > img', 5) &&
      (profile?.engineInstruments !== 'CONVENTIONAL' ||
        (imagesReady(nativeMain, 'img.conventional-engine-panel-v1') &&
         imagesReady(nativeMain, '#fo-owner-panel-v1 > img')));
    const quadrant = doc.querySelector('#region-pedestal [data-piece="throttle-quadrant"]');
    const throttle = imagesReady(quadrant, ':scope > img') &&
      win.B737ThrottlePositions?.mounted() && imagesReady(quadrant, '.throttle-state-sprite', 10);
    const installedOverhead =
      (profile?.pressurization !== 'DCPCS' || imagesReady(overhead, '.dcpcs-owner-oh22-background > img')) &&
      (profile?.aircraftFamily !== 'B737-400' || imagesReady(overhead, '.b737-400-owner-oh20-background > img'));
    const forwardPieces = pieces.filter(piece => piece.dataset.key !== 'UPPER');
    const forwardPhotos = forwardPieces.map(piece => imagesReady(piece, '.atlas-photo'));
    const forward = forwardPieces.length >= 18 && installedOverhead && forwardPhotos.every(Boolean);
    const aft = imagesReady(atlas, '[data-key="UPPER"] .atlas-photo');
    const pedestal = imagesReady(doc, '#region-pedestal .texture-piece > img', 3) &&
      imagesReady(doc, '#region-pedestal .fire-handle-control > img', 3);
    return {main, throttle, forward, aft, pedestal};
  }

  function releaseSystems() {
    if (stage.unifiedWelcomePanels === 'ready') return;
    stage.unifiedWelcomePanels = 'ready';
    mark('panels-ready');
    win.dispatchEvent(new Event('b737:welcome-panels-ready'));
  }

  function beginFlight(now) {
    const shared = new URLSearchParams(win.location.search).has('crewRoom');
    if (!scenarioStarted) {
      if (!shared && pendingEngineScenario()) {
        startRequested = false;
        start.disabled = true;
        start.textContent = 'Start Flight';
        return;
      }
      directorPaintBaseline = mainPaints();
      if (!shared && !win.B737UnifiedFlightScenarioV1?.startFromSelection?.(null)) {
        error.textContent = by('flightScenarioStatus')?.textContent || 'FLIGHT SCENARIO NOT READY';
        error.hidden = false;
        startRequested = false;
        start.disabled = false;
        start.textContent = 'Start Flight';
        return;
      }
      scenarioStarted = true;
      scenarioStartedAt = now;
      mark('flight-initialized');
      // Do not expose a half-painted MAIN PANEL in the same task as
      // FLT PHASE initialization. Wait for both EADIs to repaint.
      return;
    }
    if (!shared) {
      const scenario = win.B737UnifiedFlightScenarioV1;
      const state = scenario?.getState?.();
      const active = scenario?.getDiagnostics?.()?.active === true;
      const ready = state?.preset==='COLD_DARK' ? active && win.B737ColdDarkGeneralPresetV1?.getStatus()?.settled===true : win.B737WelcomeReadinessV2?.scenarioReady?.({
        active, beforePaints:directorPaintBaseline || [],
        afterPaints:mainPaints(), final10:state?.preset === 'FINAL_10',
        final10Complete:win.B737Final10ApproachPresetV1?.getStatus?.()?.complete,
        elapsedMs:now-scenarioStartedAt
      }) === true;
      if (!ready) return;
    }
    restoreWelcomeLocation();
    for (const [node, anchor] of moved) anchor.replaceWith(node);
    cockpit.forEach(node => { node.inert = false; });
    stage.unifiedWelcome = 'entered';
    welcome.hidden = true;
    mark('entered');
    by('viewport')?.focus({preventScroll: true});
  }

  function report(labels, now) {
    const key = labels.join('|');
    if (key !== currentStage) {
      labelIndex = 0;
      currentStage = key;
      lastProgressAt = labelChangedAt = now;
    } else if (labels.length > 1 && now - labelChangedAt >= 1500) {
      labelIndex = (labelIndex + 1) % labels.length;
      labelChangedAt = now;
    }
    const text = labels[labelIndex] || 'Cockpit ready';
    if (text !== currentLabel) {
      progress.textContent = text;
      currentLabel = text;
    }
    progress.parentElement.dataset.ready = String(labels.length === 0);
    retry.hidden = labels.length === 0 || now - lastProgressAt < 25000;
  }

  function refresh() {
    const now = performance.now();
    const visual = panelReadiness();
    const {main, throttle, forward, aft, pedestal} = visual;
    const priorityReady = main && throttle && forward;
    const panelComplete = priorityReady && aft && pedestal;
    const profile = win.B737AircraftProfileStore?.get?.();
    // inspectFull only contains subsystem fields; inspect owns MAIN, PROFILE,
    // and CONTROLS. Combine both rather than assuming inspectFull exposes them.
    const startup = profile ? win.CockpitStartupGate?.inspect?.(win, profile) : null;
    const subsystems = profile ?
      win.CockpitStartupGate?.inspectFull?.(win, profile, startup) : null;
    const full = {...subsystems,
      main:startup?.main===true && startup?.profile===true,
      controls:startup?.controls===true};
    const gate = win.B737WelcomeReadinessV2?.evaluate?.({
      visual,full,mcpMounted:!!doc.querySelector('[data-mcp-hardware="AT_ARM"]')
    }) || null;
    latestReadiness = gate;
    // Only continuous, measurable readiness counts. A briefly ready photo
    // followed by a failed/removed instrument resets the release timer.
    if (gate?.canEnter === true && priorityReady) {
      if (readySince === null) readySince = now;
    } else readySince = null;
    const stable = readySince !== null && now - readySince >= STABLE_MS;
    if (priorityReady && gate?.mainReady && gate.percent >= 70 && !setup &&
        !introTitle.getAnimations().some(animation =>
          animation.animationName === 'unified-intro-title' &&
          animation.playState !== 'finished')) showSetup();
    // ECU was previously blocked until even AFT/Pedestal photos decoded.
    // Release it as soon as MAIN + throttle + forward images are present,
    // then KEEP the welcome overlay until functional instruments/ECU pass.
    if (priorityReady) releaseSystems();
    if (stable && startRequested) beginFlight(now);
    if (welcome.hidden) {
      win.clearInterval(timer);
      return;
    }
    const labels = [];
    if (!gate) labels.push('Preparing cockpit readiness checks…');
    if (!main || !full?.main) labels.push('Loading Main Instrument Panel photographs…');
    if (full?.instruments !== true) labels.push('Initializing EADI, EHSI and engine instruments…');
    if (full?.controls !== true ||
        !doc.querySelector('[data-mcp-hardware="AT_ARM"]')) labels.push('Connecting MCP controls…');
    if (full?.electrical !== true) labels.push('Synchronizing ECU and electrical systems…');
    if (full?.cdu !== true) labels.push('Preparing Captain and First Officer CDU…');
    if (!throttle) labels.push('Loading Throttle Quadrant…');
    if (!forward) labels.push('Loading Forward Overhead…');
    if (setup && !aft) labels.push('Loading Aft Overhead…');
    if (setup && !pedestal) labels.push('Loading Pedestal…');
    if (scenarioStarted) {
      const preset = win.B737UnifiedFlightScenarioV1?.getState?.()?.preset;
      if (preset === 'COLD_DARK') {
        const cd=win.B737ColdDarkGeneralPresetV1?.getStatus();
        if(!cd?.settled)labels.unshift('Configuring Cold & Dark: owner confirmations…');
      }
      if (preset === 'FINAL_10') {
        const status = win.B737Final10ApproachPresetV1?.getStatus?.();
        if (status?.complete !== true)
          labels.unshift('Configuring 10 NM Final: ' +
            (status?.missing?.slice(0, 2).join(', ') || 'owner confirmations'));
      }
      if (!new URLSearchParams(win.location.search).has('crewRoom') &&
          mainPaints().some((count, index) =>
            count <= (directorPaintBaseline?.[index] || 0)))
        labels.push('Applying Flight Phase to both EADIs…');
    }
    if (gate?.canEnter && !setup) labels.push('Preparing Flight Setup…');
    if (!labels.length && !startRequested) labels.push('Cockpit ready · select a flight phase');
    if (!labels.length && startRequested) labels.push('Finalizing cockpit and flight phase…');
    const prefix = gate ? gate.percent + '% readiness · ' : '';
    report(labels.map(label => prefix + label), now);
  }

  cockpit.forEach(node => { node.inert = true; });
  start.addEventListener('click', () => {
    if (pendingEngineScenario()) return;
    const controls = [...flight.querySelectorAll('input, select')];
    if (controls.some(node => !node.closest('[hidden]') && !node.reportValidity())) return;
    error.hidden = true;
    startRequested = true;
    start.disabled = true;
    start.textContent = 'Preparing Cockpit…';
    refresh();
  });
  retry.addEventListener('click', () => win.location.reload());
  mark('shown');
  const timer = win.setInterval(refresh, 220);
  refresh();
})(window, document);
