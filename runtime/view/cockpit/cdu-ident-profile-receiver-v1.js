/* Install validated selected-aircraft MODEL / ENG RATING in IDENT.
 * Separate seat-local view data, shared origin in parent Settings store.
 */
(function(root){
 'use strict';
 const seat=new URLSearchParams(root.location.search).get('seat');
 const model=root.B737CDUIdentInstallationV1;
 if(!['CAPT','FO'].includes(seat)||!model||root.parent===root||
    typeof state==='undefined'||typeof update!=='function')return;
 let current=null;
 function apply(){
  if(!current)return false;
  state.preflightEvidence={...(state.preflightEvidence||{}),
   MODEL:{...current.MODEL},ENG_RATING:{...current.ENG_RATING}};
  state.engineInstallation={
   variant:current.engineVariant,label:current.engineLabel,
   rating:current.engineRating,ratingLbf:current.ratingLbf,
   aircraftModel:current.aircraftModel,source:'USER_SELECTED_TRAINER_CONFIGURATION'
  };
  return true;
 }
 const priorUpdate=update;
 update=function(){apply();return priorUpdate();};
 root.updateStage5View=update;
 root.addEventListener('message',event=>{
  if(event.origin!==root.location.origin||event.source!==root.parent||
     event.data?.type!=='b737:cdu-installation-v1'||event.data.seat!==seat)return;
  const incoming=event.data.installation;
  if(!model.verify(incoming))return;
  current=model.select(incoming);
  apply();
  update();
 });
 function request(){
  root.parent.postMessage({type:'b737:cdu-installation-request-v1',seat},root.location.origin);
 }
 root.addEventListener('pageshow',request);
 root.B737CDUIdentReceiverV1=Object.freeze({
  getState:()=>current?{aircraftModel:current.aircraftModel,
   engineVariant:current.engineVariant,engineRating:current.engineRating}:null,
  version:model.VERSION
 });
 request();
})(window);
