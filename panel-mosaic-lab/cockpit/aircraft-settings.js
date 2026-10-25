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

  // Render the owner background for the selected pressurization type only.
  // The image is a preview; no original panel source or cockpit geometry is modified.
  const pressureField = form.querySelector('input[name="pressurization"]')?.closest('fieldset');
  const ownerPreview = document.createElement('figure');
  ownerPreview.className = 'aircraft-pressure-owner-preview';
  ownerPreview.id = 'aircraftPressureOwnerPreview';
  const ownerImage = document.createElement('img');
  ownerImage.id = 'aircraftPressureOwnerImage';
  ownerImage.alt = 'Owner-approved DCPCS background';
  ownerImage.loading = 'lazy';
  const ownerCaption = document.createElement('figcaption');
  ownerCaption.textContent = 'DCPCS · تصویر تأییدشدهٔ مرجع (بدون تغییر)';
  ownerPreview.append(ownerImage, ownerCaption);
  pressureField?.append(ownerPreview);
  function showPressureArtwork(pressureId) {
    const selected = api.CATALOG.pressurization.find(item => item.id === pressureId);
    const source = selected?.backgroundAsset;
    ownerPreview.hidden = !source;
    if (source) {
      const uri = new URL('../../' + source, document.baseURI).href;
      if (ownerImage.src !== uri) ownerImage.src = uri;
    } else {
      ownerImage.removeAttribute('src');
    }
  }
  form.querySelectorAll('input[name="pressurization"]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) showPressureArtwork(input.value);
    });
  });

  function render(detail) {
    const selected = detail.resolved;
    const family = selected.family.label;
    const pressure = selected.pressurization.id;
    const instruments = selected.engineInstruments.id === 'EIS' ? 'EIS' : 'CONVENTIONAL';
    byId('aircraftProfileHeader').textContent = family + ' · ' + pressure + ' · ' + instruments;
    byId('activeAircraftFamily').textContent = family;
    byId('activePressurization').textContent = pressure;
    byId('activeEngineInstruments').textContent = selected.engineInstruments.label;
    // Apply the selected owner artwork to the embedded OH22 panel, not only this dialog.
    const overheadFrame = byId('overheadFrame');
    if(overheadFrame?.contentWindow) overheadFrame.contentWindow.postMessage({
      type:'b737:cockpit-command', action:'pressurization-background', system:pressure
    }, location.origin);
    byId('openSelectedPressurizationPanel').textContent = 'باز کردن پنل ' + pressure + ' برای تست';
    try {
      if (!activeSession || activeSession.system !== pressure) {
        activeSession = api.createPressurizationSession(selected.profile, window);
        window.B737ActivePressurization = activeSession;
      }
      byId('activeProfileStatus').textContent = 'موتور ' + pressure + ' V' + activeSession.engineVersion + ' آماده است.' + (selected.pressurization.backgroundAsset ? ' بک‌گراند تأییدشدهٔ DCPCS در پنل تست انتخاب شده نمایش داده می‌شود.' : ' پنل CPCS مستقل است.');
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
    showPressureArtwork(profile.pressurization);
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
