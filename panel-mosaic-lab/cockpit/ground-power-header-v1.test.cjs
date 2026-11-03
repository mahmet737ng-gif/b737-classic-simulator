'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('index.html'),ui=read('ground-power-header-v1.js'),
 css=read('ground-power-header-v1.css'),battery=read('battery-recharge-header-v1.js');
const posBat=html.indexOf('id="liveBatteryRecharge"');
const posGPU=html.indexOf('id="groundPowerHeader"');
assert.ok(posBat>0&&posGPU>posBat&&posGPU-posBat<500,
 'New header control must follow the existing BAT RECHARGE button');
assert.ok(html.includes('ground-power-header-policy-v1.js?v=GPU-FCOM-0001'));
assert.ok(html.includes('ground-power-header-v1.js?v=GPU-FCOM-0001'));
assert.ok(html.includes('ground-power-header-v1.css?v=GPU-FCOM-0001'));
assert.ok(ui.includes("const ID='groundPowerHeader'"),'One header control owner');
assert.ok(ui.includes("lights.setScenario({groundPowerAttached:attached})"),
 'GPU cable scenario must be sent to the original overhead');
assert.ok(ui.includes("owner().instructor({type:'ELECTRICAL',action:command})"),
 'GRD PWR ON/OFF must write the actual ECU Electrical Pack');
assert.ok(ui.includes("if(command.source==='EXT'&&!(after.source[1]==='EXT'&&after.source[2]==='EXT'))"),
 'Do not report success after a source selection rejected by the bridge');
assert.ok(ui.includes("GRD POWER AVAILABLE"),'FCOM available status');
assert.ok(ui.includes("BATTERY"),'Battery switch source check');
assert.ok(ui.includes("GRD PWR ON"),'Momentary bus connect action');
assert.ok(ui.includes("GRD PWR OFF"),'Momentary bus disconnect action');
assert.ok(ui.includes("BUS OFF / TRANSFER BUS OFF and STANDBY PWR OFF"),
 'FCOM cross-check instructions visible');
assert.ok(css.includes('#groundPowerPopover[hidden]{display:none!important}'));
assert.ok(css.includes('#groundPowerHeader'), 'Header-specific styling');
assert.ok(!ui.includes('new B737ElectricalV7'), 'No parallel electrical backend');
assert.ok(!battery.includes('groundPowerHeader'), 'BAT RECHARGE unaffected');
new (require('node:vm').Script)(ui,{filename:'ground-power-header-v1.js'});
console.log('PASS: header GPU beside battery, FCOM cable and contactor separation, single ECU and real status checks.');
