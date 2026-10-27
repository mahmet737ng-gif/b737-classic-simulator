'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const p=require('./guard-close-policy-v2.js');
const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'guard-owner18-v1.json'),'utf8'));
const expected={"flight-control-a":"ON","flight-control-b":"ON","spoiler-a":"ON","spoiler-b":"ON","alternate-flaps-master":"OFF","battery-master":"ON","generator-disconnect-1":"NORMAL","generator-disconnect-2":"NORMAL","standby-power":"AUTO","emergency-exit-lights":"ARMED","bus-transfer":"AUTO","passenger-oxygen":"NORMAL","flight-recorder-test":"NORMAL","antiskid":"ON","gpws-flap-inhibit":"NORMAL","gpws-gear-inhibit":"NORMAL","gpws-terrain-inhibit":"NORMAL","stab-trim":"NORMAL"};
const frozen={"flight-control-a":{"rectPx":[126,91,165,265],"hinge":"top"},"flight-control-b":{"rectPx":[296,91,165,265],"hinge":"top"},"spoiler-a":{"rectPx":[126,646,165,275],"hinge":"top"},"spoiler-b":{"rectPx":[295,646,165,275],"hinge":"top"},"alternate-flaps-master":{"rectPx":[517,408,135,277],"hinge":"bottom"},"generator-disconnect-1":{"rectPx":[154,334,200,418],"hinge":"top"},"generator-disconnect-2":{"rectPx":[847,334,200,418],"hinge":"top"},"bus-transfer":{"rectPx":[325,460,368,148],"hinge":"left"}};
assert.equal(p.validate(cfg.controls),true);
assert.equal(Object.keys(expected).length,18);
assert.equal(Object.keys(frozen).length,8);
const byId=Object.fromEntries(cfg.controls.map(x=>[x.id,x]));
for(const [id,g] of Object.entries(frozen)){
 assert.deepEqual(byId[id].rectPx,g.rectPx,id+' locked');
 assert.equal(byId[id].hinge,g.hinge,id+' hinge lock');
}
for(const c of cfg.controls){
 assert.equal(c.closePolicy.target,expected[c.id],c.id);
 let s=p.initialState(c,{index:0,closed:true});
 assert.equal(c.states[s.index],expected[c.id],c.id+' saved closed must normalize');
 assert.equal(s.closed,true);
 const other=c.states.find(v=>v!==expected[c.id]);
 assert.equal(p.transition(c,s,'set',other).accepted,false,c.id+' cover interlock');
 s=p.transition(c,s,'open').next;
 s=p.transition(c,s,'set',other).next;
 assert.equal(c.states[s.index],other,c.id+' changed when cover open');
 s=p.transition(c,s,'close').next;
 assert.equal(s.closed,true);
 assert.equal(c.states[s.index],expected[c.id],c.id+' guarded-return');
 assert.equal(p.initialState(c,s).index,s.index,c.id+' persistence');
 const reopen=p.transition(c,s,'cycle').next;
 assert.equal(reopen.closed,false);
 assert.equal(reopen.index,s.index);
}
for(const id of ['generator-disconnect-1','generator-disconnect-2','passenger-oxygen']){
 const c=byId[id];
 let s=p.transition(c,p.initialState(c,{}),'open').next;
 const run=p.transition(c,s,'set',c.irreversible.detent);
 assert.equal(run.triggeredEffect,c.irreversible.effect);
 s=p.transition(c,run.next,'close').next;
 assert.equal(c.states[s.index],expected[id]);
 assert.equal(s.effects[c.irreversible.effect],true,'irreversible effect preserved');
 assert.equal(p.initialState(c,s).effects[c.irreversible.effect],true,'persisted effect');
}
assert.equal(byId['battery-master'].rectPx[0]+byId['battery-master'].rectPx[2]/2,260);
assert.equal(byId['passenger-oxygen'].rectPx[0]+byId['passenger-oxygen'].rectPx[2]/2,1290);
console.log('PASS: 18 FCOM guarded detents, eight immutable geometries, close/open and irreversible latches');
