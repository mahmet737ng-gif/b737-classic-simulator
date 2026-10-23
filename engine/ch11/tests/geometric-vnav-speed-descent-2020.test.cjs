'use strict';
const assert=require('node:assert/strict');
const c=require('../geometric-vnav-speed-descent-2020.rules.v1.json');
assert.equal(c.schema,'b737-classic-ch11-geometric-vnav-and-speed-descent/1.0');
assert.equal(c.source.screenshots.length,5);
assert.deepEqual(c.source.screenshots.map(x=>x.viewer_page),[1522,1523,1524,1525,1526]);
assert.deepEqual(c.source.screenshots.map(x=>x.folio),['11.31.33','11.31.34','11.31.35','11.31.36','11.31.37']);
assert.equal(c.source.screenshots[0].sha256,'b75c7ccf26545c3bc2157054bc94ea57080ab1ecd603d547fd15ddd5ebe7de0c');
assert.equal(c.source.screenshots[4].sha256,'c5fab666b264276924d1d7e9ec277005c799e9c215408453aa58dea9c840e6a8');
assert.equal(c.requirements.length,42);
assert.equal(new Set(c.requirements.map(x=>x.rule_id)).size,c.requirements.length);
assert.equal(c.requirements.every(x=>x.status==='SOURCE_EXTRACTED_RUNTIME_NOT_IMPLEMENTED'),true);
for(const page of c.source.screenshots){
assert.equal(c.qa.by_viewer_page[page.viewer_page],c.requirements.filter(x=>x.source.viewer_page===page.viewer_page).length);
}
assert.deepEqual(c.figure_model.numbered_steps.map(x=>x.num),[1,2,3,4,5,6,7]);
assert.equal(c.figure_model.toga_note.radio_altitude_trigger,'BELOW_2000_FT_RA');
for(const rule of ['GD-28-TOGA-MISSED-DISCONNECT','GD-29-VNAV-RESELECT-MISSED','GD-30-MISSED-LEVEL-VNAV-PTH','SD-01-MANUAL-SPEED-PROMPT','SD-02-NO-ED-ONLY-SPEED','SD-07-AUTO-START-TD','SD-08-LNAV-NOT-REQUIRED','SD-12-CONSTRAINT-EFFORT-NOT-GUARANTEE'])assert.ok(c.requirements.find(x=>x.rule_id===rule),rule);
assert.deepEqual(c.variants[1].choices,['NO_AUTOMATIC_REVERT','AUTO_PATH_REVERT_IN_VERTICAL_ANGLE_STAR_APPROACH_LEGS']);
assert.equal(c.data_interface.guidance_connected,false);
assert.equal(c.qa.locked_boeing_cdu_font_files_preserved,true);
console.log('PASS: '+c.requirements.length+' FCOM VNAV geometric/speed descent source contracts, five page anchors and 7-stage example');
