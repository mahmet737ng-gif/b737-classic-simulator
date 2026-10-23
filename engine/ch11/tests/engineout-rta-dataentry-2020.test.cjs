'use strict';
const assert=require('node:assert/strict');
const data=require('../engineout-rta-dataentry-2020.rules.v1.json');
assert.equal(data.schema,'b737-classic-ch11-engineout-rta-entry-syntax/1.0');
assert.deepEqual(data.source.pages.map(x=>x.pdf),[1536,1537,1538,1539,1540]);
assert.deepEqual(data.source.pages.map(x=>x.folio),['11.31.47','11.31.48','11.31.49','11.31.50','11.31.51']);
assert.equal(data.source.pages[0].sha,'2cc8ad54ae1e88e84e35021452dcec5f7b4f2e77651c47e58c86926fde0a8970');
assert.equal(data.source.pages[4].sha,'c1ab7e9eb42efcba3cd863dd7584a776b110f9c2e7a9c44e0967a358e3553efa');
assert.equal(data.rules.length,56);
assert.equal(new Set(data.rules.map(x=>x.id)).size,data.rules.length);
assert.equal(data.rules.every(x=>x.processing==='REFERENCE_CONTRACT_NOT_ACTIVE_CODE'),true);
assert.equal(data.completeness.status,'SOURCE_EXTRACTED_NOT_RUNTIME_CONNECTED');
assert.equal(data.consumers.flight_control_authority,false);
assert.deepEqual(data.variants[1].branches,['ENG_OUT_SPD','TGT_SPD']);
for (const id of ['EO-002','EO-010','EO-014','EO-015','EO-021','EO-022','RTA-003','ALT-004','ALT-006','ALT-014','SPD-001','PAIR-002','PAIR-005','PAIR-006','BRG-003','SIGN-002']){
 assert.ok(data.rules.some(x=>x.id===id),'missing rule '+id);
}
const e=data.data_examples;
assert.deepEqual(e.altitude_3_digit_with_transition_alt_ft_10000.map(x=>[x.typed,x.shown]),[['008','800'],['015','1500'],['115','FL115'],['250','FL250']]);
assert.equal(e.altitude_5_digit_with_transition_alt_ft_4000.find(x=>x.typed==='09995').shown,'FL100');
assert.equal(e.bearing.find(x=>x.typed==='360').shown,'000');
assert.equal(e.rta_failure_scratchpad,'RTA UNACHIEVABLE');
assert.equal(data.quality.code_bezel_and_fonts_untouched,true);
console.log('PASS: '+data.rules.length+' FCOM requirements, 5 source pages, syntax examples, RTA and engine-out variant safeguards');
