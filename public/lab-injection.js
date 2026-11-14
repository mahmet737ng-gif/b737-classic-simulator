/* Standalone guest ATA24 bus fault injection, shares origin with overhead. */
(function(win){
'use strict';
const KEY='b737classic.bus-failure-injection.v1',SCHEMA='b737classic.bus-failure-injection/1';
const CHANNEL='b737classic.bus-failure-injection.notify.v1';
let sendChannel=null;
function write(off){
 const p={schema:SCHEMA,active:off.length>0,offBusKeys:off,issuedAt:Date.now(),source:'BUS_CONSUMER_TEST_LAB'};
 win.localStorage.setItem(KEY,JSON.stringify(p));
 if(typeof win.BroadcastChannel==='function'){
  try{
   sendChannel=sendChannel||new win.BroadcastChannel(CHANNEL);
   sendChannel.postMessage(p);
  }catch(_){}
 }
 win.dispatchEvent(new CustomEvent('ata24:guest-failures',{detail:p}));
 return p;
}
function install(){
 const ui=win.B737BusConsumerTestLabUIV1;
 if(!ui?.getSession || document.getElementById('injectToOverhead'))return;
 const controls=document.querySelector('.scenario-actions');
 if(!controls)return;
 const group=document.createElement('section');
 group.className='inject-controls';
 group.style.cssText='margin-top:10px;padding:12px;border:1px solid #3c6680;border-radius:10px;display:flex;flex-wrap:wrap;gap:10px';
 group.innerHTML='<button type="button" id="injectToOverhead" class="inject-button" style="flex:1;min-width:145px">INJECT FAILURE TO OVERHEAD</button>'+
  '<button type="button" id="clearOverhead" class="scenario-btn subtle" style="flex:1;min-width:130px">CLEAR INJECTED FAILURES</button>'+
  '<p id="guestInjectStatus" role="status" style="width:100%;font-size:12px;line-height:1.7;margin:0;color:#b7d8ec">Bus changes remain local until you press INJECT.</p>';
 controls.after(group);
 function status(n){const node=document.getElementById('guestInjectStatus');
  node.textContent=n?'ACTIVE · '+n+' bus classes interrupted. The Overhead receives the outage when loaded.':'No failures injected';}
 document.getElementById('injectToOverhead').addEventListener('click',()=>{
   const session=ui.getSession();
   const keys=Object.keys(session.busStates).filter(x=>session.busStates[x]===false);
   // Inject the full effective snapshot (including cascaded bus interruptions).
   write(keys);status(keys.length);
 });
 document.getElementById('clearOverhead').addEventListener('click',()=>{write([]);status(0);});
 try{const saved=JSON.parse(win.localStorage.getItem(KEY)||'null');
  if(saved?.schema===SCHEMA&&saved.active&&Array.isArray(saved.offBusKeys))status(saved.offBusKeys.length);
 }catch(_){}
}
win.addEventListener('b737:buslab-ui-ready',install);
if(win.B737BusConsumerTestLabUIV1)install();
})(window);
