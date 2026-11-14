/* 737-300/-400/-500 FCOM 6.10.6, 6.20.2 & SP.6.1.
 * Pure UI decision policy; the only electrical writer is existing V7/ISN Pack.
 * External GPU connection is an environment event, NOT an AC bus selection.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737GroundPowerHeaderPolicyV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const ACTIONS=Object.freeze(['CONNECT','DISCONNECT','ON','OFF']);
 function evaluate(state,projection){
  if(!state?.config||!state.source)throw Error('Live Electrical V7 state required');
  const c=state.config;
  const attached=c.groundPowerAttached===true;
  const quality=c.groundPowerQualityGood===true;
  const onGround=c.onGround===true;
  const available=attached&&quality;
  const ext1=state.source[1]==='EXT',ext2=state.source[2]==='EXT';
  const connected=ext1&&ext2&&projection?.source?.[1]==='EXT'&&projection?.source?.[2]==='EXT'&&
   projection?.bus?.transfer1===true&&projection?.bus?.transfer2===true;
  const batteryOn=c.batterySwitch===true;
  const fault=!quality&&attached;
  let status=connected?'ON_BUS':available?'AVAILABLE':fault?'BAD_QUALITY':attached?'CABLE_ATTACHED':'DISCONNECTED';
  return Object.freeze({
   status,attached,quality,available,onGround,batteryOn,connected,
   selected:{1:ext1,2:ext2},
   bus:{1:projection?.bus?.transfer1===true,2:projection?.bus?.transfer2===true},
   lampAvailable:available,
   canConnect:onGround&&!attached,
   canDisconnect:attached,
   canSwitchOn:available&&onGround&&batteryOn&&!connected,
   canSwitchOff:ext1||ext2,
   reason:!onGround?'NOT_ON_GROUND':!attached?'CONNECT_GPU_FIRST':
    !quality?'POWER_QUALITY_NOT_ACCEPTABLE':!batteryOn?'BATTERY_SWITCH_OFF':
    connected?'ALREADY_ON_BOTH_BUSES':'READY_FOR_GRD_PWR_ON'
  });
 }
 function plan(action,state,projection){
  if(!ACTIONS.includes(action))throw Error('Unknown ground power header action');
  const view=evaluate(state,projection);
  if(action==='CONNECT'){
   if(!view.canConnect)throw Error(view.onGround?'GPU already attached':'GPU connection requires aircraft on ground');
   return Object.freeze({environmentAttached:true,sourceCommands:[]});
  }
  if(action==='ON'){
   if(!view.canSwitchOn)throw Error('GRD PWR ON inhibited: '+view.reason);
   return Object.freeze({environmentAttached:null,
    sourceCommands:[{type:'SELECT_SOURCE',side:1,source:'EXT'}]});
  }
  const commands=[1,2].filter(side=>view.selected[side]).map(side=>
   ({type:'SELECT_SOURCE',side,source:'OFF'}));
  return Object.freeze({environmentAttached:action==='DISCONNECT'?false:null,
   sourceCommands:commands});
 }
 return Object.freeze({ACTIONS,evaluate,plan});
});
