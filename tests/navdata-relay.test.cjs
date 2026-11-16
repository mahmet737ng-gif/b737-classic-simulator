'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),relay=require('../navdata-relay.js');
test('Only read-only NAVDATA endpoints are permitted',()=>{
 for(const p of ['/api/source/status','/api/cdu/airport?icao=OIII',
   '/api/cdu/catalog?airport=OIII&kind=SID',
   '/api/cdu/procedure?airport=OIII&kind=SID&ident=TEST1A&runway=29L',
   '/api/sg/procedure.geojson?airport=OIII&kind=SID&ident=TEST1A'])
  assert.equal(relay.allowedPath(p),true,p);
 for(const p of ['/api/navdata/import','/api/logout','/api/login',
  'https://evil.com/api/source/status','/api/cdu/catalog?evil=1',
  '/api/source/status#secret','/api/cdu/catalog%2Fmore',''])
  assert.equal(relay.allowedPath(p),false,p);
});
test('No cross-origin credential leak through Railway popup',()=>{
 assert.equal(relay.relayHtml('invalid'),null);
 const html=relay.relayHtml('a'.repeat(32));
 assert.match(html,/https:\/\/mahmet737ng-gif\.github\.io/);
 assert.match(html,/ev\.source!==window\.opener/);
 assert.match(html,/ev\.origin!==SOURCE_ORIGIN/);
 assert.match(html,/credentials:'same-origin'/);
 assert.doesNotMatch(html,/Access-Control-Allow-Origin|localStorage|sessionStorage/);
});
