'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const qa=read('engine/maps/lht-first10-source-qa-status-v1.json');
const map=read('engine/maps/lht-ata-unified-bindings-v1.json');
test('LHT ten-section audit follows the actual source page boundaries and remains non-operational',()=>{
 assert.equal(qa.source_id,map.source_id);
 assert.equal(qa.source_sha256,map.source_sha256);
 assert.equal(qa.source_sections.length,10);
 assert.deepEqual(qa.source_sections,map.sections.slice(0,10).map(x=>x.section_id));
 assert.equal(qa.pages_checked,1187);
 assert.equal(qa.split_page_text_mismatches,0);
 assert.equal(map.sections[9].ata,'DOC');
 assert.equal(map.sections[9].pdf_pages.end,1187);
 assert.equal(qa.operationally_approved,false);
 assert.equal(qa.source_effectivity_unverified,true);
 assert.equal(qa.redzone_unchanged,true);
 assert.equal(map.policy.no_control_laws_created,true);
});
test('every QA observation is unique and requires no operational sign-off',()=>{
 assert.equal(qa.rule_count,40);
 assert.equal(qa.technical_checks.length,40);
 assert.equal(new Set(qa.technical_checks.map(x=>x.code)).size,40);
 const tally=qa.technical_checks.reduce((acc,c)=>(acc[c.status]=(acc[c.status]||0)+1,acc),{});
 assert.deepEqual(tally,qa.rule_status_counts);
 for(const c of qa.technical_checks){
  assert.ok(qa.source_sections.includes(c.section_id),c.code);
  assert.ok(['MATCH','PARTIAL','BLOCK','MISSING','CROSS_REFERENCE','NOT_APPLICABLE'].includes(c.status));
  assert.ok(c.pdf_pages.every(Number.isInteger),c.code);
 }
});
test('variant and control conflicts block automatic source-law activation',()=>{
 const blocked=new Set(qa.blockers.map(x=>x.code));
 for(const code of ['WTAI_TWO_CONFIGURATIONS','INCOMPLETE_ATA30_EXCERPT','POSITION_LIGHT_DETENTS','IRS_LATITUDE_CHECK','APU_APS2000_IDENTITY','OPTIONAL_COMPRESSOR','TAILSKID_400_ONLY'])assert.ok(blocked.has(code),code);
 assert.equal(qa.rule_status_counts.BLOCK,8);
 const bySection=new Map(qa.cross_ata_header_ranges.map(x=>[x.section_id,x]));
 assert.equal(bySection.get('section-02').header_ata,'22');
 assert.deepEqual(bySection.get('section-02').pages,[644,645,646,647,658,659,660,661,662,663,664,665,666,667,668,669]);
 assert.equal(bySection.get('section-09').header_ata,'31');
 assert.deepEqual(bySection.get('section-09').pages,[1113,1114]);
});