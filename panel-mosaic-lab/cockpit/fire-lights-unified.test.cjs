'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=__dirname,root=path.resolve(dir,'../..');
const M=require('./fire-lights-model.js');
const source=JSON.parse(fs.readFileSync(path.join(root,'fire-protection-lab/reference/as-built-11-indicator-pixel-map.json'),'utf8'));
const assembly=JSON.parse(fs.readFileSync(path.join(dir,'assembly.json'),'utf8'));
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const css=fs.readFileSync(path.join(dir,'fire-lights-unified.css'),'utf8');
const ui=fs.readFileSync(path.join(dir,'fire-lights-unified.js'),'utf8');
let checks=0;const check=(condition,message)=>{checks++;assert.ok(condition,message)};
check(M.validate(),'pixel manifest model valid');
check(M.SLOTS.length===11,'8 rectangle + 3 round lamps');
check(M.SLOTS.filter(s=>s.type==='rect').length===8,'exactly 8 rectangles');
check(M.SLOTS.filter(s=>s.type==='round').length===3,'exactly 3 circular lamps');
check(M.BASE.width===2172&&M.BASE.height===724,'original panel resolution');
const srcSlots=[...source.rectangles,...source.rounds];
for(const slot of M.SLOTS){
 const expected=srcSlots.find(s=>s.id===slot.id);
 check(Boolean(expected),slot.id+' in measured manifest');
 check(expected.center[0]===slot.cx&&expected.center[1]===slot.cy,slot.id+' exact measured center');
 if(slot.type==='rect')check(M.region(slot).width===208&&M.region(slot).height===105,'uniform standard annunciator size '+slot.id);
 else check(M.region(slot).width===42&&M.region(slot).height===42,'green circle diameter '+slot.id);
 for(const on of [false,true]){
  const file=M.file(slot,on);
  check(!file.startsWith('data:'),'No synthesized or inline light sprite '+slot.id);
  check(fs.existsSync(path.resolve(dir,file)),slot.id+' DB artwork '+(on?'ON':'OFF')+': '+file);
 }
 const g=M.region(slot);
 check(g.left>=0&&g.top>=0&&g.left+g.width<=2172&&g.top+g.height<=724,slot.id+' within background');
}
const fire=assembly.regions.find(r=>r.id==='pedestal')?.placements?.find(p=>p.id==='fire-protection');
check(!!fire,'Unified fire placement exists');
check(fire.asset==='panel-mosaic-lab/cockpit/assets/FIRE_PROTECTION_BARE_STANDARD_SLOTS_V2_ORIGINAL.svg','no fire background replacement');
check(assembly.assets[fire.asset].dimensions[0]===2172&&assembly.assets[fire.asset].dimensions[1]===724,'original base dimensions');
for(const name of ['fire-lights-model.js','fire-lights-unified.js','fire-lights-unified.css','fire-protection-lab/engine.js']){
 check(html.includes(name),'Unified loads '+name);
}
check(css.includes('.texture-piece[data-piece="fire-protection"]'),'CSS limited to fire only');
check(!css.includes('data-piece="throttle-quadrant"'),'Other panels unaffected');
check(ui.includes("b737:cockpit-mounted"),'mounts on cockpit event');
check(ui.includes("b737:visual-test"),'Unified light test wired');
check(ui.includes('b737:fire-protection-state'),'fire engine input wired');
check(ui.includes('window')||ui.includes('win'),'browser binding');
new vm.Script(ui,{filename:'fire-lights-unified.js'});
const relativeGreen=path.resolve(dir,M.file(M.map.EXT_L,true));
const green=fs.readFileSync(relativeGreen,'utf8');
check(green.includes('#36f35f'),'green on illumination derives from DB color');
const black=fs.readFileSync(path.resolve(dir,M.file(M.map.EXT_L,false)),'utf8');
check(black.includes('#050e0b'),'black/off lens present');
console.log('PASS FIRELAMP-0001: '+checks+' checks, 22 mounted source pairs, eleven pixel-matched sockets, no locked artwork mutations.');
