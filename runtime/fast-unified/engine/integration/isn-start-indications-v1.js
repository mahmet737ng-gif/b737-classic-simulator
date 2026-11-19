/* ISN-03 Stage 3: present only observed/training feedback from the start
 * session. A command is never displayed as proof of N2, EGT or valve travel.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNStartIndicationsV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const SCHEMA='b737.isn.start-indications.v1';
 const tri=value=>value===true?'OPEN':value===false?'CLOSED':'UNKNOWN';
 function instrument(feedback,key,unit){const signal=feedback?.[key];
  if(!signal||signal.value===null||!Number.isFinite(signal.value))return {value:null,text:'—',origin:signal?.origin??null};
  return {value:signal.value,text:Math.round(signal.value)+' '+unit,origin:signal.origin??null};
 }
 function project(chain){if(!chain?.observations||!chain?.phase||!chain?.projected)throw Error('ISN-03 start-chain snapshot required');
  const engines={};for(const n of [1,2]){const id='engine'+n,obs=chain.observations[id];
   if(!obs?.feedback||!obs?.rules)throw Error('Missing engine observation '+id);
   const valve=obs.feedback.startValveOpen.value;
   engines[id]={phase:chain.phase[id],n2:instrument(obs.feedback,'n2Percent','%'),
    egt:instrument(obs.feedback,'egtC','°C'),fuelFlow:instrument(obs.feedback,'fuelFlowKgHr','kg/h'),
    lever:obs.feedback.fuelStartLever.value??'UNKNOWN',
    startValve:{observed:valve,text:tri(valve),amber:obs.rules.starter.startValveOpenAmberLamp,
     mountedLamp:chain.projected['mainStartValve'+n],origin:obs.feedback.startValveOpen.origin??null},
    egt725Advisory:obs.rules.advisory.egt725Latched===true,
    running:obs.running===true};
  }
  return {schema:SCHEMA,engines,apu:{phase:chain.phase.apu,
   genSelected:Object.values(chain.selectedSources||{}).includes('APU'),
   bleedValveOpen:chain.bleed?.apuBleedValveOpen??null,
   batteryPowered:chain.electrical?.battery??null},
   error:chain.lastError||'',training:chain.trainingNotice||''};
 }
 return Object.freeze({SCHEMA,project});
});
