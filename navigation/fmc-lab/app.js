'use strict';
const $=id=>document.getElementById(id);
let result=null,procedures=[],ready=false,draftRequest=null;
const cdu=$('cdu');
const endpoint=async(url,body)=>{const response=await fetch(url,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const v=await response.json();if(!response.ok)throw new Error((v.error||'ERROR')+': '+(v.message||'Source unavailable'));return v};
const clean=x=>x.trim().toUpperCase();
function parseVia(value){const items=[];for(const raw of value.split(/\r?\n/)){const line=clean(raw);if(!line)continue;const tokens=line.split(/\s+/);if(tokens.length!==2||!tokens.every(x=>/^[A-Z0-9]{2,8}$/.test(x)))throw Error('Each line must contain two terms: DCT FIX or AIRWAY FIX');items.push(tokens[0]==='DCT'?{type:'DCT',to:tokens[1]}:{type:'AIRWAY',airway:tokens[0],to:tokens[1]})}return items}
function renderMap(legs){let pts=legs.map(x=>({lat:x.lat,lon:x.lon,ident:x.to}));if(!pts.length)return;
const xs=pts.map(p=>p.lon),ys=pts.map(p=>p.lat),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const padX=Math.max(.2,(maxX-minX)*.2),padY=Math.max(.15,(maxY-minY)*.2);
const X=x=>30+(x-minX+padX)/(maxX-minX+padX*2)*540;const Y=y=>240-(y-minY+padY)/(maxY-minY+padY*2)*220;
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('map').innerHTML='<path d="'+pts.map((p,i)=>(i?'L':'M')+X(p.lon).toFixed(1)+' '+Y(p.lat).toFixed(1)).join(' ')+'" fill="none" stroke="#dba1da" stroke-width="3" />'+pts.map(p=>'<circle cx="'+X(p.lon)+'" cy="'+Y(p.lat)+'" r="4" fill="#67d6ed"/><text x="'+(X(p.lon)+8)+'" y="'+(Y(p.lat)-8)+'" fill="#dceff0" font-size="12">'+esc(p.ident)+'</text>').join('')+'<text x="12" y="18" fill="#ffca91" font-size="11">TRUE COORDINATE PREVIEW — NOT FLYABLE ARINC LEGS</text>';
}
function showLegs(route){const list=route.legs.map(l=>'<tr><td>'+l.index+'</td><td>'+l.via+'</td><td>'+l.to+'</td><td>'+l.distanceNm.toFixed(1)+'</td><td>'+(l.trueInitialTrackDeg??'—')+'</td></tr>').join('');$('legs').innerHTML='<table><thead><tr><th>#</th><th>VIA</th><th>TO</th><th>NM</th><th>TRUE°</th></tr></thead><tbody>'+list+'</tbody></table>';renderMap(route.legs)}
$('build').onclick=async()=>{result=null;$('stage').disabled=true;try{const req={origin:clean($('origin').value),destination:clean($('destination').value),via:parseVia($('via').value)};result=await endpoint('/api/route',req);if(draftRequest&&JSON.stringify(draftRequest)!==JSON.stringify(req))draftRequest=null;showLegs(result);$('routeMsg').className='status okay';$('routeMsg').textContent='Source-linked reference built: '+result.legs.length+' segments · '+result.totalDistanceNm.toFixed(1)+' NM. NO AFDS/ LNAV guidance.';$('stage').disabled=!ready;}catch(e){$('routeMsg').className='status warn';$('routeMsg').textContent=e.message;}};
$('posEvaluate').onclick=async()=>{if(!result){$('posResult').textContent='Build a reference route first.';return}try{
 const route={origin:clean($('origin').value),destination:clean($('destination').value),via:parseVia($('via').value)};
 const pos=await endpoint('/api/position',{route,position:{lat:Number($('posLat').value),lon:Number($('posLon').value)},activeLeg:Number($('posLeg').value)});
 $('posResult').textContent=JSON.stringify(pos,null,2);
}catch(e){$('posResult').textContent=e.message}};
$('useCdu').onclick=()=>{try{
 const api=cdu.contentWindow.CDU_NAV_API;if(!api?.draft)throw Error('CDU route entry bridge unavailable');
 const req=api.draft();
 $('origin').value=req.origin;$('destination').value=req.destination;
 $('via').value=req.via.map(x=>x.type==='DCT'?'DCT '+x.to:x.airway+' '+x.to).join('\n');
 draftRequest=req;result=null;$('stage').disabled=true;
 $('routeMsg').className='status okay';
 $('routeMsg').textContent='CDU RTE/VIA fields loaded. Press Compute to verify source before staging.';
}catch(e){draftRequest=null;result=null;$('stage').disabled=true;$('routeMsg').className='status warn';$('routeMsg').textContent=e.message}};
$('stage').onclick=()=>{try{const api=cdu.contentWindow.CDU_NAV_API;if(!api)throw Error('CDU adapter not loaded; use loopback server and refresh');const v=draftRequest&&api.stageFromDraft?api.stageFromDraft(result,draftRequest):api.stage(result);draftRequest=null;$('routeMsg').textContent='STAGED '+v.count+' reference legs. In CDU: RTE L5 ACTIVATE → EXEC → LEGS';$('stage').disabled=true;}catch(e){$('routeMsg').className='status warn';$('routeMsg').textContent=e.message}};
$('findProcs').onclick=async()=>{try{procedures=await endpoint('/api/procedures?airport='+encodeURIComponent(clean($('ap').value))+'&kind='+encodeURIComponent($('kind').value));$('procedures').replaceChildren(...procedures.map((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent=p.ident+' ['+p.runways.join(',')+']';return o}));$('viewProc').disabled=!procedures.length;$('procDetail').textContent=procedures.length+' source procedures, all non-executable (select one to inspect)';}catch(e){$('procDetail').textContent=e.message}};
$('viewProc').onclick=async()=>{const p=procedures[Number($('procedures').value)];if(!p)return;try{const v=await endpoint('/api/procedure-preview?airport='+encodeURIComponent(clean($('ap').value))+'&kind='+p.kind+'&ident='+p.ident);$('procDetail').textContent=JSON.stringify({status:v.status,source:v.sourceMember,segments:v.segments.map(s=>({variant:s.segment_kind,qualifier:s.qualifier,expression:s.expression,referenceChords:s.referenceChords.length}))},null,2);}catch(e){$('procDetail').textContent=e.message}};
async function boot(){try{const v=await endpoint('/api/status');ready=v.airac==='2610'&&v.routePreviewEnabled===true;$('status').className='status okay';$('status').textContent='AIRAC '+v.airac+' · Private source verified · Stage 2 '+(v.stage2?'available':'missing')+' · FMC guidance OFF';}catch(e){ready=false;$('status').className='status warn';$('status').textContent='Private source server is not running. Use python navigation/fmc_server.py with Stage-1 and Stage-2 files. '+e.message}}
const inspect=()=>{try{const api=cdu.contentWindow.CDU_NAV_API;const v=api?.snapshot();$('cduState').textContent=v?'CDU: '+v.stage+' | Page '+v.page+' | '+v.committed+' committed reference segments':'CDU Nav bridge not available';}catch{$('cduState').textContent='CDU loading or cross-origin blocked'}};
cdu.addEventListener('load',inspect);document.addEventListener('visibilitychange',inspect);setInterval(inspect,1200);boot();