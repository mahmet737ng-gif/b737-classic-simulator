/* Read-only connector to the existing ECU and Electrical V7 ownership. */
(function(root,factory){"use strict";const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.B737EngineIndicationsBridgeV1=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){"use strict";
 function create({database,indications,electrical,ecu}={}){
  if(!indications?.calculate||!indications?.fromEcu||!electrical?.evaluate||
     !ecu?.get||!ecu?.start?.core?.pack?.electricalState)throw Error("Existing ECU, Electrical V7, data and indication engine required");
  indications.validate(database);
  let previous=null,mode="EIS";
  return Object.freeze({
   setMode(value){if(!["EIS","CONVENTIONAL"].includes(value))throw Error("Unsupported mode");mode=value;},
   calculate({dtMs=0,faults={},limits={},fuelMode="RATE",resetFuelUsed=false,filterBypassThresholdPsid=null}={}){
    const power=electrical.evaluate(ecu.start.core.pack.electricalState);
    const snapshot=ecu.get();
    const next=indications.calculate(database,{mode,electrical:power,observed:indications.fromEcu(snapshot),
     faults,limits,fuelMode,resetFuelUsed,filterBypassThresholdPsid,dtMs,previous});
    previous=next;
    return {schema:"b737classic.engine-indications-live/1",owner:"EXISTING_ISN_ECU_AND_ELECTRICAL_V7",
     timeMs:snapshot.timeMs,electricalRevision:power.revision,technicalRevision:database.revision,indications:next};
   },
   reset(){previous=null;},
   getMode(){return mode;}
  });
 }
 return Object.freeze({create});
});
