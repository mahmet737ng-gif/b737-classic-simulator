(() => {
  'use strict';

  const panel = document.querySelector('#panel');
  const status = document.querySelector('#status');
  const label = document.querySelector('#focus-label');
  const pumpIds = ['ctrL', 'ctrR', 'tank1Aft', 'tank1Fwd', 'tank2Fwd', 'tank2Aft'];
  const timers = new Map();

  const state = {
    powered: true,
    fuelTempC: 10,
    crossfeed: { command: 'closed', valve: 'closed' },
    pumps: Object.fromEntries(pumpIds.map(id => [id, { switch: 'off', pressure: 'low', availableFuel: true, failed: false }])),
    fuelValveLights: ['off', 'bright'],
    filterBypass: [true, true],
    lampTest: false
  };

  const names = {
    crossfeed: 'CROSSFEED SELECTOR',
    ctrL: 'CENTER LEFT FUEL PUMP',
    ctrR: 'CENTER RIGHT FUEL PUMP',
    tank1Aft: 'TANK 1 AFT FUEL PUMP',
    tank1Fwd: 'TANK 1 FWD FUEL PUMP',
    tank2Fwd: 'TANK 2 FWD FUEL PUMP',
    tank2Aft: 'TANK 2 AFT FUEL PUMP'
  };

  function setLamp(el, mode) {
    el.classList.remove('dim', 'bright');
    if (state.powered && (state.lampTest || mode === 'bright')) el.classList.add('bright');
    else if (state.powered && mode === 'dim') el.classList.add('dim');
  }

  function render() {
    panel.dataset.powered = String(state.powered);
    document.querySelector('#power').classList.toggle('active', state.powered);

    const fuelTempControl = document.querySelector('#fuel-temp-control');
    const fuelTempNeedle = document.querySelector('#fuel-temp-needle');
    const needleAngle = Math.max(-70, Math.min(70, state.fuelTempC * 1.75));
    fuelTempNeedle.style.setProperty('--needle-angle', `${needleAngle}deg`);
    fuelTempControl.setAttribute('aria-valuenow', String(Math.round(state.fuelTempC)));
    fuelTempControl.setAttribute('aria-valuetext', `${Math.round(state.fuelTempC)} degrees Celsius`);

    pumpIds.forEach(id => {
      const pump = state.pumps[id];
      const control = document.querySelector(`[data-control="${id}"]`);
      const visual = document.querySelector(`.toggle-visual[data-switch="${id}"]`);
      const lamp = document.querySelector(`.pump-lamp[data-pump="${id}"]`);
      control.classList.toggle('on', pump.switch === 'on');
      visual.classList.toggle('on', pump.switch === 'on');
      control.setAttribute('aria-checked', String(pump.switch === 'on'));
      setLamp(lamp, pump.pressure === 'low' ? 'bright' : 'off');
    });

    const rotary = document.querySelector('[data-control="crossfeed"]');
    rotary.classList.toggle('open', state.crossfeed.command === 'open');
    rotary.classList.toggle('transit', state.crossfeed.valve === 'transit');
    rotary.setAttribute('aria-label', `Crossfeed selector, ${state.crossfeed.command}`);
    const crossMode = state.crossfeed.valve === 'open' ? 'dim' : state.crossfeed.valve === 'transit' ? 'bright' : 'off';
    setLamp(document.querySelector('#lamp-crossfeed'), crossMode);

    setLamp(document.querySelector('#lamp-fuel-valve-1'), state.fuelValveLights[0]);
    setLamp(document.querySelector('#lamp-fuel-valve-2'), state.fuelValveLights[1]);
    setLamp(document.querySelector('#lamp-filter-1'), state.filterBypass[0] ? 'bright' : 'off');
    setLamp(document.querySelector('#lamp-filter-2'), state.filterBypass[1] ? 'bright' : 'off');

    emitState();
  }

  function emitState() {
    window.B737FuelPanelState = structuredClone(state);
    window.dispatchEvent(new CustomEvent('b737:fuel-panel-change', { detail: structuredClone(state) }));
  }

  function announce(text) {
    status.textContent = text;
    label.textContent = text;
    label.classList.add('show');
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => label.classList.remove('show'), 1300);
  }

  function throwPump(id) {
    if (!state.powered) return announce('NO ELECTRICAL POWER');
    const pump = state.pumps[id];
    pump.switch = pump.switch === 'on' ? 'off' : 'on';
    clearTimeout(timers.get(id));
    const visual = document.querySelector(`.toggle-visual[data-switch="${id}"]`);
    visual.classList.remove('throwing');
    void visual.getBoundingClientRect();
    visual.classList.add('throwing');
    setTimeout(() => visual.classList.remove('throwing'), 280);

    if (pump.switch === 'off') {
      pump.pressure = 'low';
      announce(`${names[id]} — OFF / LOW PRESSURE`);
      render();
      return;
    }

    pump.pressure = 'low';
    announce(`${names[id]} — ON / PRESSURIZING`);
    render();
    const timer = setTimeout(() => {
      if (pump.switch === 'on' && state.powered && pump.availableFuel && !pump.failed) {
        pump.pressure = 'normal';
        announce(`${names[id]} — ON / PRESSURE NORMAL`);
        render();
      }
    }, 720);
    timers.set(id, timer);
  }

  function rotateCrossfeed() {
    if (!state.powered) return announce('NO ELECTRICAL POWER');
    const opening = state.crossfeed.command === 'closed';
    state.crossfeed.command = opening ? 'open' : 'closed';
    state.crossfeed.valve = 'transit';
    announce(`CROSSFEED — ${opening ? 'OPENING' : 'CLOSING'} / BRIGHT`);
    render();
    setTimeout(() => {
      state.crossfeed.valve = opening ? 'open' : 'closed';
      announce(opening ? 'CROSSFEED — OPEN / DIM' : 'CROSSFEED — CLOSED / LIGHT OUT');
      render();
    }, 820);
  }

  function activateControl(id) {
    if (id === 'crossfeed') rotateCrossfeed();
    else throwPump(id);
  }

  const fuelTempControl = document.querySelector('#fuel-temp-control');
  function setFuelTemperature(value, shouldAnnounce = true) {
    state.fuelTempC = Math.max(-40, Math.min(40, Number(value)));
    if (shouldAnnounce) announce(`FUEL TEMPERATURE — ${Math.round(state.fuelTempC)}°C`);
    render();
  }

  function temperatureFromPointer(event) {
    const rect = fuelTempControl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(event.clientX - cx, cy - event.clientY) * 180 / Math.PI;
    return Math.max(-40, Math.min(40, angle / 1.75));
  }

  fuelTempControl.addEventListener('pointerdown', event => {
    fuelTempControl.setPointerCapture(event.pointerId);
    fuelTempControl.classList.add('dragging');
    setFuelTemperature(temperatureFromPointer(event));
  });
  fuelTempControl.addEventListener('pointermove', event => {
    if (fuelTempControl.hasPointerCapture(event.pointerId)) setFuelTemperature(temperatureFromPointer(event), false);
  });
  fuelTempControl.addEventListener('pointerup', event => {
    if (fuelTempControl.hasPointerCapture(event.pointerId)) fuelTempControl.releasePointerCapture(event.pointerId);
    fuelTempControl.classList.remove('dragging');
    announce(`FUEL TEMPERATURE — ${Math.round(state.fuelTempC)}°C`);
  });
  fuelTempControl.addEventListener('pointercancel', () => fuelTempControl.classList.remove('dragging'));
  fuelTempControl.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); setFuelTemperature(state.fuelTempC - 1); }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); setFuelTemperature(state.fuelTempC + 1); }
    if (event.key === 'Home') { event.preventDefault(); setFuelTemperature(-40); }
    if (event.key === 'End') { event.preventDefault(); setFuelTemperature(40); }
  });

  document.querySelectorAll('.control').forEach(control => {
    control.addEventListener('click', () => activateControl(control.dataset.control));
    control.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateControl(control.dataset.control);
      }
    });
    control.addEventListener('pointerenter', () => announce(names[control.dataset.control]));
  });

  document.querySelectorAll('#lamp-fuel-valve-1, #lamp-fuel-valve-2').forEach((lamp, index) => {
    const cycle = () => {
      const sequence = ['off', 'dim', 'bright'];
      state.fuelValveLights[index] = sequence[(sequence.indexOf(state.fuelValveLights[index]) + 1) % sequence.length];
      announce(`FUEL VALVE ${index + 1} — ${state.fuelValveLights[index].toUpperCase()}`);
      render();
    };
    lamp.addEventListener('click', cycle);
    lamp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycle(); } });
  });

  document.querySelectorAll('#lamp-filter-1, #lamp-filter-2').forEach((lamp, index) => {
    const toggle = () => {
      state.filterBypass[index] = !state.filterBypass[index];
      announce(`FILTER BYPASS ${index + 1} — ${state.filterBypass[index] ? 'FAULT' : 'NORMAL'}`);
      render();
    };
    lamp.addEventListener('click', toggle);
    lamp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  document.querySelector('#power').addEventListener('click', () => {
    state.powered = !state.powered;
    if (!state.powered) {
      pumpIds.forEach(id => state.pumps[id].pressure = 'low');
      state.crossfeed.valve = 'closed';
    }
    announce(state.powered ? 'ELECTRICAL POWER ON' : 'ELECTRICAL POWER OFF');
    render();
  });

  const lampTest = document.querySelector('#lamp-test');
  const setLampTest = active => {
    state.lampTest = active;
    lampTest.classList.toggle('active', active);
    status.textContent = active ? 'MASTER LAMP TEST — ALL BRIGHT' : 'LAMP TEST RELEASED';
    render();
  };
  lampTest.addEventListener('pointerdown', event => { event.preventDefault(); setLampTest(true); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => lampTest.addEventListener(type, () => setLampTest(false)));
  lampTest.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') setLampTest(true); });
  lampTest.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') setLampTest(false); });

  document.querySelector('#reset').addEventListener('click', () => {
    pumpIds.forEach(id => Object.assign(state.pumps[id], { switch: 'off', pressure: 'low', availableFuel: true, failed: false }));
    state.powered = true;
    state.fuelTempC = 10;
    state.crossfeed = { command: 'closed', valve: 'closed' };
    state.fuelValveLights = ['off', 'bright'];
    state.filterBypass = [true, true];
    state.lampTest = false;
    timers.forEach(clearTimeout);
    timers.clear();
    announce('RESET — REFERENCE CONFIGURATION');
    render();
  });

  window.B737FuelPanel = {
    getState: () => structuredClone(state),
    setPumpPressure(id, normal) {
      if (!pumpIds.includes(id)) throw new Error(`Unknown pump: ${id}`);
      state.pumps[id].pressure = normal ? 'normal' : 'low';
      render();
    },
    setPumpFailure(id, failed) {
      if (!pumpIds.includes(id)) throw new Error(`Unknown pump: ${id}`);
      state.pumps[id].failed = Boolean(failed);
      if (failed) state.pumps[id].pressure = 'low';
      render();
    },
    setAvailableFuel(id, available) {
      if (!pumpIds.includes(id)) throw new Error(`Unknown pump: ${id}`);
      state.pumps[id].availableFuel = Boolean(available);
      if (!available) state.pumps[id].pressure = 'low';
      render();
    },
    setFuelTemperature(celsius) {
      setFuelTemperature(celsius, false);
    }
  };

  render();
})();
