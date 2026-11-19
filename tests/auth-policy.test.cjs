'use strict';
const assert=require('node:assert/strict');
const {OWNER_SESSION_SECONDS,GUEST_SESSION_SECONDS,DEVICE_SESSION_SECONDS,isDocumentNavigation,canRegisterDevice}=require('../auth-policy');
assert.equal(OWNER_SESSION_SECONDS,60*60*24*400);
assert.equal(GUEST_SESSION_SECONDS,OWNER_SESSION_SECONDS);
assert.equal(DEVICE_SESSION_SECONDS,OWNER_SESSION_SECONDS);
for(const count of [0,1,2])assert.equal(canRegisterDevice('guest',null,count),true);
assert.equal(canRegisterDevice('guest',null,3),false,'4th new guest device denied');
assert.equal(canRegisterDevice('guest','guest',3),true,'Registered device may re-login when full');
assert.equal(canRegisterDevice('unlimited',null,3),true,'Owner exempt');
assert.equal(canRegisterDevice('guest','unlimited',3),false);
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
