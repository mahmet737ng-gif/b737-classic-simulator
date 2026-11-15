/* B737 CLASSIC AFDS warning-panel TEST switch — event-driven control core.
 * Hardware/test-only implementation: no inferred FMC/FCC/electrical feed.
 * FCOM visual test: TEST 1 amber all; TEST 2 red A/P & A/T, amber FMC.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.B737AFDSAnnunciatorCoreV1=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
 "use strict";
 const VERSION="AFDS-ANN-TEST-0001";
 const DETENTS=Object.freeze(["TEST_1","NEUTRAL","TEST_2"]);
 const ALLOWED=Object.freeze({AP:["OFF","STEADY_RED","FLASH_RED","STEADY_AMBER","FLASH_AMBER"],
   AT:["OFF","STEADY_RED","FLASH_RED","STEADY_AMBER","FLASH_AMBER"],FMC:["OFF","STEADY_AMBER"]});
 const TEST=Object.freeze({TEST_1:Object.freeze({AP:"STEADY_AMBER",AT:"STEADY_AMBER",FMC:"STEADY_AMBER"}),
   TEST_2:Object.freeze({AP:"STEADY_RED",AT:"STEADY_RED",FMC:"STEADY_AMBER"})});
 const initial=()=>({detent:"NEUTRAL",alerts:{AP:"OFF",AT:"OFF",FMC:"OFF"}});
 function reduce(previous,action){
   const s=previous||initial();
   if(!action||typeof action.type!=="string")return s;
   if(action.type==="PRESS_TEST"){
     if(action.detent!=="TEST_1"&&action.detent!=="TEST_2")return s;
     if(s.detent===action.detent)return s;
     return {...s,detent:action.detent};
   }
   if(action.type==="RELEASE_TEST"||action.type==="CANCEL_TEST"){
     if(s.detent==="NEUTRAL")return s;
     return {...s,detent:"NEUTRAL"};
   }
   if(action.type==="SET_ALERT"){
     const {id,status}=action;
     if(!Object.prototype.hasOwnProperty.call(ALLOWED,id)||!ALLOWED[id].includes(status))return s;
     if(s.alerts[id]===status)return s;
     return {...s,alerts:{...s.alerts,[id]:status}};
   }
   if(action.type==="ACKNOWLEDGE"){
     const id=action.id;
     if(!Object.prototype.hasOwnProperty.call(ALLOWED,id))return s;
     if(s.alerts[id]==="OFF")return s;
     return {...s,alerts:{...s.alerts,[id]:"OFF"}};
   }
   return s;
 }
 function lamps(s){
   if(!s||!DETENTS.includes(s.detent))throw Error("Invalid AFDS test detent");
   return {...(TEST[s.detent]||s.alerts)};
 }
 function status(s){
   return {version:VERSION,detent:s.detent,springReturn:"NEUTRAL",
     lamps:lamps(s),alerts:{...s.alerts},source:"Classic FCOM Chapter 4 AFDS Annunciator P/RST TEST"};
 }
 return Object.freeze({VERSION,DETENTS,ALLOWED,TEST,initial,reduce,lamps,status});
});