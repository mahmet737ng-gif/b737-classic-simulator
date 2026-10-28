/* ASP-BARE-0001. Additive overlays on existing pedestal-radio native image only.
No modifications to locked panel assets or controls. OBS bay provisional. */
(()=>{'use strict';
const src={w:1122,h:1402};
const slots=Object.freeze([
{id:'CAPT',x:20,y:649,w:375,h:297,provisional:false},
{id:'FO',x:744,y:649,w:375,h:297,provisional:false},
{id:'OBS',x:398,y:948,w:345,h:274,provisional:true}
]);
function mount(){
const host=document.querySelector('#region-pedestal .texture-piece[data-piece="pedestal-radio"]');
if(!host||host.dataset.aspBareMounted==='1')return false;
for(const s of slots){
 const wrapper=document.createElement('div');wrapper.className='asp-bare-mounted';
 wrapper.dataset.seat=s.id;wrapper.dataset.provisional=String(s.provisional);
 Object.assign(wrapper.style,{position:'absolute',left:100*s.x/src.w+'%',top:100*s.y/src.h+'%',width:100*s.w/src.w+'%',height:100*s.h/src.h+'%',background:'#35434d',overflow:'hidden',zIndex:'9',pointerEvents:'none',border:'0',borderRadius:'0'});
 const img=document.createElement('img');img.src='./assets/asp-bare-unified-v1.svg?v=ASP-BARE-0001';img.draggable=false;img.alt=s.id+' empty ASP panel';Object.assign(img.style,{display:'block',width:'100%',height:'100%',objectFit:'fill',border:'0',maxWidth:'none',maxHeight:'none',pointerEvents:'none'});
 wrapper.appendChild(img);host.appendChild(wrapper);
}
host.dataset.aspBareMounted='1';
window.B737UnifiedASPBlank=Object.freeze({version:'ASP-BARE-0001',slots,inspect:()=>slots.map(s=>({seat:s.id,provisional:s.provisional,box:document.querySelector('.asp-bare-mounted[data-seat="'+s.id+'"]')?.getBoundingClientRect().toJSON()}))});
return true;}
if(!mount())window.addEventListener('b737:cockpit-mounted',mount,{once:true});
})();