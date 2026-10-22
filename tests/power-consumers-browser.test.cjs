'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=require('../engine/network/integrated-aircraft-kernel.cjs');
const browserSource=fs.readFileSync(path.join(root,'power-consumers-lab/runtime.js'),'utf8');
const context=vm.createContext({globalThis:{}});
new vm.Script(browserSource,{filename:'power-consumers-lab/runtime.js'}).runInContext(context);
const browser=context.globalThis.B737PowerNetwork;
assert.equal(typeof browser.initialAircraftState,'function');
assert.equal(typeof browser.transitionAircraftState,'function');
const snap=x=>JSON.parse(JSON.stringify(x));
const actions=[
  {type:'SET_GENERATOR_AVAILABLE',generator:'GEN1',value:false},
  {type:'ACK_MASTER_CAUTION'},
  {type:'SET_GENERATOR_AVAILABLE',generator:'GEN1',value:true},
  {type:'SET_FUEL_PUMP_HEALTH',pump:'MAIN2_AFT',value:false},
  {type:'SET_FUEL_PUMP_HEALTH',pump:'MAIN2_FWD',value:false},
  {type:'SET_WARNING_RECALL',value:true},
  {type:'SET_BUS_TRANSFER',value:'OFF'},
  {type:'SET_HYD_ELECTRIC_SWITCH',system:'A',value:false},
  {type:'SET_ENGINE_RUNNING',system:'A',value:false}
];
const initialSource=source.initialAircraftState();
const initialBrowser=browser.initialAircraftState();
assert.deepEqual(snap(initialBrowser),snap(initialSource));
let a=initialSource,b=initialBrowser;
for(const action of actions){
  const stepA=source.transitionAircraftState(a,action);
  const stepB=browser.transitionAircraftState(b,action);
  assert.deepEqual(snap(stepB.view),snap(stepA.view),'browser deviated at '+action.type);
  assert.deepEqual(snap(stepB.event),snap(stepA.event),'event deviated at '+action.type);
  a=stepA.state;b=stepB.state;
}
assert.deepEqual(snap(browser.replayAircraftActions(initialBrowser,actions).view),
 snap(source.replayAircraftActions(initialSource,actions).view));
const html=fs.readFileSync(path.join(root,'power-consumers-lab/index.html'),'utf8');
assert.match(html,/<script src="\.\/runtime\.js"><\/script>/);
assert.match(html,/data-scenario="gen1"/);
assert.match(html,/data-scenario="gen2"/);
assert.match(html,/data-action="ack"/);
const inline=/\<script\>([\s\S]*?)\<\/script\>\s*\<\/body\>/m.exec(html);
assert.ok(inline,'interactive inline script missing');
new vm.Script(inline[1],{filename:'power-consumers-lab/index.html:inline'});
console.log('Browser bundle parity, scenario event replay and UI syntax checks PASS');
