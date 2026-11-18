/* Source-pixel registration of the removable panel hardware. */
(() => {
 'use strict';
 const base=new URL('./tcas-photo/',document.baseURI);
 const url=name=>new URL(name,base).href;
 const api=window.B737UnifiedTcasV1;
 const modes=['TEST','STBY','ALT_OFF','ALT_ON','TA_ONLY','TA_RA'];
 const ranges=[3,5,10,15],filters=['ABOVE','NORM','BELOW'];
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const style=(node,css)=>Object.assign(node.style,css);
 function part(host,tag,x,y,w,h,W,H){
  const n=document.createElement(tag);
  style(n,{position:'absolute',left:100*x/W+'%',top:100*y/H+'%',width:100*w/W+'%',height:100*h/H+'%',boxSizing:'border-box',margin:'0',padding:'0',border:'0',maxWidth:'none'});
  host.append(n);return n;
 }
 function hardware(host,W,H){
  function image(name,x,y,w,h){
   const img=part(host,'img',x-w/2,y-h/2,w,h,W,H);
   img.src=url(name);img.alt='';img.draggable=false;img.style.pointerEvents='none';return img;
  }
  function control(label,x,y,w,h,step,tap){
   const b=part(host,'button',x-w/2,y-h/2,w,h,W,H);
   b.type='button';b.title=label;b.setAttribute('aria-label',label);
   style(b,{background:'transparent',pointerEvents:'auto',touchAction:'none',cursor:'pointer',minWidth:0,minHeight:0});
   let drag=null;
   b.onpointerdown=e=>{e.stopPropagation();b.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,moved:false};};
   b.onpointermove=e=>{
    if(!drag||!step)return;
    const dx=e.clientX-drag.x,dy=drag.y-e.clientY;
    const ticks=Math.trunc((Math.abs(dx)>Math.abs(dy)?dx:dy)/8);
    if(ticks){step(ticks);drag={x:e.clientX,y:e.clientY,moved:true};}
   };
   b.onpointerup=e=>{e.stopPropagation();if(drag&&!drag.moved)(tap||(()=>step(1)))();drag=null;};
   b.onpointercancel=()=>{drag=null;};
   b.onclick=e=>{e.stopPropagation();if(e.detail===0)(tap||(()=>step(1)))();};
   b.onkeydown=e=>{if(step&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();step(['ArrowUp','ArrowRight'].includes(e.key)?1:-1);}};
   b.addEventListener('wheel',e=>{if(step){e.preventDefault();e.stopPropagation();step(e.deltaY<0?1:-1);}},{passive:false});
   return b;
  }
  return {image,control};
 }
 let redraw=()=>{};
 function mount(){
  const frame=document.querySelector('[data-faceplate="transponder-tcas"]');
  if(!frame||frame.dataset.operational)return;
  frame.dataset.operational='true';
  const plate=frame.querySelector('img');plate.src=url('plate.webp');plate.alt='Transponder / TCAS control panel';
  const {image,control}=hardware(frame,1006,394);
  const mode=image('mode.png',215,118,120,120),range=image('range.png',797,118,116,116);
  image('fl.png',797,118,49,49);
  const unit=image('toggle.png',179,309,21,40),band=image('toggle.png',823,309,21,40);
  const fail=image('fail.png',680,104,32,32),ident=image('ident.png',508,309,44,44);
  // Unlit INOP lens retains the engraved lettering.
  const inop=part(frame,'div',786,186,102,55,1006,394);
  style(inop,{background:'#12141a',borderRadius:'10%',pointerEvents:'none'});
  const rotors=[];
  const change=(key,value)=>api.configure({[key]:value});
  function selector(key,values){return d=>{
   const i=values.indexOf(api.getControls()[key]);change(key,values[clamp(i+d,0,values.length-1)]);
  };}
  control('Transponder mode',215,118,113,113,selector('mode',modes));
  control('TCAS range',797,118,113,113,selector('rangeNm',ranges));
  control('FL · absolute altitude',797,118,49,49,null,()=>api.absolute());
  const labels=(key,values,positions,width,height)=>positions.forEach(([x,y],i)=>
   control(String(values[i]).replaceAll('_',' '),x,y,width,height,null,()=>change(key,values[i])));
  labels('mode',modes,[[124,118],[133,68],[161,26],[259,26],[285,69],[307,119]],65,30);
  labels('rangeNm',ranges,[[735,69],[768,37],[818,37],[860,68]],34,32);
  control('ATC 1 / 2',179,309,52,52,null,()=>change('unit',3-api.getControls().unit));
  labels('unit',[1,2],[[179,264],[179,356]],42,30);
  control('Altitude band',823,309,54,49,selector('filter',filters),()=>change('filter',filters[(filters.indexOf(api.getControls().filter)+1)%3]));
  labels('filter',filters,[[823,260],[895,309],[823,357]],72,30);
  control('ATC IDENT',508,309,52,52,null,()=>api.ident());
  for(const [pair,x] of [353,660].entries()){
   for(const [ring,size] of [148,93].entries()){
    const index=pair*2+ring;
    rotors.push(image(ring?'inner.png':'outer.png',x,292,size,size));
    control('Squawk digit '+(index+1),x,292,size,size,d=>{
     const digits=api.getControls().code.split('');
     digits[index]=String(((Number(digits[index])+d)%8+8)%8);change('code',digits.join(''));
    }).style.borderRadius='50%';
   }
  }
  const lcd=part(frame,'canvas',402,40,205,125,1006,394);lcd.width=205;lcd.height=125;
  const g=lcd.getContext('2d');
  const glyph=new Image(),legend=new Image();glyph.onload=legend.onload=()=>redraw();glyph.src=url('segments.png');legend.src=url('legends.png');
  const segments=[[4,0,27,9],[25,4,10,22],[25,31,10,22],[4,47,27,9],[0,31,10,22],[0,4,10,22],[4,23,27,9]];
  const masks=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg'];
  redraw=()=>{
   const c=api.getControls(),state=api.getState(),xp=state.transponder;
   const mi=modes.indexOf(c.mode),ri=ranges.indexOf(c.rangeNm);
   mode.style.transform='rotate('+([-180,-149,-108,-66,-32,0][mi]+139)+'deg)';
   range.style.transform='rotate('+([-141,-109,-75,-37][ri]+109)+'deg)';
   unit.style.transform='rotate('+(c.unit===1?180:0)+'deg)';
   band.style.transform=c.filter==='NORM'?'scaleY(.56)':'rotate('+(c.filter==='ABOVE'?180:0)+'deg)';
   inop.style.opacity=xp?.powered&&(state.mode==='FAIL'||state.mode==='TEST')?'0':'.62';
   fail.style.filter=xp?.powered&&xp.atcFailLight?'':'brightness(.22)';
   ident.style.filter=xp?.ident?'brightness(.65)':'';
   rotors.forEach((img,i)=>img.style.transform='rotate('+Number(c.code[i])*45+'deg)');
   g.fillStyle='#26151e';g.fillRect(0,0,205,125);
   if(!xp?.powered)return;
   if(legend.naturalWidth){
    g.drawImage(legend,0,0,59,22,9,9,59,22);
    if(xp.test)g.drawImage(legend,64,0,32,22,72,9,32,22);
    else {const sx=c.unit===1?64:77;g.drawImage(legend,sx,0,16,22,74,9,16,22);}
    if(xp.test||xp.ident&&xp.modeS)g.drawImage(legend,149,0,19,22,167,9,19,22);
   }
   if(glyph.naturalWidth)[...xp.displayedCode].forEach((n,i)=>{
    for(const ch of masks[Number(n)]){const [x,y,w,h]=segments[ch.charCodeAt(0)-97];g.drawImage(glyph,x,y,w,h,12+46*i+x,57+y,w,h);}
   });
   frame.dataset.atcCode=xp.displayedCode;
  };
  redraw();
 }
 window.B737TcasPhotoHardware={hardware,part,url};
 window.addEventListener('b737:pedestal-faceplates-mounted',mount);
 window.addEventListener('b737:tcas-state',()=>redraw());
 mount();
})();
