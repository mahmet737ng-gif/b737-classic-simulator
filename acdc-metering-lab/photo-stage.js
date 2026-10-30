/* OH-10 P5-13 photo-based trainer / native pixel calibration.
 * LOCK: never edit the immutable user artwork; control overlays are independent DOM.
 * Geometries are unapproved estimates pending source-photo coordinate audit.
 */
(function(){
"use strict";
var SVG="http://www.w3.org/2000/svg",W=1095,H=1436;
var E=window.B737ElectricalV7;
var $=function(id){return document.getElementById(id);};
var STORAGE="b737-oh10-photo-geometry-v3-ellipse";
var initial={
 dcAmps:{x:307.386918,y:272.100000,r:164.101996,rY:159.161290,type:"meter"},
 cpsFreq:{x:781.879157,y:253.738710,r:145.368071,rY:140.991398,type:"meter"},
 dcVolts:{x:310.770510,y:710.143011,r:174.654102,rY:169.395699,type:"meter"},
 acVolts:{x:785.307095,y:698.181720,r:153.533259,rY:148.910753,type:"meter"},
 dcSelector:{x:306,y:1029,r:84,type:"rotary"},
 acSelector:{x:783,y:1029,r:84,type:"rotary"},
 battery:{x:480,y:1295,r:51,type:"toggle"},
 galley:{x:727,y:1299,r:38,type:"toggle"},
 residual:{x:894,y:1299,r:39,type:"momentary"}
};
var state={geometry:JSON.parse(JSON.stringify(initial)),selected:"dcAmps",calibration:false,scale:.70,overlay:true,showMarkers:false,sourceOK:false};
var dcOptions=["STBY PWR","BAT BUS","BAT","TR1","TR2","TR3","TEST"];
var acOptions=["STBY PWR","GRD PWR","GEN1","APU GEN","GEN2","INV","TEST"];
var sim={model:null,mode:"engines",dc:"BAT",ac:"GEN1",galley:true,resid:false};
var needlePos={},needleVelocity={},needleDirection={},needleTargets={},needleFrame=0,needleFrameTime=null;
function photoAngle(id,data){
 var M=window.B737AcDcMeteringModel,entry=id==="cpsFreq"?"cps":id,value=data[id];
 return id==="acVolts"?M.limitAngle("acVolts",M.angleForAcVolts(value,{mode:data.residualScale?"RESIDUAL":"NORMAL"})):M.limitAngle(entry,M.angleForIndication(entry,value));
}
function animateNeedles(ts){
 needleFrame=0;
 if(!state.overlay){needleFrameTime=null;return;}
 var M=window.B737AcDcMeteringModel;
 var dt=needleFrameTime===null?1/60:Math.max(0,Math.min(M.motion.maxStepSeconds,(ts-needleFrameTime)/1000));
 needleFrameTime=ts;var moving=false;
 ["dcAmps","cpsFreq","dcVolts","acVolts"].forEach(function(id){
  var target=needleTargets[id],key=id==="cpsFreq"?"cps":id;
  if(!Number.isFinite(target))return;
  var pos=needlePos[id];if(!Number.isFinite(pos))pos=M.limitAngle(key,M.meters.find(function(m){return m.id===key;}).initialAngle);
  var nextDirection=Math.sign(target-pos);
  if(nextDirection&&needleDirection[id]&&nextDirection!==needleDirection[id])needleVelocity[id]=0;
  if(nextDirection)needleDirection[id]=nextDirection;
  var adv=M.advanceNeedle(pos,needleVelocity[id]||0,target,dt);
  needlePos[id]=M.limitAngle(key,adv.angle);needleVelocity[id]=adv.velocity;
  var node=document.querySelector('[data-needle="'+id+'"]');
  if(node)node.setAttribute("transform","rotate("+needlePos[id].toFixed(6)+" 256 256)");
  if(!adv.done)moving=true;
 });
 if(moving)needleFrame=requestAnimationFrame(animateNeedles);
 else needleFrameTime=null;
}
function scheduleNeedles(){
 if(state.overlay&&!needleFrame)needleFrame=requestAnimationFrame(animateNeedles);
}
function log(line){var p=$("events");if(!p)return;var stamp=new Date().toLocaleTimeString();p.textContent="["+stamp+"] "+line+"\n"+p.textContent.slice(0,1600);}
function status(msg,ok){var e=$("status");e.textContent=msg;e.classList.toggle("ok",!!ok);}
function safeStore(){try{localStorage.setItem(STORAGE,JSON.stringify(state.geometry));}catch(err){log("Local storage unavailable: "+err.message);}}
function goodGeom(raw){if(!raw||typeof raw!=="object")return false;return Object.keys(initial).every(function(k){var p=raw[k];return p&&Number.isFinite(+p.x)&&Number.isFinite(+p.y)&&Number.isFinite(+p.r)&&+p.r>4&&+p.r<300&&+p.x>=0&&+p.x<=W&&+p.y>=0&&+p.y<=H;});}
function useGeometry(raw){if(!goodGeom(raw))return false;Object.keys(initial).forEach(function(k){var p=raw[k];state.geometry[k]={x:+p.x,y:+p.y,r:+p.r,rY:initial[k].type==="meter"?(Number.isFinite(+p.rY)?+p.rY:+p.r*(.902/.930)):undefined,type:initial[k].type};});return true;}
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
// The source photograph owns all dial scales and printed markings.
function meter(id,data){
 // Original photo, original sprite. The screen RED arc is circular, while
 // the mapped native OH10 track is elliptical due to separate X/Y scales.
 var p=state.geometry[id],base=e("g",{transform:"translate("+p.x+" "+p.y+")","data-part":id,"pointer-events":"none"});
 if(!state.overlay)return base;
 var M=window.B737AcDcMeteringModel;
 var key=id==="cpsFreq"?"cps":id,original=M.meters.find(function(m){return m.id===key;});
 var angle=Number.isFinite(needlePos[id])?needlePos[id]:M.limitAngle(key,original.initialAngle);
 needleTargets[id]=photoAngle(id,data);
 needlePos[id]=angle;
 // Scale AFTER rotation: the point follows x=rx*sin(angle), y=-ry*cos(angle).
 // Scaling before rotation would make the tip drift off the annotated arc.
 var rx=p.r/216,ry=(p.rY||p.r)/216;
 var frame=e("g",{transform:"scale("+rx+" "+ry+") translate(-256 -256)"});
 var clip=e("clipPath",{id:"oh10-needle-window-"+id,clipPathUnits:"userSpaceOnUse"});
 clip.appendChild(e("path",{d:M.blackWindowPath(key)}));
 frame.appendChild(clip);
 var upper=e("g",{"clip-path":"url(#oh10-needle-window-"+id+")"});
 var blade=e("g",{"data-needle":id,transform:"rotate("+angle+" 256 256)"});
 blade.appendChild(e("image",{href:"../panel-mosaic-lab/cockpit/ac-dc-metering-needle.svg?v=MET-0001",x:0,y:0,width:512,height:512}));
 upper.appendChild(blade);frame.appendChild(upper);base.appendChild(frame);
 return base;
}
function photoHotspot(id){
 // The photo contains the hardware. Do NOT paint fake silver knobs, switches,
 // rings, labels or other objects over its original pixels.
 var p=state.geometry[id];
 var g=e("g",{transform:"translate("+p.x+" "+p.y+")","data-part":id,class:"control",role:"button","aria-label":id});
 g.appendChild(e("circle",{r:p.r,class:"hit",fill:"transparent",stroke:"none"}));
 return g;
}
function showMarkers(){
 var g=$("calibration");g.replaceChildren();
 // Calibration never implicitly turns on visual guides. They appear only
 // when the user explicitly checks the guide option.
 if(!state.calibration||!state.showMarkers)return;
 Object.keys(state.geometry).forEach(function(id){
  var p=state.geometry[id],selected=id===state.selected;
  var m=e("g",{transform:"translate("+p.x+" "+p.y+")","data-marker":id,class:"calibration-marker",tabindex:"0",role:"button","aria-label":"Move "+id+" calibration marker"});
  var guide=e("g",{"pointer-events":"none"});
  guide.appendChild(e("circle",{r:selected?7:4,fill:selected?"#dcd6b8":"#82909a",stroke:"#18262f","stroke-width":1.5,opacity:selected?.8:.55}));
  if(selected&&state.calibration){
   guide.appendChild(e("path",{d:"M -10 0 H -5 M 5 0 H 10 M 0 -10 V -5 M 0 5 V 10",stroke:"#ccc8ac","stroke-width":1,opacity:.7}));
  }
  m.appendChild(guide);
  m.appendChild(e("circle",{r:15,fill:"transparent",stroke:"none"}));
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
    p[k]=Math.max(k==="r"?5:0,Math.min(k==="x"?W:k==="y"?H:290,v));if(k==="r"&&p.type==="meter")p.rY=p.r*(.902/.930);
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
 g.appendChild(photoHotspot("dcSelector"));
 g.appendChild(photoHotspot("acSelector"));
 g.appendChild(photoHotspot("battery"));
 g.appendChild(photoHotspot("galley"));
 g.appendChild(photoHotspot("residual"));
 showMarkers();drawCoords();scheduleNeedles();
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
 sim.resid=true;$("board").setPointerCapture(ev.pointerId);render();ev.preventDefault();
});
["pointerup","pointercancel","pointerleave"].forEach(function(name){$("board").addEventListener(name,function(){if(sim.resid){sim.resid=false;render();}});});
$("operate").onclick=function(){state.calibration=false;state.showMarkers=$("markers").checked;this.classList.add("active");$("calibrate").classList.remove("active");render();};
$("calibrate").onclick=function(){state.calibration=true;state.showMarkers=$("markers").checked;this.classList.add("active");$("operate").classList.remove("active");render();};
$("overlay").onchange=function(){state.overlay=this.checked;if(!this.checked&&needleFrame){cancelAnimationFrame(needleFrame);needleFrame=0;needleFrameTime=null;}render();};
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
 p.r=Math.round(Math.max(5,Math.min(290,p.r+dr))*2)/2;if(p.type==="meter")p.rY=p.r*(.902/.930);
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
 state.sourceOK=true;
 if(ref.dataset.pointerCleanup==="READY"){
  $("sourceStatus").textContent="Locked OH10 source preserved · four baked static needles restored in derived display bitmap";
  log("Original locked photo unchanged; cleaned display shows only shared moving needle sprite.");
  return;
 }
 if(ref.dataset.pointerCleanup==="PENDING")return;
 var cleaner=window.B737AcDcStaticCleaner;
 if(!cleaner){$("sourceStatus").textContent="WARNING: static needle cleanup module not loaded";return;}
 ref.dataset.pointerCleanup="PENDING";
 var source=new URL(ref.getAttribute("href"),window.location.href).href;
 cleaner.ensureDerivedUrl(source).then(function(url){
  ref.dataset.pointerCleanup="READY";
  ref.setAttribute("href",url);
  $("sourceStatus").textContent="Derived photo display active · original locked OH10 unchanged";
  render();
 }).catch(function(error){
  ref.dataset.pointerCleanup="FAILED";
  $("sourceStatus").textContent="Static needle cleanup failed; original photo remains unchanged";
  log("ERROR cleaning photo: "+error.message);
 });
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
if(!E||!window.B737AcDcMeteringModel){status("Required electrical model or Unified photographic meter model is missing; no readings can be produced.",false);log("ERROR: electrical or calibrated meter source not loaded.");}
else init();
})();
