/* Source-aware vector construction; no copyrighted cockpit images embedded.
 * Training-only renderer. Geometric registration against aircraft reference PENDING.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.EFISDisplayLabEadi=api;})(typeof globalThis==='object'?globalThis:null,function(){
'use strict';
const W=640,H=640,WHITE='#f2f5fb',GREEN='#3be171',MAGENTA='#f04ef0',AMBER='#ffcc54',RED='#fa4853';
function line(c,x1,y1,x2,y2,color=WHITE,w=2){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineWidth=w;c.strokeStyle=color;c.stroke()}
function txt(c,s,x,y,size=15,color=WHITE,align='left'){c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.font=`500 ${size}px "Lucida Console",Consolas,monospace`;c.fillText(s,x,y)}
function path(c,points,fill,outline=WHITE){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(outline){c.lineWidth=2;c.strokeStyle=outline;c.stroke()}}
function ovalAperture(c){c.beginPath();c.moveTo(165,292);c.bezierCurveTo(165,214,236,141,324,141);c.bezierCurveTo(413,141,487,215,487,292);c.lineTo(487,413);c.bezierCurveTo(487,490,413,521,324,521);c.bezierCurveTo(236,521,165,486,165,413);c.closePath();}
function drawAtt(c,e,v){
 const cx=324,cy=344,scale=5.8,bank=e.bank*Math.PI/180,pitch=e.pitch*scale;
 c.save();ovalAperture(c);c.clip();c.translate(cx,cy);c.rotate(-bank);
 c.fillStyle='#1457b5';c.fillRect(-1800,-2000,3600,2000+pitch);
 c.fillStyle='#85551b';c.fillRect(-1800,pitch,3600,2300);
 line(c,-1800,pitch,1800,pitch,WHITE,3);
 for(let deg=-90;deg<=90;deg+=2.5){
  if(deg===0)continue;let yy=pitch-deg*scale,abs=Math.abs(deg);
  const major=abs%10===0,medium=abs%5===0;
  let width=major?60:medium?32:15;
  line(c,-width,yy,width,yy,WHITE,major?2.7:1.8);
  if(major){txt(c,String(abs),-width-12,yy,16,WHITE,'right');txt(c,String(abs),width+12,yy,16);}
 }
 if(v.fd){line(c,-97, e.fdPitch*-scale+0,97,e.fdPitch*-scale,MAGENTA,5);line(c,(e.fdRoll)*4,-101,e.fdRoll*4,101,MAGENTA,5)}
 // TCAS red forbidden guidance area: illustrative width pending pixel validation.
 if(e.tcas==='UP'){c.fillStyle='rgba(241,56,70,.75)';c.fillRect(-122,41,244,75)}
 if(e.tcas==='DOWN'){c.fillStyle='rgba(241,56,70,.75)';c.fillRect(-122,-117,244,75)}
 c.restore();
 // Pointer attached to rolling attitude card; outer fixed triangle.
 c.save();c.translate(cx,344);c.rotate(-bank);path(c,[[-9,-211],[9,-211],[0,-230]],WHITE,null);c.restore();
 const reference=c=>{c.save();c.translate(cx,cy);for(const side of [-1,1]){c.save();c.scale(side,1);path(c,[[41,-9],[110,-9],[110,2],[54,2],[54,27],[41,27]],'#05080a',WHITE);c.restore()}c.beginPath();c.arc(0,0,8,0,2*Math.PI);c.fillStyle='#030608';c.fill();c.strokeStyle=WHITE;c.lineWidth=2.3;c.stroke();c.restore()};
 reference(c);
 // Bank scale fixed: 0 10 20 30 45 60.
 for(const a of [-60,-45,-30,-20,-10,0,10,20,30,45,60]){let rad=a*Math.PI/180,r=207;
 let x1=cx+Math.sin(rad)*r,y1=344-Math.cos(rad)*r;
 let r2=r+(Math.abs(a)%30===0?17:10);line(c,x1,y1,cx+Math.sin(rad)*r2,344-Math.cos(rad)*r2,WHITE,2.5)}
 path(c,[[cx-10,111],[cx+10,111],[cx,131]],WHITE,null);
 // Inclinometer (simulated bank slip) and curved slot.
 c.beginPath();c.arc(324,602,26,.15*Math.PI,.85*Math.PI);c.strokeStyle=WHITE;c.lineWidth=2;c.stroke();
 c.beginPath();c.arc(324+e.slip*2.4,623,8,0,2*Math.PI);c.fillStyle='#050607';c.fill();c.strokeStyle=WHITE;c.stroke();
}
function drawTape(c,e,v){
 const x0=18,x1=150,t=165,b=511,m=(t+b)/2,px=3.5;
 line(c,x1,t,x1,b,'#ffffff9f',1);
 if(!v.ias){txt(c,'SPD',71,338,23,AMBER,'center');return}
 for(let kt=Math.floor((e.ias-65)/10)*10;kt<=e.ias+65;kt+=10){if(kt<0)continue;let y=m-(kt-e.ias)*px;if(y<t||y>b)continue;
  line(c,x1-(kt%20===0?12:7),y,x1,y,WHITE,1.7);
  if(kt%20===0)txt(c,String(kt),x1-19,y,18,WHITE,'right')}
 c.fillStyle='#0a0b11';c.strokeStyle=WHITE;c.lineWidth=2;c.fillRect(54,m-21,91,42);c.strokeRect(54,m-21,91,42);
 txt(c,String(Math.round(e.ias)),126,m,24,WHITE,'right');
 const sy=m-(e.selectedSpeed-e.ias)*px;if(sy>t&&sy<b){line(c,137,sy,154,sy,MAGENTA,3);path(c,[[154,sy],[164,sy-8],[164,sy+8]],MAGENTA,null);}
 txt(c,'GS '+Math.round(e.groundSpeed),18,550,15,WHITE);
 if(v.mach)txt(c,'.'+Math.round(e.mach*1000).toString().padStart(3,'0'),18,576,19,WHITE);
}
function drawIls(c,e,v){
 const x=563,ym=349; for(let i=-2;i<=2;i++){c.beginPath();c.arc(x,ym+i*27,2.8,0,Math.PI*2);c.fillStyle=WHITE;c.fill()}
 if(v.gs){path(c,[[x-9,ym+e.gsDev*27],[x,ym-7+e.gsDev*27],[x+9,ym+e.gsDev*27],[x,ym+7+e.gsDev*27]],MAGENTA,null);}
 else if(!v.gs)txt(c,'G/S',550,266,16,AMBER,'center');
 const yc=549;for(let i=-2;i<=2;i++){c.beginPath();c.arc(324+i*32,yc,2.8,0,2*Math.PI);c.fillStyle=WHITE;c.fill()}
 if(v.loc)path(c,[[324+e.locDev*32-9,yc],[324+e.locDev*32,yc-7],[324+e.locDev*32+9,yc],[324+e.locDev*32,yc+7]],MAGENTA,null);
 else txt(c,'LOC',324,548,17,AMBER,'center');
 if(v.ra){txt(c,'DH '+e.dh,480,571,15,GREEN);txt(c,String(Math.max(0,Math.round(e.radioAlt))),568,596,28,v.raColor,'right');}
 else txt(c,'RA',552,593,20,AMBER,'center');
 if(v.runway){let rise= Math.min(1,(200-e.radioAlt)/200)*66;line(c,298,509-rise,350,509-rise,GREEN,4);line(c,324,509-rise,324,517-rise,GREEN,2)}
}
function render(canvas,state,core){
 if(!canvas)return;const c=canvas.getContext('2d');const e=state.eadi,v=core.evaluate(state);if(canvas.width!==W)canvas.width=W;if(canvas.height!==H)canvas.height=H;
 c.fillStyle='#030508';c.fillRect(0,0,W,H);
 // Black when no power; no source/flight data invented.
 if(!v.powered)return;
 if(!v.sg){txt(c,'S G FAIL',W/2,H/2,29,AMBER,'center');return}
 // FMA four fields — manually injected, not an AFDS solver.
 line(c,8,82,632,82,'#aeb7c3',1);for(const x of [160,320,480])line(c,x,17,x,80,WHITE,1.8);
 const f=[e.at,e.pitchMode,e.rollMode,e.afds];f.forEach((mode,i)=>txt(c,String(mode||''),80+i*160,43,mode==='ARM'?14:17,mode==='ARM'?WHITE:GREEN,'center'));
 if(v.attitude)drawAtt(c,e,v);else txt(c,'ATT',324,350,28,AMBER,'center');
 drawTape(c,e,v);drawIls(c,e,v);
 if(e.pli&&v.attitude){for(let i=0;i<7;i++)line(c,286+i*10,166+(i%2)*3,293+i*10,157+(i%2)*3,AMBER,3)}
 if(e.windshear)txt(c,'WINDSHEAR',324,452,23,RED,'center');
 if(e.pullup)txt(c,'PULL UP',324,475,23,RED,'center');
 if(e.tcas!=='OFF')txt(c,'TCAS RA '+e.tcas,325,504,13,RED,'center');
 // Exposed failure flags, do not imply all aircraft flags are implemented.
 v.flags.forEach((flag,i)=>txt(c,flag,484,105+i*25,15,AMBER));
 txt(c,'TRAINING / INJECTED DATA',320,632,11,'#79889a','center');
}
return {render};
});
