'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const BASE='http://127.0.0.1:3000';
const USER='ci-reviewer';
const PASSWORD='ci-only-fixture';
const UNLIMITED_USER='Taregh',UNLIMITED_PASSWORD='ci-unlimited-fixture';
async function get(route,opts={}){
  return await fetch(BASE+route,{redirect:'manual',signal:AbortSignal.timeout(60000),...opts});
}
async function loginAs(username,password,cookies=''){
  const r=await get('/api/login',{method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded',...(cookies?{Cookie:cookies}:{})},
    body:new URLSearchParams({username,password}).toString()});
  const jar=r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
  return {status:r.status,location:r.headers.get('location'),cookies:jar};
}
const login=(cookies='')=>loginAs(USER,PASSWORD,cookies);
async function read(route,cookies){
  const response=await get(route,{headers:{Cookie:cookies}});
  assert.equal(response.status,200,route+' HTTP '+response.status);
  return {response,bytes:Buffer.from(await response.arrayBuffer())};
}
(async()=>{
 const auth=await get('/panel-mosaic-lab/cockpit/');
 assert.equal(auth.status,401,'Unauthenticated non-document requests must fail closed');
 for(const originalResource of [
   '/panel-mosaic-lab/cockpit/overhead-stage.html',
   '/panel-mosaic-lab/cockpit/app.js',
   '/engine/systems/electrical-v7.js',
   '/cb-panel-lab/',
   '/bus-consumer-test-lab/v3.html',
   '/panel-mosaic-lab/assets/locked/2026-10-23/OH10-ELEC-LOSSLESS-9a1ca4d6cfb2.png'
 ]) {
   const unauthorized=await get(originalResource);
   assert.equal(unauthorized.status,401,'Unprotected original resource: '+originalResource);
 }
 const noAccess=await get('/api/cdu/airway-check?from=DHN&airway=B411&lat=35.254167&lon=52.72');
 assert.equal(noAccess.status,401,'Airway check must be session protected');
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
  'id="aircraftSettingsOpen"',
  'id="cbPanelOpen"','id="busConsumerTestLabOpen"','id="failuresHeaderOpen"'
 ]) assert(html.includes(part),'Missing original cockpit / guest integration: '+part);
 assert(html.includes('src="./app.js'),'Original cockpit script absent');
 const css=(await read('/static/guest-cockpit.css',first.cookies)).bytes.toString('utf8');
 assert(css.includes('#viewport')&&css.includes('#guestLogoutForm'));
 const js=(await read('/static/guest-cockpit.js',first.cookies)).bytes.toString('utf8');
 assert(js.includes('mountLogout')&&js.includes('SIGN OUT'));
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
 const validAirway=await get('/api/cdu/airway-check?from=DHN&airway=B411&lat=35.254167&lon=52.72',
  {headers:{Cookie:first.cookies}});
 assert.equal(validAirway.status,200);
 assert.equal((await validAirway.json()).valid,true,'B411 must connect to source DHN');
 const absent=await get('/api/cdu/airway-check?from=DHN&airway=B11&lat=35.254167&lon=52.72',
  {headers:{Cookie:first.cookies}});
 assert.equal(absent.status,200);
 assert.equal((await absent.json()).valid,false,'B11 must be absent at DHN');
 const spoofed=await get('/api/cdu/airway-check?from=DHN&airway=B411&lat=41.645&lon=122.115',
  {headers:{Cookie:first.cookies}});
 assert.equal((await spoofed.json()).valid,false,'Another DHN position must not resolve as Iran DHN');
 const pulse=await get('/api/pulse',{method:'POST',headers:{Cookie:first.cookies}});
 assert.equal(pulse.status,204,'Session heartbeat failed');
 const second=await login(),third=await login(),fourth=await login();
 assert.equal(second.location,'/');assert.equal(third.location,'/');
 assert.equal(fourth.location,'/login?e=full','Fourth distinct browser device must be refused');
 const out=await get('/api/logout',{method:'POST',headers:{Cookie:second.cookies}});
 assert.equal(out.status,303);
 const retry=await login();
 assert.equal(retry.location,'/','Logout must free a device slot');
 const owners=await Promise.all(Array.from({length:7},()=>loginAs(UNLIMITED_USER,UNLIMITED_PASSWORD)));
 assert.equal(owners.length,7);
 for(const owner of owners){
  assert.equal(owner.status,303);
  assert.equal(owner.location,'/','Unlimited account must accept concurrent devices');
  assert.match(owner.cookies,/ata24_session=/);
 }
 const online=await get('/api/pulse',{method:'POST',headers:{Cookie:owners[6].cookies}});
 assert.equal(online.status,204,'Unlimited account must remain online');
 const blocked=await login();
 assert.equal(blocked.location,'/login?e=full','Unlimited sessions must not loosen guest device cap');
 const ownerContent=await get('/static/session.js',{headers:{Cookie:owners[6].cookies}});
 assert.equal(ownerContent.status,200);
 console.log('AUTH: PASS, 3-device guest cap: PASS, unlimited concurrent sessions: PASS, logout: PASS');
 console.log('ORIGINAL SOURCE ROUTES:',JSON.stringify(results));
 console.log('ORIGINAL OVERHEAD PHOTO:',image.bytes.length,'bytes, PNG signature OK');
 console.log('LIVE GITHUB MIRROR: PASS');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
