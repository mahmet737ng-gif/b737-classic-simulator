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
  const initialLoad = by('unifiedWelcomeLoad');
  const fuel = by('unifiedWelcomeFuel');
  const mass = by('unifiedWelcomeMass');
  const cockpit = [...doc.querySelectorAll('body > header, body > main')];
  const moved = [];
  const decoded = new WeakMap();
  let setup = false;
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
    relocate(by('flightSetupTabs') || by('flightAirport').closest('.flight-grid'), flight);
    flight.append(manual, initialLoad);
    relocate(by('flightAlt').closest('.flight-grid'), manual);
    const setManualVisibility = () => { manual.hidden = (win.B737UnifiedFlightScenarioV1?.getSelectedPreset?.() || by('flightPreset').value) !== 'MANUAL'; };
    by('flightPreset').addEventListener('change', setManualVisibility);
    setManualVisibility();
    aircraft.addEventListener('change', () => {
      const changes = Object.fromEntries([...aircraft.querySelectorAll('input:checked')]
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
      const startupLoad = fuel.value !== '' || mass.value !== '';
      const owner = win.B737ISNCockpitV1;
      if (!shared && startupLoad && !owner?.applyStartupLoad) return;
      const applyLoad = startupLoad ? () => owner.applyStartupLoad({
        fuelKg: fuel.value === '' ? null : fuel.valueAsNumber,
        massKg: mass.value === '' ? null : mass.valueAsNumber
      }) : null;
      directorPaintBaseline = mainPaints();
      if (!shared && !win.B737UnifiedFlightScenarioV1?.startFromSelection?.(applyLoad)) {
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
