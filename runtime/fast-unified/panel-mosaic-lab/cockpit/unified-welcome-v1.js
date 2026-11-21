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
  let startRequested = false;
  let lastProgressAt = performance.now();
  let currentStage = '';
  let currentLabel = '';
  let labelIndex = 0;
  let labelChangedAt = 0;

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
    relocate(by('flightAirport').closest('.flight-grid'), flight);
    flight.append(manual, initialLoad);
    relocate(by('flightAlt').closest('.flight-grid'), manual);
    const setManualVisibility = () => { manual.hidden = by('flightPreset').value !== 'MANUAL'; };
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

  function beginFlight() {
    const startupLoad = fuel.value !== '' || mass.value !== '';
    const owner = win.B737ISNCockpitV1;
    if (startupLoad && !owner?.applyStartupLoad) return;
    const applyLoad = startupLoad ? () => owner.applyStartupLoad({
      fuelKg: fuel.value === '' ? null : fuel.valueAsNumber,
      massKg: mass.value === '' ? null : mass.valueAsNumber
    }) : null;
    if (!win.B737UnifiedFlightScenarioV1.startFromSelection(applyLoad)) {
      error.textContent = by('flightScenarioStatus').textContent;
      error.hidden = false;
      startRequested = false;
      start.disabled = false;
      start.textContent = 'Start Flight';
      return;
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
    const {main, throttle, forward, aft, pedestal} = panelReadiness();
    const priorityReady = main && throttle && forward;
    const panelComplete = priorityReady && aft && pedestal;
    if (priorityReady && !setup && !introTitle.getAnimations().some(animation =>
      animation.animationName === 'unified-intro-title' && animation.playState !== 'finished'
    )) showSetup();
    if (panelComplete) releaseSystems();
    if (panelComplete && startRequested) beginFlight();
    if (welcome.hidden) {
      win.clearInterval(timer);
      return;
    }
    const labels = [];
    if (!main) labels.push('Loading Main Instrument Panel…');
    if (!doc.querySelector('[data-mcp-hardware="AT_ARM"]')) labels.push('Loading MCP…');
    if (!throttle) labels.push('Loading Throttle Quadrant…');
    if (!forward) labels.push('Loading Forward Overhead…');
    if (setup && !aft) labels.push('Loading Aft Overhead…');
    if (setup && !pedestal) labels.push('Loading Pedestal…');
    if (panelComplete && !setup) labels.push('Preparing Flight Setup…');
    if (setup && doc.querySelectorAll('.cdu-station.ready').length < 2) labels.push('Loading CDU…');
    if (panelComplete && !win.B737ISNCockpitV1?.startupSynchronized()) labels.push('Initializing Systems…');
    report(labels, performance.now());
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
