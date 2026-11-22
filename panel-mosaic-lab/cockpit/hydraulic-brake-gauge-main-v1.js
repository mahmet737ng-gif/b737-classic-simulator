/* B737 Classic frontal FO brake accumulator gauge.
 * FCOM gauge display 0..4 x1000 PSI; calibrated physical photo pivot
 * 473,568 on FO-INNER 918x1713. OH17 lab is an EDUCATIONAL model,
 * not the certified hydraulic ECU; its output is the only numeric source.
 */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document)api.mount(root);
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const CAL={cx:473,cy:568,r:85,width:918,height:1713};
 const DETENTS=Object.freeze([[0,110],[1000,180],[2000,269],[3000,358],[4000,425]]
  .map(([psi,angle])=>Object.freeze({psi,angle})));
 const NS='http://www.w3.org/2000/svg';
 const polar=(a,r)=>[CAL.cx+r*Math.sin(a*Math.PI/180),CAL.cy-r*Math.cos(a*Math.PI/180)];
 function angle(psi){
  if(!Number.isFinite(psi))return null;
  const v=Math.max(0,Math.min(4000,psi));
  for(let i=1;i<DETENTS.length;i++){
   const a=DETENTS[i-1],b=DETENTS[i];
   if(v<=b.psi)return a.angle+(b.angle-a.angle)*(v-a.psi)/(b.psi-a.psi);
  }
  return DETENTS.at(-1).angle;
 }
 function mount(win){
  const doc=win.document;
  let canvas=null,rotor=null,flag=null,tip=null,pressure=undefined,updates=0;
  const E=(parent,tag,attrs={},val)=>{
   const n=doc.createElementNS(NS,tag);
   for(const [key,v]of Object.entries(attrs))n.setAttribute(key,String(v));
   if(val!==undefined)n.textContent=String(val);parent.append(n);return n;
  };
  function create(){
   const piece=doc.querySelector('#region-main .texture-piece[data-piece="fo-inner"]');
   if(!piece)return false;
   if(canvas?.parentNode===piece)return true;
   canvas?.remove();
   canvas=E(piece,'svg',{viewBox:'0 0 918 1713','data-brake-gauge-main':'FRONTAL-0001',
    role:'img','aria-label':'Hydraulic brake accumulator pressure'});
   Object.assign(canvas.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',
    overflow:'hidden',pointerEvents:'none',zIndex:'7'});
   E(canvas,'circle',{cx:CAL.cx,cy:CAL.cy,r:89,fill:'#111916',stroke:'#b4bdb3','stroke-width':4});
   E(canvas,'circle',{cx:CAL.cx,cy:CAL.cy,r:81,fill:'#07100f',stroke:'#47584d','stroke-width':2});
   E(canvas,'text',{x:CAL.cx,y:CAL.cy-31,'text-anchor':'middle','font-size':11,fill:'#e5e8d9'},'HYD BRAKE');
   E(canvas,'text',{x:CAL.cx,y:CAL.cy-18,'text-anchor':'middle','font-size':10,fill:'#e5e8d9'},'PRESS');
   E(canvas,'text',{x:CAL.cx,y:CAL.cy+40,'text-anchor':'middle','font-size':10,fill:'#c4c9c0'},'PSI × 1000');
   for(let j=0;j<=16;j++){
    const a=angle(j*250),major=j%4===0;
    const p1=polar(a,major?60:67),p2=polar(a,77);
    E(canvas,'line',{x1:p1[0],y1:p1[1],x2:p2[0],y2:p2[1],
     stroke:major?'#f0ecde':'#a2ada5','stroke-width':major?2.3:1});
   }
   for(const d of DETENTS){
    const p=polar(d.angle,46);
    E(canvas,'text',{x:p[0],y:p[1]+5,'text-anchor':'middle',
     'font-family':'Arial, sans-serif','font-size':15,'font-weight':'bold',
     fill:'#edecda'},d.psi/1000);
   }
   rotor=E(canvas,'g',{'data-brake-needle':'true'});
   const c=CAL.cx,z=CAL.cy;
   E(rotor,'path',{d:'M '+(c-3)+' '+(z+12)+' L '+c+' '+(z-68)+' L '+(c+3)+' '+(z+12)+' Z',
    fill:'#f0f0d4',stroke:'#121c15','stroke-width':1});
   E(canvas,'circle',{cx:c,cy:z,r:8,fill:'#b9c3b9',stroke:'#374439','stroke-width':2});
   flag=E(canvas,'text',{x:c,y:z+4,'text-anchor':'middle','font-size':17,
    fill:'#ffbe6b',visibility:'hidden'},'--');
   tip=E(canvas,'title',{});
   pressure=undefined;return true;
  }
  function source(){
   const output=win.B737HydraulicLabV1?.getOutput?.();
   const n=output?.indications?.['fo.hyd_brake_pressure'];
   return Number.isFinite(n)?n:null;
  }
  function update(){
   if(!create())return null;
   const n=source();
   if(n===pressure)return n;
   pressure=n;updates++;
   if(n===null){
    rotor.setAttribute('visibility','hidden');flag.setAttribute('visibility','visible');
    tip.textContent='Brake pressure sensor invalid';
   }else{
    rotor.setAttribute('visibility','visible');flag.setAttribute('visibility','hidden');
    rotor.setAttribute('transform','rotate('+angle(n)+' '+CAL.cx+' '+CAL.cy+')');
    tip.textContent='Brake pressure '+Math.round(n)+' PSI, OH17 hydraulic training model';
   }
   canvas.dataset.pressurePsi=n===null?'INVALID':String(Math.round(n));
   return n;
  }
  function applyBrake(count=1){
   if(!Number.isInteger(count)||count<1||count>12)throw Error('Invalid brake press count');
   const core=win.B737HydraulicLabV1;
   if(!core?.command)throw Error('OH17 hydraulic core unavailable');
   core.command({type:'BRAKE',count});return update();
  }
  win.addEventListener('b737:cockpit-mounted',update);
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',update,{once:true});
  else update();
  const interval=win.setInterval(update,250);
  const api=Object.freeze({version:'BRAKE-FRONTAL-0001',update,applyBrake,
   getState:()=>({mounted:!!canvas?.isConnected,pressurePsi:pressure,updates,
    source:'OH17_HYDRAULIC_TRAINING_LAB'}),stop:()=>win.clearInterval(interval)});
  win.B737BrakePressureGaugeMainV1=api;return api;
 }
 return Object.freeze({CAL,DETENTS,angle,polar,mount});
});
