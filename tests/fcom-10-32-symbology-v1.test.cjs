const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const Registry=require('../engine/efis/fcom-10-32-symbol-registry-v1.js');
const FCOM=require('../panel-mosaic-lab/cockpit/ehsi-fcom-ch1032-live-v1.js');
const Source=require('../panel-mosaic-lab/cockpit/unified-efis-sources-v1.js');
const rec=value=>({quality:'VALID',value});
test('every 10.32 symbol is uniquely page-indexed with a known EHSI mode/color',()=>{
 assert.ok(Registry.specs.length>=90);
 assert.equal(new Set(Registry.specs.map(s=>s.id)).size,Registry.specs.length);
 for(const s of Registry.specs){
  assert.match(s.page,/^10\.32\.\d+$/);
  assert.ok(s.modes.length>0&&s.modes.every(m=>Registry.modes.includes(m)),s.id);
  assert.ok(s.colors.every(c=>['white','green','magenta','cyan','amber','red','black'].includes(c)),s.id);
  assert.ok(s.placement&&s.condition&&s.remarks,s.id);
 }
});
test('no signal can be shown from an unverified FCOM symbol observation',()=>{
 assert.deepEqual(Registry.eligible('tcasRA','MAP'),{eligible:false,reason:'NO_VALID_EVIDENCE'});
 assert.equal(Registry.eligible('tcasRA','MAP',{tcasRA:{valid:true}}).eligible,true);
 assert.equal(Registry.eligible('tcasRA','PLAN',{tcasRA:{valid:true}}).eligible,false);
});
test('wind 10.32.6 hysteresis >6 on and <4 off with invalid reset',()=>{
 let x=false;
 for(const [speed,expected] of [[6,false],[6.1,true],[5,true],[4,true],[3.9,false],[5,false],[8,true]]){
  x=FCOM.windVisible(x,speed);assert.equal(x,expected,'speed '+speed);
 }
 assert.equal(FCOM.windVisible(true,14,false),false);
 const seat=FCOM.makeSeatState();
 for(const [s,v] of [[6,false],[7,true],[5,true],[3,false]]){
  const model={mode:'MAP',windSpeed:s,windDirection:150};
  seat.prepare('CAPT',model);
  assert.equal(model.fcom32WindVisible,v);
  if(!v)assert.equal(model.windDirection,null);
 }
});
test('FCOM 10.32.37 fault messages need explicit verified source quality',()=>{
 const model={mode:'MAP',efis:{displayPower:true,sgValid:true},terrain:{sourceQuality:'UNKNOWN',failed:true},
  weather:{sourceQuality:'UNKNOWN',calibrationFault:true}};
 assert.deepEqual(FCOM.resolve(model,FCOM.liveEvidence(model)),[]);
 model.terrain.sourceQuality='VALID';
 assert.deepEqual(FCOM.resolve(model,FCOM.liveEvidence(model)).map(x=>x.message),['TERR FAIL']);
});
test('terrain warning color, conditions and level are separate',()=>{
 const model={mode:'MAP'};
 assert.equal(FCOM.resolve(model,{terrainAlert:{valid:true,severity:'CAUTION'}})[0].color,'amber');
 assert.equal(FCOM.resolve(model,{terrainAlert:{valid:true,severity:'WARNING'}})[0].color,'red');
});
test('combined WXR/MAP disagreement suppresses separate duplicate annunciations',()=>{
 const model={mode:'CTR_MAP',weather:{sourceQuality:'VALID',healthy:true,mapRangeDisagree:true,wxrRangeDisagree:true}};
 const symbols=FCOM.resolve(model,FCOM.liveEvidence(model));
 assert.deepEqual(symbols.map(s=>s.id),['wxrMapRangeDisagree']);
});
test('course change ALERT is limited to ten seconds before turn/waypoint sequencing',()=>{
 const model={mode:'FULL_NAV'};
 const fmc={operational:true,failed:false,courseChangeSeconds:9.9,rollToNextCourse:false,nextWaypointSequenced:false};
 assert.deepEqual(FCOM.resolve(model,FCOM.liveEvidence(model,{fmc})).map(x=>x.id),['courseChangeAlert']);
 assert.equal(FCOM.resolve(model,FCOM.liveEvidence(model,{fmc:{...fmc,courseChangeSeconds:11}})).length,0);
 assert.equal(FCOM.resolve(model,FCOM.liveEvidence(model,{fmc:{...fmc,rollToNextCourse:true}})).length,0);
});
test('weather mode and tilt require valid weather feed, WXR selected and a recognized mode',()=>{
 const model={mode:'MAP',weather:{sourceQuality:'VALID',selected:true,healthy:true,mode:'WX+T',
  tiltDeg:1.5,gainCalibrated:false}};
 assert.equal(FCOM.resolve(model,FCOM.liveEvidence(model))[0].message,'VAR/WX+T +1.5');
 model.weather.sourceQuality='STALE';
 assert.equal(FCOM.resolve(model,FCOM.liveEvidence(model)).length,0);
});
test('ADF head/tail pointers read ADF1/2 rather than VOR1/2 data',()=>{
 const irs={powered:true,attitudeValid:true,positionValid:true,pitchDeg:0,rollDeg:0,
  headingDeg:90,trackDeg:90,magneticVariationDeg:5,lat:35.7,lon:51.3};
 const snapshot={'irs.left':rec(irs),'irs.right':rec(irs),'navigation.vor1':rec({
  bearingDeg:120,bearingReference:'TRUE'}),'navigation.adf2':rec({
  bearingDeg:140,bearingReference:'MAGNETIC'})};
 const result=Source.resolve(snapshot,'CAPT',{}, {1:true,2:true},{1:false,2:false});
 assert.equal(result.bearings.length,1);
 assert.equal(result.bearings[0].channel,2);
 assert.equal(result.bearings[0].angle,140);
});
test('Unified renderer shows conditional EXP range arcs and green tuned VOR Navaid',()=>{
 const html=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/index.html'),'utf8');
 const ehsi=fs.readFileSync(path.join(root,'efis-display-lab/ehsi-v2.js'),'utf8');
 assert.match(ehsi,/\['EXP_NAV','EXP_VOR_ILS'\]\.includes\(m\.mode\)/);
 assert.match(ehsi,/pt\.tuned===true\?colors\.green:colors\.cyan/);
 assert.match(html,/ehsi-fcom-ch1032-live-v1\.js/);
 assert.ok(html.indexOf('ehsi-fcom-ch1032-live-v1.js')<html.indexOf('ehsi-unified-v1.js'));
});
test('fault overlay renders only validated symbols at their assigned zones',()=>{
 class El{
  constructor(tag,doc){this.tag=tag;this.doc=doc;this.ownerDocument=doc;this.attrs={};this.children=[];}
  setAttribute(k,v){this.attrs[k]=String(v);}
  appendChild(e){this.children.push(e);e.parent=this;}
  remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
  querySelector(sel){return this.children.find(x=>x.attrs['data-fcom1032-layer']==='true')||null}
 }
 const doc={createElementNS(_,tag){return new El(tag,doc)}};
 const svg=new El('svg',doc);
 const state={mode:'MAP',efis:{displayPower:true,sgValid:true}};
 const msgs=FCOM.draw(svg,state,{terrainAlert:{valid:true,severity:'WARNING'},excessData:{valid:true}});
 assert.equal(msgs.length,2);
 assert.equal(svg.children[0].children.length,2);
 assert.equal(svg.children[0].children[0].attrs.fill,FCOM.COLORS.red);
 FCOM.draw(svg,state,{});
 assert.equal(svg.children.length,0);
});

test('10.32.17 route data, 10.32.20 VNAV and 10.32.23 range scale rules are implemented',()=>{
 const source=fs.readFileSync(path.join(root,'efis-display-lab/ehsi-v2.js'),'utf8');
 assert.match(source,/m\.options\.rteData===true/);
 assert.match(source,/points\[i\]\.altitude,points\[i\]\.eta/);
 assert.match(source,/m\.nav\.vnavActive&&m\.nav\.descent===true/);
 assert.match(source,/\(m\.options\.wxr\|\|m\.options\.tfc\)/);
});
test('92-item FCOM mode/evidence matrix never paints unknown or wrong-mode signals',()=>{
 for(const spec of Registry.specs){
  for(const mode of Registry.modes){
   const state=Registry.eligible(spec.id,mode,{[spec.id]:{valid:true}});
   assert.equal(state.eligible,spec.modes.includes(mode),spec.id+' in '+mode);
  }
  assert.equal(Registry.eligible(spec.id,spec.modes[0],{[spec.id]:{valid:false}}).eligible,false);
 }
 assert.equal(Registry.eligible('FAKE','MAP',{FAKE:{valid:true}}).eligible,false);
});
