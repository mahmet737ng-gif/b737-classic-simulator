'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const BASE='http://127.0.0.1:3000';
const USER='ci-reviewer';
const PASSWORD='ci-only-fixture';
async function get(route,opts={}){
  return await fetch(BASE+route,{redirect:'manual',signal:AbortSignal.timeout(60000),...opts});
}
async function login(cookies=''){
  const r=await get('/api/login',{method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded',...(cookies?{Cookie:cookies}:{})},
    body:new URLSearchParams({username:USER,password:PASSWORD}).toString()});
  const jar=r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
  return {status:r.status,location:r.headers.get('location'),cookies:jar};
}
async function read(route,cookies){
  const response=await get(route,{headers:{Cookie:cookies}});
  assert.equal(response.status,200,route+' HTTP '+response.status);
  return {response,bytes:Buffer.from(await response.arrayBuffer())};
}
(async()=>{
 const auth=await get('/panel-mosaic-lab/cockpit/');
 assert.equal(auth.status,303,'Protected cockpit must reject guests');
 assert.equal(auth.headers.get('location'),'/login');
 for(const originalResource of [
   '/panel-mosaic-lab/cockpit/overhead-stage.html',
   '/panel-mosaic-lab/cockpit/app.js',
   '/engine/systems/electrical-v7.js',
   '/cb-panel-lab/',
   '/bus-consumer-test-lab/v3.html',
   '/panel-mosaic-lab/assets/locked/2026-10-23/OH10-ELEC-LOSSLESS-9a1ca4d6cfb2.png'
 ]) {
   const unauthorized=await get(originalResource);
   assert.equal(unauthorized.status,303,'Unprotected original resource: '+originalResource);
   assert.equal(unauthorized.headers.get('location'),'/login');
 }
 const first=await login();
 assert.equal(first.status,303);
 assert.equal(first.location,'/');
 assert.match(first.cookies,/ata24_session=/);
 const root=await get('/',{headers:{Cookie:first.cookies}});
 assert.equal(root.status,303);
 assert.equal(root.headers.get('location'),'/panel-mosaic-lab/cockpit/');
 const home=await read('/panel-mosaic-lab/cockpit/',first.cookies);
 const html=home.bytes.toString('utf8');
 for(const part of [
  '<base href="/panel-mosaic-lab/cockpit/">','/static/guest-cockpit.js',
  '/static/guest-cockpit.css','/static/session.js',
  'id="guestSourceOverheadFocus"','id="aircraftSettingsOpen"',
  'id="cbPanelOpen"','id="busConsumerTestLabOpen"','id="failuresHeaderOpen"'
 ]) assert(html.includes(part),'Missing original cockpit / guest integration: '+part);
 assert(html.includes('src="./app.js'),'Original cockpit script absent');
 const css=(await read('/static/guest-cockpit.css',first.cookies)).bytes.toString('utf8');
 assert(css.includes('#region-main')&&css.includes('#region-pedestal'));
 const js=(await read('/static/guest-cockpit.js',first.cookies)).bytes.toString('utf8');
 assert(js.includes("window.addEventListener('b737:cockpit-mounted'"));
 const resources=[
  '/panel-mosaic-lab/cockpit/app.js',
  '/panel-mosaic-lab/cockpit/overhead-stage.html',
  '/panel-mosaic-lab/cockpit/overhead-bridge.js',
  '/panel-mosaic-lab/interactive-overhead/lights.json',
  '/panel-mosaic-lab/interactive-overhead/lights.js',
  '/panel-mosaic-lab/cockpit/assets/mcp-switches/owner13-photo-part0.b64',
  '/panel-mosaic-lab/cockpit/aircraft-settings.js',
  '/panel-mosaic-lab/cockpit/failures-header-v1.js',
  '/engine/systems/electrical-v7.js',
  '/cb-panel-lab/catalog.js',
  '/bus-consumer-test-lab/v3.html'
 ];
 const results=await Promise.all(resources.map(async route=>{
  const {bytes}=await read(route,first.cookies);
  assert(bytes.length>500,'Unexpectedly short GitHub response '+route);
  return [route,bytes.length];
 }));
 const image=await read('/panel-mosaic-lab/assets/locked/2026-10-23/OH10-ELEC-LOSSLESS-9a1ca4d6cfb2.png',first.cookies);
 assert(image.bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Original overhead PNG was not delivered');
 const pulse=await get('/api/pulse',{method:'POST',headers:{Cookie:first.cookies}});
 assert.equal(pulse.status,204,'Session heartbeat failed');
 const second=await login(),third=await login(),fourth=await login();
 assert.equal(second.location,'/');assert.equal(third.location,'/');
 assert.equal(fourth.location,'/login?e=full','Fourth distinct browser device must be refused');
 const out=await get('/api/logout',{method:'POST',headers:{Cookie:second.cookies}});
 assert.equal(out.status,303);
 const retry=await login();
 assert.equal(retry.location,'/','Logout must free a device slot');
 console.log('AUTH: PASS, 3-device cap: PASS, logout: PASS');
 console.log('ORIGINAL SOURCE ROUTES:',JSON.stringify(results));
 console.log('ORIGINAL OVERHEAD PHOTO:',image.bytes.length,'bytes, PNG signature OK');
 console.log('LIVE GITHUB MIRROR: PASS');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
