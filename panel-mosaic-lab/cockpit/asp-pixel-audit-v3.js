/* ASP-AUDIT-0003 — non-invasive live 72-socket center audit.
 * 20 photo controls + 3 physical + VBR on each of CPT FO OBS.
 * The owner must still approve the actual pixels before freezing artwork.
 */
(function(root){'use strict';
 const G=root.B737ASPSocketRegistrationV2,Photo=root.B737ASPControlsModel,
  Physical=root.B737ASPPhysicalCommandsV1,VBR=root.B737ASPVBRModel;
 if(!G||!Photo||!Physical||!VBR)return;
 const expected=[...Photo.sockets.map(s=>({kind:s.kind,channel:s.channel,x:s.x,y:s.y})),
  ...Object.entries(Physical.CONTROLS).map(([kind,v])=>({kind:'physical',channel:kind,x:v.x,y:v.y})),
  {kind:'vbr',channel:'VBR',x:VBR.socket.x,y:VBR.socket.y}];
 function faceIn(d,seat){
  const f=seat==='OBS'?d.querySelector('#atlasAbsolute > .asp-bare-mounted[data-seat="OBS"]'):
   d.querySelector('.asp-bare-mounted[data-seat="'+seat+'"]');
  return f&&f.isConnected?f:null;
 }
 function inspectSeat(host,seat){
  const face=host.querySelector(':scope > img')||host;
  const r=face.getBoundingClientRect(),frame=G.viewport(r.width,r.height);
  const controls=expected.map(s=>{
   const selector=s.kind==='physical'?'[data-asp-physical-kind="'+s.channel+'"]':
    s.kind==='vbr'?'.asp-vbr-selector':
    '.asp-photo-control[data-kind="'+s.kind+'"][data-channel="'+s.channel+'"]';
   const el=host.querySelector(selector);
   const point=frame.point(s.x,s.y),target=[r.left+point.x,r.top+point.y];
   if(!el)return {kind:s.kind,channel:s.channel,found:false,errorCssPx:null};
   const b=el.getBoundingClientRect();
   const actual=[b.left+b.width/2,b.top+b.height/2];
   return {kind:s.kind,channel:s.channel,found:true,target,actual,
    errorCssPx:Math.hypot(target[0]-actual[0],target[1]-actual[1])};
  });
  const missing=controls.filter(c=>!c.found).map(c=>c.channel);
  const error=Math.max(0,...controls.map(c=>c.errorCssPx||0));
  return {seat,mounted:true,controls:controls.length,found:controls.length-missing.length,
   maxCenterErrorCssPx:error,missing,pass:missing.length===0&&error<=.5,details:controls};
 }
 function inspect(){
  const local=['CAPT','FO'].map(s=>{const host=faceIn(document,s);return host?inspectSeat(host,s):{seat:s,mounted:false,pass:false};});
  const ifr=document.getElementById('overheadFrame'),frame=ifr?.contentDocument;
  const obs=frame&&faceIn(frame,'OBS')?inspectSeat(faceIn(frame,'OBS'),'OBS'):{seat:'OBS',mounted:false,pass:false,reason:'AFT OH-04 iframe unavailable'};
  const stations=[...local,obs];
  return {schema:'B737_ASP_PIXEL_AUDIT_V3',expectedCount:72,foundCount:stations.reduce((n,s)=>n+(s.found||0),0),
   stations,pass:stations.every(s=>s.pass),thresholdCssPx:0.5,
   limitations:'Registration is geometric; visible sprite silhouettes and human photo QA required before final lock'};
 }
 function boot(){
  const host=document.getElementById('inspector');if(!host)return;
  const section=document.createElement('section');section.id='aspPixelAuditV3';
  section.style.cssText='border:1px solid #688190;border-radius:8px;padding:9px;background:#142834;color:#dfecf2;font:11px/1.5 system-ui;margin:8px 0';
  const btn=document.createElement('button');btn.textContent='RUN ASP 72-CENTER PIXEL AUDIT';
  btn.style.cssText='width:100%;padding:6px;background:#26506a;color:white;border:1px solid #718aa1;border-radius:5px';
  const result=document.createElement('pre');result.style.cssText='white-space:pre-wrap;max-height:160px;overflow:auto;margin:6px 0';
  result.textContent='Checks 20 photo + 3 toggle + 1 VBR per station. No auto freeze.';
  btn.onclick=()=>{const v=inspect();result.textContent=v.stations.map(s=>s.seat+': '+(s.found||0)+'/24, max '+(s.maxCenterErrorCssPx??'n/a')+' CSS px, '+(s.pass?'PASS':'REVIEW')+'\n'+(s.missing?.join(', ')||'')).join('\n')+'\n'+(v.pass?'GEOMETRIC PASS — photo approval still required':'DO NOT LOCK OR ACCEPT');};
  section.append(btn,result);host.prepend(section);
 }
 root.B737ASPPixelAuditV3=Object.freeze({inspect});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
