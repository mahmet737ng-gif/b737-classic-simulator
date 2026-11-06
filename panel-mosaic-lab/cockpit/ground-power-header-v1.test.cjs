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
assert.ok(html.includes('ground-power-header-v1.js?v=GPU-SPRING-0001'));
assert.ok(html.includes('ground-power-header-v1.css?v=GPU-SPRING-0001'));
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
assert.ok(ui.includes('id="gpuMomentarySwitch"'),'Single three-position header selector installed');
assert.ok(ui.includes('data-position="NEUTRAL"'),'Spring-loaded header selector starts centered');
assert.ok(ui.includes("momentary.dataset.position=position"),'Lever visual pose is explicit');
assert.ok(ui.includes("function releaseMomentary(){setMomentary('NEUTRAL');}"),
 'Releasing the GRD PWR lever always returns it to NEUTRAL');
for(const ev of ['pointerup','pointercancel','lostpointercapture','keyup','blur','visibilitychange'])
 assert.ok(ui.includes(ev),'Spring lever must be released on '+ev);
assert.ok(ui.includes("if(position==='ON'||position==='OFF')run(position)"),
 'Only ON/OFF detents dispatch electrical commands; neutral cannot unlatch buses');
assert.ok(css.includes('gpu-spring-switch[data-position="ON"]'));
assert.ok(css.includes('gpu-spring-switch[data-position="OFF"]'));
assert.ok(!ui.includes('data-gpu-action="ON"')&&!ui.includes('data-gpu-action="OFF"'),
 'Do not leave latching separate ON/OFF controls alongside the three-way switch');
assert.ok(!ui.includes('new B737ElectricalV7'), 'No parallel electrical backend');
assert.ok(!battery.includes('groundPowerHeader'), 'BAT RECHARGE unaffected');
new (require('node:vm').Script)(ui,{filename:'ground-power-header-v1.js'});
console.log('PASS: header GPU beside battery, FCOM cable and contactor separation, single ECU and real status checks.');
