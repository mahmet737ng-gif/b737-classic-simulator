'use strict';
/* Execute Unified's production CDU mount path and its no-CDU diagnostic. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const assembly=JSON.parse(fs.readFileSync(path.join(__dirname,'assembly.json'),'utf8'));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const seatPolicy=source.match(/const cduSeats=[^;]+;/)?.[0];
const start=source.indexOf('for(const item of assembly.embeddedInstruments||[])');
const end=source.indexOf('\n }\n',start);
assert.ok(start>=0&&end>start&&seatPolicy);
const loop=source.slice(start,end);
assert.match(source,/function mountGallery\(\)/,'Gallery must remain on demand.');

function mount(noCdu){
 const iframes=[];
 function node(tag){
  const el={tag,children:[],style:{},dataset:{},attributes:{},className:'',textContent:'',
   classList:{values:new Set(),add(...names){names.forEach(n=>this.values.add(n))},contains(n){return this.values.has(n)}},
   append(child){this.children.push(child)},
   setAttribute(name,value){this.attributes[name]=value},
   querySelector(selector){return selector==='.region-native'?this.native:null}};
  if(tag==='iframe')iframes.push(el);
  return el;
 }
 const native=node('native'),region=node('section');region.native=native;
 const frames=new Map();
 const view={instrumentPresentation:i=>({left:0,top:0,scaleX:i.w/i.nativeWidth,scaleY:i.h/i.nativeHeight})};
 new Function('window','assembly','document','model','byId','cduFrames',seatPolicy+'\n'+loop)(
  {B737UnifiedNoCduTest:noCdu},assembly,{createElement:node},view,id=>id==='region-main'?region:null,frames);
 return {iframes,frames,native};
}

assert.equal(assembly.embeddedInstruments.length,2);
const live=mount(false);
assert.deepEqual([...live.frames.keys()],['CAPT','FO']);
for(const seat of ['CAPT','FO']){
 const {item,child,station}=live.frames.get(seat);
 assert.equal(child.id,'cduFrame'+seat);
 assert.match(child.src,new RegExp('[?&]seat='+seat+'(?:&|$)'));
 assert.equal(child.loading,'lazy');
 assert.equal(station.id,item.id);
 assert.ok(station.children.some(n=>n.tag==='div'&&n.className==='cdu-frame-window'));
 assert.match(html,new RegExp('data-focus="'+item.id+'"'));
}
assert.equal(live.iframes.length,2);
assert.match(html,/data-focus="cdu-both"/);
assert.match(html,/<button id="resetCduCaptain" type="button" disabled>/);
assert.match(html,/app\.js\?v=[^"]*DUAL-CDU-CH11-ROUTE-PAGES-0001/);
assert.match(source,/if\(id===item\.id\|\|id==='cdu-both'\)child\.loading='eager'/);

const diagnostic=mount(true);
assert.equal(diagnostic.iframes.length,0);
assert.equal(diagnostic.frames.size,0);
assert.deepEqual(diagnostic.native.children.map(n=>[n.dataset.seat,n.dataset.runtime]),
 [['CAPT','OFF'],['FO','OFF']]);
console.log('PASS: CAPT and FO mount lazily in production; no-CDU diagnostic mounts neither iframe.');
