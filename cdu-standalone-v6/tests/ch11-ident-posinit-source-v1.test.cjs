'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pages=JSON.parse(read('cdu-standalone-v6/data/page-definitions.json')).pages;
const core=require('../engine/cdu-engine.js');
function started(page='POS_INIT'){const s=core.makeState(page);return s;}
function type(s,text){for(const c of text)core.press(s,pages,'CDU_CAPT_KEY_'+c);}
test('IDENT labels and navigation follow FCOM 11.40.8-9 without fake display values',()=>{
 const p=pages.IDENT;
 assert.deepEqual(p.rows.map(row=>row.map(c=>c.label)),[
  ['MODEL','ENG RATING'],['NAV DATA','ACTIVE'],['','INACTIVE'],['OP PROGRAM',''],['','SUPP DATA'],['<INDEX','POS INIT>']]);
 for(const row of p.rows)for(const c of row)assert.ok(!['TRAINER','DEMO ONLY','SIM','737-300','CFM56-3'].includes(c.value||''));
 assert.equal(p.source_ref.pdf_page_near,1560);
});
test('POS INIT FCOM 11.40.11-13 shows LAST POS only at 1R',()=>{
 const p=pages.POS_INIT;
 assert.equal(p.rows[0][0].label,'');assert.equal(p.rows[0][1].label,'LAST POS');
 assert.equal(p.rows[0][0].value??'', '');
 assert.equal(p.rows[0][1].value??'', '');
 assert.equal(p.rows[4][0].label,'GMT-MON/DY');
 assert.equal(p.rows[3][1].label,'SET IRS POS');
 assert.equal(p.rows[4][1].label,'SET IRS HDG');
});
test('REF AIRPORT entry is immediate and changing it invalidates prior GATE',()=>{
 const s=started();type(s,'OIII');core.press(s,pages,'CDU_CAPT_LSK_L2');
 assert.equal(s.active.REF_AIRPORT,'OIII');assert.equal(s.scratch,'');
 type(s,'A12');core.press(s,pages,'CDU_CAPT_LSK_L3');assert.equal(s.active.GATE,'A12');
 type(s,'OIMM');core.press(s,pages,'CDU_CAPT_LSK_L2');
 assert.equal(s.active.REF_AIRPORT,'OIMM');assert.equal(s.active.GATE,undefined);
});
test('Gate cannot be entered without an entered reference airport',()=>{
 const s=started();type(s,'A12');core.press(s,pages,'CDU_CAPT_LSK_L3');
 assert.equal(s.message,'ENTER REF AIRPORT');assert.equal(s.active.GATE,undefined);
});
test('Disconnected IRS position and ATT heading never pretend to write a live IRS',()=>{
 const s=started();type(s,'N35363E051234');core.press(s,pages,'CDU_CAPT_LSK_R4');
 assert.equal(s.message,'IRS NOT CONNECTED');assert.equal(s.active.IRS_POS,undefined);
 core.press(s,pages,'CDU_CAPT_KEY_CLR');
 core.press(s,pages,'CDU_CAPT_LSK_R5');assert.equal(s.message,'KEY INACTIVE');
 s.preflightEvidence.irs={R:{mode:'ATT',powered:true}};
 core.press(s,pages,'CDU_CAPT_LSK_R5');assert.equal(s.message,'IRS HDG NOT LINKED');
 assert.equal(s.active.IRS_HDG,undefined);
});
test('Locked original CDU image/hotspots remain; screen uses source-only rendering',()=>{
 const app=read('cdu-standalone-v6/app.js'),stage=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 assert.match(app,/preflight\.identValue/);
 assert.match(app,/preflight\.lastPosition/);
 assert.match(app,/valueLine\.querySelector\('\.fmc-left'\)\?\.classList\.add\('full'\)/);
 assert.match(stage,/cdu-preflight-evidence-v1\.js/);
 assert.match(stage,/assets\/cdu-approved-unlit\.png/);
 assert.match(stage,/id="clickmap"/);
});
test('Live page definitions are consistent with their canonical JSON specification',()=>{
 const js=read('cdu-standalone-v6/data/page-definitions.js');
 const v=JSON.parse(js.slice('window.CDU_PAGES='.length).replace(/;\s*$/,''));
 for(const page of ['IDENT','POS_INIT'])assert.deepEqual(v[page],pages[page]);
});

test('Both Unified CDU seats reload corrected source rules before app and real IRS adapter after it',()=>{
 const html=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 const a=html.indexOf('cdu-preflight-evidence-v1.js'),b=html.indexOf('app.js?v='),d=html.indexOf('cdu-irs-adapter-v1.js');
 assert.ok(a>=0&&a<b&&b<d);
 const seats=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json')).embeddedInstruments;
 assert.equal(seats.length,2);
 for(const seat of ['CAPT','FO']){
  const item=seats.find(x=>x.seat===seat);
  assert.ok(item);assert.ok(item.embeddedUrl.includes('FCOM-PREFLIGHT-0001-ENGINE-IDENT-0001-AIRAC-2611-0001'));
 }
});
test('RTE/LEGS position selection page count and 24-character entry limits remain intact',()=>{
 const s=started('POS_INIT');
 assert.match(core.render(s,pages)[0],/1\/3/);
 core.press(s,pages,'CDU_CAPT_NEXT_PAGE');
 assert.equal(s.page,'POS_REF');
 core.press(s,pages,'CDU_CAPT_NEXT_PAGE');
 assert.equal(s.page,'POS_SHIFT');
 const a=started('POS_INIT');
 type(a,'A'.repeat(24));core.press(a,pages,'CDU_CAPT_KEY_A');
 assert.equal(a.scratch.length,24);
});
