'use strict';
const assert=require('node:assert/strict');
const map=require('../cdu-standalone-v6/nav-map-overlay.js');
function route(...coords){return {airac:'2610',sourceId:map.SOURCE,origin:'OIII',destination:'OIIE',
 originPosition:{lat:coords[0][0],lon:coords[0][1]},fmcExecutable:false,afdsCommands:false,
 legs:coords.slice(1).map((p,i)=>({to:i===coords.length-2?'OIIE':'REVUR',lat:p[0],lon:p[1],distanceNm:10}))};}
const v=route([35.69,51.31],[35.7,51.6],[35.42,51.15]);
assert.equal(map.acceptedRoute(v),true);
const pts=map.projectRoute(v);
assert.equal(pts.length,3);assert(pts.every(p=>p.x>=94&&p.x<=346&&p.y>=96&&p.y<=348));
assert.notEqual(pts[0].x,pts[1].x);
assert.equal(map.render({ehsi:{mode:'MAP'},navdbActive:v},null).displayed,false);
assert.equal(map.acceptedRoute({...v,afdsCommands:true}),false);
assert.equal(map.acceptedRoute({...v,legs:[{to:'REVUR',lat:99,lon:0,distanceNm:0}]}),false);
const wrapped=map.projectRoute(route([32,179.7],[32,-179.9]));
assert(Math.abs(wrapped[1].x-wrapped[0].x)<=252,'dateline must unwrap rather than span world');
class El{constructor(ownerDocument){this.ownerDocument=ownerDocument;this.child=[];this.attr={};this.textContent=''}appendChild(c){this.child.push(c);return c}setAttribute(k,v){this.attr[k]=v}querySelector(q){return null}}
const doc={createElementNS(){return new El(doc)}};const svg=new El(doc);
const data=map.render({ehsi:{mode:'PLAN',range:10,options:{wpt:true}},navdbActive:v},svg);
assert.equal(data.displayed,true);assert.equal(data.navGuidance,false);
assert.equal(svg.child.length,1);assert.equal(svg.child[0].attr['data-navdb-reference'],'ACT_SOURCE_ROUTE');
assert(svg.child[0].child.some(n=>n.textContent.includes('NOT LNAV')));
assert.equal(map.render({ehsi:{mode:'PLAN'},navdbPending:v},new El(doc)).displayed,false);
console.log('CDU NAV EHSI PLAN: source-validated geography, pending isolation, dateline, non-guidance PASS');