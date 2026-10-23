'use strict';
const assert=require('node:assert/strict');
const f=require('../vnav-takeoff-climb-2022.rules.v1.json');
assert.equal(f.schema,'b737-ch11-takeoff-climb-vnav-reference/1.0');
assert.equal(f.record_id,'B737-CLASSIC-CDU-CH11-TAKEOFF-CLIMB-VNAV-2022');
assert.equal(f.source.screenshot_sha256,'ff9dbc09c31294c3460c9319307616accad22bee78d55f232cda3f5fbb948992');
assert.equal(f.source.screenshot_pdf_viewer_page,1513);
assert.equal(f.source.explicit_text_footer_printed_folio,'11.31.25');
assert.equal(f.source.option_markers_preserved,false);
assert.equal(f.requirements.length,24);
assert.equal(new Set(f.requirements.map(x=>x.id)).size,f.requirements.length);
assert.equal(f.integration_contract.runtime_activation,'NOT_IN_THIS_COMMIT');
assert.ok(f.requirements.every(x=>x.status==='DESIGNED_NOT_IMPLEMENTED'));
assert.deepEqual(f.figure.numbered_milestones.map(x=>x.key),
['THRUST_REDUCTION','VNAV_ENGAGEMENT','VNAV_SPD','VNAV_PTH','TOP_OF_CLIMB']);
assert.deepEqual(f.figure.example_waypoint_constraints.map(x=>[x.waypoint,x.comparison,x.altitude_ft]),
[['ABC','>=',4000],['BCD','=',6000],['CDE','>=',18000]]);
assert.ok(f.figure.speed_annotations.includes('V2+15'));
assert.ok(f.figure.speed_annotations.includes('ECON CLB SPD'));
assert.ok(f.figure.speed_annotations.includes('ECON CRZ SPD'));
assert.equal(f.figure.map_symbol.symbol,'GREEN_OPEN_CIRCLE');
assert.ok(f.requirements.some(x=>x.id==='TC-010'&&x.outputs.includes('CDU_MESSAGE_UNABLE_NEXT_ALTITUDE')));
assert.ok(f.requirements.some(x=>x.id==='TC-009'&&x.option_scope==='ENG_OUT_SUPPRESSION_TEXT_VARIANT'));
assert.ok(f.requirements.some(x=>x.id==='TC-002'&&x.option_scope==='AUTOMATIC_AT_THRUST_REDUCTION_ALTITUDE_VARIANT'));
assert.equal(f.policy.preserve_boeing_cdu_large_and_small_fonts,true);
assert.equal(f.policy.do_not_enable_unverified_flight_guidance,true);
console.log('PASS Chapter 11: 24 Takeoff/Climb requirements, five markers, three constraints, variants and guardrails');
