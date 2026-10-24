(function () {
  'use strict';
  const API = window.B737_ENGINE_START_DETENTS;
  const selectors = API.createEngineStartSelectors();
  const groups = { 1: document.getElementById('rotary-1'), 2: document.getElementById('rotary-2') };
  const initialTransform = {};

  function update(engine) {
    const p = API.geometry(engine).pivot;
    const angle = selectors.angle(engine);
    const group = groups[engine];
    // The sprite is north-pointing; rotation lands directly on the measured label ray.
    group.setAttribute('transform', `rotate(${angle.toFixed(3)} ${p.x} ${p.y})`);
    group.setAttribute('aria-label', `Engine ${engine} start switch, ${selectors.get(engine)}`);
    document.getElementById(`status-${engine}`).textContent = selectors.get(engine);
    document.getElementById(`degrees-${engine}`).textContent = `Detent angle: ${angle.toFixed(1)}° · printed-mark calibrated`;
    document.querySelectorAll(`#buttons-${engine} button`).forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.detent === selectors.get(engine)));
    });
  }

  function bindPointer(group, engine) {
    let drag = null;
    const THRESHOLD = 23;
    group.addEventListener('pointerdown', event => {
      if (event.button != null && event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, consumed: 0, moved: false };
      try { group.setPointerCapture(event.pointerId); } catch (_) {}
    });
    group.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = drag.y - event.clientY;
      const motion = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      const reached = Math.trunc(motion / THRESHOLD);
      const difference = reached - drag.consumed;
      if (!difference) return;
      const steps = Math.min(4, Math.abs(difference));
      for (let n = 0; n < steps; n++) selectors.step(engine, Math.sign(difference));
      drag.consumed = reached;
      drag.moved = true;
      event.preventDefault();
    });
    function finish(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const moved = drag.moved;
      drag = null;
      selectors.release(engine); // Intentionally does not advance or snap to a new state.
      if (!moved) group.dataset.tapPending = 'true';
      try { group.releasePointerCapture(event.pointerId); } catch (_) {}
    }
    group.addEventListener('pointerup', finish);
    group.addEventListener('pointercancel', finish);
    group.addEventListener('lostpointercapture', event => { if (drag && event.pointerId === drag.id) drag = null; });
    group.addEventListener('click', () => {
      if (group.dataset.tapPending === 'true') {
        selectors.step(engine, +1, 'tap');
      }
      delete group.dataset.tapPending;
    });
    group.addEventListener('wheel', event => {
      event.preventDefault();
      selectors.step(engine, -Math.sign(event.deltaY), 'wheel');
    }, { passive: false });
    group.addEventListener('keydown', event => {
      let direction = 0;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') direction = +1;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') direction = -1;
      if (direction) { event.preventDefault(); selectors.step(engine, direction, 'keyboard'); }
    });
  }

  for (const engine of [1, 2]) {
    const buttonGroup = document.getElementById(`buttons-${engine}`);
    for (const detent of API.ORDER) {
      const button = document.createElement('button');
      button.textContent = detent;
      button.dataset.detent = detent;
      button.type = 'button';
      button.addEventListener('click', () => selectors.set(engine, detent, 'button'));
      buttonGroup.appendChild(button);
    }
    bindPointer(groups[engine], engine);
    update(engine);
  }
  selectors.subscribe(detail => {
    update(detail.engine);
    window.dispatchEvent(new CustomEvent('b737-engine-start-detent-change', { detail }));
  });
  window.B737_ENGINE_START_TEST = selectors;
})();
