'use strict';
const assert=require('node:assert/strict'),{create,apply}=require('./cdu-session'),core=require('../../cdu-standalone-v6/engine/cdu-engine'),pages=require('../../cdu-standalone-v6/data/page-definitions.json').pages;
const hub=create(),a=core.makeState('RTE'),b=core.makeState('IDENT');
function attach(seat,state){let paints=0;const session=hub.attach(seat,{read:()=>state,write:data=>apply(state,data),refresh:()=>paints++});return {session,key(k){core.press(state,pages,'CDU_CAPT_'+k);session.publish();},paints:()=>paints};}
const capt=attach('CAPT',a),fo=attach('FO',b);
for(const c of 'OIII')capt.key('KEY_'+c);
assert.equal(b.scratch,'');assert.equal(core.readValue(b,'ORIGIN','RTE'),'');
fo.key('KEY_X');capt.key('LSK_L1');
assert.equal(core.readValue(b,'ORIGIN','RTE'),'OIII');assert.equal(b.page,'IDENT');assert.equal(b.scratch,'X');
fo.key('KEY_CLR');fo.key('RTE');for(const c of 'OIMM')fo.key('KEY_'+c);fo.key('LSK_R1');
assert.equal(core.readValue(a,'ORIGIN','RTE'),'OIII');assert.equal(core.readValue(a,'DEST','RTE'),'OIMM');
assert.equal(a.page,'RTE');assert.equal(core.lights(a).EXEC,false);assert.equal(core.lights(b).EXEC,false);
capt.key('LSK_L5');assert.equal(a.page,'ACTIVATE');assert.equal(b.page,'RTE');assert.equal(core.lights(a).EXEC,true);assert.equal(core.lights(b).EXEC,true);
fo.key('EXEC');assert.equal(a.page,'ACTIVATE','remote EXEC must not change captain page');assert.equal(b.page,'RTE');assert.equal(a.active.ORIGIN,'OIII');assert.equal(a.active.DEST,'OIMM');assert.equal(core.lights(a).EXEC,false);
// Bidirectional performance fields use the same shared maps.
capt.key('CRZ');a.pending.CRZ_ALT='FL350';capt.session.publish();assert.equal(core.readValue(b,'CRZ_ALT'),'FL350');fo.key('EXEC');assert.equal(a.active.CRZ_ALT,'FL350');
// Simultaneous input does not overwrite the peer's scratchpad or submitted fields.
capt.key('RTE');fo.key('RTE');for(const c of 'OIIE')capt.key('KEY_'+c);for(const c of 'OMDB')fo.key('KEY_'+c);capt.key('LSK_L1');fo.key('LSK_R1');assert.equal(core.readValue(a,'ORIGIN','RTE'),'OIIE');assert.equal(core.readValue(a,'DEST','RTE'),'OMDB');
fo.key('LSK_L5');capt.key('LEGS');fo.key('LSK_L5');assert.equal(a.page,'LEGS');assert.equal(core.readValue(a,'ORIGIN','RTE'),'OIII');assert.equal(core.readValue(a,'DEST','RTE'),'OIMM');assert.deepEqual(a.pending,{});assert.deepEqual(a.stagedRoute,{});
// DELETE and commit are shared; source object references are never aliased.
fo.key('KEY_DEL');fo.key('LSK_R1');assert.equal(core.readValue(a,'DEST','RTE'),'');fo.key('LSK_L5');capt.key('EXEC');assert.equal(core.readValue(b,'DEST','RTE'),'');assert.notEqual(a.active,b.active);
// Late/reloaded peer receives current FMC without importing the other display.
const reloaded=core.makeState('IDENT'),newFo=attach('FO',reloaded);assert.equal(reloaded.active.ORIGIN,'OIII');assert.equal(reloaded.page,'IDENT');assert.equal(reloaded.scratch,'');
fo.key('RTE');assert.equal(reloaded.page,'IDENT','old detached frame cannot publish');
// Local-only navigation and brightness cause no dataset revisions.
const revision=newFo.session.revision();newFo.key('DIM_BRT');newFo.key('PROG');assert.equal(newFo.session.revision(),revision);assert.equal(a.brightness,1);assert.equal(a.page,'LEGS');
// Optional staged/committed route payloads share data, but display cursors remain local.
a.stage5Pending={origin:'OIII',destination:'OIMM',legs:[]};a.stage5AwaitingExec=true;a.stage5Page=3;capt.session.publish();assert.deepEqual(reloaded.stage5Pending,a.stage5Pending);assert.equal(reloaded.stage5AwaitingExec,true);assert.equal(reloaded.stage5Page,undefined);delete a.stage5Pending;capt.session.publish();assert.equal(reloaded.stage5Pending,undefined);
// Explicit shared reset broadcasts removal of route/adaptor data while preserving peer UI.
reloaded.scratch='LOCAL';reloaded.message='LOCAL MSG';reloaded.brightness=.4;
Object.keys(a).forEach(k=>delete a[k]);Object.assign(a,core.makeState('IDENT'));capt.session.publish();assert.equal(reloaded.active.ORIGIN,'');assert.deepEqual(reloaded.pending,{});assert.equal(reloaded.stage5AwaitingExec,undefined);assert.equal(reloaded.page,'PROG');assert.equal(reloaded.scratch,'LOCAL');assert.equal(reloaded.message,'LOCAL MSG');assert.equal(reloaded.brightness,.4);
assert.throws(()=>hub.attach('INVALID',{}));assert.ok(capt.paints()>1&&newFo.paints()>1);
console.log('PASS: one shared FMC; OIII and destination propagate both ways; independent pages/scratchpads/brightness; ACTIVATE/EXEC/ERASE/DELETE; interleaved edits; late/reloaded CDU; route payload/removal; shared reset.');
