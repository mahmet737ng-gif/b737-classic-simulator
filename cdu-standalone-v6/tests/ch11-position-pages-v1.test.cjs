'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const core=require('../engine/cdu-engine.js');
const js=fs.readFileSync(path.join(__dirname,'../data/page-definitions.js'),'utf8');
const scope={window:{}};vm.runInNewContext(js,scope);
const pages=scope.window.CDU_PAGES;
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/page-definitions.json'),'utf8'));
test('37 CDU display definitions track the companion JSON',()=>{
 assert.equal(Object.keys(pages).length,source.page_count);
 assert.equal(Object.keys(pages).length,37);
 assert.equal(pages.POS_REF.source_ref.pdf_page_near,1565);
 assert.equal(pages.POS_SHIFT.source_ref.pdf_page_near,1721);
});
test('POS pages use FCOM 1/3 2/3 3/3 counters and reversible page keys',()=>{
 const s=core.makeState('POS_INIT');
 assert.match(core.render(s,pages)[0],/1\/3/);
 core.press(s,pages,'CDU_CAPT_NEXT_PAGE');assert.equal(s.page,'POS_REF');
 assert.match(core.render(s,pages)[0],/2\/3/);
 core.press(s,pages,'CDU_CAPT_NEXT_PAGE');assert.equal(s.page,'POS_SHIFT');
 assert.match(core.render(s,pages)[0],/3\/3/);
 core.press(s,pages,'CDU_CAPT_NEXT_PAGE');assert.equal(s.page,'POS_INIT');
 core.press(s,pages,'CDU_CAPT_PREV_PAGE');assert.equal(s.page,'POS_SHIFT');
});
test('non-pos source pages remain unchanged in 24x14 render contract',()=>{
 const st=core.makeState('IDENT');
 const grid=core.render(st,pages);
 assert.equal(grid.length,14);
 assert(grid.every(line=>String(line).length<=24));
 assert.equal(pages.IDENT.rows[3][0].label,'OP PROGRAM');
 assert.equal(pages.IDENT.rows[4][1].label,'SUPP DATA');
});
test('POS REF cannot create fake live GPS coordinates',()=>{
 for(const row of pages.POS_REF.rows){
  for(const cell of row){
   assert(!String(cell.value||'').includes('47°32.4'));
  }
 }
});
