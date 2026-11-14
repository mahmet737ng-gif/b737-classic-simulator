/* ASP-BARE-0003-COLOR — Observer ASP now on the OH-04 AFT OVERHEAD plate, not pedestal.
This additive overlay does NOT change overhead source mosaics or guarded switches/IRS. */
(()=>{'use strict';
const IMAGE=Object.freeze({pedestal:'./assets/asp-bare-pedestal-v3.svg?v=ASP-COLOR-0003', 'aft-overhead':'./assets/asp-bare-aft-overhead-v3.svg?v=ASP-COLOR-0003'});
const RADIO={w:1122,h:1402};
const PEDESTAL=Object.freeze([
Object.freeze({id:'CAPT',x:20,y:649,w:375,h:297,region:'pedestal'}),
Object.freeze({id:'FO',x:744,y:649,w:375,h:297,region:'pedestal'})
]);
// Registered from frozen geometry: OH-04 polygon x953..1332, y56..339
// UPPER source: 1731 x 909; UPPER destination: [3,3,2214,1019].
const OH04=Object.freeze({
id:'OBS',region:'aft-overhead',panelId:'OH-04',
x:3+953*2214/1731,y:3+56*1019/909,
w:(1332-953)*2214/1731,h:(339-56)*1019/909,
geometrySource:'upper-oh/geometry.json',status:'registered; pixel screenshot QA pending'
});
function face(id,region,box){
 const el=document.createElement('div');
 el.className='asp-bare-mounted';el.dataset.seat=id;el.dataset.region=region;
 el.dataset.panel=id==='OBS'?'OH-04':'PEDESTAL';
 Object.assign(el.style,{position:'absolute',left:box.x,top:box.y,width:box.w,height:box.h,boxSizing:'border-box',background:region==='aft-overhead'?'#566e81':'#727c89',border:'0',borderRadius:'0',padding:'0',margin:'0',overflow:'hidden',zIndex:'9',pointerEvents:'auto',userSelect:'none'});
 const img=document.createElement('img');img.src=IMAGE[region];img.draggable=false;img.alt=id+' bare ASP panel';
 Object.assign(img.style,{display:'block',width:'100%',height:'100%',objectFit:'fill',border:'0',padding:'0',margin:'0',pointerEvents:'none'});
 el.appendChild(img);return el;
}
function mount(){
 const radio=document.querySelector('#region-pedestal .texture-piece[data-piece="pedestal-radio"]');
 const overhead=document.querySelector('#region-overhead');
 if(!radio||!overhead)return false;
 radio.querySelectorAll('.asp-bare-mounted[data-seat="OBS"]').forEach(x=>x.remove());
 for(const s of PEDESTAL){
  if(radio.querySelector('.asp-bare-mounted[data-seat="'+s.id+'"]'))continue;
  radio.appendChild(face(s.id,'pedestal',{
   x:s.x/RADIO.w*100+'%',y:s.y/RADIO.h*100+'%',w:s.w/RADIO.w*100+'%',h:s.h/RADIO.h*100+'%'
  }));
 }
 if(!overhead.querySelector('.asp-bare-mounted[data-seat="OBS"]')){
  overhead.appendChild(face('OBS','aft-overhead',{
   x:OH04.x+'px',y:OH04.y+'px',w:OH04.w+'px',h:OH04.h+'px'
  }));
 }
 radio.dataset.aspBareMounted='2';overhead.dataset.aspBareObserverMounted='OH-04';
 window.B737UnifiedASPBlank=Object.freeze({
  version:'ASP-BARE-0003-COLOR',slots:Object.freeze([...PEDESTAL,OH04]),observerPanel:'OH-04 / AFT OVERHEAD',
  inspect(){return ['CAPT','FO','OBS'].map(seat=>{const n=document.querySelector('.asp-bare-mounted[data-seat="'+seat+'"]');return {seat,region:n?.dataset.region,panel:n?.dataset.panel,rect:n?.getBoundingClientRect().toJSON()||null};});}
 });
 return true;
}
if(!mount())window.addEventListener('b737:cockpit-mounted',mount,{once:true});
})();