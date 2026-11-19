/* B737 Classic ATA26 / FCOM 8.10 and 8.20, standalone engineering trainer v3.
   References (Sepehran 737CL FCOM): 8.10.1–8.10.4, 8.20.1–8.20.8.
   Educational simulation; no actual-flight/navigation endorsement.
   Never updates immutable panel art or sends commands to unified runtime.
*/
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.B737FireProtection=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const UNITS=Object.freeze(['ENG1','ENG2','APU']), BOTTLES=Object.freeze(['L','R','APU']);
const clone=v=>JSON.parse(JSON.stringify(v));
function defaults(){return {
 selectors:{ENG1:'NORMAL',ENG2:'NORMAL'},test:null,extTest:null,
 heldSeconds:{ENG1:0,ENG2:0,APU:0},
 loops:{ENG1:{A:true,B:true},ENG2:{A:true,B:true}},
 sensing:{ENG1:{A:{fire:false,overheat:false},B:{fire:false,overheat:false}},ENG2:{A:{fire:false,overheat:false},B:{fire:false,overheat:false}}},
 apuDetector:true,engineFire:{ENG1:false,ENG2:false},engineOverheat:{ENG1:false,ENG2:false},apuFire:false,wheelWellFire:false,
 bottles:{L:false,R:false,APU:false},dischargedTo:{L:null,R:null,APU:null},pressureLow:{L:false,R:false,APU:false},pending:{L:null,R:null,APU:null},
 circuits:{L:true,R:true,APU:true},squibs:{L:{1:true,2:true},R:{1:true,2:true},APU:{1:true,2:true}},
 handles:{ENG1:{pulled:false,angle:0,override:false},ENG2:{pulled:false,angle:0,override:false},APU:{pulled:false,angle:0,override:false}},
 power:{batteryBus:true,hotBatteryBus:true,acTransfer1:true,onGround:true},ackFire:null,elapsed:0
};}
function selected(s,unit){const choice=s.selectors[unit],l=s.loops[unit];if(choice==='NORMAL')return ['A','B'].filter(k=>l[k]);return l[choice]?[choice]:[];}
function fault(s,unit){const choice=s.selectors[unit],l=s.loops[unit];return choice==='NORMAL'?(!l.A&&!l.B):!l[choice];}
function sensed(s,unit,kind){
 const paths=selected(s,unit);if(paths.length===0)return false;
 return paths.every(loop=>s.sensing[unit][loop][kind]||s.engineFire[unit]||(kind==='overheat'&&(s.engineOverheat[unit]||s.sensing[unit][loop].fire)));
}
// LAN ATA 26-20 figs 29/30. Two independent hot-battery feeds per
// engine bottle supply the two firing coils. Squib 1/2 selects the engine.
function feeds(bottle){
 const cb=globalThis.B737UnifiedCB;
 const primary=cb?.available('fire.extinguisher'+bottle)!==false;
 return bottle==='APU'?[primary]:[primary,cb?.available('fire.extinguisher'+bottle+'Alternate')!==false];
}
function dischargeStatus(s,unit,angle){
 const bottle=unit==='APU'?'APU':angle<0?'L':'R';
 if(!s.power.hotBatteryBus)return 'NO_HOT_BATTERY_POWER';
 if(s.bottles[bottle]||s.pending[bottle]!==null||s.pressureLow[bottle])return 'BOTTLE_UNAVAILABLE';
 const squib=unit==='ENG2'?2:1;
 if(!s.circuits[bottle]||!s.squibs[bottle][squib]||!feeds(bottle).some(Boolean))
  return 'EXTINGUISHER_CIRCUIT_FAILED';
 return null;
}
function evaluate(s){
 const cb=(name)=>globalThis.B737UnifiedCB?.available(name)!==false;
 const detector=unit=>cb(unit==='APU'?'apu.fireDetector':'engine'+(unit==='ENG1'?1:2)+'.fireDetector');
 const powered=s.power.batteryBus,testFire=s.test==='OVHT_FIRE'&&powered,testFault=s.test==='FAULT_INOP'&&powered;
 const testPath=unit=>testFire&&selected(s,unit).length>0;
 const anyFault=['ENG1','ENG2'].some(unit=>!detector(unit)||fault(s,unit));
 const activeFire={
 ENG1:powered&&detector('ENG1')&&(testPath('ENG1')||sensed(s,'ENG1','fire')),
 ENG2:powered&&detector('ENG2')&&(testPath('ENG2')||sensed(s,'ENG2','fire')),
 APU:powered&&detector('APU')&&s.apuDetector&&(testFire||s.apuFire)
 };
 const activeOverheat={
 ENG1:powered&&detector('ENG1')&&(testPath('ENG1')||sensed(s,'ENG1','overheat')),
 ENG2:powered&&detector('ENG2')&&(testPath('ENG2')||sensed(s,'ENG2','overheat'))
 };
 const wheel=Boolean(cb('fire.wheelWellDetector')&&s.power.acTransfer1&&(s.wheelWellFire||testFire));
 const warningIds=[...UNITS.filter(unit=>activeFire[unit]),...(wheel?['WHEEL_WELL']:[])];
 const signature=warningIds.join('|'),acknowledged=s.ackFire!==null&&warningIds.every(id=>s.ackFire.split('|').includes(id));
 const noDet=powered&&(!s.apuDetector||!detector('APU'));
 // An engine detector FAULT alone does not illuminate either master caution (FCOM 8.10.3-4).
 const caution=testFault||activeOverheat.ENG1||activeOverheat.ENG2||noDet;
 const flags={
 ENG1_OVERHEAT:activeOverheat.ENG1,ENG2_OVERHEAT:activeOverheat.ENG2,
 FAULT:powered&&(testFault||anyFault||(testFire&&['ENG1','ENG2'].some(u=>!s.loops[u].A||!s.loops[u].B))),
 APU_DET_INOP:powered&&(testFault||!s.apuDetector||!detector('APU')),
 WHEEL_WELL:wheel,L_BOTTLE_DISCHARGED:s.power.hotBatteryBus&&feeds('L').some(Boolean)&&(s.bottles.L||s.pressureLow.L),
 R_BOTTLE_DISCHARGED:s.power.hotBatteryBus&&feeds('R').some(Boolean)&&(s.bottles.R||s.pressureLow.R),
 APU_BOTTLE_DISCHARGED:s.power.hotBatteryBus&&feeds('APU').some(Boolean)&&(s.bottles.APU||s.pressureLow.APU),
 ENG1_FIRE:activeFire.ENG1,ENG2_FIRE:activeFire.ENG2,APU_FIRE:activeFire.APU,
 FIRE_BELL:cb('warning.aural')&&signature.length>0&&!acknowledged,
 MASTER_FIRE_WARN:signature.length>0&&!acknowledged,
 APU_GROUND_HORN:s.power.onGround&&activeFire.APU&&!acknowledged,
 APU_GROUND_LIGHT:s.power.onGround&&activeFire.APU&&!acknowledged,
 MASTER_CAUTION:caution,OVHT_DET:caution
 };
 const ext=s.extTest||s.test;
 const channel=ext==='EXT_1'?1:ext==='EXT_2'?2:0;
 for(const bottle of BOTTLES){const suffix=bottle==='L'?'L':bottle==='R'?'R':'APU';
  flags['EXT_'+suffix]=!!(channel&&feeds(bottle).every(Boolean)&&s.power.hotBatteryBus&&s.circuits[bottle]&&s.squibs[bottle][bottle==='APU'?1:channel]&&s.dischargedTo[bottle]!== (bottle==='APU'?'APU':'ENG'+channel));
 }
 const outputs={};
 for(const unit of ['ENG1','ENG2']){const pulled=s.handles[unit].pulled;outputs[unit]={
 fuelShutoff:pulled,hydraulicShutoff:pulled,bleedShutoff:pulled,generatorTrip:pulled,reverserInhibit:pulled,
 engineDrivenHydraulicLowPressureInhibit:pulled};}
 const apuPull=s.handles.APU.pulled;
 const realApuFire=powered&&detector('APU')&&s.apuDetector&&s.apuFire;
 outputs.APU={autoShutdown:realApuFire,fuelShutoff:apuPull||realApuFire,bleedShutoff:apuPull,
 inletDoorClose:apuPull,generatorTrip:apuPull};
 return {indications:flags,outputs,activeFire,activeOverheat,fireKeys:warningIds,fireSignature:signature,
 handleUnlock:{ENG1:activeFire.ENG1||activeOverheat.ENG1,ENG2:activeFire.ENG2||activeOverheat.ENG2,APU:activeFire.APU},
 detectorSelection:clone(s.selectors),dischargePending:clone(s.pending)};
}
function createEngine(initialPower){
 const initial=()=>{const state=defaults();Object.assign(state.power,initialPower);return state;};
 let state=initial(),last={accepted:true,reason:'INIT'};
 function dispatch(cmd){
 if(!cmd||typeof cmd!=='object')throw new TypeError('Command is required');
 const prior=state, n=clone(state),unit=cmd.unit, value=cmd.value;
 let result={accepted:true,reason:cmd.type};
 const known=()=>{if(!UNITS.includes(unit))throw new RangeError('Invalid unit '+unit);};
 const engine=()=>{if(!['ENG1','ENG2'].includes(unit))throw new RangeError('Invalid engine '+unit);};
 const bottleCheck=()=>{if(!BOTTLES.includes(cmd.bottle))throw new RangeError('Invalid bottle '+cmd.bottle);};
 switch(cmd.type){
 case 'RESET':Object.assign(n,initial());break;
 case 'SERVICE_BOTTLES':
   if(UNITS.some(id=>n.handles[id].pulled)||BOTTLES.some(id=>n.pending[id]!==null)){
    result={accepted:false,reason:'STOW_HANDLES_BEFORE_SERVICE'};break;
   }
   for(const bottle of BOTTLES){n.bottles[bottle]=false;n.dischargedTo[bottle]=null;}
   break;
 case 'SELECT_LOOP':
   if(!['NORMAL','A','B'].includes(value))throw new RangeError('Invalid selector detent');
   if(unit){engine();n.selectors[unit]=value;}else{n.selectors.ENG1=value;n.selectors.ENG2=value;}
   break;
 case 'EXT_TEST':
   if(![null,'EXT_1','EXT_2'].includes(value))throw new RangeError('Invalid extinguisher test');
   n.extTest=value;break;
 case 'TEST':if(![null,'EXT_1','EXT_2','FAULT_INOP','OVHT_FIRE'].includes(value))throw new RangeError('Invalid test');n.test=value;break;
 case 'SET_LOOP':engine();if(!['A','B'].includes(cmd.loop))throw new RangeError('Invalid loop');n.loops[unit][cmd.loop]=Boolean(cmd.healthy);break;
 case 'SET_SENSOR':
   engine();if(!['A','B'].includes(cmd.loop)||!['fire','overheat'].includes(cmd.kind))throw new RangeError('Invalid sensor');
   n.sensing[unit][cmd.loop][cmd.kind]=Boolean(cmd.active);break;
 case 'SET_APU_DETECTOR':n.apuDetector=Boolean(cmd.healthy);break;
 case 'SET_FIRE':known();if(unit==='APU')n.apuFire=Boolean(cmd.active);else n.engineFire[unit]=Boolean(cmd.active);break;
 case 'SET_OVERHEAT':engine();n.engineOverheat[unit]=Boolean(cmd.active);break;
 case 'SET_WHEEL_FIRE':n.wheelWellFire=Boolean(cmd.active);break;
 case 'SET_BOTTLE_LOW':bottleCheck();n.pressureLow[cmd.bottle]=Boolean(cmd.active);break;
 case 'SET_CIRCUIT':bottleCheck();
   if(cmd.channel!==undefined&&!['1','2',1,2].includes(cmd.channel))throw new RangeError('Invalid squib channel');
   if(cmd.channel!==undefined)n.squibs[cmd.bottle][cmd.bottle==='APU'?1:Number(cmd.channel)]=Boolean(cmd.healthy);
   else n.circuits[cmd.bottle]=Boolean(cmd.healthy);
   break;
 case 'SYNC_POWER':
   for(const bus of Object.keys(n.power)){
    if(typeof cmd.power?.[bus]!=='boolean')throw new TypeError('Missing '+bus);
    n.power[bus]=cmd.power[bus];
   }
   break;
 case 'SET_POWER':
   if(!Object.prototype.hasOwnProperty.call(n.power,cmd.bus))throw new RangeError('Invalid power bus');
   n.power[cmd.bus]=Boolean(cmd.active);break;
 case 'OVERRIDE':known();n.handles[unit].override=Boolean(cmd.enabled);break;
 case 'PULL':
   known();if(cmd.pulled===false){
     if(n.handles[unit].angle!==0){result={accepted:false,reason:'RETURN_ROTATION_TO_CENTER'};break;}
     n.handles[unit].pulled=false;break;}
   if(!(evaluate(n).handleUnlock[unit]||n.handles[unit].override)){result={accepted:false,reason:'HANDLE_LOCKED'};break;}
   n.handles[unit].pulled=true;break;
 case 'ROTATE':
   known();if(![-45,0,45].includes(cmd.angle))throw new RangeError('Invalid rotary detent');
   if(!n.handles[unit].pulled){result={accepted:false,reason:'PULL_FIRST'};break;}
   if(n.handles[unit].angle!==cmd.angle){n.heldSeconds[unit]=0;n.handles[unit].angle=cmd.angle;}
   if(cmd.angle){
    const failure=dischargeStatus(n,unit,cmd.angle);
    if(failure)result={accepted:false,reason:failure};
   }
   break;
 case 'TICK': {
   const dt=cmd.seconds;
   if(!Number.isFinite(dt)||dt<0||dt>30)throw new RangeError('Invalid tick');
   n.elapsed+=dt;
   for(const id of UNITS){
    const angle=n.handles[id].angle;
    if(!angle||!n.handles[id].pulled||dischargeStatus(n,id,angle)){n.heldSeconds[id]=0;continue;}
    const held=n.heldSeconds[id];
    n.heldSeconds[id]=held+dt;
    if(held<1&&held+dt>=1){
     const bottle=id==='APU'?'APU':angle<0?'L':'R';
     // One second at the stop, followed by the pressure-switch delay.
     n.dischargedTo[bottle]=id;
     n.pending[bottle]=1-held+1.5;
    }
   }
   for(const bottle of BOTTLES)if(n.pending[bottle]!==null){
    n.pending[bottle]-=dt;
    if(n.pending[bottle]<=0){
     n.pending[bottle]=null;n.bottles[bottle]=true;
     // A successful application clears the simulated compartment fire. Separately
     // injected heat and detector faults remain under the instructor's control.
     const target=n.dischargedTo[bottle];
     if(target==='APU')n.apuFire=false;
     else if(target)n.engineFire[target]=false;
    }
   }
   break;}
 case 'BELL_CUTOUT':n.ackFire=evaluate(n).fireSignature;break;
 default:throw new RangeError('Unknown fire protection command '+cmd.type);
 }
 if(!n.power.hotBatteryBus)for(const id of UNITS)n.heldSeconds[id]=0;
 if(result.accepted||(cmd.type==='ROTATE'&&n.handles[unit]?.pulled)){
   const was=evaluate(prior).fireKeys, now=evaluate(n).fireKeys;
   const newAlert=now.some(id=>!was.includes(id));
   if(newAlert)n.ackFire=null;
   if(!now.length)n.ackFire=null;
   state=n;
 }
 last=result;
 return {state:clone(state),derived:evaluate(state),result};
 }
 return Object.freeze({dispatch,getState:()=>clone(state),evaluate:()=>evaluate(state),lastEvent:()=>({...last})});
}
return Object.freeze({VERSION:'3.0.0',UNITS,BOTTLES,defaults,evaluate,createEngine});
});
