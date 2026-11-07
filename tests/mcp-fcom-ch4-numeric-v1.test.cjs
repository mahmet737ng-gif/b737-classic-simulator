'use strict';
/* FCOM Ch4 / MCP seven-segment selector regression, 737 Classic 300/400/500.
 * FCOM 4.10.3-4: IAS 110 to Vmo by 1 KT, MACH .60 to Mmo by .01;
 * 4.10.7-8: ALT 0..50000 by 100, V/S -7900..+6000, 50/100 increments;
 * 4.10.13-15: independent COURSE and HDG selectors (angle convention).
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Rules=require('../engine/afds/mcp-fcom-ch4-numeric-v1.js');
const Core=require('../engine/afds/mcp-mode-core-v1.js');
const Electrical=require('../engine/systems/electrical-v7.js');
const repo=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(repo,p),'utf8');
assert.equal(Rules.SPECS.speed.min,110);
assert.equal(Rules.SPECS.speed.max,340);
assert.equal(Rules.SPECS.speed.step,1);
assert.equal(Rules.SPECS.machHundredths.min,60);
assert.equal(Rules.SPECS.machHundredths.max,82);
assert.equal(Rules.SPECS.machHundredths.step,1);
assert.equal(Rules.SPECS.altitude.max,50000);
assert.equal(Rules.SPECS.altitude.step,100);
assert.deepEqual([Rules.SPECS.verticalSpeed.min,Rules.SPECS.verticalSpeed.max],[-7900,6000]);
for(const [field,good,bad] of [['speed',110,109],['speed',340,341],
 ['machHundredths',60,59],['machHundredths',82,83],
 ['altitude',50000,50100],['altitude',0,-100],
 ['verticalSpeed',-7900,-7950],['verticalSpeed',6000,6050],
 ['verticalSpeed',950,975]]){
 assert.equal(Rules.valid(field,good),true,field+' accepted '+good);
 assert.equal(Rules.valid(field,bad),false,field+' rejected '+bad);
}
assert.equal(Rules.valid('verticalSpeed',1050),false);
assert.equal(Rules.step('verticalSpeed',0,1),50);
assert.equal(Rules.step('verticalSpeed',-50,1),0);
assert.equal(Rules.step('verticalSpeed',950,1),1000);
assert.equal(Rules.step('verticalSpeed',1000,1),1100);
assert.equal(Rules.step('verticalSpeed',1100,-1),1000);
assert.equal(Rules.step('verticalSpeed',1000,-1),950);
assert.equal(Rules.step('verticalSpeed',-1000,1),-950);
assert.equal(Rules.step('verticalSpeed',-1000,-1),-1100);
assert.equal(Rules.step('verticalSpeed',6000,1),6000);
assert.equal(Rules.step('verticalSpeed',-7900,-1),-7900);
assert.equal(Rules.step('altitude',49900,1),50000);
assert.equal(Rules.step('altitude',50000,1),50000);
assert.equal(Rules.step('speed',110,-1),110);
assert.equal(Rules.step('speed',340,1),340);
assert.equal(Rules.step('machHundredths',82,1),82);
assert.equal(Rules.step('heading',359,1),0);
assert.equal(Rules.step('courseR',0,-1),359);
assert.equal(Rules.format('speed',110),'110');
assert.equal(Rules.format('speed',82,{mode:'MACH'}),'.82');
assert.equal(Rules.format('altitude',0),'00000');
assert.equal(Rules.format('altitude',50000),'50000');
assert.equal(Rules.format('verticalSpeed',0),' 0000');
assert.equal(Rules.format('verticalSpeed',50),'+0050');
assert.equal(Rules.format('verticalSpeed',-7900),'-7900');
assert.equal(Rules.format('heading',5),'005');
assert.equal(Rules.format('verticalSpeed',0,{blank:true}),'');
const state=Core.initialState();
assert.equal(state.values.speed,110);
assert.equal(state.values.altitude,10000);
assert.equal(state.values.machHundredths,60);
assert.equal(Core.output(state).displayBlank.verticalSpeed,true);
let live=Electrical.evaluate(Electrical.initialState());
live={...live,bus:{...live.bus,electronic1:true,battery:true}};
let s=Core.transition(state,{type:'ELECTRICAL',snapshot:live});
assert.equal(Core.output(s).power,true);
s=Core.transition(s,{type:'SPEED_MODE',mode:'MACH'});
assert.equal(Core.output(s).speedDisplayMode,'MACH');
s=Core.transition(s,{type:'VALUE',id:'machHundredths',value:82});
assert.equal(s.values.machHundredths,82);
assert.throws(()=>Core.transition(s,{type:'VALUE',id:'machHundredths',value:83}),/FCOM/);
assert.throws(()=>Core.transition(s,{type:'VALUE',id:'speed',value:109}),/FCOM/);
assert.throws(()=>Core.transition(s,{type:'VALUE',id:'altitude',value:50050}),/FCOM/);
assert.throws(()=>Core.transition(s,{type:'VALUE',id:'verticalSpeed',value:1050}),/FCOM/);
s=Core.transition(s,{type:'FD',side:'left',on:true});
s=Core.transition(s,{type:'BUTTON',id:'VS'});
assert.equal(Core.output(s).displayBlank.verticalSpeed,false);
s=Core.transition(s,{type:'VALUE',id:'verticalSpeed',value:-7900});
assert.equal(s.values.verticalSpeed,-7900);
s=Core.transition(s,{type:'BUTTON',id:'VS'});
assert.equal(Core.output(s).displayBlank.verticalSpeed,true);
const cockpit=read('panel-mosaic-lab/cockpit/index.html');
const standalone=read('panel-mosaic-lab/mcp-panel/index.html');
for(const html of [cockpit,standalone]){
 const rules=html.indexOf('mcp-fcom-ch4-numeric-v1.js');
 const visual=html.indexOf('mcp-visual-v3.js');
 const hardware=html.indexOf('mcp-hardware-v1.js');
 const core=html.indexOf('mcp-mode-core-v1.js');
 assert.ok(rules>=0&&rules<visual&&visual<hardware&&hardware<core,
  'FCOM rules must initialize before visual/hardware/AFDS');
}
const digits=read('panel-mosaic-lab/cockpit/mcp-independent-digits-v1.js');
assert.match(digits,/slots:5/);
assert.match(digits,/23:/); // V/S narrow sign slot
assert.match(digits,/stringFor\(view\.d,values\)/);
assert.match(digits,/speedDisplayMode/);
const wheel=read('panel-mosaic-lab/cockpit/mcp-hardware-v1.js');
assert.match(wheel,/Rules\.step\("verticalSpeed"/);
assert.match(wheel,/-7900/);
assert.match(wheel,/6000/);
console.log('PASS MCP FCOM Ch4: IAS/Mach/altitude/VS limits, variable detents, C/O, blank V/S, fixed six display slots and load order');
