'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const manifest=new Set(require('../runtime/manifest.json'));
const root=path.join(__dirname,'..');
const runtime=url=>path.join(root,'runtime',url.slice(1));
function exists(url){assert(manifest.has(url),'Route not allowlisted: '+url);assert(fs.existsSync(runtime(url)),'Asset missing: '+url);}
for(const url of manifest){
 assert(!url.includes('..')&&!url.includes('//'),'Unsafe route '+url);
 exists(url);
}
for(const page of [
  ['public/index.html','/'],
  ['public/lab.html','/lab/'],
  ['runtime/view/cockpit/overhead-stage.html','/view/cockpit/overhead-stage.html'],
  ['runtime/cb-panel-lab/index.html','/cb-panel-lab/']
]){
 const html=fs.readFileSync(path.join(root,page[0]),'utf8');
 assert(!/https?:\/\/(?:mahmet|[^"' ]*github\.io)/i.test(html),'Source-site navigation in '+page[0]);
 const base=page[0].includes('/view/cockpit/')
    ?'/view/all-overhead/':page[1];
 for(const match of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)){
  const target=match[1];const u=new URL(target,'https://example.test'+base);
  if(u.origin!=='https://example.test')throw Error('Unexpected external resource '+u.href);
  if(u.pathname.startsWith('/static/')){
    const asset=u.pathname.split('/').at(-1);assert(fs.existsSync(path.join(root,'public',asset)),'Missing public '+u.pathname);
  }else exists(u.pathname);
 }
}
const spec=require('../runtime/view/all-overhead/spec.json');
assert(spec.images.length>=18);
for(const art of spec.images){const u=new URL(art.url,'https://example.test/view/all-overhead/');exists(u.pathname);}
const lights=require('../runtime/view/interactive-overhead/lights.json');
assert(lights.lights.length>=100);
for(const item of lights.lights){
 for(const state of Object.values(lights.assets[item.asset]||{})){
  const ref=typeof state==='string'?state:state?.url;
  if(ref){const u=new URL(ref,'https://example.test/view/interactive-overhead/');exists(u.pathname);}
 }
}
const source=fs.readFileSync(path.join(root,'server.js'),'utf8');
assert(source.includes('MAX_DEVICES = 3'),'Missing three-device server-side cap');
assert(source.includes('pg_advisory_xact_lock'),'Concurrent login cap must be atomic');
assert(source.includes('runtimeFiles.has(runtimePath)'),'Static route guard missing');
assert(source.includes("const ok=await authorized(req)"),'Authentication guard missing');
const guest=fs.readFileSync(path.join(root,'runtime/view/cockpit/overhead-stage.html'),'utf8');
assert(guest.includes('/bridge/failure-protocol.js'));
assert(guest.includes('../cockpit/cb-unified-live-v1.js'));
assert(guest.includes('/bridge/guest-overhead.js'));
const portal=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
assert(portal.includes('src="/view/cockpit/overhead-stage.html"'));
assert(!manifest.has('/view/cockpit/index.html'),'Full cockpit route must not be web-accessible');
assert(!manifest.has('/view/interactive-overhead/index.html'),'Old alternate gallery must not be exposed');
for(const source of ['performance/overhead-renderer.js','cockpit/guard-owner18-v1.js','cockpit/oh21-owner-photo-registration-v1.js','cockpit/exterior-lights-classic-v1.js','cockpit/overhead-bridge.js']) assert(guest.includes(source),'Original cockpit module missing: '+source);
assert(guest.includes('/bridge/failure-protocol.js'),'Overhead must subscribe to bus failure engine');
assert(fs.readFileSync(path.join(root,'public/index.html'),'utf8').includes('/static/portal-overhead.js'));
assert(portal.includes('src="/cb-panel-lab/"'));
assert(portal.includes('src="/lab/"'));
// Regression: the Railway guest must display every original Unified cockpit panel.
const fullCSS=fs.readFileSync(path.join(root,'public/guest-cockpit.css'),'utf8');
const fullJS=fs.readFileSync(path.join(root,'public/guest-cockpit.js'),'utf8');
assert(!/#region-main|#region-pedestal/.test(fullCSS),'Main and pedestal must not be hidden');
assert(!/button\[data-focus=/.test(fullCSS),'Native view selection buttons must remain visible');
assert(!/focusOverhead|guestSourceOverheadFocus/.test(fullJS),'Guest startup must not force overhead-only mode');
assert(!source.includes('guestSourceOverheadFocus'),'Gateway must not inject hidden navigation controls');
// Expired sessions must never transform hundreds of original cockpit JS/CSS
// requests into 303 -> /login HTML. The cockpit starts a preflight refresh
// before loading all original deferred files.
const session=fs.readFileSync(path.join(root,'public/session.js'),'utf8');
assert(source.includes('const preflight='),'Missing synchronous cockpit auth renewal bootstrap');
assert(source.includes('location.replace("/login?e=expired")'),'Preflight must redirect on expiry');
assert(source.includes('isDocumentNavigation(url.pathname,req.headers)'),'Expired cockpit navigation must redirect even if fetch headers are omitted');
assert(source.includes('res.writeHead(401'),'Expired subresources must receive 401 instead of login HTML');
assert(session.includes('ping();'),'Heartbeat must start immediately');
assert(session.includes("window.addEventListener('pageshow'"),'Back-forward cache revalidation missing');
// Railway must proxy the authentic EFIS renderer scripts from main. Prior
// Gateway allowlist accidentally omitted /efis-display-lab/, giving 404 for
// five essential EADI/EHSI scripts and four black screens.
assert(source.includes("'efis-display-lab'"),'EFIS upstream path must be allowlisted');
const efisImports=['reference-geometry.js','glyphs.js','core.js','ehsi-v2.js','eadi.js'];
for(const name of efisImports){
 const url='/efis-display-lab/'+name;
 assert(source.includes("'efis-display-lab'"),'Railway blocks '+url);
}
console.log('Guest full cockpit visibility, protected resources, and injection contract: OK');
