/* One persisted CB state in every same-origin Unified/overhead/CB frame. */
(function(win){'use strict';
const Core=win.B737UnifiedCircuitGatesV1,Kernel=win.B737_CB_Kernel;
if(!Core||!Kernel||!win.CB_CATALOG)throw Error('Unified CB prerequisites unavailable');
const service=Core.create(win.CB_CATALOG,Kernel);let signature='',lastError=null;
function profile(){try{const p=JSON.parse(localStorage.getItem(Core.PROFILE)||'{}');return p.pressurization==='DCPCS'?'DCPCS':'CPCS';}catch{return 'CPCS';}}
function notify(){win.dispatchEvent(new CustomEvent('b737:cb-state-change',{detail:service.report()}));}
function refresh(){
 try{
  const raw=localStorage.getItem(Core.STORAGE),variant=profile(),next=(raw||'')+'|'+variant;
  if(next===signature)return false;
  if(raw){const result=service.restore(JSON.parse(raw));if(!result.ok)throw Error(result.reason);}
  else service.network.reset();
  service.setVariant(variant);signature=next;lastError=null;notify();return true;
 }catch(error){lastError=String(error);console.warn('Unified CB state rejected; last valid state retained',error);return false;}
}
win.B737UnifiedCB=Object.freeze({get revision(){return service.revision;},closed:service.closed,available:service.available,gate:service.gate,
 irsPower:(side,upstream)=>{
  const ac=service.available('irs.'+side+'.ac')!==false,dc=service.available('irs.'+side+'.dc')!==false;
  if(!ac&&!dc)return false;
  const bus=win.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
  const rawAC=bus?.[side==='L'?'acStandby':'transfer2'],rawDC=bus?.switchedHotBattery;
  if(rawAC===true||rawDC===true)return upstream&&((rawAC===true&&ac)||(rawDC===true&&dc));
  return upstream;
 },
 snapshot:service.snapshot,report:()=>({...service.report(),error:lastError}),refresh,
 lampAllowed:id=>{const name=Core.LIGHT_CONSUMERS[id];return !name||service.available(name)!==false;}});
win.addEventListener('storage',e=>{if(e.key===Core.STORAGE||e.key===Core.PROFILE||e.key===null)refresh();});
win.addEventListener('b737:cb-snapshot',refresh);
win.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.data?.type!=='b737:cb-state-changed')return;
 if(e.source===win.parent||[...document.querySelectorAll('iframe')].some(f=>f.contentWindow===e.source))refresh();
});
win.addEventListener('b737:aircraft-profile-change',refresh);
refresh();
})(window);
