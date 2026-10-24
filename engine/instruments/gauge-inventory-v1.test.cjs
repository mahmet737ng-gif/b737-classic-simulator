const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const inventory = require('./gauge-inventory-v1.json');
const existingOverlayAudit = require('./scale-audit-v1.json');
const overhead = require('../../panel-mosaic-lab/all-overhead/spec.json');
const assembly = require('../../panel-mosaic-lab/cockpit/assembly.json');

test('stage-1 review covers all 18 overhead and 8 Unified placement source panels', () => {
  const atlasKeys = overhead.images.map(image => image.id === 'UPPER' ? 'OH01-06' : image.id);
  const placementKeys = assembly.regions.flatMap(region => (region.placements || []).map(item => ({
    'captain': 'CAPTAIN',
    'mcp': 'MCP',
    'engine': 'ENGINE',
    'fo-inner': 'FO-INNER',
    'fo-outer': 'FO-OUTER',
    'throttle-quadrant': 'THROTTLE',
    'fire-protection': 'FIRE',
    'pedestal-radio': 'RADIO'
  })[item.id]));
  const actual = Object.keys(inventory.sourcePanels).sort();
  assert.deepEqual(actual, [...atlasKeys, ...placementKeys].sort());
  for (const file of Object.values(inventory.sourcePanels)) {
    assert.ok(fs.statSync(path.join(root, file)).isFile(), `missing ${file}`);
  }
  const categorized = new Set([
    ...inventory.faceGroups.map(group => group.panel),
    ...inventory.unresolvedCandidates.map(candidate => candidate.panel),
    ...inventory.reviewedPanelsWithoutIndicatingFaces
  ]);
  assert.deepEqual([...categorized].sort(), actual);
});

test('every face and unresolved candidate has a unique panel-qualified identity', () => {
  const faces = inventory.faceGroups.flatMap(group => group.ids);
  const candidates = inventory.unresolvedCandidates.map(item => item.id);
  const all = [...faces, ...candidates];
  assert.equal(faces.length, 53);
  assert.equal(candidates.length, 3);
  assert.equal(new Set(all).size, all.length);
  for (const group of inventory.faceGroups) {
    assert.ok(inventory.sourcePanels[group.panel]);
    assert.ok(group.scalesPerFace > 0);
    assert.ok(group.needlesPerFace === null || group.needlesPerFace > 0);
    assert.ok(Array.isArray(group.mountedNeedles));
  }
});

test('all 23 existing mounted overlays are reconciled without treating them as all gauges', () => {
  const registered = inventory.faceGroups.flatMap(group => group.mountedNeedles).sort();
  const previous = existingOverlayAudit.gauges.map(gauge => gauge.id).sort();
  assert.equal(registered.length, 23);
  assert.deepEqual(registered, previous);
  assert.equal(inventory.faceGroups.filter(group => group.region === 'overhead').reduce((n, group) => n + group.ids.length, 0), 15);
  assert.equal(inventory.faceGroups.filter(group => group.region === 'main').reduce((n, group) => n + group.ids.length, 0), 35);
  assert.equal(inventory.faceGroups.filter(group => group.region === 'pedestal').reduce((n, group) => n + group.ids.length, 0), 3);
});
