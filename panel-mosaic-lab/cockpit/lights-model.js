(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737CockpitLightsModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 function initial(){return {power:true,aircraftAltitude:8000,selectedAltitude:10000,trailingFlaps:0,gsCaptured:false,gearLever:'DN',gearLeft:'DOWN',gearRight:'DOWN',gearNose:'DOWN',thrustIdle:false,leadingEdge:'RETRACTED',autoslatInFlight:false,antiskidOn:true,antiskidFault:false,autobrakeArmed:false,autobrakeDisarmed:false,autopilotEngaged:false,stabTrimError:false,gpwsPullUp:false,belowGsDots:0,gsSignalValid:true,gsInhibited:false,radioAltitude:1500,gpwsComputerFailed:false,gpwsPowerLost:false,gpwsInvalidInput:false,brakeTempTest:false,reverser1Unlocked:false,reverser2Unlocked:false,startValve1Open:false,startValve2Open:false,starter1Air:false,starter2Air:false,oil1AtRedRadial:false,oil2AtRedRadial:false,oilFilter1Bypass:false,oilFilter2Bypass:false};}
 function programmed(s){return s.trailingFlaps===0?s.leadingEdge==='RETRACTED':[1,2,5].includes(s.trailingFlaps)?s.leadingEdge==='INTERMEDIATE':s.trailingFlaps>=10&&s.trailingFlaps<=40&&s.leadingEdge==='FULL';}
 function validate(reg,assembly){const ids=new Set(),pieces=new Map();for(const r of assembly.regions)for(const p of r.placements||[])pieces.set(p.id,p);for(const c of reg.lights){if(ids.has(c.id))throw Error('Duplicate light '+c.id);ids.add(c.id);const p=pieces.get(c.pieceId),a=p&&assembly.assets[p.asset],b=c.sourceRect;if(!a||b.length!==4||b.some(n=>!Number.isFinite(n))||b[0]<0||b[1]<0||b[2]<=0||b[3]<=0||b[0]+b[2]>a.dimensions[0]||b[1]+b[3]>a.dimensions[1])throw Error('Invalid socket '+c.id);if(!reg.assets[c.asset]?.OFF||!reg.assets[c.asset]?.ON)throw Error('Missing faces '+c.id);for(const k of c.inputs)if(!Object.hasOwn(initial(),k))throw Error('Missing input '+k);}return true;}
 function controller(reg){let s=initial(),overrides={},lampTest=false,overheadPower=null,previousDifference=Math.abs(s.aircraftAltitude-s.selectedAltitude),previousTarget=s.selectedAltitude,acquired=false,altitudeMode='OFF';
  function altitude(){const d=Math.abs(s.aircraftAltitude-s.selectedAltitude),newTarget=s.selectedAltitude!==previousTarget,inhibited=s.trailingFlaps>=25||s.gsCaptured;if(newTarget||inhibited){acquired=false;altitudeMode='OFF';}else if(d<=300){acquired=true;altitudeMode='OFF';}else if(acquired){altitudeMode=d<900?'FLASH':'OFF';}else if(previousDifference>900&&d<=900){altitudeMode='ON';}else if(d>900){altitudeMode='OFF';}previousDifference=d;previousTarget=s.selectedAltitude;return altitudeMode;}
  function evaluate(){if(s.radioAltitude>1000||s.radioAltitude<30)s.gsInhibited=false;const altitudeFrame=altitude(),frames={},power=s.power&&overheadPower===true;
   for(const c of reg.lights){let on=false;switch(c.rule){
    case 'signal':on=s[c.inputs[0]];break;
    case 'start-valve':on=c.inputs.every(k=>s[k]);break;
    case 'altitude':on=altitudeFrame;break;
    case 'below-gs':on=s.gsInhibited||(s.gsSignalValid&&s.belowGsDots>1.3);break;
    case 'gear-green':on=s['gear'+c.gear[0].toUpperCase()+c.gear.slice(1)]==='DOWN';break;
    case 'gear-red':{const g=s['gear'+c.gear[0].toUpperCase()+c.gear.slice(1)];on=['TRANSIT','UNSAFE'].includes(g)||(s.gearLever==='DN'&&g!=='DOWN')||(s.gearLever==='UP'&&g!=='UP')||(s.thrustIdle&&g!=='DOWN');break;}
    case 'le-transit':on=!s.autoslatInFlight&&!programmed(s);break;
    case 'le-extended':on=s.trailingFlaps>0&&programmed(s);break;
    case 'antiskid':on=!s.antiskidOn||s.antiskidFault;break;
    case 'autobrake':on=s.autobrakeDisarmed||s.autobrakeArmed&&!s.antiskidOn;break;
    case 'stab-trim':on=s.autopilotEngaged&&s.stabTrimError;break;
    case 'gpws-inop':on=s.gpwsComputerFailed||s.gpwsPowerLost||s.gpwsInvalidInput;break;
    default:throw Error('Unrecognized source rule '+c.rule);
   }frames[c.id]=!power?'OFF':lampTest?'ON':Object.hasOwn(overrides,c.id)?overrides[c.id]:typeof on==='string'?on:on?'ON':'OFF';}
   return {version:reg.version,frames,inputs:copy(s),overrides:copy(overrides),power,overheadPower,lampTest};
  }
  return {evaluate,update(patch){for(const [k,v]of Object.entries(patch)){if(!Object.hasOwn(s,k)||typeof v!==typeof s[k]||(typeof v==='number'&&!Number.isFinite(v)))throw Error('Invalid sensor input '+k);if(k==='gearLever'&&!['UP','OFF','DN'].includes(v)||k.startsWith('gear')&&k!=='gearLever'&&!['UP','DOWN','TRANSIT','UNSAFE'].includes(v)||k==='leadingEdge'&&!['RETRACTED','INTERMEDIATE','FULL','TRANSIT','DISAGREE'].includes(v))throw Error('Invalid sensor value '+k);if(k==='trailingFlaps'&&![0,1,2,5,10,15,25,30,40].includes(v)||k==='belowGsDots'&&(v<0||v>10)||k==='radioAltitude'&&(v<0||v>60000)||['aircraftAltitude','selectedAltitude'].includes(k)&&(v< -2000||v>60000))throw Error('Sensor out of range '+k);}Object.assign(s,patch);return evaluate();},setOverheadPower(v){if(typeof v!=='boolean')throw Error('Invalid power');overheadPower=v;return evaluate();},setTest(v){lampTest=!!v;return evaluate();},setOverride(id,frame){if(!reg.lights.some(c=>c.id===id)||!['AUTO','ON','OFF'].includes(frame))throw Error('Invalid lamp override');if(frame==='AUTO')delete overrides[id];else overrides[id]=frame;return evaluate();},reset(){s=initial();overrides={};lampTest=false;previousDifference=2000;previousTarget=10000;acquired=false;altitudeMode='OFF';return evaluate();}};
 }
 return Object.freeze({initial,programmed,validate,controller});
});
