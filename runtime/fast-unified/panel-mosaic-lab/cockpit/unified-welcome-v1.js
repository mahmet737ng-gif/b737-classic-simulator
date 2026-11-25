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
  let selectedV1Type = () => null;
  let requestedV1Type = null;
  let selectedFinalType=()=>null,requestedFinalType=null;
  let selectedRapidType=()=>null,requestedRapidType=null,selectedGroundFireType=()=>null,requestedGroundFireType=null;
  retry.textContent='RELOAD';
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
      #unifiedWelcome .welcome-note,#unifiedWelcome .welcome-choice small{display:none!important}
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
      '<label class="welcome-choice"><input id="welcomeColdDark" name="welcomeGroundState" value="COLD_DARK" type="radio"> <span>COLD &amp; DARK</span></label>' +
      '<label class="welcome-choice"><input name="welcomeGroundState" value="READY_FOR_START" type="radio"> <span>READY FOR START</span></label>' +
      '<label class="welcome-choice"><input name="welcomeGroundState" value="READY_FOR_TAKEOFF" type="radio"> <span>READY FOR TAKEOFF</span></label>' +
      '<p class="welcome-note" id="welcomeGeneralNote">Optional: existing flight-location presets are retained when no general state is selected.</p>';
    aircraft.append(general);
    const cold = by('welcomeColdDark');
    const groundChoices=[...general.querySelectorAll('input[name="welcomeGroundState"]')];
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
      ['ABNORMAL_ENGINE_START', 'ABNORMAL ENGINE START', abnormalStartTypes],
      ['ENGINE_FIRE_GROUND','ENGINE FIRE ON GROUND',[['PERSISTING','PERSISTING'],['CONTROLLABLE','CONTROLLABLE']]]
    ];
    const rapid=['RAPID_DECOMPRESSION','RAPID DECOMPRESSION',[['CONTROLLABLE','CONTROLLABLE'],['UNCONTROLLABLE','UNCONTROLLABLE']]];
    const renderChoice=([id,title,types])=>'<label class="welcome-choice"><input type="radio" name="welcomeScenario" value="'+id+'" aria-controls="welcomeFailure_'+id+'" aria-expanded="false"> <span>'+title+'</span></label><fieldset class="welcome-failure-options" id="welcomeFailure_'+id+'" hidden disabled><legend>Failure Type</legend>'+types.map(([v,l])=>'<label class="welcome-choice"><input type="radio" name="welcomeFailure_'+id+'" value="'+v+'"> <span>'+l+'</span></label>').join('')+'</fieldset>';
    scenarios.innerHTML = '<h2>Scenarios</h2>' +
      '<label class="welcome-choice"><input type="radio" name="welcomeScenario" value="NONE" checked> <span>NORMAL FLIGHT</span></label>' +
      '<h3 class="welcome-subheading">Engine Failure</h3>' +
      engineScenarios.map(([id, title, types]) =>
        '<label class="welcome-choice"><input type="radio" name="welcomeScenario" value="' + id +
        '" aria-controls="welcomeFailure_' + id + '" aria-expanded="false"> <span>' + title + '</span></label>' +
        '<fieldset class="welcome-failure-options" id="welcomeFailure_' + id + '" hidden disabled><legend>Failure Type</legend>' +
        types.map(([value, label]) => '<label class="welcome-choice"><input type="radio" name="welcomeFailure_' +
          id + '" value="' + value + '"> <span>' + label + '</span></label>').join('') + '</fieldset>'
      ).join('') +
      '<h3 class="welcome-subheading">Special Operations</h3>' +
      renderChoice(rapid) +
      '<p class="welcome-note" id="welcomeScenarioNote" role="status">Normal Flight available. Engine scenario behavior is not yet configured.</p>';
    by('unifiedWelcomeSetup').append(scenarios);
    const currentScenario=()=>scenarios.querySelector('input[name="welcomeScenario"]:checked')?.value;
    selectedV1Type=()=>currentScenario()==='ENGINE_FAILURE_V1'?by('welcomeFailure_ENGINE_FAILURE_V1')?.querySelector('input:checked')?.value||null:null;
    selectedFinalType=()=>currentScenario()==='ENGINE_FAILURE_FINAL'?by('welcomeFailure_ENGINE_FAILURE_FINAL')?.querySelector('input:checked')?.value||null:null;
    selectedRapidType=()=>currentScenario()==='RAPID_DECOMPRESSION'?by('welcomeFailure_RAPID_DECOMPRESSION')?.querySelector('input:checked')?.value||null:null;
    selectedGroundFireType=()=>currentScenario()==='ENGINE_FIRE_GROUND'?by('welcomeFailure_ENGINE_FIRE_GROUND')?.querySelector('input:checked')?.value||null:null;
    pendingEngineScenario = () => currentScenario()!=='NONE'&&!((selectedV1Type()||selectedFinalType()||selectedRapidType()||selectedGroundFireType())&&!new URLSearchParams(win.location.search).has('crewRoom'));
    let enforceV1Ground=()=>{};
    const syncEngineScenario = () => {
      const selected = scenarios.querySelector('input[name="welcomeScenario"]:checked')?.value;
      for (const [id] of [...engineScenarios,rapid]) {
        const group = by('welcomeFailure_' + id);
        const active = selected === id;
        group.hidden = !active;
        group.disabled = !active;
        scenarios.querySelector('input[name="welcomeScenario"][value="' + id + '"]').setAttribute('aria-expanded', String(active));
        if (!active) group.querySelectorAll('input').forEach(input => { input.checked = false; });
      }
      const pending = pendingEngineScenario();
      const subtype = pending ? by('welcomeFailure_' + selected)?.querySelector('input:checked') : null;
      by('welcomeScenarioNote').textContent = selected==='ENGINE_FAILURE_V1'
        ? (new URLSearchParams(win.location.search).has('crewRoom')?'V1 is single cockpit only.':selectedV1Type()?'Ready for Takeoff · random engine · 140 KT IAS.':'Select a failure type. Ready for Takeoff is required.')
        : selected==='ENGINE_FAILURE_FINAL'?(new URLSearchParams(win.location.search).has('crewRoom')?'Engine-out final is single cockpit only.':selectedFinalType()?'10 NM FINAL · random engine · failure on START.':'Select a failure type. 10 NM FINAL is required.')
        : pending?(subtype?'Failure type selected. Scenario execution is not configured yet.':'Select a failure type. Scenario execution is not configured yet.'):'Normal Flight available.';
      enforceV1Ground();
      if (!startRequested) start.disabled = pending;
    };
    scenarios.addEventListener('change', syncEngineScenario);
    syncEngineScenario();
    flight.append(manual);
    relocate(by('flightAlt').closest('.flight-grid'), manual);
    const weather = doc.createElement('div');
    weather.id = 'welcomeOnlineWeather';
    weather.innerHTML = '<h3 class="welcome-subheading">Weather Online</h3>' +
      '<label class="welcome-choice"><input type="checkbox" disabled> <span>LIVE METAR</span></label>' +
      '<p class="welcome-note">No verified weather-to-aircraft connection. Simulator defaults remain unchanged.</p>';
    flight.append(weather);
    let syncing = false;
    const setManualVisibility = () => { manual.hidden = locationSelect.value !== 'MANUAL'||currentScenario()==='RAPID_DECOMPRESSION'; };
    const syncGeneral = () => {
      if (syncing) return;
      syncing = true;
      try {
        const v1=['ENGINE_FAILURE_V1','ENGINE_FIRE_GROUND'].includes(currentScenario());
        const rapidSelected=currentScenario()==='RAPID_DECOMPRESSION';
        if(v1){locationSelect.value='RUNWAY_READY';for(const choice of groundChoices)choice.checked=choice.value==='READY_FOR_TAKEOFF';}
        const final=currentScenario()==='ENGINE_FAILURE_FINAL';
        if(final)locationSelect.value='FINAL_10';
        if(rapidSelected)locationSelect.value='MANUAL';
        locationSelect.disabled=v1||final||rapidSelected;
        const ground = locationSelect.value === 'RUNWAY_READY';
        for(const choice of groundChoices){if(!ground)choice.checked=false;choice.disabled=v1||!ground||!locationButton||!generalButton;}
        const chosen=groundChoices.find(x=>x.checked);
        const native=chosen&&doc.querySelector('input[name="flightGeneralSetup"][value="'+chosen.value+'"]');
        if(native)native.checked=true;
        const target = native ? generalButton : locationButton;
        if (target && target.getAttribute('aria-pressed') !== 'true') target.click();
        locationGrid.hidden = false;
        locationGrid.style.display = '';
        setManualVisibility();
        if(final)by('welcomeGeneralNote').textContent='10 NM FINAL is required for Engine Failure on Final.';
        else if(v1)by('welcomeGeneralNote').textContent='Ready for Takeoff is required for Engine Failure at V1.';
        else if (ground && !cold.disabled) by('welcomeGeneralNote').textContent = 'Optional: no selection retains the existing flight-location preset.';
        else if (!ground) by('welcomeGeneralNote').textContent = 'Ground presets require ON THRESHOLD.';
      } finally { syncing = false; }
    };
    enforceV1Ground=syncGeneral;
    for(const choice of groundChoices)choice.addEventListener('change',syncGeneral);
    locationSelect.addEventListener('change', syncGeneral);
    locationSelect.dispatchEvent(new Event('change', {bubbles:true}));
    syncGeneral();
    // Restore the original dialog visibility and listeners when entering the cockpit.
    restoreWelcomeLocation = () => {
      locationSelect.removeEventListener('change', syncGeneral);
      locationSelect.disabled=false;
      by('flightAirport').removeEventListener('change', stripRunwayHeadings);
      const isGeneral = generalButton?.getAttribute('aria-pressed') === 'true';
      locationGrid.hidden = isGeneral;
      locationGrid.style.display = isGeneral ? 'none' : '';
    };
    aircraft.addEventListener('change', () => {
      const changes = Object.fromEntries([...aircraft.querySelectorAll('fieldset input[name]:checked')]
        .map(input => [input.name, input.value]));
      win.B737AircraftProfileStore.set(changes);
      lastProgressAt = performance.now();
      retry.hidden = true;
    });
    welcome.dataset.stage = 'setup';
    by('unifiedWelcomeSetup').hidden = false;
    start.hidden = false;
    start.textContent='START';
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

  function preparationFailed(message){
    win.B737PoweredGeneralPresetsV1?.stop();
    console.warn('Welcome preparation failed',message);error.textContent='Something went wrong.';error.hidden=false;retry.hidden=false;scenarioStarted=false;startRequested=false;
    start.disabled=pendingEngineScenario();start.textContent='START';
  }
  function beginFlight(now) {
    const shared = new URLSearchParams(win.location.search).has('crewRoom');
    if (!scenarioStarted) {
      if (!shared && pendingEngineScenario()) {
        startRequested = false;
        start.disabled = true;
        start.textContent = 'START';
        return;
      }
      directorPaintBaseline = mainPaints();
      let loaded=false;
      if(!shared){try{
        if(requestedRapidType){
          const s=win.B737UnifiedFlightScenarioV1.loadScenario({airport:by('flightAirport').value,runway:by('flightRunway').value,preset:'MANUAL',airborne:true,holdStart:true,altitudeFt:30000,headingDeg:90,speedKt:279,vsFpm:0});
          if(!s||!win.B737PoweredGeneralPresetsV1?.applyCruise)throw Error('Cruise owner unavailable');
          win.B737PoweredGeneralPresetsV1.applyCruise(s);loaded=true;
        }else loaded=win.B737UnifiedFlightScenarioV1?.startFromSelection?.(null)===true;
      }catch(e){console.warn(e);}}
      if (!shared && !loaded) {
        console.warn(by('flightScenarioStatus')?.textContent);error.textContent='Something went wrong.';retry.hidden=false;
        error.hidden = false;
        startRequested = false;
        start.disabled = false;
        start.textContent = 'START';
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
      const powered=win.B737PoweredGeneralPresetsV1;
      const p=powered?.getStatus();
      const poweredSetup=Boolean(requestedRapidType)||powered?.applies(state?.preset);
      if(poweredSetup&&p?.state===state.preset&&p.timedOut&&!p.coreReady){
        preparationFailed('Preset incomplete: '+p.missing.map(k=>k+(p.reasons?.[k]?': '+p.reasons[k]:'')).join(' | '));return;
      }
      const ready = poweredSetup ? active&&p?.state===state.preset&&p?.settled===true&&p?.coreReady===true : state?.preset==='COLD_DARK' ? active && win.B737ColdDarkGeneralPresetV1?.getStatus()?.settled===true : win.B737WelcomeReadinessV2?.scenarioReady?.({
        active, beforePaints:directorPaintBaseline || [],
        afterPaints:mainPaints(), final10:state?.preset === 'FINAL_10',
        final10Complete:win.B737Final10ApproachPresetV1?.getStatus?.()?.complete,
        elapsedMs:now-scenarioStartedAt
      }) === true;
      if (!ready) return;
      if(requestedGroundFireType||requestedRapidType){
        try{
          if(requestedGroundFireType){if(!win.B737EngineFailureV1Scenario?.armGround)throw Error('Fire owner unavailable');win.B737EngineFailureV1Scenario.armGround(requestedGroundFireType,state);}
          if(requestedRapidType){if(!win.B737UnifiedInstructorNonNormalV1?.armRapid)throw Error('Pressure owner unavailable');win.B737UnifiedInstructorNonNormalV1.armRapid(requestedRapidType);}
        }catch(e){preparationFailed(String(e.message||e));return;}
      }
      if(requestedV1Type||requestedFinalType){
       try{if(!win.B737EngineFailureV1Scenario)throw Error('Engine failure scenario owner not loaded');if(requestedFinalType)win.B737EngineFailureV1Scenario.armFinal(requestedFinalType,state);else win.B737EngineFailureV1Scenario.arm(requestedV1Type,state);}
       catch(e){preparationFailed(String(e.message||e));return;}
      }
    }
    restoreWelcomeLocation();
    for (const [node, anchor] of moved) anchor.replaceWith(node);
    cockpit.forEach(node => { node.inert = false; });
    stage.unifiedWelcome = 'entered';
    welcome.hidden = true;
    mark('entered');
    if(requestedRapidType)win.B737UnifiedFlightScenarioV1?.pause(false);
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
    const stalled=labels.length>0&&now-lastProgressAt>=25000;
    const text = stalled?'Something went wrong.':labels.length?'Preparing cockpit…':'';
    if (text !== currentLabel) {
      progress.textContent = text;
      currentLabel = text;
    }
    progress.parentElement.dataset.ready = String(labels.length === 0);
    progress.parentElement.style.display=labels.length===0?'none':'';
    retry.hidden = error.hidden && !stalled;
  }

  let prewarmKey='';
  function prewarm(){const api=win.B737UnifiedFlightScenarioV1,airport=by('flightAirport')?.value,runway=by('flightRunway')?.value;if(!api?.prepareScenario||!airport||!runway)return;const key=airport+'|'+runway;if(key===prewarmKey)return;try{for(const preset of ['RUNWAY_READY','COLD_DARK','READY_FOR_START','READY_FOR_TAKEOFF','FINAL_10'])api.prepareScenario({airport,runway,preset,airborne:preset==='FINAL_10'});api.prepareScenario({airport,runway,preset:'MANUAL',airborne:true,holdStart:true,altitudeFt:30000,headingDeg:90,speedKt:279,vsFpm:0});prewarmKey=key;}catch(e){console.warn('Scenario preload',e);}}
  function refresh() {
    prewarm();
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
    if(startRequested&&scenarioStarted){
      const state=win.B737UnifiedFlightScenarioV1?.getState?.();
      const p=win.B737PoweredGeneralPresetsV1?.getStatus?.();
      if(p?.state===state?.preset&&p?.timedOut&&!p.coreReady){
        preparationFailed('Preset incomplete: '+p.missing.map(k=>k+(p.reasons?.[k]?': '+p.reasons[k]:'')).join(' | '));
      }else if(now-scenarioStartedAt>40000&&(requestedRapidType||['READY_FOR_START','READY_FOR_TAKEOFF'].includes(state?.preset))){
        const keys=[...(p?.missing||[]),...(p?.pending||[])];
        preparationFailed('Cockpit preparation timed out: '+(keys.map(k=>k+(p.reasons?.[k]?': '+p.reasons[k]:'')).join(' | ')||'Readiness gate not satisfied'));
      }
    }
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
      if(win.B737PoweredGeneralPresetsV1?.applies(preset)){
        const p=win.B737PoweredGeneralPresetsV1.getStatus();
        if(!p?.settled)labels.unshift('Configuring '+preset.replaceAll('_',' ')+': '+[...(p?.missing||[]),...(p?.pending||[])].slice(0,2).map(k=>k+(p?.reasons?.[k]?': '+p.reasons[k]:'')).join(' | '));
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
    if (!labels.length && !startRequested) {progress.parentElement.hidden=true;report([],now);return;}
    progress.parentElement.hidden=false;
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
    requestedV1Type=selectedV1Type();requestedFinalType=selectedFinalType();requestedRapidType=selectedRapidType();requestedGroundFireType=selectedGroundFireType();
    startRequested = true;
    start.disabled = true;
    start.textContent = 'STARTING…';
    refresh();
  });
  retry.addEventListener('click', () => win.location.reload());
  mark('shown');
  const timer = win.setInterval(refresh, 220);
  refresh();
})(window, document);
