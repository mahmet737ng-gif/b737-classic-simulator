(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const mechanics = window.B737ControlMechanics;
  if (!mechanics) throw new Error('FCOM control mechanics must load before the panel');
  const guardedIds = ['flightA', 'flightB', 'spoilerA', 'spoilerB'];
  const guardedStateKey = id => id + 'Guard';
  const isGuardOpen = id => state[guardedStateKey(id)] === 'open';

  const state = {
    power: true,
    lampTest: false,
    flightA: 'on',
    flightB: 'on',
    spoilerA: 'on',
    spoilerB: 'on',
    flightAGuard: 'closed',
    flightBGuard: 'closed',
    spoilerAGuard: 'closed',
    spoilerBGuard: 'closed',
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

    $$('[data-guard-control]').forEach(guard => {
      const id=guard.dataset.guardControl;
      guard.dataset.guard = state[guardedStateKey(id)];
      guard.setAttribute('aria-label', id + ' safety guard, ' + guard.dataset.guard);
      guard.setAttribute('aria-pressed', String(isGuardOpen(id)));
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

  function guardAction(id, action, value) {
    const isAlt = id === 'alternateFlapsArm';
    const current = isAlt ? { value: state.altArmed ? 'arm':'off', guard:state.altGuard }
      : { value:state[id], guard:state[guardedStateKey(id)] };
    const result = mechanics.guardTransition(id, current, action, value);
    if (!result.ok) { render(id.toUpperCase() + ' — ' + result.reason); return false; }
    if (isAlt) {
      state.altGuard=result.state.guard;
      state.altArmed=result.state.value === 'arm';
    } else {
      state[id]=result.state.value;
      state[guardedStateKey(id)]=result.state.guard;
    }
    render(id.toUpperCase() + ' — ' + result.state.value.toUpperCase() + ' / GUARD ' + result.state.guard.toUpperCase());
    return true;
  }
  $$('.paddle-guard').forEach(guard => {
    guard.addEventListener('click', () => {
      const id=guard.dataset.guardControl;
      guardAction(id, isGuardOpen(id) ? 'close' : 'open');
    });
  });
  $$('.paddle-control').forEach(control => {
    control.addEventListener('click', () => {
      const key=control.dataset.control;
      const detents=mechanics.definitions[key].detents;
      const next=detents[(detents.indexOf(state[key])+1)%detents.length];
      guardAction(key,'set',next);
    });
  });

  // User-approved three-frame switch. The bezel stays at its fixed panel pivot.
  $$('.selector').forEach(control => {
    const id = control.dataset.control;
    const positions = mechanics.horizontal[id];
    let drag = null;
    function setPosition(value) {
      if(value===state[id]) return;
      const result=mechanics.horizontalTransition(id,state[id],'choose',value);
      if(!result.ok) return;
      state[id]=result.value;
      render(id.toUpperCase()+' — '+labels[id][result.value]);
    }
    function tapDetent(x) {
      const rect=control.getBoundingClientRect();
      const u=(x-rect.left)/rect.width;
      return u<1/3 ? 'left' : u>2/3 ? 'right' : 'normal';
    }
    control.addEventListener('pointerdown',event=>{
      if(event.button!==undefined && event.button!==0) return;
      drag={pointerId:event.pointerId,startX:event.clientX,startPosition:positions.indexOf(state[id])};
      control.setPointerCapture?.(event.pointerId);
    });
    control.addEventListener('pointermove',event=>{
      if(!drag || drag.pointerId!==event.pointerId) return;
      const length=control.getBoundingClientRect().width;
      const step=Math.round((event.clientX-drag.startX)/Math.max(15,length*.28));
      setPosition(positions[Math.max(0,Math.min(2,drag.startPosition+step))]);
    });
    control.addEventListener('pointerup',event=>{
      if(!drag || drag.pointerId!==event.pointerId) return;
      const dx=event.clientX-drag.startX;
      if(Math.abs(dx)<10) setPosition(tapDetent(event.clientX));
      else {
        const length=control.getBoundingClientRect().width;
        const step=Math.round(dx/Math.max(15,length*.28)) || Math.sign(dx);
        setPosition(positions[Math.max(0,Math.min(2,drag.startPosition+step))]);
      }
      drag=null;
      if(control.hasPointerCapture?.(event.pointerId)) control.releasePointerCapture(event.pointerId);
    });
    control.addEventListener('pointercancel',()=>{drag=null;});
    control.addEventListener('lostpointercapture',()=>{drag=null;});
    control.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      if(event.key==='Home') {setPosition('normal');return;}
      if(event.key==='End') {setPosition('right');return;}
      const result=mechanics.horizontalTransition(id,state[id],'step',event.key==='ArrowLeft'?-1:1);
      if(result.ok) setPosition(result.value);
    });
    control.addEventListener('click',event=>{
      // Genuine pointer clicks were already handled on pointerup; synthetic keyboard
      // and assistive input may report detail=0.
      if(event.detail===0 && !drag){
        const result=mechanics.horizontalTransition(id,state[id],'step',1);
        if(result.ok) setPosition(result.value);
      }
    });
    control.addEventListener('wheel',event=>{
      event.preventDefault();
      const result=mechanics.horizontalTransition(id,state[id],'step',event.deltaY>0?1:-1);
      if(result.ok) setPosition(result.value);
    },{passive:false});
  });

  $('.toggle[data-control="yawDamper"]').addEventListener('click', () => {
    state.yawDamper = !state.yawDamper;
    render(`YAW DAMPER — ${state.yawDamper ? 'ON' : 'OFF'}`);
  });

  $('.red-guard').addEventListener('click', () => {
    guardAction('alternateFlapsArm', state.altGuard === 'closed' ? 'open' : 'close');
  });

  $('.arm-switch').addEventListener('click', () => {
    if (state.altGuard !== 'open') {
      render('OPEN THE RED GUARD BEFORE ARMING ALTERNATE FLAPS');
      return;
    }
    guardAction('alternateFlapsArm','set',state.altArmed ? 'off':'arm');
  });

  const altPosition = $('.toggle[data-control="altPosition"]');
  altPosition.addEventListener('pointerdown', event => {
    const rect = altPosition.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    if (!state.altArmed) {
      render('ALTERNATE FLAPS POSITION SWITCH INHIBITED — ARM FIRST');
      return;
    }
    state.altPosition = ratio < .34 ? 'up' : ratio > .66 ? 'down' : 'off';
    render(`ALTERNATE FLAPS — ${state.altPosition.toUpperCase()}`);
  });
  const releaseAlt = () => {
    // FCOM 9.10.3 specifies DOWN is spring-loaded to OFF. UP is not.
    if (state.altPosition === 'down') {
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
      flightAGuard:'closed',flightBGuard:'closed',spoilerAGuard:'closed',spoilerBGuard:'closed',
      altGuard: 'closed', altArmed: false, altPosition: 'off', yawDamper: true,
      vhfNav: 'normal', irs: 'normal', efi: 'normal'
    });
    Object.keys(state.faults).forEach(key => { state.faults[key] = false; });
    render('RESET — NORMAL CONFIGURATION');
  });

  window.B737FlightControlsPanel = {
    getState: () => JSON.parse(JSON.stringify(state)),
    setGuard(id,open) {
      if (!mechanics.definitions[id]) throw new Error('Unknown guarded control: '+id);
      return guardAction(id, open ? 'open':'close');
    },
    setGuardedSwitch(id,value) {
      if (!mechanics.definitions[id]) throw new Error('Unknown guarded control: '+id);
      return guardAction(id,'set',value);
    },
    setNavSource(id,value) {
      if (!mechanics.horizontal[id]) throw new Error('Unknown nav selector: '+id);
      const result=mechanics.horizontalTransition(id,state[id],'choose',value);
      if (!result.ok) return false;
      state[id]=result.value;render();return true;
    },
    setFault(name, value = true) {
      if (!(name in state.faults)) throw new Error(`Unknown annunciator: ${name}`);
      state.faults[name] = Boolean(value); render();
    },
    setPower(value) { state.power = Boolean(value); render(); }
  };

  render();
})();
