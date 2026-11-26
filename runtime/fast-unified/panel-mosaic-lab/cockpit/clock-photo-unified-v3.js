/* CLOCK-PHOTO-0003: independently operable captain and first officer clock.
   Uses the approved standalone face and the existing flight-needle photo registration.
   Does not alter locked photo masters or other instrument needles. */
(function(win,doc){
 'use strict';
 const version='CLOCK-PHOTO-0003';
 const regs=[
  {seat:'captain',piece:'captain',selector:'.texture-piece[data-piece="captain"]',width:3942,height:3591,x:3713,y:1610,radius:193},
  {seat:'firstOfficer',piece:'fo-outer',selector:'.texture-piece[data-piece="fo-outer"]',width:1123,height:1400,x:869,y:609,radius:103},
  {seat:'firstOfficer',piece:'fo-owner',selector:'#fo-owner-panel-v1',width:1286,height:1223,x:1142,y:592,radius:81}
 ];
 const frames=new Map();let pending=false;
 function mountOne(reg){
  const host=doc.querySelector(reg.selector);if(!host)return;
  let frame=frames.get(reg.piece);if(frame&&frame.parentNode===host)return;
  if(frame)frame.remove();
  frame=doc.createElement('iframe');frame.className='classic-clock-photo-v3';
  frame.dataset.clockSeat=reg.seat;frame.dataset.clockPiece=reg.piece;
  frame.title=(reg.seat==='captain'?'Captain':'First Officer')+' clock';
  frame.src=new URL('./clock-test-lab-v3.html?embed=1&seat='+reg.seat+'&v='+version,doc.baseURI).href;
  frame.setAttribute('allowtransparency','true');
  const size=reg.radius*2.4;
  Object.assign(frame.style,{position:'absolute',left:((reg.x-size*624/1248)/reg.width*100)+'%',top:((reg.y-size*570/1248)/reg.height*100)+'%',width:(size/reg.width*100)+'%',height:(size/reg.height*100)+'%',border:'0',padding:'0',background:'transparent',pointerEvents:'auto',zIndex:'8',display:'block'});
  frame.addEventListener('load',()=>{try{if(frame.contentWindow.clockTest){frame.dataset.ready='true';for(const old of host.querySelectorAll('[data-flight-needle="clock"]'))old.style.visibility='hidden'}}catch(e){}});
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
 win.B737ClassicClockPhotoV3={version,inspect:()=>[...frames].map(([piece,frame])=>({piece,seat:frame.dataset.clockSeat,ready:frame.dataset.ready==='true',visible:frame.style.display!=='none'}))};
})(window,document);
