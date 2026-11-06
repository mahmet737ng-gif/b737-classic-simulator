'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'../panel-mosaic-lab/cockpit');
const read=n=>fs.readFileSync(path.join(base,n),'utf8');
const html=read('index.html');
const header=html.match(/<header class="unified-minimal-header">([\s\S]*?)<\/header>/)?.[1];
assert.ok(header,'Main Unified top bar exists');
const ids=[...header.matchAll(/<button\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(ids,['inspectorToggle','aircraftSettingsOpen','cbPanelOpen','groundPowerHeader'],
 'Only Controls, Settings, CB PNL and Ground Power can be in header');
const controlStart=html.indexOf('<section id="unifiedControlCenter"'),controlEnd=html.indexOf('</section>',controlStart);
assert.ok(controlStart>0,'Controls drawer must exist');
const controlBlock=html.slice(controlStart,html.indexOf('<section class="aircraft-profile-summary"',controlStart));
for(const id of ['batteryControlsSlot','batteryMeterControlSlot','batteryRechargeControlSlot',
 'liveBatteryRecharge','visualLampTest','apuLabButtonV1','unifiedLabShortcuts'])
 assert.ok(controlBlock.includes('id="'+id+'"'),id+' must remain accessible inside Controls');
for(const id of ['liveBatteryRecharge','visualLampTest','apuLabButtonV1','engineLabButtonV2','airconLiveLabOpen','b737ExteriorLightsOpen'])
 assert.ok(!header.includes('id="'+id+'"'),id+' must not appear in header');
const modules=[
 ['battery-panel-live-v1.js',"document.getElementById('batteryMeterControlSlot')"],
 ['battery-recharge-header-v1.js',"document.getElementById('batteryRechargeControlSlot')"],
 ['engine-indication-live-v2.js',"$('unifiedLabShortcuts')"],
 ['exterior-lights-classic-v1.js',"document.getElementById('unifiedLabShortcuts')"],
 ['aircon-live-test-lab-v1.js',"document.getElementById('unifiedLabShortcuts')"]
];
for(const [name,anchor] of modules){
 const src=read(name);
 assert.ok(src.includes(anchor),name+' must mount inside Controls');
 new vm.Script(src,{filename:name});
}
const battery=read('battery-panel-live-v1.js');
assert.ok(battery.includes("readout.style.display=''"),
 'Battery voltage, charge and amperage remain visible even with AC generators online');
const recharge=read('battery-recharge-header-v1.js');
assert.ok(!recharge.includes("bar.querySelector('#cbPanelOpen')"),'Battery charge must not reattach to top bar');
const gpu=read('ground-power-header-v1.js');
assert.ok(gpu.includes("holder.querySelector('#cbPanelOpen')"),'Ground Power follows CB PNL');
assert.ok(!gpu.includes("holder.querySelector('#liveBatteryRecharge')"),
 'Ground Power must not move behind drawer battery button');
assert.ok(html.includes("battery-panel-live-v1.js?v=BAT-CONTROLS-0001"),'Battery meter cache bumped');
assert.ok(html.includes("battery-recharge-header-v1.js?v=BAT-CONTROLS-0001"),'Battery recharge cache bumped');
console.log('PASS: strict 4-button header; rechargeable live battery volt/amp meter and tests remain under Controls');
