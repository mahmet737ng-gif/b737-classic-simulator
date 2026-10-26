/* B737 Classic Fire Protection — isolated simulation/training model.
 * FCOM Sepehran 737 Classic Chapter 8, printed 8.10.1–8.10.4.
 * No connection to the locked overhead or live aircraft system bus.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.B737FireProtection=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const UNITS=['ENG1','ENG2','APU'];
const BOTTLES=['L','R','APU'];
function defaults(){return {
 selector:'NORMAL',test:null,
 loops:{ENG1:{A:true,B:true},ENG2:{A:true,B:true}},
 apuDetector:true,engineFire:{ENG1:false,ENG2:false},
 engineOverheat:{ENG1:false,ENG2:false},apuFire:false,wheelWellFire:false,
 bottles:{L:false,R:false,APU:false},circuits:{L:true,R:true,APU:true},
 handles:{ENG1:{pulled:false,angle:0,override:false},ENG2:{pulled:false,angle:0,override:false},APU:{pulled:false,angle:0,override:false}},
 ackFire:null
};}
const clone=x=>JSON.parse(JSON.stringify(x));
function detectOK(s,unit){let l=s.loops[unit];return s.selector==='NORMAL'?(l.A||l.B):Boolean(l[s.selector]);}
function fault(s,unit){let l=s.loops[unit];return s.selector==='NORMAL'?(!l.A&&!l.B):!l[s.selector];}
function evaluate(s){
 const testFire=s.test==='OVHT_FIRE',testFault=s.test==='FAULT_INOP';
 const activeFire={ENG1:(s.engineFire.ENG1&&detectOK(s,'ENG1'))||testFire,ENG2:(s.engineFire.ENG2&&detectOK(s,'ENG2'))||testFire,APU:(s.apuFire&&s.apuDetector)||testFire};
 const activeOverheat={ENG1:(s.engineOverheat.ENG1&&detectOK(s,'ENG1'))||testFire,ENG2:(s.engineOverheat.ENG2&&detectOK(s,'ENG2'))||testFire};
 const wheel=s.wheelWellFire||testFire;
 const fireKeys=[...UNITS.filter(x=>activeFire[x]),...(wheel?['WHEEL_WELL']:[])];
 const fireSignature=fireKeys.join('|');
 const commonFault=testFault||fault(s,'ENG1')||fault(s,'ENG2');
 const apuFault=testFault||!s.apuDetector;
 const detectorCaution=(!testFault&&s.selector==='NORMAL'&&(fault(s,'ENG1')||fault(s,'ENG2')))||!s.apuDetector;
 const amberOverheat=activeOverheat.ENG1||activeOverheat.ENG2;
 const extTest=s.test==='EXT_1'||s.test==='EXT_2';
 const indications={
 ENG1_OVERHEAT:activeOverheat.ENG1,ENG2_OVERHEAT:activeOverheat.ENG2,
 FAULT:commonFault,APU_DET_INOP:apuFault,WHEEL_WELL:wheel,
 L_BOTTLE_DISCHARGED:s.bottles.L,R_BOTTLE_DISCHARGED:s.bottles.R,
 APU_BOTTLE_DISCHARGED:s.bottles.APU,
 EXT_L:extTest&&s.circuits.L,EXT_R:extTest&&s.circuits.R,EXT_APU:extTest&&s.circuits.APU,
 ENG1_FIRE:activeFire.ENG1,ENG2_FIRE:activeFire.ENG2,APU_FIRE:activeFire.APU,
 MASTER_FIRE_WARN:fireKeys.length>0&&fireSignature!==s.ackFire,
 FIRE_BELL:fireKeys.length>0&&fireSignature!==s.ackFire,
 MASTER_CAUTION:(amberOverheat||detectorCaution),
 OVHT_DET:(amberOverheat||detectorCaution)
 };
 const outputs={ENG1:{fuelShutoff:s.handles.ENG1.pulled,hydraulicShutoff:s.handles.ENG1.pulled,bleedShutoff:s.handles.ENG1.pulled,generatorTrip:s.handles.ENG1.pulled,reverserInhibit:s.handles.ENG1.pulled},
 ENG2:{fuelShutoff:s.handles.ENG2.pulled,hydraulicShutoff:s.handles.ENG2.pulled,bleedShutoff:s.handles.ENG2.pulled,generatorTrip:s.handles.ENG2.pulled,reverserInhibit:s.handles.ENG2.pulled},
 APU:{fuelShutoff:s.handles.APU.pulled,bleedShutoff:s.handles.APU.pulled,inletDoorClose:s.handles.APU.pulled,generatorTrip:s.handles.APU.pulled}};
 return {indications,outputs,activeFire,activeOverheat,fireKeys,fireSignature,handleUnlock:{ENG1:activeFire.ENG1,ENG2:activeFire.ENG2,APU:activeFire.APU}};
}
function createEngine(){
 let state=defaults(), lastEvent={accepted:true,reason:'INIT'};
 function dispatch(cmd){
  if(!cmd||typeof cmd!=='object')throw new TypeError('Command required');
  let n=clone(state), result={accepted:true,reason:cmd.type};
  const unit=cmd.unit;
  function checkUnit(){if(!UNITS.includes(unit))throw new RangeError('Unknown unit '+unit);}
  switch(cmd.type){
   case 'RESET':n=defaults();break;
   case 'SELECT_LOOP':if(!['NORMAL','A','B'].includes(cmd.value))throw new RangeError('Loop');n.selector=cmd.value;break;
   case 'TEST':if(![null,'EXT_1','EXT_2','FAULT_INOP','OVHT_FIRE'].includes(cmd.value))throw new RangeError('Test');n.test=cmd.value;break;
   case 'SET_LOOP':if(!['ENG1','ENG2'].includes(unit)||!['A','B'].includes(cmd.loop))throw new RangeError('Detector loop');n.loops[unit][cmd.loop]=Boolean(cmd.healthy);break;
   case 'SET_APU_DETECTOR':n.apuDetector=Boolean(cmd.healthy);break;
   case 'SET_FIRE':checkUnit();if(unit==='APU')n.apuFire=Boolean(cmd.active);else n.engineFire[unit]=Boolean(cmd.active);n.ackFire=null;break;
   case 'SET_OVERHEAT':if(!['ENG1','ENG2'].includes(unit))throw new RangeError('Overheat unit');n.engineOverheat[unit]=Boolean(cmd.active);break;
   case 'SET_WHEEL_FIRE':n.wheelWellFire=Boolean(cmd.active);n.ackFire=null;break;
   case 'SET_BOTTLE_LOW':if(!BOTTLES.includes(cmd.bottle))throw new RangeError('Bottle');n.bottles[cmd.bottle]=Boolean(cmd.active);break;
   case 'SET_CIRCUIT':if(!BOTTLES.includes(cmd.bottle))throw new RangeError('Circuit');n.circuits[cmd.bottle]=Boolean(cmd.healthy);break;
   case 'OVERRIDE':checkUnit();n.handles[unit].override=Boolean(cmd.enabled);break;
   case 'PULL':
    checkUnit();
    if(cmd.pulled===false){if(n.handles[unit].angle!==0){result={accepted:false,reason:'RETURN_ROTATION_TO_CENTER'};break;}n.handles[unit].pulled=false;break;}
    if(!(evaluate(n).handleUnlock[unit]||n.handles[unit].override)){result={accepted:false,reason:'HANDLE_LOCKED'};break;}
    n.handles[unit].pulled=true;break;
   case 'ROTATE':
    checkUnit();
    if(![-45,0,45].includes(cmd.angle))throw new RangeError('Detent');
    if(!n.handles[unit].pulled){result={accepted:false,reason:'PULL_FIRST'};break;}
    n.handles[unit].angle=cmd.angle;
    if(cmd.angle!==0){
      const bottle=unit==='APU'?'APU':(cmd.angle<0?'L':'R');
      if(n.bottles[bottle])result={accepted:false,reason:'BOTTLE_ALREADY_DISCHARGED'};
      else if(!n.circuits[bottle])result={accepted:false,reason:'EXTINGUISHER_CIRCUIT_FAILED'};
      else n.bottles[bottle]=true;
    }
    break;
   case 'BELL_CUTOUT':n.ackFire=evaluate(n).fireSignature;break;
   default:throw new RangeError('Unknown action '+cmd.type);
  }
  if(result.accepted)state=n;lastEvent=result;return {state:clone(state),result,derived:evaluate(state)};
 }
 return Object.freeze({getState:()=>clone(state),evaluate:()=>evaluate(state),dispatch,lastEvent:()=>({...lastEvent})});
}
return Object.freeze({UNITS,BOTTLES,defaults,evaluate,createEngine});
});
