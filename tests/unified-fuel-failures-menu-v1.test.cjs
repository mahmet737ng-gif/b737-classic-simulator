'use strict';
/* Fuel branch uses one real ATA28 model; no replacement fuel tank ledger. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const FuelBranch=require('../panel-mosaic-lab/cockpit/failures-fuel-v1.js');
const FuelSystem=require('../engine/systems/classic-fuel-system-v1.js');
const Runtime=require('../engine/integration/isn-09-12-runtime-v1.js');
const file=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');
const index=file('panel-mosaic-lab/cockpit/index.html');
const oldPanel=file('panel-mosaic-lab/cockpit/fuel-system-live-unified-v1.js');
assert.ok(index.includes('failures-fuel-v1.js?v=ATA28-FAILURES-FUEL-0002'));
assert.ok(index.includes('failures-header-v1.js?v=FAILURES-FUEL-0002'));
assert.match(oldPanel,/type:'SERVICE_TANK'/);
for(const type of ['TANK_LEAK','PUMP_FAILURE','CROSSFEED_FAILURE','FUEL_TEMPERATURE','FUEL_FREEZE_POINT'])
 assert.ok(!oldPanel.includes("type:'"+type+"'"),'Old inspector has no duplicate '+type+' injector');
assert.equal(Object.keys(FuelBranch.PUMPS).length,6);
assert.deepEqual(Object.keys(FuelBranch.TANKS),['main1','center','main2']);
assert.deepEqual(FuelBranch.action('pump','fuel.main1FwdPump',true),{
 type:'PUMP_FAILURE',id:'fuel.main1FwdPump',active:true
});
assert.throws(()=>FuelBranch.action('leak','main1',60001),/0–60000/);
assert.throws(()=>FuelBranch.action('pump','nonexistent',true),/Invalid fuel/);
assert.throws(()=>FuelBranch.action('temperature',null,70),/temperature/);

class Element{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};
  this.listeners={};this.style={};this.disabled=false;this.value='';this.textContent='';this.hidden=false;}
 append(...items){for(const x of items){this.children.push(x);x.parentElement=this;}}
 replaceChildren(...items){this.children=[];this.append(...items);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 click(){for(const fn of this.listeners.click||[])fn({target:this,preventDefault(){}});}
}
const nodes=new Map;
function existing(tag,id){const x=new Element(tag);x.id=id;nodes.set(id,x);return x;}
const root=existing('section','failuresHeaderPopover');root.hidden=false;
const branch=existing('details','failuresFuelBranch');branch.open=true;root.append(branch);
const mount=existing('div','failuresFuelMount');branch.append(mount);
const doc={readyState:'complete',activeElement:null,getElementById:id=>nodes.get(id)??null,
 createElement:tag=>new Element(tag)};
const descend=root=>root.children.flatMap(x=>[x,...descend(x)]);
const find=predicate=>descend(mount).find(predicate);
const fuelLedger=new Runtime.FuelNetwork({initialFuelKg:{main1:3500,center:1000,main2:3500}});
const controller=new FuelSystem.Controller({fuel:fuelLedger});
const raw=Object.fromEntries(Object.keys(FuelBranch.PUMPS).map(id=>[id,{
 switchOn:true,operating:true,failed:false,powerEvidence:'TEST_SENSOR'
}]));
let commands=[],headerRefreshCount=0,busWrites=0;
const owner={
 getFuelSystem(){return controller.get(raw);},
 fuelTrainerAction(c){
  assert.equal(c.instructor,true);
  commands.push({...c});
  switch(c.type){
   case 'PUMP_FAILURE':raw[c.id].failed=c.active;break;
   case 'CROSSFEED_FAILURE':controller.setCrossfeedFailure(c.active);break;
   case 'TANK_LEAK':controller.setTankLeak(c.tank,c.rateKgHr);break;
   case 'FUEL_TEMPERATURE':controller.setTemperature(c.celsius);break;
   case 'FUEL_FREEZE_POINT':controller.setFuelFreezePoint(c.celsius);break;
   default:throw Error('Unexpected type '+c.type);
  }
  return {accepted:true,system:this.getFuelSystem()};
 }
};
const listeners=new Map;
const win={document:doc,B737ISNCockpitV1:owner,
 B737UnifiedFailuresHeaderV1:{refresh(){headerRefreshCount++;return true;}},
 addEventListener(k,fn){if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(fn);}
};
const ui=FuelBranch.install(win);
assert.equal(ui?.installed,true,'FUEL branch installs inside the existing FAILURES panel');
assert.equal(ui.refresh(),0,'Initial tank and pump states have no faults');
assert.equal(ui.getCount(),0);
const pumpButtons=descend(mount).filter(x=>x.dataset.fuelPump);
assert.equal(pumpButtons.length,6);
pumpButtons[0].click();
assert.equal(commands.at(-1).type,'PUMP_FAILURE');
assert.equal(raw[pumpButtons[0].dataset.fuelPump].failed,true);
assert.equal(owner.getFuelSystem().pumps[pumpButtons[0].dataset.fuelPump].failed,true,
 'Pump failed state must be reported from the authoritative ATA28 ECU');
assert.equal(pumpButtons[0].getAttribute('aria-pressed'),'true');
assert.equal(ui.getCount(),1);
pumpButtons[1].click();assert.equal(ui.getCount(),2);
const cross=find(x=>x.dataset.fuelCrossfeed==='true');
assert.ok(cross);cross.click();
assert.equal(controller.get(raw).valves.crossfeed.failed,true);
assert.equal(ui.getCount(),3);
const leakInputs=descend(mount).filter(x=>x.type==='number'&&x.getAttribute('aria-label')?.includes('LEAK RATE'));
assert.equal(leakInputs.length,3);
leakInputs[0].value='18000';
leakInputs[0].parentElement.children.find(x=>x.textContent==='APPLY LEAK').click();
assert.equal(controller.get(raw).leaks.rateKgHr.main1,18000);
assert.equal(ui.getCount(),4);
leakInputs[1].value='3600';
leakInputs[1].parentElement.children.find(x=>x.textContent==='APPLY LEAK').click();
assert.equal(ui.getCount(),5);
const old=controller.get(raw).tanksKg.main1;
controller.advance(120000,raw,{batteryPowered:true});
assert.ok(controller.get(raw).tanksKg.main1<old,'Leak on ECU advances real tank quantity');
const hot=find(x=>x.textContent==='HOT +50°C');
assert.ok(hot);hot.click();
assert.equal(controller.indications().temperature.status,'ABOVE_MAX');
assert.equal(ui.getCount(),6);
const cold=find(x=>x.textContent==='COLD -50°C');cold.click();
assert.equal(controller.indications().temperature.status,'BELOW_MIN');
assert.equal(ui.getCount(),6);
const freezeInput=descend(mount).find(x=>x.getAttribute('aria-label')==='FREEZING POINT (°C)');
freezeInput.value='-40';
freezeInput.parentElement.children.find(x=>x.textContent==='SET POINT').click();
assert.equal(controller.get(raw).indications.temperature.freezePointC,-40);
const reset=find(x=>x.textContent==='CLEAR ALL FUEL FAILURES');
reset.click();
assert.equal(ui.getCount(),0);
assert.equal(controller.get(raw).fuelTemperatureC,10);
assert.equal(controller.get(raw).indications.temperature.freezePointC,-47);
assert.equal(controller.get(raw).valves.crossfeed.failed,false);
assert.ok(Object.values(controller.get(raw).leaks.rateKgHr).every(v=>v===0));
assert.ok(Object.values(controller.get(raw).pumps).every(p=>p.failed===false));
assert.equal(busWrites,0,'Fuel injection must never overwrite Electrical bus failures');
assert.ok(headerRefreshCount>3,'Header count updates after Fuel changes');
assert.equal(ui.refresh(),0);
console.log('PASS Unified FAILURES > FUEL: six live ECU pumps, crossfeed, leaks, hot/cold temperature, freeze point, single-source reset and Electrical isolation');
