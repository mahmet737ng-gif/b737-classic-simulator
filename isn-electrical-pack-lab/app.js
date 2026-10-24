(function() {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = window;
  const session = new root.B737ISNElectricalPackV1.Session({
    Electrical: root.B737ElectricalV7,
    Loads: root.B737ElectricalLoadsV8,
    TrainerCore: root.B737TrainerCore,
    WarningEngine: root.B737WarningEngine.WarningEngine
  });
  const PUMPS = root.B737ISNElectricalPackV1.PUMP_REGISTRY;
  const status = value => value === null ? 'UNKNOWN' : value ? 'ON' : 'OFF';
  const colored = value => '<span class="state ' + (value === null ? 'unknown' : value ? 'on' : 'off') + '">' + status(value) + '</span>';
  const escape = text => String(text).replace(/[&<>"']/g, chr => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[chr]));
  function command(value) { session.send(value); render(); }

  $('mode').onclick = () => command({type: 'MODE', value: session.get().mode === 'SOURCE_GATED' ? 'TRAINING_SURROGATE' : 'SOURCE_GATED', instructor: true});
  $('reset').onclick = () => { session.reset(); render(); };
  $('busTransfer').onchange = e => command({type: 'ELECTRICAL', action: {type: 'CONTROL', key: 'busTransferAuto', value: e.target.checked}});
  for (const [element, fault] of [['gen1Fault', 'GEN1_FAILED'], ['gen2Fault', 'GEN2_FAILED']]) {
    $(element).onchange = e => command({type: 'ELECTRICAL', action: {type: 'FAULT', id: fault, active: e.target.checked, instructor: true}});
  }
  $('fire1').onchange = e => command({type: 'WARNING_SENSOR', key: 'engine1Fire', value: e.target.checked});
  $('highCabin').onchange = e => command({type: 'WARNING_SENSOR', key: 'cabinAltitudeFt', value: e.target.checked ? 12000 : 0});
  $('cutoutCabin').onclick = () => command({type: 'CUTOUT_CABIN'});
  $('ackFire').onclick = () => command({type: 'ACK_FIRE'});

  const pumpBody = $('pumps');
  for (const pump of PUMPS) {
    const row = document.createElement('tr');
    row.dataset.pump = pump.id;
    row.innerHTML = '<td><strong>' + escape(pump.label) + '</strong><small>' + escape(pump.id) + '</small></td>' +
      '<td><input type="checkbox" data-action="switch" aria-label="' + escape(pump.label) + ' switch"></td>' +
      '<td><input type="checkbox" data-action="fault" aria-label="' + escape(pump.label) + ' instructor failure"></td>' +
      '<td><select data-action="observed" aria-label="Observed power ' + escape(pump.label) + '"><option value="unknown">UNKNOWN</option><option value="true">ON</option><option value="false">OFF</option></select></td>' +
      '<td data-out="operating">—</td><td data-out="lowPressure">—</td><td data-out="evidence">—</td>';
    pumpBody.append(row);
    row.querySelector('[data-action="switch"]').onchange = e => command({type: 'PUMP_SWITCH', id: pump.id, value: e.target.checked});
    row.querySelector('[data-action="fault"]').onchange = e => command({type: 'PUMP_FAULT', id: pump.id, value: e.target.checked, instructor: true});
    row.querySelector('[data-action="observed"]').onchange = e => command({type: 'OBSERVED_POWER', id: pump.id,
      value: e.target.value === 'unknown' ? null : e.target.value === 'true', instructor: true});
  }
  function render() {
    const state = session.get(), sur = state.mode === 'TRAINING_SURROGATE';
    $('mode').setAttribute('aria-pressed', String(sur));
    $('mode').textContent = sur ? 'بازگشت به Source-Gated' : 'فعال‌سازی نگاشت آموزشی Surrogate';
    $('modeBadge').textContent = state.mode;
    $('modeBadge').className = sur ? 'surrogate' : '';
    $('busTransfer').checked = session.electricalState.config.busTransferAuto;
    $('gen1Fault').checked = session.electricalState.faults.GEN1_FAILED;
    $('gen2Fault').checked = session.electricalState.faults.GEN2_FAILED;
    $('fire1').checked = state.sensors.engine1Fire;
    $('highCabin').checked = state.sensors.cabinAltitudeFt > 10000;
    $('buses').innerHTML = ['generator1','generator2','transfer1','transfer2','main1','main2','dc1','dc2']
      .map(bus => '<div><small>' + escape(bus.toUpperCase()) + '</small>' + colored(state.electrical.bus[bus]) + '</div>').join('');
    $('powerQa').textContent = state.electrical.qa.map(item => item.id).join(' · ') || 'Electrical V7 · منبع‌های AC و DC در مدل گسسته محاسبه شدند.';
    for (const p of PUMPS) {
      const row = pumpBody.querySelector('[data-pump="' + p.id + '"]');
      const item = state.pumps[p.id];
      row.querySelector('[data-action="switch"]').checked = item.switchOn;
      row.querySelector('[data-action="fault"]').checked = item.failed;
      row.querySelector('[data-action="observed"]').value = item.observedPower === null ? 'unknown' : String(item.observedPower);
      row.querySelector('[data-out="operating"]').innerHTML = colored(item.operating);
      row.querySelector('[data-out="lowPressure"]').innerHTML = colored(item.lowPressure);
      row.querySelector('[data-out="evidence"]').textContent = (item.sourceBus ? item.sourceBus + ' · ' : '') + item.powerEvidence;
    }
    const w = state.warnings;
    const summary = [
      ['FUEL ANNUNCIATOR · candidate', w.fuelSystemAnnunciatorCandidate],
      ['MASTER CAUTION FUEL · candidate', w.masterCautionFuelCandidate],
      ['MASTER CAUTION HYD · unverified', w.masterCautionHyd],
      ['FIRE BELL · WarningEngine', w.audio.active.some(a => a.id === 'fireBell')],
      ['CABIN HORN · WarningEngine', w.audio.active.some(a => a.id === 'intermittentHorn')]
    ];
    $('warningSummary').innerHTML = summary.map(([name,value]) => '<div><small>' + escape(name) + '</small>' + colored(value) + '</div>').join('');
    $('warningNote').textContent = 'Fuel caution یک خروجی آموزشی کاندید است؛ Hydraulic Master Caution و تغذیه دقیق پمپ‌ها تا دریافت مدرک معتبر UNKNOWN می‌مانند.';
    $('eventTrace').replaceChildren();
    for (const event of [...state.recentEvents].reverse().slice(0,25)) {
      const item = document.createElement('div'); item.className = 'event';
      const top = document.createElement('b');top.textContent = '#' + event.seq + ' · ' + event.command.type;
      item.append(top);
      if (!event.changes.length) { const none = document.createElement('small'); none.textContent = 'بدون تغییر خروجی'; item.append(none); }
      for (const change of event.changes) {
        const p = document.createElement('p');p.dir = 'ltr';
        p.textContent = change.path + ': ' + status(change.from) + ' → ' + status(change.to) + ' [' + change.evidence + ']';
        item.append(p);
      }
      $('eventTrace').append(item);
    }
    if (!state.recentEvents.length) $('eventTrace').textContent = 'هنوز رویدادی ثبت نشده است.';
  }
  root.B737ISNPack01Session = session;
  render();
})();
