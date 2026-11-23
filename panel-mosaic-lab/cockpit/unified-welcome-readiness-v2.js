/* Unified Welcome entry gate: measured cockpit owner/paint milestones.
 * 70% is a weighted readiness score, never a fake network/download percentage.
 * Main panel/flight displays/electrical/MCP/CDUs are mandatory even at 99%.
 * Pure evaluator; no side effects or DOM mutations.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737WelcomeReadinessV2=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='WELCOME-MAIN-READY-0001',MIN_PERCENT=70;
 const REQUIRED=Object.freeze(['mainPhotos','mainInstruments','mcp','electrical',
  'cdu','throttle','forward']);
 function evaluate({visual={},full={},mcpMounted=false}={}){
  const checks={
   mainPhotos:visual.main===true&&full.main===true,
   // StartupGate requires both painted EADIs, both EHSIs and a
   // live engine-indication layer (rather than merely a background texture).
   mainInstruments:full.instruments===true,
   mcp:full.controls===true&&mcpMounted===true,
   electrical:full.electrical===true,
   cdu:full.cdu===true,
   throttle:visual.throttle===true,
   forward:visual.forward===true,
   aft:visual.aft===true,
   pedestal:visual.pedestal===true,
   overheadOwner:full.overhead===true
  };
  const weights={mainPhotos:2,mainInstruments:3,mcp:1,electrical:2,
   cdu:1,throttle:1,forward:1,aft:1,pedestal:1,overheadOwner:1};
  const total=Object.values(weights).reduce((n,w)=>n+w,0);
  const done=Object.entries(weights).reduce((n,[key,w])=>n+(checks[key]?w:0),0);
  const percent=Math.floor(done*100/total);
  const missing=REQUIRED.filter(key=>!checks[key]);
  const mainReady=checks.mainPhotos&&checks.mainInstruments&&checks.mcp;
  return {version:VERSION,percent,completed:done,total,
   mainReady,criticalReady:missing.length===0,
   canEnter:percent>=MIN_PERCENT&&missing.length===0,
   checks,missing};
 }
 return Object.freeze({VERSION,MIN_PERCENT,REQUIRED,evaluate});
});
