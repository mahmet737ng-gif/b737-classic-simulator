/* Additive Unified FLT PHASE -> IRS initialization bridge.
 * Do not modify the owner-locked IRS panel/core. Only uses its public FMC
 * POS INIT API, which observes L/R power and alignment eligibility.
 * Never forces NAV VALID, completes alignment, or drives AFDS.
 */
(function(win){
 'use strict';
 const PHASES=new Set(['SELFTEST','ALIGNING','ALIGN_READY','WAIT_POSITION','HIGH_LAT_READY','FAST_REALIGN']);
 let pending=null,delivered=new Set(),busy=false,lastResult=null;
 function format(v,width){
  const abs=Math.abs(v),degrees=Math.floor(abs),tenths=Math.round((abs-degrees)*600);
  const dd=degrees+Math.floor(tenths/600),mm=tenths%600;
  return (v<0?(width===2?'S':'W'):(width===2?'N':'E'))+
   String(dd).padStart(width,'0')+String(mm).padStart(3,'0');
 }
 function positionText(p){
  if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||
     Math.abs(p.lat)>90||Math.abs(p.lon)>180)throw Error('INVALID_FLIGHT_LOCATION');
  return format(p.lat,2)+' '+format(p.lon,3);
 }
 function attempt(){
  if(!pending||busy)return;
  const trainer=win.B737IRSTrainerUnified;
  if(!trainer?.getState||!trainer?.setFmcPosition)return;
  const snapshot=trainer.getState();
  const eligible=['L','R'].filter(side=>{
   const u=snapshot.units?.[side];
   return u?.powered===true&&PHASES.has(u.phase);
  });
  if(!eligible.some(side=>!delivered.has(side)))return;
  const candidate=pending;
  busy=true;
  try{
   // The existing IRS API applies to all currently eligible L/R units.
   // We cannot initialize OFF, unpowered, or NAV-ready IRS.
   const result=trainer.setFmcPosition(positionText(candidate));
   for(const side of result.sides||[])delivered.add(side);
   lastResult={status:'ENTERED_FOR_ALIGNMENT',sides:[...delivered],icao:candidate.icao||null,
    latitude:candidate.lat,longitude:candidate.lon};
   win.dispatchEvent(new CustomEvent('b737:flight-location-irs-transfer',{detail:lastResult}));
   if(delivered.has('L')&&delivered.has('R'))pending=null;
  }catch(error){
   lastResult={status:'DEFERRED',reason:String(error?.message||error)};
  }finally{busy=false;}
 }
 win.addEventListener('b737:flight-location-reference',e=>{
  const p=e.detail;
  if(!p||p.source==='FLIGHT_SCENARIO_LIVE_POSITION')return;
  pending=p;delivered=new Set();attempt();
 });
 // Event-driven retry when an independently powered IRS enters ALIGN/NAV.
 win.addEventListener('b737:irs-trainer-state',attempt);
 win.B737UnifiedFlightIRSBridgeV1=Object.freeze({
  positionText,attempt,getStatus:()=>lastResult?{...lastResult}:null
 });
})(window);
