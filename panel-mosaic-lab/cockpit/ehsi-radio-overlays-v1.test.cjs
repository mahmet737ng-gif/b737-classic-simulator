const test=require('node:test'),assert=require('node:assert/strict');
const Overlay=require('./ehsi-radio-overlays-v1.js');
const valid=value=>({quality:'VALID',value});
const point={lat:35.7,lon:51.3};
const vor1={stationLat:35.73,stationLon:51.36,radialDeg:120,
 bearingDeg:300,bearingReference:'TRUE',stationIdent:'TRN'};
const vor2={stationLat:35.81,stationLon:51.42,radialDeg:215,
 bearingDeg:35,bearingReference:'TRUE',stationIdent:'IKA'};
const mcp={powered:true,course2Powered:true,courseL:135,courseR:240};
const captain={vhf:1,sg:1,course:135,magneticVariationDeg:5,heading:170};
const fo={vhf:2,sg:2,course:240,magneticVariationDeg:5,heading:170};
const snapshot={'mcp.state':valid(mcp),'navigation.vor1':valid(vor1),'navigation.vor2':valid(vor2)};
const args={snapshot,position:point,range:40,mode:'MAP',options:{vorAdf:true}};
test('CAPT and FO both show CRS1 and CRS2 regardless of SG and seat',()=>{
 const a=Overlay.plan({...args,src:captain});
 const b=Overlay.plan({...args,src:fo});
 for(const x of [a,b]){
  assert.deepEqual(x.courses.map(c=>c.channel),[1,2]);
  assert.deepEqual(x.courses.map(c=>c.degree),[135,240]);
  assert.deepEqual(x.courses.map(c=>c.trueDegree),[140,245]);
  assert.deepEqual(x.pointers.map(p=>p.label),['V1-120','V2-215']);
 }
});
test('a missing or stale NAV1 never removes the independent NAV2 line',()=>{
 for(const rec of [undefined,{quality:'STALE',value:vor1},{quality:'UNKNOWN',value:null}]){
  const x=Overlay.plan({...args,src:captain,snapshot:{...snapshot,'navigation.vor1':rec}});
  assert.deepEqual(x.courses.map(c=>c.channel),[2]);
 }
});
test('CRS2 uses separate COURSE2 power and never blanks valid CRS1',()=>{
 const x=Overlay.plan({...args,src:captain,snapshot:{...snapshot,
  'mcp.state':valid({...mcp,course2Powered:false})}});
 assert.deepEqual(x.courses.map(c=>c.channel),[1]);
});
test('COURSE2 battery-only feed works independently of MCP power',()=>{
 const x=Overlay.plan({...args,src:fo,snapshot:{...snapshot,
  'mcp.state':valid({...mcp,powered:false,course2Powered:true})}});
 assert.deepEqual(x.courses.map(c=>c.channel),[2]);
});
test('stale MCP data suppresses both courses but not valid VOR pointers',()=>{
 const x=Overlay.plan({...args,src:captain,snapshot:{...snapshot,
  'mcp.state':{quality:'STALE',value:mcp}}});
 assert.equal(x.courses.length,0);assert.equal(x.pointers.length,2);
});
test('MCP changes rotate only that selected course, on both displays',()=>{
 const x=Overlay.plan({...args,src:captain,snapshot:{...snapshot,
  'mcp.state':valid({...mcp,courseR:310})}});
 assert.deepEqual(x.courses.map(c=>c.degree),[135,310]);
});
test('VOR/ADF selection does not affect two selected MCP course lines',()=>{
 const x=Overlay.plan({...args,src:captain,options:{vorAdf:false}});
 assert.equal(x.courses.length,2);assert.equal(x.pointers.length,0);
});
test('ADF bearing references convert relative and true to magnetic',()=>{
 assert.equal(Overlay.adfMagnetic({bearingDeg:140,bearingReference:'TRUE'},captain),135);
 assert.equal(Overlay.adfMagnetic({bearingDeg:20,bearingReference:'RELATIVE'},captain),190);
 assert.equal(Overlay.adfMagnetic({bearingDeg:270,bearingReference:'MAGNETIC'},captain),270);
});
test('valid ADF bearing can render without fabricated station coordinates',()=>{
 const x=Overlay.plan({...args,src:captain,snapshot:{...snapshot,
  'navigation.adf1':valid({bearingDeg:35,bearingReference:'MAGNETIC'})}});
 assert.equal(x.pointers[2].label,'A1-035');assert.equal(x.pointers[2].stationLocated,false);
});
test('station proximity controls number label, not line visibility',()=>{
 const x=Overlay.plan({...args,src:captain,range:10,snapshot:{...snapshot,
  'navigation.vor2':valid({...vor2,stationLat:35.9,stationLon:51.7})}});
 assert.equal(x.courses.length,2);assert.equal(x.courses[1].near,false);
});
test('magnetic variation missing suppresses both selected course lines',()=>{
 const x=Overlay.plan({...args,src:{...captain,magneticVariationDeg:null}});
 assert.equal(x.courses.length,0);
});
test('PLAN and VOR/ILS deviation modes do not receive duplicated map overlays',()=>{
 for(const mode of ['PLAN','EXP_VOR_ILS','FULL_VOR_ILS']){
  const x=Overlay.plan({...args,mode,src:fo});assert.equal(x.courses.length,0);
 }
});
test('SVG paints two green dashed courses, each with independent channel IDs, on both EHSIs',()=>{
 class Element{
  constructor(tag,ownerDocument){this.tag=tag;this.ownerDocument=ownerDocument;this.children=[];this.attrs={};}
  setAttribute(k,v){this.attrs[k]=String(v)}
  append(child){this.children.push(child);child.parent=this}
  remove(){this.parent.children=this.parent.children.filter(x=>x!==this)}
  querySelector(selector){return this.children.find(x=>x.attrs?.['data-radio-nav-overlay']==='true')||null}
 }
 const doc={createElementNS(_ns,tag){return new Element(tag,doc)}};
 const renderer={COLORS:{green:'#41f585'},LAYOUT:{MAP:{roseCenter:[256,440],radius:220,radiusX:190}},
  routeProjection:()=>((x,y)=>[256+x*4,440-y*4])};
 const walk=e=>[e,...e.children.flatMap(walk)];
 for(const src of [captain,fo]){
  const svg=new Element('svg',doc);svg.id=src.sg===1?'unifiedEhsiCAPT':'unifiedEhsiFO';
  const model={mode:'MAP',range:40,options:{vorAdf:true}};
  Overlay.draw(svg,model,src,snapshot,point,renderer);
  const marks=walk(svg).filter(e=>e.attrs['data-segment']==='nav-selected-course');
  assert.equal(marks.length,2);assert.deepEqual(marks.map(e=>e.attrs['data-channel']),['1','2']);
  assert.ok(marks.every(e=>e.attrs['stroke-dasharray']==='9 12'));
  assert.equal(walk(svg).filter(e=>e.attrs['data-segment']==='nav-station-bearing').length,2);
  const nums=walk(svg).filter(e=>e.attrs['data-segment']==='nav-course-number');
  assert.deepEqual(nums.map(e=>e.textContent),['135','240']);
 }
});
