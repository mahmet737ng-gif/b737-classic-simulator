(() => {
  'use strict';
  // Photo coordinates reference the measured half-resolution source previews.
  // Each rectangle covers only the existing glass or the QTY TEST button cap.
  const registrations = {
    EIS: {
      size: [620, 640],
      sockets: [[95, 449, 40], [40, 552, 40], [140, 551, 40], [18, 468, 10]]
    },
    CONVENTIONAL: {
      size: [730, 536],
      sockets: [[89, 384, 33], [46, 461, 34], [129, 461, 34], [23, 391, 7]]
    }
  };
  const layer = document.createElement('div');
  layer.className = 'smiths-fuel-quantity';
  const faces = ['Center', 'Left', 'Right'].map((tank, index) => {
    const face = document.createElement('div');
    face.className = 'smiths-fuel-face';
    face.setAttribute('role', 'img');
    face.setAttribute('aria-label', tank + ' tank Smiths fuel quantity indicator');
    face.style.setProperty('--smiths-column', index * 50 + '%');
    return face;
  });
  const test = document.createElement('button');
  test.type = 'button';
  test.className = 'smiths-qty-test';
  test.setAttribute('aria-label', 'Fuel quantity test');
  test.title = 'QTY TEST';
  layer.append(...faces, test);
  let timer;
  function preview(mode) {
    clearTimeout(timer);
    layer.dataset.preview = mode;
  }
  function release() {
    if (layer.dataset.preview !== 'held') return;
    preview('segments');
    timer = setTimeout(() => preview('blank'), 2000);
  }
  test.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    test.setPointerCapture(event.pointerId);
    preview('held');
  });
  test.addEventListener('pointerup', release);
  test.addEventListener('lostpointercapture', release);
  test.addEventListener('pointercancel', () => preview('blank'));
  test.addEventListener('keydown', event => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) preview('held');
  });
  test.addEventListener('keyup', event => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    release();
  });
  test.addEventListener('blur', () => preview('blank'));
  function mount() {
    const native = document.querySelector('#region-main .region-native');
    const mode = document.documentElement.dataset.engineIndication === 'CONVENTIONAL' ? 'CONVENTIONAL' : 'EIS';
    const photo = native?.querySelector(mode === 'CONVENTIONAL'
      ? '.conventional-engine-photo-wrap-v1' : '.texture-piece[data-piece="engine"]');
    if (!photo) return;
    const { size: [width, height], sockets } = registrations[mode];
    Object.assign(layer.style, {
      left: photo.style.left, top: photo.style.top,
      width: photo.style.width, height: photo.style.height
    });
    [...faces, test].forEach((element, index) => {
      const [x, y, radius] = sockets[index];
      Object.assign(element.style, {
        left: (x - radius) / width * 100 + '%',
        top: (y - radius) / height * 100 + '%',
        width: 2 * radius / width * 100 + '%',
        height: 2 * radius / height * 100 + '%'
      });
    });
    if (layer.dataset.mode !== mode) preview('blank');
    layer.dataset.mode = mode;
    if (layer.parentElement !== native) native.append(layer);
  }
  window.addEventListener('b737:engine-indication-view', mount);
  window.addEventListener('b737:cockpit-mounted', mount);
  mount();
})();
