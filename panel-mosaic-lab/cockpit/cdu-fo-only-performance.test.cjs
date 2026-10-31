'use strict';
/* This test executes the real Unified CDU mounting loop with a minimal DOM,
 * ensuring the Captain iframe is never constructed or assigned a URL. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const assembly=JSON.parse(fs.readFileSync(path.join(__dirname,'assembly.json'),'utf8'));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const start=source.indexOf('for(const item of assembly.embeddedInstruments||[])');
const end=source.indexOf('  const gallery=byId(',start);
assert.ok(start>=0&&end>start,'Original CDU mounting loop still exists');
const loop=source.slice(start,end);
assert.match(source,/const ENABLED_CDU_SEAT='FO'/);
assert.match(loop,/if\(item\.seat!==ENABLED_CDU_SEAT\)/);
assert.ok(loop.indexOf('continue;')<loop.indexOf("document.createElement('iframe')"),
 'Captain must exit before creating its iframe');
assert.ok(loop.indexOf("document.createElement('iframe')")<loop.indexOf('cduFrames.set('),
 'Only a loaded FO frame can register with FMC peer session');

const nodes=[],iframes=[];
function node(tag){
 const el={tag,children:[],style:{},dataset:{},attributes:{},className:'',textContent:'',
  classList:{values:new Set(),add(...names){names.forEach(n=>this.values.add(n))},contains(n){return this.values.has(n)}},
  append(child){this.children.push(child)},
  setAttribute(name,value){this.attributes[name]=value},
  querySelector(selector){if(selector==='.region-native')return this.native;return null}};
 nodes.push(el);
 if(tag==='iframe')iframes.push(el);
 return el;
}
const native=node('native'),region=node('section');region.native=native;
const doc={createElement:node},frames=new Map();
const view={instrumentPresentation:i=>({left:0,top:0,scaleX:i.w/i.nativeWidth,scaleY:i.h/i.nativeHeight})};
new Function('assembly','document','model','byId','cduFrames','ENABLED_CDU_SEAT',loop)(
 assembly,doc,view,id=>id==='region-main'?region:null,frames,'FO');
assert.equal(iframes.length,1,'Only one iframe must be created');
assert.equal(iframes[0].id,'cduFrameFO');
assert.match(iframes[0].src,/seat=FO/);
assert.equal(frames.size,1);
assert.ok(frames.has('FO'));
assert.equal(frames.has('CAPT'),false);
const captain=native.children.find(n=>n.id==='cdu-captain');
assert.ok(captain,'Captain footprint must remain registered');
assert.equal(captain.dataset.runtime,'OFF');
assert.equal(captain.style.pointerEvents,'none');
assert.ok(captain.classList.contains('cdu-disabled'));
assert.equal(captain.children.some(n=>n.tag==='iframe'),false);
assert.equal(captain.children.at(-1).textContent,'CDU OFF');
const officer=native.children.find(n=>n.id==='cdu-first-officer');
assert.ok(officer.children.some(n=>n.tag==='div'&&n.className==='cdu-frame-window'));
assert.match(html,/<button data-focus="cdu-first-officer">نمایش CDU فرست‌آفیسر<\/button>/);
assert.match(html,/<button id="resetCduCaptain" type="button" hidden disabled/);
assert.match(html,/app\.js\?v=[^"]*FO-ONLY-20261031/);
assert.match(source,/const c=cduFrames.get\(ENABLED_CDU_SEAT\)/);
assert.equal(assembly.embeddedInstruments.length,2,
 'Retain both approved reference footprints without editing image registration');
assert.deepEqual([...frames.keys()],['FO']);
console.log('PASS: CAPT iframe=0 / FO iframe=1; no captain DOM runtime or network URL; FO session and layout retained');
