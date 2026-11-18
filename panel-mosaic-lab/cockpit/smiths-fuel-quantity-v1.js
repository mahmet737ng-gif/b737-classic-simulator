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
  const tanks = ['center', 'main1', 'main2'];
  const numeralSegments = ['012345','12','01346','01236','1256','02356','023456','012','0123456','012356'];
  // Coordinates in the source-derived atlas and in the 514 px glass crop.
  const segments = [{"arc":[[0,0,39,47,44,297],[39,0,36,42,36,260],[75,0,36,44,36,216],[111,0,43,48,40,174],[154,0,49,50,52,135],[203,0,48,52,73,101],[251,0,53,49,100,72],[304,0,51,50,135,51],[355,0,49,45,173,38],[404,0,43,40,216,32],[447,0,44,40,259,32],[491,0,49,45,297,38],[540,0,51,50,333,51],[591,0,52,49,366,72],[643,0,48,50,397,101],[691,0,45,49,421,136],[736,0,40,48,438,174],[776,0,35,43,447,216],[811,0,35,43,447,259],[846,0,40,46,436,297]],"digits":[[[886,0,35,17,137,214],[921,0,16,44,164,216],[937,0,16,43,162,261],[953,0,34,14,131,292],[987,0,15,45,120,261],[1002,0,17,47,122,214],[1019,0,36,16,133,252]],[[1055,0,35,17,206,214],[1090,0,16,44,234,216],[1106,0,16,43,232,261],[1122,0,34,13,200,293],[1156,0,16,45,189,261],[1172,0,17,47,191,214],[1189,0,36,14,202,254]],[[1225,0,39,12,264,228],[1264,0,14,39,297,228],[1278,0,14,35,295,267],[1292,0,28,11,270,293],[1320,0,14,37,260,267],[1334,0,15,39,262,228],[1349,0,30,13,271,260]],[[1379,0,40,13,322,228],[1419,0,14,39,355,228],[1433,0,14,35,353,267],[1447,0,28,11,329,293],[1475,0,14,37,319,267],[1489,0,16,39,320,228],[1505,0,30,13,330,260]],[[1535,0,29,13,393,228],[1564,0,14,39,416,228],[1578,0,13,35,414,267],[1591,0,28,11,388,293],[1619,0,14,37,378,267],[1633,0,15,39,380,228],[1648,0,29,13,390,260]],[[1677,0,17,6,382,344],[1694,0,5,14,395,344],[1699,0,5,13,395,358],[1704,0,12,5,385,367],[1716,0,6,14,382,358],[1722,0,6,14,382,344],[1728,0,16,7,382,354]]],"err":[1744,0,58,27,286,191]},{"arc":[[1840,0,39,47,41,296],[1879,0,36,42,33,259],[1915,0,36,44,33,215],[1951,0,43,48,37,173],[1994,0,49,50,49,134],[0,52,48,52,70,100],[48,52,53,49,97,71],[101,52,51,50,132,50],[152,52,49,45,170,37],[201,52,43,40,213,31],[244,52,44,40,256,31],[288,52,49,45,294,37],[337,52,51,50,330,50],[388,52,52,49,363,71],[440,52,48,50,394,100],[488,52,45,49,418,135],[533,52,40,48,435,173],[573,52,35,43,444,215],[608,52,35,43,444,258],[643,52,40,46,433,296]],"digits":[[[683,52,35,17,134,213],[718,52,16,44,161,215],[734,52,16,43,159,260],[750,52,34,14,128,291],[784,52,15,45,117,260],[799,52,17,47,119,213],[816,52,36,16,130,251]],[[852,52,35,17,203,213],[887,52,16,44,231,215],[903,52,16,43,229,260],[919,52,34,13,197,292],[953,52,16,45,186,260],[969,52,17,47,188,213],[986,52,36,14,199,253]],[[1022,52,39,12,261,227],[1061,52,14,39,294,227],[1075,52,14,35,292,266],[1089,52,28,11,267,292],[1117,52,14,37,257,266],[1131,52,15,39,259,227],[1146,52,30,13,268,259]],[[1176,52,40,13,319,227],[1216,52,14,39,352,227],[1230,52,14,35,350,266],[1244,52,28,11,326,292],[1272,52,14,37,316,266],[1286,52,16,39,317,227],[1302,52,30,13,327,259]],[[1332,52,29,13,390,227],[1361,52,14,39,413,227],[1375,52,13,35,411,266],[1388,52,28,11,385,292],[1416,52,14,37,375,266],[1430,52,15,39,377,227],[1445,52,29,13,387,259]],[[1474,52,17,6,379,343],[1491,52,5,14,392,343],[1496,52,5,13,392,357],[1501,52,12,5,382,366],[1513,52,6,14,379,357],[1519,52,6,14,379,343],[1525,52,16,7,379,353]]],"err":[1541,52,58,27,283,190]},{"arc":[[1637,52,39,47,44,298],[1676,52,36,42,36,261],[1712,52,36,44,36,217],[1748,52,43,48,40,175],[1791,52,49,50,52,136],[1840,52,48,52,73,102],[1888,52,53,49,100,73],[1941,52,51,50,135,52],[1992,52,49,45,173,39],[0,104,43,40,216,33],[43,104,44,40,259,33],[87,104,49,45,297,39],[136,104,51,50,333,52],[187,104,52,49,366,73],[239,104,48,50,397,102],[287,104,45,49,421,137],[332,104,40,48,438,175],[372,104,35,43,447,217],[407,104,35,43,447,260],[442,104,40,46,436,298]],"digits":[[[482,104,35,17,137,215],[517,104,16,44,164,217],[533,104,16,43,162,262],[549,104,34,14,131,293],[583,104,15,45,120,262],[598,104,17,47,122,215],[615,104,36,16,133,253]],[[651,104,35,17,206,215],[686,104,16,44,234,217],[702,104,16,43,232,262],[718,104,34,13,200,294],[752,104,16,45,189,262],[768,104,17,47,191,215],[785,104,36,14,202,255]],[[821,104,39,12,264,229],[860,104,14,39,297,229],[874,104,14,35,295,268],[888,104,28,11,270,294],[916,104,14,37,260,268],[930,104,15,39,262,229],[945,104,30,13,271,261]],[[975,104,40,13,322,229],[1015,104,14,39,355,229],[1029,104,14,35,353,268],[1043,104,28,11,329,294],[1071,104,14,37,319,268],[1085,104,16,39,320,229],[1101,104,30,13,330,261]],[[1131,104,29,13,393,229],[1160,104,14,39,416,229],[1174,104,13,35,414,268],[1187,104,28,11,388,294],[1215,104,14,37,378,268],[1229,104,15,39,380,229],[1244,104,29,13,390,261]],[[1273,104,17,6,382,345],[1290,104,5,14,395,345],[1295,104,5,13,395,359],[1300,104,12,5,385,368],[1312,104,6,14,382,359],[1318,104,6,14,382,345],[1324,104,16,7,382,355]]],"err":[1340,104,58,27,286,192]}];
  const atlas = new Image();
  atlas.src = new URL('./assets/smiths-fuel-segments-v2.webp', document.currentScript.src).href;
  const layer = document.createElement('div');
  layer.className = 'smiths-fuel-quantity';
  const faces = ['Center', 'Left', 'Right'].map((tank, index) => {
    const face = document.createElement('canvas');
    face.width = face.height = 514;
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
  let reading;
  let lastRefresh = -Infinity;
  const painted = [];
  const circuitAvailable = name => window.B737UnifiedCB?.available(name) !== false;
  function render() {
    const mode = layer.dataset.preview || 'live';
    const commonPower = reading?.standbyAc === true && circuitAvailable('fuel.quantityCommon');
    faces.forEach((face, index) => {
      const powered = commonPower && circuitAvailable('fuel.quantity.' + tanks[index]);
      const capacity = reading?.capacitiesKg[tanks[index]];
      const raw = mode === 'full' ? capacity : reading?.tanksKg[tanks[index]];
      const on = powered && atlas.complete && atlas.naturalWidth > 0 && Number.isFinite(raw) && mode !== 'blank';
      const quantity = mode === 'held' ? 0 : Math.round(raw);
      const ring = mode === 'held' ? 0 : Math.max(0, Math.min(20, Math.floor(raw / capacity * 20)));
      const key = on ? [mode, quantity, ring].join(':') : 'off';
      if (key === painted[index]) return;
      painted[index] = key;
      const ctx = face.getContext('2d');
      ctx.clearRect(0, 0, 514, 514);
      if (!on) return;
      const sprite = segments[index];
      const copy = ([sx, sy, w, h, x, y]) => ctx.drawImage(atlas, sx, sy, w, h, x, y, w, h);
      function digit(index, value) {
        for (const segment of numeralSegments[value]) copy(sprite.digits[index][segment]);
      }
      const testAll = mode === 'segments';
      sprite.arc.slice(0, testAll ? 20 : ring).forEach(copy);
      const value = testAll ? '88888' : String(quantity);
      [...value].forEach((digitValue, index) => digit(5 - value.length + index, Number(digitValue)));
      if (testAll || mode === 'held') {
        copy(sprite.err);
        digit(5, testAll ? 8 : 4);
      }
      ctx.fillStyle = '#c5c6c9';
      ctx.font = 'bold 31px sans-serif';
      ctx.fillText('KG', 330, 337);
    });
  }
  function refresh(force = false) {
    const now = performance.now();
    if (!force && now - lastRefresh < 250) return;
    lastRefresh = now;
    reading = window.B737ISNCockpitV1?.getFuelQuantityIndications?.();
    if (reading?.standbyAc !== true || !circuitAvailable('fuel.quantityCommon')) preview('live');
    else render();
  }
  function preview(mode) {
    clearTimeout(timer);
    layer.dataset.preview = mode;
    render();
  }
  function hold() {
    if (reading?.standbyAc === true && circuitAvailable('fuel.quantityCommon')) preview('held');
  }
  function release() {
    if (layer.dataset.preview !== 'held') return;
    const phases = ['segments', 'blank', 'full', 'live'];
    function next() {
      const phase = phases.shift();
      preview(phase);
      if (phases.length) timer = setTimeout(next, 2000);
    }
    next();
  }
  test.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    test.setPointerCapture(event.pointerId);
    hold();
  });
  test.addEventListener('pointerup', release);
  test.addEventListener('lostpointercapture', release);
  test.addEventListener('pointercancel', () => preview('live'));
  test.addEventListener('keydown', event => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) hold();
  });
  test.addEventListener('keyup', event => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    release();
  });
  test.addEventListener('blur', () => preview('live'));
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
    if (layer.dataset.mode !== mode) preview('live');
    layer.dataset.mode = mode;
    if (layer.parentElement !== native) native.append(layer);
  }
  window.addEventListener('b737:engine-indication-view', mount);
  window.addEventListener('b737:cockpit-mounted', mount);
  window.addEventListener('b737:unified-ecu-observation', () => refresh());
  window.addEventListener('b737:cb-state-change', () => refresh(true));
  atlas.addEventListener('load', render);
  mount();
  refresh(true);
})();
