'use strict';
const assert=require('node:assert/strict');
const {OWNER_SESSION_SECONDS,GUEST_SESSION_SECONDS,DEVICE_SESSION_SECONDS,isDocumentNavigation}=require('../auth-policy');
assert.equal(OWNER_SESSION_SECONDS,60*60*24*400);
assert.equal(GUEST_SESSION_SECONDS,60*60*24*7);
assert.equal(DEVICE_SESSION_SECONDS,60*60*24*30);
const cases=[
 ['/',{},true],
 ['/panel-mosaic-lab/cockpit/',{},true],
 ['/panel-mosaic-lab/cockpit/',{'sec-fetch-dest':'empty',accept:'*/*'},true],
 ['/panel-mosaic-lab/cockpit/index.html',{accept:'*/*'},true],
 ['/view/cockpit/overhead-stage.html',{},true],
 ['/lab/',{},true],
 ['/cb-panel-lab/',{},true],
 ['/panel-mosaic-lab/cockpit/sw.js',{'sec-fetch-dest':'script',accept:'*/*'},false],
 ['/panel-mosaic-lab/cockpit/performance/manifest.js',{accept:'*/*'},false],
 ['/panel-mosaic-lab/cockpit/atlas.png',{'sec-fetch-dest':'image'},false],
 ['/static/session.js',{},false],
 ['/api/pulse',{'sec-fetch-dest':'empty',accept:'text/html'},false],
 ['/api/navdata/local-reference',{accept:'text/html'},false],
 ['/favicon.ico',{},false],
 ['/panel-mosaic-lab/cockpit/',{'sec-fetch-dest':'document'},true],
 ['/panel-mosaic-lab/cockpit/script.js',{'sec-fetch-dest':'script',accept:'text/html'},false]
];
for(const [route,headers,expected] of cases)
 assert.equal(isDocumentNavigation(route,headers),expected,route);
console.log('Owner sliding-session and expired-document fallback policy: OK');
