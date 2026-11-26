/* CLOCK-PHOTO-0005: independently operable captain and first officer clock.
   Uses the approved standalone face and the existing flight-needle photo registration.
   Does not alter locked photo masters or other instrument needles. */
(function(win,doc){
 'use strict';
 const version='CLOCK-PHOTO-0005';
 const regs=[
  {seat:'captain',piece:'captain',selector:'.texture-piece[data-piece="captain"]',width:3942,height:3591,x:3692,y:1589,w:680,h:700},
  {seat:'firstOfficer',piece:'fo-outer',selector:'.texture-piece[data-piece="fo-outer"]',width:1123,height:1400,x:868,y:601,w:294,h:294},
  {seat:'firstOfficer',piece:'fo-owner',selector:'#fo-owner-panel-v1',width:1286,height:1223,x:1141,y:586,w:231,h:231}
 ];
 const frames=new Map();let pending=false;
 function mountOne(reg){
  const host=doc.querySelector(reg.selector);if(!host)return;
  let frame=frames.get(reg.piece);if(frame&&frame.parentNode===host)return;
  if(frame)frame.remove();
  frame=doc.createElement('iframe');frame.className='classic-clock-photo-v3';
  frame.dataset.clockSeat=reg.seat;frame.dataset.clockPiece=reg.piece;
  frame.title=(reg.seat==='captain'?'Captain':'First Officer')+' clock';
  frame.src=new URL('./clock-embedded-v5.html?embed=1&seat='+reg.seat+'&v='+version,doc.baseURI).href;
  frame.setAttribute('allowtransparency','true');
  // Register against the outer case rather than the chronograph pivot.
  Object.assign(frame.style,{position:'absolute',left:((reg.x-reg.w/2)/reg.width*100)+'%',top:((reg.y-reg.h/2)/reg.height*100)+'%',width:(reg.w/reg.width*100)+'%',height:(reg.h/reg.height*100)+'%',border:'0',padding:'0',background:'transparent',colorScheme:'normal',clipPath:'polygon(16.5% 4.3%,83.5% 4.3%,95.1% 17.9%,95.1% 81.8%,85.0% 94.5%,15.4% 94.5%,4.8% 82.2%,4.8% 17.9%)',pointerEvents:'auto',zIndex:'8',display:'block'});
  frame.addEventListener('load',()=>{try{if(frame.contentWindow.clockTest){const ready=()=>{if(!frame.isConnected)return;if(!frame.contentWindow.clockTest?.artworkReady()){win.requestAnimationFrame(ready);return}frame.dataset.ready='true';for(const old of host.querySelectorAll('[data-flight-needle="clock"]'))old.style.visibility='hidden'};ready()}}catch(e){}});
  frames.set(reg.piece,frame);host.append(frame);
 }
 function mount(){
  for(const reg of regs)mountOne(reg);
  const conv=doc.documentElement.dataset.engineIndication==='CONVENTIONAL';
  for(const [piece,frame] of frames){const active=piece==='captain'||(conv?piece==='fo-owner':piece==='fo-outer');const v=active?'block':'none';if(frame.style.display!==v)frame.style.display=v}
 }
 function queue(){if(pending)return;pending=true;win.requestAnimationFrame(()=>{pending=false;mount()})}
 for(const e of ['b737:cockpit-mounted','b737:engine-indication-view','b737:aircraft-profile-change'])win.addEventListener(e,queue);
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',queue,{once:true});
 new win.MutationObserver(queue).observe(doc.getElementById('scene')||doc.body,{childList:true,subtree:true});queue();
 win.B737ClassicClockPhotoV3={version,inspect:()=>[...frames].map(([piece,frame])=>({piece,seat:frame.dataset.clockSeat,ready:frame.dataset.ready==='true',visible:frame.style.display!=='none',clipPath:frame.style.clipPath,rect:frame.getBoundingClientRect().toJSON()}))};
})(window,document);
