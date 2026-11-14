(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const key='b737classic.aircraft-profile.v1';
const injectionKey='b737classic.bus-failure-injection.v1';
const schema='b737classic.bus-failure-injection/1';
const channel='b737classic.bus-failure-injection.notify.v1';
let current='overhead',bc=null;
function show(view){
 if(!['overhead','lab','cb'].includes(view))return;
 current=view;
 $$('.module').forEach(el=>{const active=el.id==='view-'+view;el.hidden=!active;el.classList.toggle('active',active);});
 $$('button[data-view]').forEach(button=>{const active=button.dataset.view===view;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
 // Lazy CB begins loading once first selected, keeping overhead startup fast.
 const cb=$('#cbFrame');if(view==='cb'&&cb.loading==='lazy')cb.loading='eager';
}
$$('button[data-view]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.view)));
const config={
 schema:'b737-classic-aircraft-profile/1',aircraftFamily:'B737-300-500',aircraftModel:'737-300',
 engineVariant:'CFM56-3B3',pressurization:'DCPCS',engineInstruments:'EIS'
};
function profile(){try{const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored?.schema===config.schema)return {...config,...stored};}catch(_){}return {...config};}
const settings=$('#settingsDialog'),form=$('#settingsForm');
function openSettings(){const p=profile();for(const name of ['aircraftModel','engineVariant','pressurization','engineInstruments'])form.elements.namedItem(name).value=p[name];settings.showModal();}
$('#openSettings').addEventListener('click',openSettings);
$('#closeSettings').addEventListener('click',()=>settings.close());
$('#cancelSettings').addEventListener('click',()=>settings.close());
form.addEventListener('submit',event=>{
 event.preventDefault(); const next={...profile()};
 for(const name of ['aircraftModel','engineVariant','pressurization','engineInstruments'])next[name]=form.elements.namedItem(name).value;
 next.aircraftFamily=next.aircraftModel==='737-400'?'B737-400':'B737-300-500';
 localStorage.setItem(key,JSON.stringify(next));settings.close();
 const overhead=$('#overheadFrame').contentWindow;
 if(overhead)overhead.dispatchEvent(new overhead.CustomEvent('b737:guest-profile-changed',{detail:next}));
});
function faults(){try{const v=JSON.parse(localStorage.getItem(injectionKey)||'null');return v?.schema===schema&&v.active&&Array.isArray(v.offBusKeys)?v.offBusKeys:[]}catch(_){return [];}}
function renderFailures(){
 const ids=faults();$('#failureCount').textContent=ids.length?' ('+ids.length+')':'';
 const list=$('#faultsList');list.replaceChildren();
 if(!ids.length){list.textContent='No injected failures';return;}
 for(const id of ids){const row=document.createElement('div');row.textContent=id;list.appendChild(row);}
}
const dialog=$('#failuresDialog');
$('#failureSwitch').addEventListener('click',()=>{renderFailures();dialog.showModal();});
$('#closeFailures').addEventListener('click',()=>dialog.close());
$('#openBusFromFaults').addEventListener('click',()=>{dialog.close();show('lab');});
$('#clearFailures').addEventListener('click',()=>{
 const data={schema,active:false,offBusKeys:[],issuedAt:Date.now(),source:'GUEST_OPERATOR'};
 localStorage.setItem(injectionKey,JSON.stringify(data));
 if(!bc&&typeof BroadcastChannel==='function')bc=new BroadcastChannel(channel);
 bc?.postMessage(data);renderFailures();
});
window.addEventListener('storage',e=>{if(e.key===injectionKey)renderFailures();});
if(typeof BroadcastChannel==='function'){bc=new BroadcastChannel(channel);bc.onmessage=renderFailures;}
window.addEventListener('message',e=>{
 if(e.origin!==location.origin)return;
 if(e.data?.type==='b737:cb-state-changed'&&e.source===$('#cbFrame').contentWindow){
  const overhead=$('#overheadFrame').contentWindow;
  overhead?.B737UnifiedCB?.refresh?.();
  overhead?.dispatchEvent(new overhead.CustomEvent('b737:cb-state-change',{detail:{source:'GUEST_CB'}}));
 }
});
renderFailures();
})();
