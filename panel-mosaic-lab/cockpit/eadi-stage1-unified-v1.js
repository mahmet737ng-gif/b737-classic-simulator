/* EADI-UNIFIED-STAGE1-0004-FO-RIGHT
 * B737 Classic attitude-only EADI. Independent CAPT/FO canvas faces.
 * Non-destructive display overlay on original/owner main panel artwork.
 * First milestone: static level datum until flight-state is explicitly injected.
 * No idle polling, electrical assumptions, FMC/AFDS/ILS/TCAS logic or extra symbology.
 * The hook registerLayer(seat,id,fn) is reserved for future FMA/speed/ILS etc.
 */
(function(root){
'use strict';
const VERSION='EADI-UNIFIED-STAGE1-0004-FO-RIGHT',R=Math.PI/180;
const WIDTH=900,HEIGHT=720;
// Main-panel native coordinates (2100 x 920), calculated from source-image apertures.
// CAPT: [1680,350,888,782] from 3942x3591 photo at [35,166,726,661.356].
// FO: red-rectangle owner reference in 1920x1080 screenshot 2026-11-08.
// Screen bounds [894..1588, 304..898] were converted to the 2100x920 native
// mosaic using existing EADI host [977..1657, 207..867] as the scale reference.
// The CRT black-face overlay follows the owner-marked empty socket, not bezel metal.
// CAPT photo aperture remains separately source-measured and unchanged.
const CAPT_SCALE=726/3942;
const stations={
 CAPT:{name:'Captain',x:35+1680*CAPT_SCALE,y:166+350*CAPT_SCALE,w:888*CAPT_SCALE,h:782*CAPT_SCALE,pitch:0,bank:0,powered:true,canvas:null,host:null,source:'captain-photo-measured'},
 FO:{name:'First Officer',x:1616.75,y:263.40,w:173.44,h:147.14,pitch:0,bank:0,powered:true,canvas:null,host:null,source:'fo-owner-red-rectangle-registered-20261108'}
};
const futureSlots=Object.freeze(['fma','speedTape','mach','localizer','glideslope','radioAltitude','decisionHeight','flightDirector','tcasRA','windshear','comparators']);
const hooks={CAPT:new Map(),FO:new Map()};
function round1(v){return Math.round(v*10)/10}
function line(c,x,y,ex,ey,width=2,color='#f3f3f6'){c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.lineWidth=width;c.strokeStyle=color;c.stroke();}
function aperture(c){const cx=452,top=174,bottom=579,L=278,U=626;c.beginPath();c.moveTo(L,303);c.bezierCurveTo(L,231,354,top,cx,top);c.bezierCurveTo(550,top,U,231,U,303);c.lineTo(U,474);c.bezierCurveTo(U,546,550,bottom,cx,bottom);c.bezierCurveTo(354,bottom,L,546,L,474);c.closePath();}
function drawAttitude(c,pitch,bank){
 const cx=452,cy=393,pix=8.55,shift=pitch*pix;
 c.save();aperture(c);c.clip();c.translate(cx,cy);c.rotate(-bank*R);
 const sky=c.createLinearGradient(0,-700,0,350);sky.addColorStop(0,'#0750d7');sky.addColorStop(.75,'#156be1');sky.addColorStop(1,'#247ac9');c.fillStyle=sky;c.fillRect(-2200,-2200,4400,2200+shift);
 const earth=c.createLinearGradient(0,0,0,900);earth.addColorStop(0,'#82501b');earth.addColorStop(.55,'#784312');earth.addColorStop(1,'#5b300d');c.fillStyle=earth;c.fillRect(-2200,shift,4400,2200);
 line(c,-2200,shift,2200,shift,3.7,'#eef0f3');
 for(let n=-36;n<=36;n++){
  const d=n*2.5;if(!d)continue;const yy=shift-d*pix;if(Math.abs(yy)>1500)continue;
  const ten=Math.abs(d%10)<.001,five=Math.abs(d%5)<.001,half=ten?68:(five?30:18);
  line(c,-half,yy,half,yy,ten?2.7:2.3);
  if(ten){const str=String(Math.abs(d));c.font="600 16.4px Arial,sans-serif";c.textBaseline='middle';c.fillStyle='#f2f2f6';c.textAlign='right';c.fillText(str,-half-10,yy);c.textAlign='left';c.fillText(str,half+10,yy);}
 }
 // Release the aperture clip before drawing the pointer so its apex can
 // extend beyond the rounded top of the attitude window without being cut.
 c.restore();
 c.save();c.translate(cx,cy);c.rotate(-bank*R);
 c.beginPath();c.moveTo(0,-226);c.lineTo(-11,-198);c.lineTo(11,-198);c.closePath();c.fillStyle='#fff';c.fill();c.restore();
}
function drawBank(c){
 const cx=452,cy=387,rad=220;
 for(const a of [-60,-45,-30,-20,-10,10,20,30,45,60]){
  const t=a*R,len=(Math.abs(a)===60||Math.abs(a)===30)?19:(Math.abs(a)===45?16:11);
  line(c,cx+(rad+5)*Math.sin(t),cy-(rad+5)*Math.cos(t),cx+(rad+5+len)*Math.sin(t),cy-(rad+5+len)*Math.cos(t),a%30===0?3.5:3,'#fff');
 }
 c.beginPath();c.moveTo(cx-11,cy-243);c.lineTo(cx+11,cy-243);c.lineTo(cx,cy-rad+1);c.closePath();c.fillStyle='#fff';c.fill();
}
function drawReference(c){
 c.save();c.translate(452,393);c.lineJoin='round';c.lineCap='round';
 function wing(sign){c.save();c.scale(sign,1);c.beginPath();c.moveTo(130,-13);c.lineTo(42,-13);c.lineTo(42,23);c.lineTo(56,23);c.lineTo(56,1);c.lineTo(130,1);c.closePath();c.fillStyle='#040609';c.fill();c.lineWidth=3.6;c.strokeStyle='#f3f4f7';c.stroke();c.restore();}
 wing(-1);wing(1);
 c.beginPath();c.arc(0,0,9.5,0,Math.PI*2);c.fillStyle='#030507';c.fill();c.lineWidth=3.3;c.strokeStyle='#f3f4f7';c.stroke();c.restore();
}
function render(seat){
 const s=stations[seat];if(!s?.canvas)return;
 const c=s.canvas.getContext('2d',{alpha:false});if(!c)return;
 c.clearRect(0,0,WIDTH,HEIGHT);c.fillStyle='#080b12';c.fillRect(0,0,WIDTH,HEIGHT);
 if(!s.powered)return;
 c.save();
 // Reference-approved ADI fit: ~45% of glass width, ~71% of glass height.
 // The pitch/bank card is centered in the CRT, leaving independent margin
 // for future FMA (top), speed tape (left), ILS (right), and lower data.
 // X and Y scale are intentionally independent to match the approved mockup.
 // Original panel, screws, bezel, and approved controls stay untouched.
 c.translate(450,395);c.scale(1.16,1.26);c.translate(-452,-387);
 drawAttitude(c,s.pitch,s.bank);drawBank(c);drawReference(c);
 c.restore();
 // Future independent display overlays use full 900x720 glass coordinates;
 // they must not inherit the attitude-only scale and translation.
 for(const cb of hooks[seat].values()){
  try{cb(c,Object.freeze({seat,pitch:s.pitch,bank:s.bank,version:VERSION}));}
  catch(e){console.warn('EADI extension paint error:',e);}
 }
}
function make(seat,parent){
 const s=stations[seat];let host=parent.querySelector('[data-eadi-stage1-seat="'+seat+'"]');
 if(!host){
  host=document.createElement('div');host.className='eadi-stage1-host';host.dataset.eadiStage1Seat=seat;host.dataset.eadiVersion=VERSION;
  const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;canvas.className='eadi-stage1-canvas';canvas.setAttribute('aria-label',s.name+' B737 Classic attitude display');canvas.setAttribute('role','img');
  host.appendChild(canvas);parent.appendChild(host);
 }
 Object.assign(host.style,{position:'absolute',left:s.x+'px',top:s.y+'px',width:s.w+'px',height:s.h+'px',overflow:'hidden',borderRadius:'7% / 8%',background:'#080b12',pointerEvents:'none',userSelect:'none',zIndex:'27'});
 const canvas=host.querySelector('canvas');Object.assign(canvas.style,{display:'block',width:'100%',height:'100%',pointerEvents:'none'});
 s.host=host;s.canvas=canvas;render(seat);
}
function mount(){
 const native=document.querySelector('#region-main .region-native');if(!native)return false;
 for(const seat of ['CAPT','FO']){
  if(stations[seat].host?.parentElement!==native){stations[seat].host=null;stations[seat].canvas=null;}
  if(!stations[seat].host)make(seat,native);
 }
 return true;
}
function normalizeSeat(seat){const s=String(seat).toUpperCase();if(s==='CAPTAIN')return 'CAPT';if(s==='FIRST OFFICER'||s==='FIRSTOFFICER')return 'FO';if(!stations[s])throw Error('Unknown EADI seat');return s;}
function setAttitude(seat,pitch,bank){const id=normalizeSeat(seat),s=stations[id];if(!Number.isFinite(pitch)||!Number.isFinite(bank))throw TypeError('Attitude requires numeric degrees');s.pitch=Math.max(-90,Math.min(90,round1(pitch)));s.bank=((bank%360)+540)%360-180;render(id);return {seat:id,pitch:s.pitch,bank:s.bank};}
function setPower(seat,on){const id=normalizeSeat(seat);stations[id].powered=!!on;render(id);return stations[id].powered;}
function registerLayer(seat,id,draw){const key=normalizeSeat(seat);if(!futureSlots.includes(id)||typeof draw!=='function')throw Error('Unregistered EADI slot');hooks[key].set(id,draw);render(key);return ()=>{hooks[key].delete(id);render(key);};}
function snapshot(){return {version:VERSION,mounted:!!stations.CAPT.host?.isConnected&&!!stations.FO.host?.isConnected,stations:Object.fromEntries(Object.entries(stations).map(([k,s])=>[k,{x:s.x,y:s.y,w:s.w,h:s.h,pitch:s.pitch,bank:s.bank,powered:s.powered,source:s.source}])) ,futureSlots:[...futureSlots]};}
const api=Object.freeze({version:VERSION,mount,setAttitude,setPower,registerLayer,snapshot});
root.B737UnifiedEADIStage1=api;
root.addEventListener('b737:cockpit-mounted',mount);
root.addEventListener('b737:engine-indication-view',mount);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);