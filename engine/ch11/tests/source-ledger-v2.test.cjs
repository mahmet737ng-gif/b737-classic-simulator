'use strict';
const assert = require('node:assert/strict');
const ledger = require('../source-page-ledger.v2.json');
const contract = require('../functional-contract.v2.json');
assert.equal(ledger.pages.length,409);
assert.equal(ledger.chapter_pdf_start,1414);
assert.equal(ledger.chapter_pdf_end,1822);
assert.equal(ledger.chapter_toc_pages,8);
assert.equal(ledger.semantic_review_claim,'NOT_COMPLETE');
assert.equal(ledger.source_text_read,'ALL_409_PAGES_TEXT_LOADED_AND_SCANNED');
const byPage = new Map(ledger.pages.map(x=>[x.pdf_page,x]));
assert.equal(byPage.size,409);
assert.equal(ledger.sections.length,12);
for(let page=1414;page<=1822;page++){
 const p=byPage.get(page);
 assert.ok(p,'missing physical PDF page '+page);
 assert.match(p.text_sha256,/^[a-f0-9]{64}$/);
 assert.match(p.fcom_folio,/^11\.(?:TOC|\d\d)\./);
 assert.equal(p.scan_status,'TEXT_SCAN_COMPLETE_SEMANTIC_REVIEW_PENDING');
}
assert.equal(ledger.sections.reduce((n,x)=>n+x.page_count,0),409);
assert.equal(contract.rule_catalog.length,34);
for(const rule of contract.rule_catalog){
 const entry=byPage.get(rule.source.pdf_page);
 assert.ok(entry,'no evidence page for '+rule.rule_id);
 assert.equal(entry.fcom_folio,rule.source.printed_folio,'folio mismatch: '+rule.rule_id);
 assert.notEqual(rule.verification,'AIRCRAFT_INSTALLED_SYSTEM_VERIFIED');
}
console.log('Chapter11 provenance: 409 page sources and 34 contracts verified (metadata only).');
