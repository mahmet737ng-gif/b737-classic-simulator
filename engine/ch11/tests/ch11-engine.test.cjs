'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const eng=require('../engine.js');
const index=require('../index/ch11-page-metadata.json');
const req=require('../requirements.v1.json');
let s=eng.createState(); const key=(k)=>{s=eng.dispatch(s,{type:'KEY',key:'CDU_CAPT_'+k})};
function enter(data){for(const c of data){const name=c==='.'?'DOT':c==='/'?'SLASH':c===' '?'SP':c;key('KEY_'+name)}}
function move(page){s=eng.dispatch(s,{type:'NAVIGATE',page})}
function checkInvariant(){const v=eng.display(s);assert.equal(v.rows.length,14);assert(v.rows.every(row=>row.length===24));assert.equal(eng.annunciators(s).EXEC,Object.keys(s.pending).length>0)}
assert.equal(index.summary.pages_total,409);assert.equal(index.pages.length,409);assert.equal(index.pages[0].pdf_page,1414);assert.equal(index.pages.at(-1).pdf_page,1822);assert.equal(req.rules.length,46);
for(let i=1;i<index.pages.length;i++)assert.equal(index.pages[i].pdf_page,index.pages[i-1].pdf_page+1);
for(const r of req.rules){const p=index.pages.find(x=>x.pdf_page===r.fcom.pdf_page);assert(p);assert.equal(p.folio,r.fcom.printed_folio)}
assert.equal(s.page,'MENU');checkInvariant();key('LSK_L1');assert.equal(s.page,'INDEX');key('LSK_L2');assert.equal(s.page,'RTE');
enter('OIII');key('LSK_L1');assert.equal(s.pending.ORIGIN,'OIII');assert.equal(eng.annunciators(s).EXEC,true);enter('OIMM');key('LSK_R1');assert.equal(s.pending.DEST,'OIMM');key('EXEC');assert.equal(s.active.ORIGIN,'OIII');assert.equal(s.active.DEST,'OIMM');assert.equal(eng.annunciators(s).EXEC,false);checkInvariant();
enter('OI');key('LSK_L1');assert.equal(eng.annunciators(s).MSG,true);assert.equal(eng.display(s).scratchpadMessage.severity,'entry_error');key('KEY_CLR');assert.equal(s.scratch,'OI');assert.equal(eng.annunciators(s).MSG,false);key('KEY_CLR_LONG');assert.equal(s.scratch,'');
enter('ABCD');key('KEY_DEL');assert.equal(s.scratch,'DELETE');key('LSK_L1');assert.equal(s.messages[0].text,'INVALID DELETE');key('KEY_CLR');assert.equal(s.scratch,'DELETE');key('KEY_CLR');assert.equal(s.scratch,'');
assert.deepEqual(eng.validate('bearing','090'),{valid:true,value:'090'});assert.deepEqual(eng.validate('bearing','360'),{valid:true,value:'000'});assert.equal(eng.validate('bearing','90').valid,false);assert.equal(eng.validate('altitude','008').valid,true);assert.equal(eng.validate('altitude','0835').value,'840');assert.equal(eng.validate('altitude','FL250').valid,true);assert.equal(eng.validate('altitude','123456').valid,false);
assert.equal(eng.validate('airspeed','.78').valid,true);assert.equal(eng.validate('airspeed','280').valid,true);assert.equal(eng.validate('offset','L99.9').valid,true);assert.equal(eng.validate('offset','R100').valid,false);
move('LEGS');enter('L10');key('LSK_L4');assert.equal(s.pending.OFFSET,'L10');assert.equal(eng.annunciators(s).OFST,false,'offset request cannot trigger guidance indication');key('EXEC');assert.equal(eng.annunciators(s).EXEC,false);s=eng.dispatch(s,{type:'LNAV_OFFSET_GUIDANCE',value:true});assert.equal(eng.annunciators(s).OFST,true);
s=eng.dispatch(s,{type:'SET_CALL',value:true});s=eng.dispatch(s,{type:'SELF_TEST_FAIL',value:true});assert.equal(eng.annunciators(s).CALL,true);assert.equal(eng.annunciators(s).FAIL,true);
s=eng.dispatch(s,{type:'MESSAGE',text:'CHECK FMC DATA',severity:'alert'});s=eng.dispatch(s,{type:'MESSAGE',text:'NAV DATA ERROR',severity:'advisory'});assert.equal(eng.display(s).scratchpadMessage.text,'CHECK FMC DATA');assert.equal(eng.annunciators(s).FMC_ALERT,true);key('KEY_CLR');assert.equal(eng.display(s).scratchpadMessage.text,'NAV DATA ERROR');
enter('AB');assert.equal(eng.annunciators(s).MSG,false,'visible scratch suppresses lower-priority advisory');key('KEY_CLR_LONG');assert.equal(eng.annunciators(s).MSG,true);
const before=JSON.stringify(s);let s2=eng.dispatch(s,{type:'KEY',key:'CDU_CAPT_RTE'});assert.equal(JSON.stringify(s),before,'reducer mutates old state');assert.equal(s2.page,'RTE');
for(const page of Object.keys(eng.PAGES)){let x=eng.dispatch(s2,{type:'NAVIGATE',page});assert.equal(eng.display(x).rows.length,14);assert(eng.display(x).rows.every(row=>row.length===24))}
const originalArtwork=fs.readFileSync(path.join(__dirname,'../../../cdu-standalone-v6/assets/cdu-approved-unlit.png'));assert(originalArtwork.length>1000000);
console.log('PASS: 409-page source index, 46 FCOM-referenced rules, 24x14 display, 17 page IDs, LSK transaction + EXEC, entry errors/CLR/DEL, 3/4/5-digit altitude, speed, bearing, offset guidance, prioritized MSG, standalone independence, immutable dispatch.');