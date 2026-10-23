(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const state = {
    power: true,
    lampTest: false,
    flightA: 'on',
    flightB: 'on',
    spoilerA: 'on',
    spoilerB: 'on',
    altGuard: 'closed',
    altArmed: false,
    altPosition: 'off',
    yawDamper: true,
    vhfNav: 'normal',
    irs: 'normal',
    efi: 'normal',
    faults: {
      standbyQuantity: false,
      standbyPressure: false,
      flightPressureA: false,
      flightPressureB: false,
      feelDiff: false,
      speedTrim: false,
      machTrim: false,
      autoSlat: false,
      yawDamper: false
    }
  };

  const labels = {
    flightA: { stby: 'STBY RUD', off: 'OFF', on: 'ON' },
    flightB: { stby: 'STBY RUD', off: 'OFF', on: 'ON' },
    spoilerA: { off: 'OFF', on: 'ON' },
    spoilerB: { off: 'OFF', on: 'ON' },
    vhfNav: { left: 'BOTH ON 1', normal: 'NORMAL', right: 'BOTH ON 2' },
    irs: { left: 'BOTH ON L', normal: 'NORMAL', right: 'BOTH ON R' },
    efi: { left: 'BOTH ON 1', normal: 'NORMAL', right: 'BOTH ON 2' }
  };

  function effectiveLights() {
    const lights = { ...state.faults };
    lights.flightPressureA ||= state.power && state.flightA !== 'on';
    lights.flightPressureB ||= state.power && state.flightB !== 'on';
    lights.yawDamper ||= state.power && !state.yawDamper;
    if (!state.power) Object.keys(lights).forEach(key => { lights[key] = false; });
    if (state.lampTest && state.power) Object.keys(lights).forEach(key => { lights[key] = true; });
    return lights;
  }

  function render(message = '') {
    $$('[data-control]').forEach(control => {
      const key = control.dataset.control;
      const value = key === 'yawDamper' ? (state.yawDamper ? 'on' : 'off') : state[key];
      control.dataset.position = value;
      control.setAttribute('aria-valuetext', labels[key]?.[value] || value.toUpperCase());
      if (control.getAttribute('role') === 'switch' || key === 'yawDamper') {
        control.setAttribute('aria-checked', String(value === 'on'));
      }
    });

    const alt = $('.alt-arm');
    alt.dataset.guard = state.altGuard;
    alt.dataset.armed = String(state.altArmed);
    $('.red-guard').setAttribute('aria-pressed', String(state.altGuard === 'open'));
    $('.red-guard').setAttribute('aria-label', `Alternate flaps red guard, ${state.altGuard}`);
    $('.arm-switch').setAttribute('aria-pressed', String(state.altArmed));

    const lights = effectiveLights();
    $$('[data-light]').forEach(lamp => {
      const lit = Boolean(lights[lamp.dataset.light]);
      lamp.classList.toggle('lit', lit);
      lamp.setAttribute('aria-pressed', String(lit));
    });

    $('#power').setAttribute('aria-pressed', String(state.power));
    $('#hyd-fail').setAttribute('aria-pressed', String(state.faults.standbyPressure || state.faults.standbyQuantity));
    $('#status').textContent = message || statusLine(lights);
  }

  function statusLine(lights) {
    if (!state.power) return 'PANEL POWER OFF';
    const active = Object.entries(lights).filter(([, value]) => value).map(([key]) => key);
    if (active.length) return `ACTIVE ANNUNCIATORS: ${active.join(', ').toUpperCase()}`;
    return 'READY — NORMAL CONFIGURATION';
  }

  function cycle(key, positions) {
    const current = state[key];
    state[key] = positions[(positions.indexOf(current) + 1) % positions.length];
    render(`${key.toUpperCase()} — ${labels[key]?.[state[key]] || state[key].toUpperCase()}`);
  }

  $$('.paddle-control').forEach(control => {
    control.addEventListener('click', () => {
      const key = control.dataset.control;
      cycle(key, control.classList.contains('three') ? ['on', 'off', 'stby'] : ['on', 'off']);
    });
  });

  $$('.selector').forEach(control => {
    control.addEventListener('click', event => {
      const rect = control.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      const next = ratio < .36 ? 'left' : ratio > .64 ? 'right' : 'normal';
      state[control.dataset.control] = next;
      render(`${control.dataset.control.toUpperCase()} — ${labels[control.dataset.control][next]}`);
    });
  });

  $('.toggle[data-control="yawDamper"]').addEventListener('click', () => {
    state.yawDamper = !state.yawDamper;
    render(`YAW DAMPER — ${state.yawDamper ? 'ON' : 'OFF'}`);
  });

  $('.red-guard').addEventListener('click', () => {
    state.altGuard = state.altGuard === 'closed' ? 'open' : 'closed';
    if (state.altGuard === 'closed' && state.altArmed) state.altArmed = false;
    render(`ALTERNATE FLAPS GUARD — ${state.altGuard.toUpperCase()}`);
  });

  $('.arm-switch').addEventListener('click', () => {
    if (state.altGuard !== 'open') {
      render('OPEN THE RED GUARD BEFORE ARMING ALTERNATE FLAPS');
      return;
    }
    state.altArmed = !state.altArmed;
    render(`ALTERNATE FLAPS — ${state.altArmed ? 'ARMED' : 'OFF'}`);
  });

  const altPosition = $('.toggle[data-control="altPosition"]');
  altPosition.addEventListener('pointerdown', event => {
    const rect = altPosition.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    if (!state.altArmed) {
      render('ALTERNATE FLAPS POSITION SWITCH INHIBITED — ARM FIRST');
      return;
    }
    state.altPosition = ratio < .5 ? 'up' : 'down';
    render(`ALTERNATE FLAPS — ${state.altPosition.toUpperCase()}`);
  });
  const releaseAlt = () => {
    if (state.altPosition !== 'off') {
      state.altPosition = 'off';
      render('ALTERNATE FLAPS POSITION SWITCH — RETURNED TO OFF');
    }
  };
  altPosition.addEventListener('pointerup', () => setTimeout(releaseAlt, 240));
  altPosition.addEventListener('pointercancel', releaseAlt);
  altPosition.addEventListener('pointerleave', event => { if (event.buttons) releaseAlt(); });

  $$('[data-light]').forEach(lamp => {
    lamp.addEventListener('click', () => {
      const key = lamp.dataset.light;
      state.faults[key] = !state.faults[key];
      render(`${key.toUpperCase()} FAULT — ${state.faults[key] ? 'SET' : 'CLEARED'}`);
    });
  });

  $('#power').addEventListener('click', () => {
    state.power = !state.power;
    render(`PANEL POWER — ${state.power ? 'ON' : 'OFF'}`);
  });

  const lampTest = $('#lamp-test');
  const setLampTest = value => { state.lampTest = value; render(value ? 'LAMP TEST — ALL ANNUNCIATORS BRIGHT' : 'LAMP TEST RELEASED'); };
  lampTest.addEventListener('pointerdown', () => setLampTest(true));
  lampTest.addEventListener('pointerup', () => setLampTest(false));
  lampTest.addEventListener('pointercancel', () => setLampTest(false));
  lampTest.addEventListener('pointerleave', event => { if (event.buttons) setLampTest(false); });

  $('#hyd-fail').addEventListener('click', () => {
    const fail = !(state.faults.standbyPressure || state.faults.standbyQuantity);
    state.faults.standbyPressure = fail;
    state.faults.standbyQuantity = fail;
    render(`STANDBY HYDRAULIC FAILURE — ${fail ? 'SET' : 'CLEARED'}`);
  });

  $('#reset').addEventListener('click', () => {
    Object.assign(state, {
      power: true, lampTest: false, flightA: 'on', flightB: 'on', spoilerA: 'on', spoilerB: 'on',
      altGuard: 'closed', altArmed: false, altPosition: 'off', yawDamper: true,
      vhfNav: 'normal', irs: 'normal', efi: 'normal'
    });
    Object.keys(state.faults).forEach(key => { state.faults[key] = false; });
    render('RESET — NORMAL CONFIGURATION');
  });

  window.B737FlightControlsPanel = {
    getState: () => JSON.parse(JSON.stringify(state)),
    setFault(name, value = true) {
      if (!(name in state.faults)) throw new Error(`Unknown annunciator: ${name}`);
      state.faults[name] = Boolean(value); render();
    },
    setPower(value) { state.power = Boolean(value); render(); }
  };

  render();
})();
