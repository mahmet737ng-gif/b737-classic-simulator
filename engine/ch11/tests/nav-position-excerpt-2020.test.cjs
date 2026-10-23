'use strict';
const assert=require('node:assert/strict');
const dataset=require('../nav-position-excerpt-2020.rules.v1.json');
assert.equal(dataset.schema,'b737-classic-ch11-navigation-position-excerpt/1.0');
assert.equal(dataset.source.printed_revision_date,'2020-12-15');
assert.equal(dataset.source.source_sha256,'51070db4b1b479e906f9a2ac7a698e6165cca36137f869bbd88027725aadf294');
assert.equal(dataset.rules.length,34);
assert.equal(dataset.quality.markers_lost,true);
assert.equal(dataset.implementation_policy.no_runtime_code_activated_by_this_import,true);
assert.equal(dataset.implementation_policy.hardware_effectivity_required_before_activation,true);
const ids=new Set();
for(const rule of dataset.rules){
 assert.ok(!ids.has(rule.id),'duplicate rule '+rule.id);ids.add(rule.id);
 assert.ok(rule.source.printed_folio);
 assert.ok(rule.source.uploaded_text_lines.length===2);
 assert.ok(rule.source.uploaded_text_lines[0]>=1 && rule.source.uploaded_text_lines[1]<=199);
 assert.notEqual(rule.status,'AIRCRAFT_EFFECTIVITY_VERIFIED');
}
for(const id of ['GPS-UPDATE-REASONABLENESS','GROUND-IRS-ONLY','GROUND-GPS-FALLBACK-IRS','UPDATE-PRIORITY-ORDER','DME-AGILITY-TUNING','VOR-BEARING-25NM-LIMIT','POST-TAKEOFF-MAP-SHIFT','ANP-FROM-SENSOR-QUALITY'])assert.ok(ids.has(id),id);
console.log('PASS: FCOM 2020 nav-position excerpt provenance, '+ids.size+' paraphrased source rules and guarded effectivity');
