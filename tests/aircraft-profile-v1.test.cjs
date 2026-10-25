'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../engine/config/aircraft-profile-v1.js');
const cpcs = require('../engine/systems/cpcs-v5.js');
const dcpcs = require('../engine/systems/dcpcs-v4.js');

const storage = new Map();
const fakeStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value)
};
const store = profile.createStore({storage: fakeStorage});
assert.deepEqual(store.get(), profile.DEFAULTS);
assert.equal(profile.validate(store.get()), true);
let updates = 0;
const unsubscribe = store.subscribe(() => updates++);

// Each of the two family options can use either pressurization and instrument
// type; nothing is hard-coded to EP-FSI or blocks a valid training combination.
for (const family of profile.CATALOG.aircraftFamily) {
  for (const pressure of profile.CATALOG.pressurization) {
    for (const instruments of profile.CATALOG.engineInstruments) {
      store.set({aircraftFamily: family.id, pressurization: pressure.id, engineInstruments: instruments.id});
      const resolved = store.resolve();
      assert.equal(resolved.family.id, family.id);
      assert.equal(resolved.pressurization.id, pressure.id);
      assert.equal(resolved.engineInstruments.id, instruments.id);
      assert.equal(profile.validate(resolved.profile), true);
    }
  }
}
assert.ok(updates >= 7, 'Profile change notifications should be emitted');
const persisted = store.get();
assert.deepEqual(profile.createStore({storage: fakeStorage}).get(), persisted, 'Reload must retain all selections');
unsubscribe();
const former = updates;
store.set(Object.fromEntries(profile.FIELDS.map(field => [field, profile.DEFAULTS[field]])));
assert.equal(updates, former, 'Unsubscribed listeners must not be notified');
for (const invalid of [
  {aircraftFamily: 'B737-700'},
  {pressurization: 'BOTH'},
  {engineInstruments: 'UNAVAILABLE'},
  {unknownField: 'INVALID'}
]) assert.throws(() => store.set(invalid));

const engines = {B737CPCSV5: cpcs, B737DCPCSV4: dcpcs};
for (const id of ['CPCS', 'DCPCS']) {
  const session = profile.createPressurizationSession({...profile.DEFAULTS, pressurization: id}, engines);
  assert.equal(session.system, id);
  assert.ok(session.read().operatingMode);
  assert.ok(session.dispatch({type: 'MODE', value: 'AUTO'}));
  assert.equal(session.reset().selectedMode, 'AUTO');
}
assert.throws(() => profile.createPressurizationSession(profile.DEFAULTS, {}), /not loaded/);

// DCPCS must select the immutable owner-supplied background. CPCS must not reuse it.
const dcpcsAsset = 'panel-mosaic-lab/assets/locked/2026-10-23/DCPCS_Background_Owner.png';
assert.equal(profile.resolve({...profile.DEFAULTS, pressurization: 'DCPCS'}).pressurization.backgroundAsset, dcpcsAsset);
assert.equal(profile.resolve({...profile.DEFAULTS, pressurization: 'CPCS'}).pressurization.backgroundAsset, undefined);
const approvedPanel = fs.readFileSync(path.join(__dirname, '..', dcpcsAsset));
assert.equal(approvedPanel.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'DCPCS source should be PNG');
const labHtml = fs.readFileSync(path.join(__dirname, '../dcpcs-lab/index.html'), 'utf8');
assert.ok(labHtml.includes('../' + dcpcsAsset), 'DCPCS lab must show approved image, not generated placeholder');
const settingsUi = fs.readFileSync(path.join(__dirname, '../panel-mosaic-lab/cockpit/aircraft-settings.js'), 'utf8');
assert.ok(settingsUi.includes('selected?.backgroundAsset'), 'Settings must use selected pressurization artwork');
assert.ok(settingsUi.includes('ownerPreview.hidden = !source'), 'CPCS must not show DCPCS image');

const html = fs.readFileSync(path.join(__dirname, '../panel-mosaic-lab/cockpit/index.html'), 'utf8');
for (const id of ['aircraftSettingsOpen','aircraftSettingsDialog','aircraftSettingsForm','activeAircraftFamily','activePressurization','activeEngineInstruments','openSelectedPressurizationPanel','selectedPressureFrame']) {
  assert.ok(html.includes('id="' + id + '"'), 'Unified settings element missing: ' + id);
}
for (const field of profile.FIELDS) for (const option of profile.CATALOG[field]) {
  assert.ok(html.includes('name="' + field + '" value="' + option.id + '"'), 'Missing selectable option: ' + option.id);
}
assert.ok(html.includes('aircraft-profile-v1.js'));
assert.ok(html.includes('aircraft-settings.js'));
assert.ok(!fs.readFileSync(path.join(__dirname, '../panel-mosaic-lab/all-overhead/final-lock.json'), 'utf8').includes('aircraft-settings'));
console.log('PASS: all 8 737 Classic configurations, persistence, source-specific CPCS/DCPCS engine selection and Unified Settings UI.');
