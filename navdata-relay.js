/* Authenticated Railway popup bridge; never exports session cookies. */
'use strict';
const GH_ORIGIN='https://mahmet737ng-gif.github.io';
const PROTOCOL='b737:private-navdata-relay-v1';
const PATTERN=/^\\/api\\/(?:source\\/status|cdu\\/(?:airport|catalog|procedure)|sg\\/procedure\\.geojson)(?:\\?[^#]*)?$/;
function allowedPath(p){
 if(typeof p!=='string'||p.length>440||!PATTERN.test(p)||p.includes('..')||/%2f|%5c/i.test(p))return false;
 const u=new URL(p,'https://railway.local');
 return [...u.searchParams.keys()].every(x=>['icao','airport','kind','ident','runway','transition'].includes(x));
}
const CLIENT="(function(){\n 'use strict';\n const SOURCE_ORIGIN='https://mahmet737ng-gif.github.io';\n const PROTOCOL='b737:private-navdata-relay-v1';\n const nonce=new URLSearchParams(location.search).get('nonce');\n const label=document.getElementById('state');\n if(!/^[a-f0-9]{32}$/.test(nonce||'')||!window.opener){\n  label.textContent='Open this window from Unified on GitHub Pages.';\n  return;\n }\n function send(data){try{window.opener.postMessage({type:PROTOCOL,nonce,...data},SOURCE_ORIGIN)}catch(_){}}\n function validPath(path){\n  if(typeof path!=='string'||path.length>440||\n    !/^\\/api\\/(?:source\\/status|cdu\\/(?:airport|catalog|procedure)|sg\\/procedure\\.geojson)(?:\\?[^#]*)?$/.test(path)||\n    path.includes('..')||/%2f|%5c/i.test(path))return false;\n  const u=new URL(path,location.origin);\n  return [...u.searchParams.keys()].every(x=>['icao','airport','kind','ident','runway','transition'].includes(x));\n }\n let pending=0;\n window.addEventListener('message',async function(ev){\n  const m=ev.data;\n  if(ev.source!==window.opener||ev.origin!==SOURCE_ORIGIN||m?.type!==PROTOCOL||m?.nonce!==nonce)return;\n  if(m.kind==='PING'){send({kind:'READY'});return;}\n  if(m.kind!=='GET'||!Number.isSafeInteger(m.id)||m.id<1||m.id>100000000||!validPath(m.path)||pending>=6)return;\n  pending++;\n  try{\n   const resp=await fetch(m.path,{credentials:'same-origin',cache:'no-store',method:'GET',redirect:'error'});\n   const body=resp.status===401?{error:'SESSION_EXPIRED'}:await resp.json();\n   send({kind:'RESULT',id:m.id,status:resp.status,body});\n   if(resp.status===401)label.textContent='Railway session expired; sign in on Railway then reconnect.';\n  }catch(_){send({kind:'RESULT',id:m.id,status:503,body:{error:'PRIVATE_NAVDATA_UNAVAILABLE'}})}\n  finally{pending--;}\n });\n window.addEventListener('beforeunload',()=>send({kind:'CLOSED'}));\n label.textContent='Protected CDU/SG NAVDATA bridge connected. Keep this window open while using GitHub Pages.';\n send({kind:'READY'});\n function pulse(){fetch('/api/pulse',{method:'POST',credentials:'same-origin'}).catch(()=>{})}\n pulse();setInterval(pulse,240000);\n})();";
function relayHtml(nonce){
 if(typeof nonce!=='string'||!/^[a-f0-9]{32}$/.test(nonce))return null;
 return '<!doctype html><html lang="en"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="referrer" content="no-referrer"><title>CDU/SG NAVDATA</title>'+
  '<style>body{margin:0;min-height:100vh;background:#0c1824;color:#b5e3f7;font:15px/1.6 system-ui,sans-serif;display:grid;place-items:center;padding:24px}main{max-width:420px;padding:25px;border:1px solid #50748a;border-radius:12px}h2{color:#fff;font-size:18px}small{color:#8fb0c4}</style></head><body><main>'+
  '<h2>Secure NAVDATA · Railway</h2><p id="state">Starting protected connection…</p>'+
  '<small>Read-only • OIII / OIMM / OISS • Training reference, not FMC navigation</small>'+
  '</main><script>'+CLIENT.replace(/<\\/script/gi,'<\\\\/script')+'</script></body></html>';
}
module.exports={GH_ORIGIN,PROTOCOL,allowedPath,relayHtml};
