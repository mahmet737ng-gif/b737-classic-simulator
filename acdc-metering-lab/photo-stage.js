/* OH-10 P5-13 photo-based trainer / native pixel calibration.
 * LOCK: never edit the immutable user artwork; control overlays are independent DOM.
 * Geometries are unapproved estimates pending source-photo coordinate audit.
 */
(function(){
"use strict";
var SVG="http://www.w3.org/2000/svg",W=1095,H=1436;
var E=window.B737ElectricalV7;
var $=function(id){return document.getElementById(id);};
var STORAGE="b737-oh10-photo-geometry-v1";
var initial={
 dcAmps:{x:305,y:213,r:147,type:"meter"},
 cpsFreq:{x:786,y:213,r:147,type:"meter"},
 dcVolts:{x:305,y:552,r:147,type:"meter"},
 acVolts:{x:786,y:552,r:147,type:"meter"},
 dcSelector:{x:306,y:1029,r:84,type:"rotary"},
 acSelector:{x:783,y:1029,r:84,type:"rotary"},
 battery:{x:480,y:1295,r:51,type:"toggle"},
 galley:{x:727,y:1299,r:38,type:"toggle"},
 residual:{x:894,y:1299,r:39,type:"momentary"}
};
var state={geometry:JSON.parse(JSON.stringify(initial)),selected:"dcAmps",calibration:false,scale:.70,faces:true,overlay:true,showMarkers:false,sourceOK:false};
var dcOptions=["STBY PWR","BAT BUS","BAT","TR1","TR2","TR3","TEST"];
var acOptions=["STBY PWR","GRD PWR","GEN1","APU GEN","GEN2","INV","TEST"];
var sim={model:null,mode:"engines",dc:"BAT",ac:"GEN1",galley:true,resid:false};
function log(line){var p=$("events");if(!p)return;var stamp=new Date().toLocaleTimeString();p.textContent="["+stamp+"] "+line+"\n"+p.textContent.slice(0,1600);}
function status(msg,ok){var e=$("status");e.textContent=msg;e.classList.toggle("ok",!!ok);}
function safeStore(){try{localStorage.setItem(STORAGE,JSON.stringify(state.geometry));}catch(err){log("Local storage unavailable: "+err.message);}}
function goodGeom(raw){if(!raw||typeof raw!=="object")return false;return Object.keys(initial).every(function(k){var p=raw[k];return p&&Number.isFinite(+p.x)&&Number.isFinite(+p.y)&&Number.isFinite(+p.r)&&+p.r>4&&+p.r<300&&+p.x>=0&&+p.x<=W&&+p.y>=0&&+p.y<=H;});}
function useGeometry(raw){if(!goodGeom(raw))return false;Object.keys(initial).forEach(function(k){var p=raw[k];state.geometry[k]={x:+p.x,y:+p.y,r:+p.r,type:initial[k].type};});return true;}
function geoExport(){return JSON.stringify({schema:"b737.p5-13.photo-stage.geometry.v1",source:{path:"../panel-mosaic-lab/assets/locked/2026-10-23/OH10-ELEC-LOSSLESS-9a1ca4d6cfb2.png",width:W,height:H,sha256:"9a1ca4d6cfb277ec1404f3a464e957d81be9d9689a0810883364342d57b0f1ea"},markers:state.geometry,status:"PROVISIONAL_NOT_APPROVED",unifiedMountAllowed:false},null,2);}
function setupElectrical(mode){
 sim.mode=mode;sim.model=E.initialState();sim.dc="BAT";sim.ac="GEN1";sim.resid=false;sim.galley=true;
 function set(k,v){sim.model=E.apply(sim.model,{type:"CONTROL",key:k,value:v});}
 set("engine1Running",false);set("engine2Running",false);
 if(mode==="dark")set("batterySwitch",false);
 if(mode==="ground"){set("groundPowerAttached",true);sim.model=E.apply(sim.model,{type:"SELECT_SOURCE",source:"EXT",side:1});sim.model=E.apply(sim.model,{type:"SELECT_SOURCE",source:"EXT",side:2});sim.ac="GRD PWR";}
 if(mode==="engines"){set("engine1Running",true);set("engine2Running",true);}
 document.querySelectorAll("[data-mode]").forEach(function(b){b.classList.toggle("active",b.dataset.mode===mode);});
 render();
}
function meterData(){
 var r=E.evaluate(sim.model),b=r.bus,t=r.feed.tr;
 function numeric(x){return x===null?null:Math.round(x);}
 var amps=null,dcv=null,freq=null,acv=null;
 switch(sim.dc){
 case "TR1":amps=t.TR1?22:0;dcv=b.dc1===null?null:b.dc1?28:0;break;
 case "TR2":amps=t.TR2?22:0;dcv=b.dc2===null?null:b.dc2?28:0;break;
 case "TR3":amps=t.TR3?12:0;dcv=t.TR3?28:0;break;
 case "BAT":amps=b.hotBattery?(t.TR3?0:-7):0;dcv=b.hotBattery?24:0;break;
 case "BAT BUS":dcv=b.battery?28:0;amps=null;break;
 case "STBY PWR":dcv=b.dcStandby===null?null:b.dcStandby?28:0;amps=null;break;
 }
 var powered=false;
 switch(sim.ac){
 case "GEN1":powered=r.source[1]==="GEN1";break;
 case "GEN2":powered=r.source[2]==="GEN2";break;
 case "APU GEN":powered=Object.values(r.source).includes("APU");break;
 case "GRD PWR":powered=Object.values(r.source).includes("EXT");break;
 case "STBY PWR":powered=b.acStandby===true;break;
 case "INV":powered=b.acStandby===true&&r.feed.standbyFeed.indexOf("BATTERY")>=0;break;
 }
 if(sim.ac!=="TEST"){freq=powered?400:0;acv=powered?115:0;}
 var warning="";
 if(sim.resid){
  if(sim.ac!=="GEN1"&&sim.ac!=="GEN2")warning="RESID VOLTS: first select GEN1 or GEN2; the TEST reading is not available.";
  else if(powered)warning="RESID VOLTS inhibited: selected generator is on bus. This test needs the GCR opened (manual warns of damage).";
  else{acv=sim.model.config["engine"+(sim.ac==="GEN1"?1:2)+"Running"]?4:0;warning="Residual volts — demo only; 0–30 V interpretation.";}
 }
 return {dcAmps:numeric(amps),dcVolts:numeric(dcv),cpsFreq:numeric(freq),acVolts:numeric(acv),residualScale:sim.resid&&warning.indexOf("Residual volts —")==0,warning:warning,electrical:r};
}
function e(tag,attrs,children){var el=document.createElementNS(SVG,tag);Object.keys(attrs||{}).forEach(function(k){el.setAttribute(k,String(attrs[k]));});if(children!=null)el.innerHTML=children;return el;}
function polar(a,rad){return {x:Math.sin(a*Math.PI/180)*rad,y:-Math.cos(a*Math.PI/180)*rad};}
function angle(v,min,max){
 if(v==null)return -75;
 return -75+150*Math.max(0,Math.min(1,(v-min)/(max-min)));
}
function dialScale(min,max,labels){
 var g=e("g",{});
 for(var i=0;i<=20;i++){
  var a=-75+150*i/20, p1=polar(a,i%5===0?87:96),p2=polar(a,108);
  g.appendChild(e("line",{x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y,stroke:"#e8e7d9","stroke-width":i%5===0?3.2:1.4}));
 }
 labels.forEach(function(v){
  var p=polar(angle(v,min,max),74);
  g.appendChild(e("text",{x:p.x,y:p.y+6,"text-anchor":"middle","font-size":17,"font-weight":"bold",fill:"#e9e7e0","font-family":"Arial"},String(v)));
 });
 return g;
}
var meterDefs={
 dcAmps:{title:"DC AMPS",min:-50,max:50,labels:[-50,0,50]},
 cpsFreq:{title:"CPS FREQ",min:360,max:420,labels:[360,400,420]},
 dcVolts:{title:"DC VOLTS",min:0,max:40,labels:[0,20,40]},
 acVolts:{title:"AC VOLTS",min:100,max:130,labels:[100,110,120,130]}
};
function meter(id,data){
 var p=state.geometry[id],def=meterDefs[id],base=e("g",{transform:"translate("+p.x+" "+p.y+") scale("+(p.r/130)+")","data-part":id,"class":"control"});
 if(state.faces){
  base.appendChild(e("circle",{r:126,fill:"url(#bezel)",stroke:"#262e31","stroke-width":5}));
  base.appendChild(e("circle",{r:118,fill:"#676c70",stroke:"#afb0a9","stroke-width":3}));
  base.appendChild(e("path",{d:"M -117 0 A 117 117 0 0 1 117 0 L -117 0 Z",fill:"#181b1d"}));
  base.appendChild(dialScale(def.min,def.max,def.labels));
  base.appendChild(e("text",{x:0,y:45,fill:"#e7e4d8","text-anchor":"middle","font-size":"20","font-family":"Arial","font-weight":"bold"},def.title));
 }
 if(state.overlay){
  var val=data[id],isResid=id==="acVolts"&&data.residualScale;
  var ang=isResid?angle(val,0,30):angle(val,def.min,def.max);
  var needle=e("g",{transform:"rotate("+ang+")"});
  needle.appendChild(e("path",{d:"M -5 12 L -4 -98 Q 0 -114 4 -98 L 5 12 Z",fill:"#e9ebdc",stroke:"#181b1c","stroke-width":"2"}));
  base.appendChild(needle);
  base.appendChild(e("circle",{r:9,fill:"url(#silver)",stroke:"#2b3031","stroke-width":3}));
 }
 base.appendChild(e("circle",{r:130,class:"hit"}));
 return base;
}
function rotary(id,value,options){
 var p=state.geometry[id],g=e("g",{transform:"translate("+p.x+" "+p.y+") scale("+(p.r/77)+")","data-part":id,class:"control"});
 if(state.overlay){
  var a=-127+254*options.indexOf(value)/(options.length-1);
  g.appendChild(e("circle",{r:70,fill:"#292e30",stroke:"#979f9f","stroke-width":6}));
  var k=e("g",{transform:"rotate("+a+")"});
  k.appendChild(e("circle",{r:57,fill:"url(#silver)",stroke:"#3d4140","stroke-width":3}));
  k.appendChild(e("path",{d:"M -17 38 L -16 -32 Q -14 -50 0 -53 Q 14 -50 16 -32 L 17 38 Q 0 44 -17 38Z",fill:"url(#lever)",stroke:"#333938","stroke-width":2}));
  k.appendChild(e("path",{d:"M 0 -48 L 0 -20",stroke:"#202528","stroke-width":6,"stroke-linecap":"round"}));
  g.appendChild(k);
 }
 g.appendChild(e("circle",{r:77,class:"hit"}));
 return g;
}
function toggle(id,on){
 var p=state.geometry[id],g=e("g",{transform:"translate("+p.x+" "+p.y+") scale("+(p.r/45)+")","data-part":id,class:"control"});
 if(state.overlay){
  if(id==="battery"){
   g.appendChild(e("rect",{x:-31,y:-50,width:62,height:100,rx:5,fill:"#16191a",stroke:"#8f9693","stroke-width":3}));
   g.appendChild(e("rect",{x:-18,y:on?5:-36,width:36,height:33,rx:3,fill:"url(#lever)",stroke:"#282c2b","stroke-width":2}));
  }else{
   g.appendChild(e("circle",{r:31,fill:"#282d2f",stroke:"#9b9f9b","stroke-width":4}));
   g.appendChild(e("path",{d:on?"M 0 4 L 0 31":"M 0 -4 L 0 -31",stroke:"#dedbd2","stroke-width":13,"stroke-linecap":"round"}));
  }
 }
 g.appendChild(e("circle",{r:47,class:"hit"}));
 return g;
}
function residual(){
 var p=state.geometry.residual,g=e("g",{transform:"translate("+p.x+" "+p.y+") scale("+(p.r/35)+")","data-part":"residual",class:"control"});
 if(state.overlay){
  g.appendChild(e("circle",{r:31,fill:"#a7aaa5",stroke:"#2d3335","stroke-width":5}));
  g.appendChild(e("circle",{r:sim.resid?19:24,fill:"#14181b",stroke:"#444a49","stroke-width":4}));
 }
 g.appendChild(e("circle",{r:39,class:"hit"}));return g;
}
function showMarkers(){
 var g=$("calibration");g.replaceChildren();if(!state.calibration&&!state.showMarkers)return;
 Object.keys(state.geometry).forEach(function(id){
  var p=state.geometry[id],m=e("g",{transform:"translate("+p.x+" "+p.y+")","data-marker":id,class:"calibration-marker",tabindex:"0",role:"button","aria-label":"Move "+id+" calibration marker"});
  m.appendChild(e("circle",{r:20,fill:"#121c2888"}));
  m.appendChild(e("path",{d:"M -37 0 H 37 M 0 -37 V 37",class:"marker-cross"}));
  m.appendChild(e("text",{x:27,y:-25},id));
  if(id===state.selected)m.appendChild(e("circle",{r:p.r,fill:"none",stroke:"#f9e99b","stroke-dasharray":"7 7","stroke-width":2,"vector-effect":"non-scaling-stroke","pointer-events":"none"}));
  g.appendChild(m);
 });
}
function drawCoords(){
 $("coordrows").replaceChildren();
 Object.keys(state.geometry).forEach(function(id){
  var p=state.geometry[id],tr=document.createElement("tr");tr.innerHTML="<td>"+id+"</td>";
  ["x","y","r"].forEach(function(k){
   var td=document.createElement("td"),inp=document.createElement("input");
   inp.type="number";inp.step=".5";inp.value=p[k].toFixed(1);
   inp.setAttribute("aria-label",id+" "+k+" pixels");
   inp.addEventListener("focus",function(){state.selected=id;showMarkers();$("selected").textContent=id;});
   inp.addEventListener("change",function(){
    var v=Number(inp.value);
    if(!Number.isFinite(v)){inp.value=p[k];return;}
    p[k]=Math.max(k==="r"?5:0,Math.min(k==="x"?W:k==="y"?H:290,v));
    safeStore();render();
   });
   td.appendChild(inp);tr.appendChild(td);
  });
  $("coordrows").appendChild(tr);
 });
 $("selected").textContent=state.selected;
}
function render(){
 if(!sim.model)return;
 var data=meterData(),g=$("artwork");
 g.replaceChildren();
 ["dcAmps","cpsFreq","dcVolts","acVolts"].forEach(function(id){g.appendChild(meter(id,data));});
 g.appendChild(rotary("dcSelector",sim.dc,dcOptions));
 g.appendChild(rotary("acSelector",sim.ac,acOptions));
 g.appendChild(toggle("battery",sim.model.config.batterySwitch));
 g.appendChild(toggle("galley",sim.galley));
 g.appendChild(residual());
 showMarkers();drawCoords();
 ["dcAmps","cpsFreq","dcVolts","acVolts"].forEach(function(id){
  var out={"dcAmps":"dcamps","cpsFreq":"freq","dcVolts":"dcvolts","acVolts":"acvolts"}[id];
  $(out).textContent=data[id]===null?"—":data[id].toFixed(0);
 });
 $("selectorstate").textContent="DC: "+sim.dc+" | AC: "+sim.ac+" | BAT: "+(sim.model.config.batterySwitch?"ON":"OFF");
 $("genfail").classList.toggle("active",sim.model.faults.GEN1_FAILED);
 $("trfail").classList.toggle("active",sim.model.faults.TR1_FAILED);
 if(data.warning)status(data.warning,false);
 else if(data.electrical.qa.length)status("Electrical V7 source caveat: "+data.electrical.qa.map(function(x){return x.id;}).join(", "),false);
 else status("Prototype electrical indications are live. Geometry remains unverified.",true);
}
function zoomSet(z){
 state.scale=Math.max(.3,Math.min(2.5,Math.round(z*20)/20));
 $("zoom").value=Math.round(state.scale*100);$("zoomlabel").textContent=Math.round(state.scale*100)+"%";
 $("board").setAttribute("width",String(Math.round(W*state.scale)));
 $("board").setAttribute("height",String(Math.round(H*state.scale)));
}
function pointFromEvent(ev){
 var svg=$("board"),pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;
 var matrix=svg.getScreenCTM();return matrix?pt.matrixTransform(matrix.inverse()):{x:0,y:0};
}
var dragging=null,moved=false;
$("calibration").addEventListener("pointerdown",function(ev){
 if(!state.calibration)return;
 var t=ev.target.closest("[data-marker]");if(!t)return;
 var id=t.getAttribute("data-marker"),pt=pointFromEvent(ev);
 state.selected=id;dragging={id:id,dx:pt.x-state.geometry[id].x,dy:pt.y-state.geometry[id].y};
 moved=false;$("board").setPointerCapture(ev.pointerId);ev.preventDefault();$("selected").textContent=id;showMarkers();
});
$("board").addEventListener("pointermove",function(ev){
 if(!dragging)return;
 var p=pointFromEvent(ev),v=state.geometry[dragging.id];
 v.x=Math.max(0,Math.min(W,Math.round((p.x-dragging.dx)*2)/2));
 v.y=Math.max(0,Math.min(H,Math.round((p.y-dragging.dy)*2)/2));moved=true;
 render();
});
function stopDrag(){if(!dragging)return;var id=dragging.id;dragging=null;if(moved){safeStore();log("Calibrated "+id+" → "+JSON.stringify(state.geometry[id]));}}
$("board").addEventListener("pointerup",stopDrag);
$("board").addEventListener("pointercancel",stopDrag);
$("artwork").addEventListener("click",function(ev){
 if(state.calibration)return;
 var t=ev.target.closest("[data-part]");if(!t)return;
 var id=t.getAttribute("data-part"),d=ev.shiftKey?-1:1;
 if(id==="dcSelector"){sim.dc=dcOptions[(dcOptions.indexOf(sim.dc)+d+dcOptions.length)%dcOptions.length];}
 if(id==="acSelector"){sim.ac=acOptions[(acOptions.indexOf(sim.ac)+d+acOptions.length)%acOptions.length];}
 if(id==="battery"){sim.model=E.apply(sim.model,{type:"CONTROL",key:"batterySwitch",value:!sim.model.config.batterySwitch});}
 if(id==="galley")sim.galley=!sim.galley;
 if(id!=="residual")render();
});
$("artwork").addEventListener("pointerdown",function(ev){
 if(state.calibration)return;
 var t=ev.target.closest("[data-part=residual]");if(!t)return;
 sim.resid=true;render();ev.preventDefault();
});
["pointerup","pointercancel","pointerleave"].forEach(function(name){$("board").addEventListener(name,function(){if(sim.resid){sim.resid=false;render();}});});
$("operate").onclick=function(){state.calibration=false;state.showMarkers=$("markers").checked;this.classList.add("active");$("calibrate").classList.remove("active");render();};
$("calibrate").onclick=function(){state.calibration=true;state.showMarkers=true;this.classList.add("active");$("operate").classList.remove("active");render();};
$("face").onchange=function(){state.faces=this.checked;render();};
$("overlay").onchange=function(){state.overlay=this.checked;render();};
$("markers").onchange=function(){state.showMarkers=this.checked;render();};
$("zoom").oninput=function(){zoomSet(Number(this.value)/100);};
$("zoomin").onclick=function(){zoomSet(state.scale+.1);};
$("zoomout").onclick=function(){zoomSet(state.scale-.1);};
$("fit").onclick=function(){var width=$("viewport").clientWidth-50;zoomSet(width/W);};
document.querySelectorAll("[data-mode]").forEach(function(b){b.onclick=function(){setupElectrical(b.dataset.mode);};});
$("genfail").onclick=function(){sim.model=E.apply(sim.model,{type:"FAULT",id:"GEN1_FAILED",active:!sim.model.faults.GEN1_FAILED,instructor:true});render();};
$("trfail").onclick=function(){sim.model=E.apply(sim.model,{type:"FAULT",id:"TR1_FAILED",active:!sim.model.faults.TR1_FAILED,instructor:true});render();};
$("restart").onclick=function(){setupElectrical("engines");};
function adjust(dx,dy,dr){
 if(!state.calibration){log("Activate native pixel calibration first.");return;}
 var p=state.geometry[state.selected];if(!p)return;
 p.x=Math.round(Math.max(0,Math.min(W,p.x+dx))*2)/2;
 p.y=Math.round(Math.max(0,Math.min(H,p.y+dy))*2)/2;
 p.r=Math.round(Math.max(5,Math.min(290,p.r+dr))*2)/2;
 safeStore();render();
}
$("left").onclick=function(){adjust(-.5,0,0);};
$("right").onclick=function(){adjust(.5,0,0);};
$("up").onclick=function(){adjust(0,-.5,0);};
$("down").onclick=function(){adjust(0,.5,0);};
$("smaller").onclick=function(){adjust(0,0,-.5);};
$("bigger").onclick=function(){adjust(0,0,.5);};
document.addEventListener("keydown",function(ev){
 if(!state.calibration||["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName))return;
 var dist=ev.shiftKey?5:.5,moves={ArrowLeft:[-dist,0,0],ArrowRight:[dist,0,0],ArrowUp:[0,-dist,0],ArrowDown:[0,dist,0]};
 if(moves[ev.key]){ev.preventDefault();adjust.apply(null,moves[ev.key]);}
});
$("resetgeometry").onclick=function(){
 if(!confirm("Reset only the local provisional hotspot calibration? Locked image will NOT change."))return;
 state.geometry=JSON.parse(JSON.stringify(initial));safeStore();render();log("Restored proposed geometry; approved artwork untouched.");
};
$("export").onclick=function(){
 var text=geoExport(),blob=new Blob([text],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="OH10-P5-13-calibration-provisional.json";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);log("Exported PROVISIONAL coordinates, not an approved mount.");
};
$("copy").onclick=async function(){
 try{await navigator.clipboard.writeText(geoExport());log("Copied provisional geometry to clipboard.");}
 catch(err){log("Copy failed: "+err.message);}
};
var ref=$("reference");
ref.addEventListener("load",function(){
 state.sourceOK=true;$("sourceStatus").textContent="Source image loaded: original 1095×1436 · SHA256 in manifest · unchanged";
 log("Immutable original owner OH-10 displayed. Drag markers to calibrate.");
});
ref.addEventListener("error",function(){
 state.sourceOK=false;$("sourceStatus").textContent="Source photo failed to load: verify GitHub Pages asset path. Do not approve visual QA.";
 status("Photo could not be loaded. Geometry and appearance are NOT validated.",false);
 log("ERROR: source image unavailable.");
});
async function init(){
 try{
  var req=await fetch("./photo-geometry.v1.json",{cache:"no-store"});
  if(req.ok){var manifest=await req.json();
   if(goodGeom(manifest.markers)){useGeometry(manifest.markers);log("Loaded versioned provisional geometry "+manifest.version);}
   else log("Invalid geometry manifest; using hardcoded safe proposal.");
  }else log("Geometry manifest HTTP "+req.status+"; fallback proposal.");
 }catch(err){log("Geometry manifest unavailable: "+err.message);}
 try{var saved=JSON.parse(localStorage.getItem(STORAGE));if(saved&&useGeometry(saved))log("Restored local calibration.");}
 catch(err){log("Local geometry unavailable.");}
 setupElectrical("engines");zoomSet(.70);
}
if(!E){status("Electrical-V7 engine is missing; no readings can be produced.",false);log("ERROR ElectricalV7 not loaded.");}
else init();
})();
