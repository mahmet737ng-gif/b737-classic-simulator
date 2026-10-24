(function() {
  'use strict';
  const api = window.B737AircraftProfileV1;
  if (!api) throw Error('Aircraft profile registry is not loaded');
  const byId = id => document.getElementById(id);
  const settings = byId('aircraftSettingsDialog');
  const pressureDialog = byId('selectedPressurizationDialog');
  const pressureFrame = byId('selectedPressureFrame');
  const form = byId('aircraftSettingsForm');
  let storage = null;
  try { storage = window.localStorage; } catch (_) { /* browser storage may be restricted */ }
  const store = api.createStore({storage, emitter: window});
  let activeSession = null;
  window.B737AircraftProfileStore = store;

  function render(detail) {
    const selected = detail.resolved;
    const family = selected.family.label;
    const pressure = selected.pressurization.id;
    const instruments = selected.engineInstruments.id === 'EIS' ? 'EIS' : 'CONVENTIONAL';
    byId('aircraftProfileHeader').textContent = family + ' · ' + pressure + ' · ' + instruments;
    byId('activeAircraftFamily').textContent = family;
    byId('activePressurization').textContent = pressure;
    byId('activeEngineInstruments').textContent = selected.engineInstruments.label;
    byId('openSelectedPressurizationPanel').textContent = 'باز کردن پنل ' + pressure + ' برای تست';
    try {
      if (!activeSession || activeSession.system !== pressure) {
        activeSession = api.createPressurizationSession(selected.profile, window);
        window.B737ActivePressurization = activeSession;
      }
      byId('activeProfileStatus').textContent = 'موتور ' + pressure + ' V' + activeSession.engineVersion + ' آمادهٔ تست مستقل است. تصویر فعلی ثابت می‌ماند.';
    } catch (error) {
      window.B737ActivePressurization = null;
      byId('activeProfileStatus').textContent = 'موتور انتخاب‌شده در دسترس نیست: ' + error.message;
    }
    if (pressureDialog.open) {
      byId('selectedPressureTitle').textContent = 'پنل ' + pressure + ' · سیستم فشار کابین';
      pressureFrame.src = '../../' + selected.pressurization.lab;
    }
  }

  store.subscribe(render);
  render({resolved: store.resolve()});

  function showSettings() {
    const profile = store.get();
    for (const field of api.FIELDS) {
      const control = form.querySelector('input[name="' + field + '"][value="' + profile[field] + '"]');
      if (control) control.checked = true;
    }
    byId('aircraftSettingsError').hidden = true;
    settings.showModal();
  }
  byId('aircraftSettingsOpen').addEventListener('click', showSettings);
  byId('aircraftSettingsClose').addEventListener('click', () => settings.close());
  byId('aircraftSettingsCancel').addEventListener('click', () => settings.close());
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(form);
    const changes = Object.fromEntries(api.FIELDS.map(field => [field, values.get(field)]));
    try {
      store.set(changes);
      settings.close();
    } catch (error) {
      const notice = byId('aircraftSettingsError');
      notice.hidden = false;
      notice.textContent = 'تنظیمات ذخیره نشد: ' + error.message;
    }
  });

  byId('openSelectedPressurizationPanel').addEventListener('click', () => {
    const selected = store.resolve().pressurization;
    byId('selectedPressureTitle').textContent = 'پنل ' + selected.id + ' · سیستم فشار کابین';
    pressureFrame.src = '../../' + selected.lab;
    pressureDialog.showModal();
  });
  function closePressure() {
    pressureDialog.close();
    pressureFrame.removeAttribute('src');
  }
  byId('selectedPressureClose').addEventListener('click', closePressure);
  pressureDialog.addEventListener('close', () => pressureFrame.removeAttribute('src'));
})();
