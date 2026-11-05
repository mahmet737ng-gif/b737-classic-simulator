/* B737-300/400/500 ATA28 fuel controller. Single tank ledger: ISN09-12 FuelNetwork.
 * Boeing FCOM 12.10, 12.20, SP.12; LAN ATA28-40/50/60, MRG IV.12.
 * Quantities/flow and valve travel are TRAINING approximations, not certified.
 * This module owns physical crossfeed-valve position, center-pump dry-stop and
 * 20-minute center scavenge; it never creates another fuel-tank state or power bus.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicFuelSystemV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='ATA28-FUEL-LIVE-0001',copy=x=>JSON.parse(JSON.stringify(x));
 const TANKS=Object.freeze(['main1','main2','center']);
 const CAPACITY_KG=Object.freeze({main1:4555,main2:4555,center:7029});
 const PUMPS=Object.freeze({
  'fuel.main1FwdPump':'main1','fuel.main1AftPump':'main1',
  'fuel.main2FwdPump':'main2','fuel.main2AftPump':'main2',
  'fuel.centerLeftPump':'center','fuel.centerRightPump':'center'
 });
 const LOW_LIGHTS=Object.freeze({
  'fuel.main1FwdPump':'fuel-1-fwd','fuel.main1AftPump':'fuel-1-aft',
  'fuel.main2FwdPump':'fuel-2-fwd','fuel.main2AftPump':'fuel-2-aft',
  'fuel.centerLeftPump':'fuel-center-l','fuel.centerRightPump':'fuel-center-r'
 });
 const TRAINING=Object.freeze({crossfeedTravelMs:820,centerDryStopMs:5000,
  scavengeWindowMs:20*60*1000,scavengeFlowKgHr:150});
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
 class Controller{
  constructor({fuel,training={}}={}){
   if(!fuel?.tanks||typeof fuel.setCrossfeed!=='function'||typeof fuel.setTank!=='function')
    throw Error('Existing ISN FuelNetwork ledger is required');
   this.fuel=fuel;this.config={...TRAINING,...training};
   this.crossfeed={command:'CLOSED',position:'CLOSED',remainingMs:0,failed:false};
   this.centerDryMs={fuel.centerLeftPump:0,fuel.centerRightPump:0};
   this.centerAutoStopped={fuel.centerLeftPump:false,fuel.centerRightPump:false};
   this.previousSwitches=Object.fromEntries(Object.keys(PUMPS).map(k=>[k,false]));
   this.scavenge={armed:false,remainingMs:0,transferredKg:0,flowKgHr:0};
   this.temperatureC=10;this.events=[];this.elapsedMs=0;
   this.fuel.setCrossfeed('CLOSED');
  }
  record(type,data={}){this.events.push({tMs:Math.round(this.elapsedMs),type,...data});if(this.events.length>60)this.events.shift();}
  setTemperature(c){if(!finite(c)||c< -56||c>56)throw Error('Fuel temperature outside instrument range');
   this.temperatureC=c;return this.get();}
  setCrossfeedFailure(failed){if(typeof failed!=='boolean')throw Error('Boolean crossfeed failure required');
   this.crossfeed.failed=failed;return this.get();}
  commandCrossfeed(command){
   if(!['CLOSED','OPEN'].includes(command))throw Error('Crossfeed selector must be CLOSED or OPEN');
   if(this.crossfeed.command!==command){this.crossfeed.command=command;this.record('CROSSFEED_COMMAND',{command});}
   return this.get();
  }
  // Existing Pack owns electrical sources, switch detents and pump failures.
  // This is a derived inlet-pressure mask; a dry tank cannot provide fuel when
  // the motor is electrically powered. UNKNOWN remains UNKNOWN.
  effectivePumps(raw={}){
   const out={...raw};
   for(const [id,tank]of Object.entries(PUMPS)){
    const p=raw[id]||{},sw=p.switchOn===true;
    const dry=this.fuel.tanks[tank]<=0||this.centerAutoStopped[id]===true;
    const operating=!sw||p.failed===true||dry?false:p.operating===true?true:p.operating===false?false:null;
    const lowPressure=tank==='center'?!sw?false:operating===null?null:!operating:
     !sw?true:operating===null?null:!operating;
    out[id]={...p,operating,lowPressure,inletAvailable:this.fuel.tanks[tank]>0,
     autoStopped:this.centerAutoStopped[id]===true,physicalFeedQuality:'TRAINING_SOURCE_GATED'};
   }
   return out;
  }
  advance(ms,rawPumps={}, {batteryPowered=false,onGround=true}={}){
   if(!finite(ms)||ms<0||ms>120000)throw Error('Invalid fuel system elapsed time');
   if(typeof batteryPowered!=='boolean'||typeof onGround!=='boolean')
    throw Error('Fuel controller needs Boolean battery/ground observation');
   this.elapsedMs+=ms;
   for(const [id,tank]of Object.entries(PUMPS)){
    const on=rawPumps[id]?.switchOn===true;
    if(tank==='center'){
     if(!on&&this.previousSwitches[id]){this.centerAutoStopped[id]=false;this.centerDryMs[id]=0;}
     if(on&&!this.previousSwitches[id])this.scavenge.armed=true;
     if(on){
      const dry=this.fuel.tanks.center<=0&&rawPumps[id]?.operating!==false;
      this.centerDryMs[id]=dry?this.centerDryMs[id]+ms:0;
      if(this.centerDryMs[id]>=this.config.centerDryStopMs&&!this.centerAutoStopped[id]){
       this.centerAutoStopped[id]=true;this.record('CENTER_PUMP_AUTO_STOP',{id});
      }
     }
    }
    this.previousSwitches[id]=on;
   }
   const centerOff=!rawPumps['fuel.centerLeftPump']?.switchOn&&!rawPumps['fuel.centerRightPump']?.switchOn;
   if(this.scavenge.armed&&centerOff){
    this.scavenge.remainingMs=this.config.scavengeWindowMs;this.scavenge.armed=false;
    this.record('SCAVENGE_WINDOW_OPEN');
   }
   if(!centerOff){this.scavenge.remainingMs=0;this.scavenge.flowKgHr=0;}
   if(this.scavenge.remainingMs>0&&centerOff){
    const windowMs=Math.min(this.scavenge.remainingMs,ms);
    this.scavenge.remainingMs=Math.max(0,this.scavenge.remainingMs-ms);
    const p=this.effectivePumps(rawPumps)['fuel.main1FwdPump'];
    const room=Math.max(0,CAPACITY_KG.main1-this.fuel.tanks.main1);
    const transferred=p?.operating===true?
      Math.min(room,this.fuel.tanks.center,this.config.scavengeFlowKgHr*windowMs/3600000):0;
    if(transferred>0){
     this.fuel.setTank('center',Math.max(0,this.fuel.tanks.center-transferred));
     this.fuel.setTank('main1',this.fuel.tanks.main1+transferred);
     this.scavenge.transferredKg+=transferred;
    }
    this.scavenge.flowKgHr=transferred>0?this.config.scavengeFlowKgHr:0;
    if(this.scavenge.remainingMs===0){this.scavenge.flowKgHr=0;this.record('SCAVENGE_WINDOW_CLOSED');}
   }else this.scavenge.flowKgHr=0;
   if(this.crossfeed.command!==this.crossfeed.position&&!this.crossfeed.failed&&batteryPowered){
    if(this.crossfeed.remainingMs<=0)this.crossfeed.remainingMs=this.config.crossfeedTravelMs;
    this.crossfeed.remainingMs=Math.max(0,this.crossfeed.remainingMs-ms);
    if(this.crossfeed.remainingMs===0){
     this.crossfeed.position=this.crossfeed.command;
     this.fuel.setCrossfeed(this.crossfeed.position);
     this.record('CROSSFEED_POSITION',{position:this.crossfeed.position});
    }
   }
   return this.get(rawPumps);
  }
  // Instructor/ground fuel servicing, not a physical cockpit refueling valve.
  service({tank,quantityKg,onGround=true}={}){
   if(!TANKS.includes(tank)||!finite(quantityKg)||quantityKg<0||quantityKg>CAPACITY_KG[tank])
    throw Error('Fuel servicing exceeds tank capacity');
   if(onGround!==true)throw Error('Fuel servicing only allowed on ground');
   this.fuel.setTank(tank,quantityKg);this.record('GROUND_FUEL_SERVICE',{tank,quantityKg});
   return this.get();
  }
  get(rawPumps={}){
   const pump=this.effectivePumps(rawPumps);
   const low=id=>pump[id].lowPressure;
   const main1=low('fuel.main1FwdPump')===true&&low('fuel.main1AftPump')===true;
   const main2=low('fuel.main2FwdPump')===true&&low('fuel.main2AftPump')===true;
   const center=['fuel.centerLeftPump','fuel.centerRightPump'].some(id=>low(id)===true);
   const master=main1||main2||center;
   const recall=master||['fuel.main1FwdPump','fuel.main1AftPump','fuel.main2FwdPump','fuel.main2AftPump'].some(id=>low(id)===true);
   const valves={crossfeed:{...this.crossfeed,
    lamp:this.crossfeed.command!==this.crossfeed.position||this.crossfeed.remainingMs>0?
     'BRIGHT_BLUE':this.crossfeed.position==='OPEN'?'DIM_BLUE':'OFF'}};
   const quantityKg={...this.fuel.tanks};
   return {schema:VERSION,source:'SAME_ISN09_12_FUEL_LEDGER',fuelTemperatureC:this.temperatureC,
    capacitiesKg:{...CAPACITY_KG},tanksKg:quantityKg,totalFuelKg:Object.values(quantityKg).reduce((a,b)=>a+b,0),
    pumps:Object.fromEntries(Object.keys(PUMPS).map(id=>[id,{tank:PUMPS[id],
     commandedOn:pump[id].switchOn===true,operating:pump[id].operating,
     lowPressure:pump[id].lowPressure,autoStopped:pump[id].autoStopped,
     powerEvidence:pump[id].powerEvidence??null}])),
    lamps:Object.fromEntries(Object.entries(LOW_LIGHTS).map(([id,light])=>[light,low(id)])),
    caution:{masterCaution:master,recall,warningAnnunciator:'FUEL',source:'FCOM_12_10_2_3'},
    valves,scavenge:{...this.scavenge,active:this.scavenge.remainingMs>0},
    limitations:['FUEL_PUMP_PRESSURE_AND_SCAVENGE_RATE_SIMULATED','NO_VERIFIED_AIRFRAME_WIRING',
     'CROSSFEED_TRAVEL_AND_CENTER_AUTO_STOP_TIMING_ARE_TRAINING_VALUES'],
    events:copy(this.events)};
  }
 }
 return Object.freeze({Controller,VERSION,CAPACITY_KG,PUMPS,LOW_LIGHTS,TRAINING});
});
