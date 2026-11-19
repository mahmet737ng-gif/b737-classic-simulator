'use strict';

// Browser implementations cap persistent cookies (Chromium: 400 days).
// Renew on every owner heartbeat: no idle 20-minute or absolute server TTL.
const OWNER_SESSION_SECONDS=60*60*24*400;
// Registration persists server-side until explicitly released.
const GUEST_SESSION_SECONDS=OWNER_SESSION_SECONDS;
const DEVICE_SESSION_SECONDS=OWNER_SESSION_SECONDS;
function canRegisterDevice(tier,previousTier,guestCount,cap=3){
 return tier==='unlimited'||previousTier==='guest'||guestCount<cap;
}

function isDocumentNavigation(pathname,headers={}) {
  const dest=String(headers['sec-fetch-dest']||'').toLowerCase();
  if(dest==='document'||dest==='iframe')return true;
  // Never send HTML login redirects as script, CSS, image, or fetch assets.
  if(dest&&dest!=='empty')return false;
  const route=String(pathname||'');
  if(/^\/(?:api|static)\//.test(route))return false;
  // Service workers and some proxy navigations omit Sec-Fetch-Dest and/or
  // Accept:text/html. Direct cockpit and lab documents still need a 303.
  if(route==='/'||route.endsWith('/')||/\.(?:html?|xhtml)$/i.test(route))return true;
  const last=route.split('/').pop()||'';
  return !/\.[a-z0-9]{1,8}$/i.test(last) &&
    String(headers.accept||'').toLowerCase().includes('text/html');
}

module.exports={OWNER_SESSION_SECONDS,GUEST_SESSION_SECONDS,DEVICE_SESSION_SECONDS,isDocumentNavigation,canRegisterDevice};
