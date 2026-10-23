'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const v of ['v3','v5','v6']){
  const folder='cdu-standalone-'+v;
  const core=require(path.join(root,folder,'engine/cdu-engine.js'));
  assert.equal(core.makeState().page,'IDENT',folder+' boot');
  assert.equal(core.makeState('RTE').page,'RTE',folder+' manual override');
  assert.match(read(folder+'/app.js'),/const state=core\.makeState\('IDENT'\)/);
  assert.match(read(folder+'/app.js'),/const fresh=core\.makeState\('IDENT'\)/);
  assert.match(read(folder+'/index.html'),/<dd id="page-now">IDENT<\/dd>/);
}
const e=require(path.join(root,'engine/ch11/fmc-runtime-v2.js'));
const first=e.createState();
assert.equal(first.page,'IDENT');assert.equal(first.phase,'PREFLIGHT');
const index=e.dispatch(first,{type:'PAGE',page:'INDEX'}).state;
assert.equal(index.page,'INDEX');assert.equal(index.phase,'PREFLIGHT');
const back=e.dispatch(index,{type:'PAGE',page:'IDENT'}).state;
assert.equal(back.page,'IDENT');assert.equal(back.phase,'PREFLIGHT');
assert.match(read('cdu-standalone/app.js'),/mode:'standalone',page:'IDENT'/);
assert.match(read('cdu-standalone/app.js'),/sim\.page='IDENT';sim\.scratch/);
assert.match(read('engine/ch11/physical-cdu/app.js'),/else if\(page==='IDENT'\)/);
assert.match(read('engine/ch11/physical-cdu/app.js'),/if\(state\.page==='IDENT'&&id==='R6'\)return page\('POS_INIT'\)/);
console.log('PASS: initial/reset page IDENT, independent PREFLIGHT state, navigation contract.');
