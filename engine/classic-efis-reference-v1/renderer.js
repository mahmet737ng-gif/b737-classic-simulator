/* Standalone drawing proof for Classic EFIS Reference Engine v1.
 * Provisional geometry, not an OEM pixel match. Missing signals -> blank, never synthetic radar/routes.
 */
(function(root,factory){
  const api=factory(root.ClassicEFISReferenceEngine);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.ClassicEFISReferenceRenderer=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(core){
  "use strict";
  const NS="http://www.w3.org/2000/svg";
  const C={white:"#f7f7f7",green:"#28d878",magenta:"#ee65f9",cyan:"#57dafa",amber:"#f2b34f",red:"#f24947",sky:"#146fc8",earth:"#855223"};
  function node(parent,type,attrs={},value){
    const e=document.createElementNS(NS,type);
    for(const [k,v] of Object.entries(attrs))if(v!==undefined&&v!==null)e.setAttribute(k,String(v));
    if(value!==undefined)e.textContent=String(value);
    parent.appendChild(e);return e;
  }
  const line=(g,x1,y1,x2,y2,color=C.white,w=2)=>node(g,"line",{x1,y1,x2,y2,stroke:color,"stroke-width":w});
  const text=(g,x,y,value,color=C.white,size=15,anchor="middle")=>node(g,"text",{x,y,fill:color,"font-size":size,"font-family":"monospace","text-anchor":anchor},value);
  function has(scene,id){return scene.segments.some(s=>s.id===id&&s.state==="READY");}
  function val(s,key){const a=s.signals?.[key];return a?.valid===true?a.value:null;}
  function rotate(g,deg,cx=300,cy=300){return node(g,"g",{transform:"rotate("+deg+" "+cx+" "+cy+")"});}
  function drawEADI(svg,scene,s){
    const att=val(s,"attitude");
    if(has(scene,"attitude-card")&&att&&Number.isFinite(Number(att.pitch))&&Number.isFinite(Number(att.bank))){
      const defs=node(svg,"defs");const clip=node(defs,"clipPath",{id:"adi-clip"});node(clip,"rect",{x:155,y:142,width:300,height:312,rx:140});
      const g=node(svg,"g",{"clip-path":"url(#adi-clip)"});
      const bg=rotate(g,-Number(att.bank));const move=node(bg,"g",{transform:"translate(0 "+Number(att.pitch)*5+")"});
      node(move,"rect",{x:-600,y:-700,width:1800,height:1000,fill:C.sky});
      node(move,"rect",{x:-600,y:300,width:1800,height:1000,fill:C.earth});
      line(move,-200,300,800,300,C.white,3);
      for(let p=-90;p<=90;p+=5){
        if(p===0)continue;const y=300-p*5,w=p%10===0?51:24;
        line(move,300-w,y,300+w,y,C.white,2);
        if(p%10===0){text(move,232-w/2,y+5,Math.abs(p),C.white,15);text(move,368+w/2,y+5,Math.abs(p),C.white,15);}
      }
      for(const deg of [-60,-45,-30,-20,-10,10,20,30,45,60]){
        const t=deg*Math.PI/180;const r=174;
        line(svg,300+Math.sin(t)*r,300-Math.cos(t)*r,300+Math.sin(t)*(r+13),300-Math.cos(t)*(r+13),C.white,2);
      }
      node(svg,"polygon",{points:"289,128 311,128 300,149",fill:C.white});
      const bank=rotate(svg,-Number(att.bank));
      node(bank,"polygon",{points:"300,137 294,152 306,152",fill:C.white});
      const wing="M190 286 H265 V301 H248 V295 H190 Z";
      node(svg,"path",{d:wing,fill:"#060708",stroke:C.white,"stroke-width":3});
      node(svg,"path",{d:"M410 286 H335 V301 H352 V295 H410 Z",fill:"#060708",stroke:C.white,"stroke-width":3});
      node(svg,"circle",{cx:300,cy:295,r:8,fill:"#060708",stroke:C.white,"stroke-width":3});
    }
    if(has(scene,"fma-at")){const f=val(s,"fma");if(f&&typeof f==="object"){text(svg,90,50,f.at||"",C.green,16);text(svg,300,50,f.pitch||"",C.green,16);text(svg,507,50,f.roll||"",C.green,16);}}
    line(svg,200,61,200,75,C.white,1);line(svg,402,61,402,75,C.white,1);
    if(has(scene,"speed-readout"))text(svg,90,282,Math.round(Number(val(s,"airspeed"))),C.white,22);
    if(has(scene,"mach"))text(svg,90,467,String(val(s,"mach")),C.white,15);
    if(has(scene,"groundspeed"))text(svg,90,495,"GS "+val(s,"groundspeed"),C.white,16);
    if(has(scene,"radio-altitude"))text(svg,510,455,String(Math.round(Number(val(s,"radioAltitude")))),C.white,18);
    if(has(scene,"decision-height"))text(svg,510,480,"DH "+val(s,"decisionHeight"),C.green,15);
    if(has(scene,"localizer")){line(svg,260,514,340,514,C.white,2);text(svg,300,538,"LOC",C.white,14);}
    if(has(scene,"glideslope")){line(svg,483,225,483,365,C.white,2);text(svg,490,211,"GS",C.white,14);}
    if(has(scene,"flight-director")){const f=val(s,"flightDirector");if(f){line(svg,300-Number(f.roll||0)*2,250,300-Number(f.roll||0)*2,350,C.magenta,5);line(svg,238,300+Number(f.pitch||0)*2,362,300+Number(f.pitch||0)*2,C.magenta,5);}}
    if(has(scene,"windshear"))text(svg,300,107,"WINDSHEAR",C.red,27);
    for(const entry of scene.segments.filter(q=>q.category==="failure"&&q.state==="READY")){
      text(svg,300,566,entry.id.replaceAll("-"," ").toUpperCase(),C.amber,13);
    }
  }
  function point(cx,cy,deg,r){const a=(deg-90)*Math.PI/180;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r];}
  function drawEHSI(svg,scene,s){
    const mode=s.mode,arc=["MAP","EXP_NAV","EXP_VOR_ILS"].includes(mode);
    const cx=300,cy=arc?447:290,r=arc?338:213;
    const orient=scene.orientation;
    const ref=scene.referenceDegrees;
    if(ref!==null&&has(scene,"compass-rose")){
      const rose=rotate(svg,-ref,cx,cy);
      for(let h=0;h<360;h+=5){
        const a=point(cx,cy,h,r),b=point(cx,cy,h,r-(h%30===0?16:7));
        line(rose,a[0],a[1],b[0],b[1],C.white,h%30===0?2:1);
        if(h%30===0){const p=point(cx,cy,h,r-36);text(rose,p[0],p[1],({0:"N",90:"E",180:"S",270:"W"})[h]||h/10,C.white,15);}
      }
      if(!arc)node(svg,"circle",{cx,cy,r,fill:"none",stroke:"#929aa0","stroke-width":1});
    }
    const referenceText=orient==="TRUE_NORTH"?"TRU":(orient==="HEADING_UP"?"HDG ":"TRK ")+
      (ref===null?"---":String(Math.round(ref)).padStart(3,"0"))+" M";
    text(svg,300,45,referenceText,C.green,19);
    text(svg,560,45,mode.replaceAll("_"," "),C.cyan,13,"end");
    if(has(scene,"selected-heading-bug")&&ref!==null){
      const delta=(Number(val(s,"selectedHeading"))-ref+360)%360;
      const p=point(cx,cy,delta,r);
      node(svg,"polygon",{points:(p[0]-7)+","+(p[1]-10)+" "+(p[0]+7)+","+(p[1]-10)+" "+p[0]+","+(p[1]+7),fill:"none",stroke:C.magenta,"stroke-width":2});
    }
    if(has(scene,"active-route")&&Array.isArray(val(s,"route")?.points)){
      text(svg,305,101,"ACT ROUTE VALID — GEOMETRY NOT CALIBRATED",C.amber,12);
    }
    if(has(scene,"vor-ils-ident"))text(svg,90,554,String(val(s,"navReceiver")),C.cyan,16);
    if(has(scene,"selected-course"))text(svg,505,550,"CRS "+val(s,"course"),C.magenta,15);
    if(has(scene,"wind-vector"))text(svg,75,60,String(val(s,"wind")),C.white,13);
    if(has(scene,"navigation-failure"))text(svg,300,306,"NAV FLAG",C.amber,23);
    if(has(scene,"heading-failure"))text(svg,300,334,"HDG FLAG",C.amber,23);
    if(has(scene,"aircraft-symbol"))node(svg,"path",{d:"M300 298 l-8 22 l-26 8 v5 l30 -4 v22 h8 v-22 l30 4 v-5 l-26 -8z",stroke:C.white,"stroke-width":1,fill:C.white});
  }
  function render(target,display,input){
    if(!target)throw Error("Missing SVG target");
    if(!core)throw Error("Core engine not loaded");
    const scene=core.compileSeat(display,input);
    const s=core.normalizeSeat(input);
    while(target.firstChild)target.removeChild(target.firstChild);
    target.setAttribute("viewBox","0 0 600 600");
    node(target,"rect",{x:0,y:0,width:600,height:600,fill:"#000"});
    if(s.powered && s.sgValid){
      if(display==="EADI")drawEADI(target,scene,s);
      else drawEHSI(target,scene,s);
    }else if(s.powered&&!s.sgValid){
      text(target,300,300,"SYMBOL GENERATOR INVALID",C.amber,18);
    }
    text(target,300,588,"VISUAL PROTOTYPE — NOT PIXEL VERIFIED",C.amber,12);
    target.setAttribute("aria-label",display+" preliminary Boeing 737 Classic training illustration");
    return scene;
  }
  return Object.freeze({render});
});
