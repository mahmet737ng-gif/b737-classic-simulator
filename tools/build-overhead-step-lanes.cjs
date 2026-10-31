'use strict';
/* PERF-0008 incremental, isolated overhead bottleneck probes.
 * A: existing zero-JS pure GUI. B: identical GUI + CSS lamp/needle painting.
 * C: same plus real source-backed Electrical V7 core (not full ECU).
 * D: same plus real, existing training engine/APU interpolation kernels.
 * E: same plus an isolated iframe message roundtrip (not entire Unified).
 * All original source visuals, locked geometry and original full Unified stay untouched.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const atlas=require('../panel-mosaic-lab/interactive-overhead/model.js');
const root=path.resolve(__dirname,'..');
const target=path.join(root,'web-dist/panel-mosaic-lab/cockpit');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nr=v=>Number(v.toFixed(2));
const lights=read('panel-mosaic-lab/interactive-overhead/lights.json').lights;
const layout=read('panel-mosaic-lab/all-overhead/atlas-layout.json');
const places=new Map(layout.placements.map(p=>[p.id,p]));
const markers=lights.map((item,i)=>{
 const placement=places.get(item.placementId);
 assert.ok(placement,'Missing lantern plate '+item.id);
 const point=(x,y)=>atlas.mapPoint({id:item.id,sourcePoint:[x,y],bezelSourceDiameter:1},placement);
 const [x,y,w,h]=item.sourceRect,a=point(x,y),b=point(x+w,y+h);
 if(!(b.x>a.x&&b.y>a.y))throw Error('Invalid lamp area '+item.id);
 const color=/GREEN|EXT|VALVE/i.test(item.asset)?'#6af58a':/BLUE/i.test(item.asset)?'#83c9ff':/RED|FIRE/i.test(item.asset)?'#ff655d':/WHITE|ALIGN/i.test(item.asset)?'#fff7cf':'#ffc367';
 return '<span class="ab-lamp" data-lamp="'+esc(item.id)+'" title="'+esc(item.id)+'" style="left:'+nr(a.x)+'px;top:'+nr(a.y)+'px;width:'+nr(b.x-a.x)+'px;height:'+nr(b.y-a.y)+'px;--lamp-color:'+color+';--delay:'+(i%17)*-.31+'s"></span>';
}).join('');
const needles=Array.from({length:10},(_,i)=>'<span class="ab-needle" style="left:'+(120+i%5*420)+'px;top:'+(1590+Math.floor(i/5)*1280)+'px;--i:'+i+';--delay:'+(i%5)*-.22+'s" aria-hidden="true"></span>').join('');
const overlays='<div class="ab-light-layer" aria-label="112 simulated lamp faces" aria-hidden="true">'+markers+'</div>'+
 '<div class="ab-needle-layer" aria-label="ten nonfunctional demonstration needles" aria-hidden="true">'+needles+'</div>';
const Bstyle=`
 .ab-light-layer,.ab-needle-layer{position:absolute;inset:0;pointer-events:none}
 .ab-light-layer{z-index:8}.ab-needle-layer{z-index:7}
 .ab-lamp{position:absolute;background:var(--lamp-color);border-radius:16%;opacity:.05;
  filter:brightness(.9);box-shadow:0 0 7px var(--lamp-color);animation:abLamp 3.1s steps(1,end) infinite;animation-delay:var(--delay)}
 @keyframes abLamp{0%,32%,100%{opacity:.05}33%,72%{opacity:.85}73%{opacity:.17}}
 .ab-needle{position:absolute;display:block;width:9px;height:76px;background:linear-gradient(90deg,#dae1de,#819c9d);
  border-radius:80% 80% 35% 35%;transform-origin:50% 87%;animation:abNeedle 4s ease-in-out infinite alternate;animation-delay:var(--delay)}
 @keyframes abNeedle{from{transform:rotate(-45deg)}to{transform:rotate(68deg)}}
 .ab-note{position:fixed;bottom:8px;left:10px;z-index:100;background:#0a1725e8;color:#d6e5ea;border:1px solid #487a86;
 padding:8px 10px;border-radius:7px;font:12px/1.5 system-ui;direction:ltr;max-width:360px}
 .ab-note strong{color:#93e8d3}.ab-note a{color:#a7e1ef}
 .ab-live{position:fixed;top:82px;right:10px;z-index:115;background:#061921f0;border:1px solid #6da3ac;border-radius:8px;
 padding:10px 12px;color:#e7f5ef;min-width:220px;max-width:330px;font:12px/1.5 monospace;direction:ltr}
 .ab-live h3{font:700 13px system-ui;margin:0 0 5px}.ab-live button{cursor:pointer;background:#284a52;border:1px solid #779caa;color:white;padding:3px 5px;border-radius:4px}
 .ab-live pre{white-space:pre-wrap;max-width:330px;font:11px/1.5 monospace}
 `;
function basePage(){return fs.readFileSync(path.join(target,'overhead-ui-only.html'),'utf8');}
function version(index){
 const base=basePage();
 let html=base.replace('Pure Overhead UI — PERF-0007','Overhead Progressive A/B — PERF-0008/'+index);
 html=html.replace('</style>',Bstyle+'</style>');
 html=html.replace('</div></main>',overlays+'</div></main>');
 const title='PERF-0008 / '+index;
 const link=(id,file)=>'<a href="./'+file+'">'+id+'</a>';
 const nav='<div class="ab-note"><strong>'+title+'</strong> · '+(index==='B'?'CSS lamps/needles, zero JS':index==='C'?'Full B + actual Electrical V7 calculations':index==='D'?'Full C + actual engine/APU training dynamics':'Full D + measured iframe messages')+
 '<div>A '+link('Pure','overhead-ui-only.html')+' · B '+link('Visual','overhead-visual-only-v8.html')+
 ' · C '+link('Electrical','overhead-electrical-v8.html')+
 ' · D '+link('Engine','overhead-engine-v8.html')+
 ' · E '+link('Messaging','overhead-messaging-v8.html')+'</div></div>';
 html=html.replace('</body>',nav+'</body>');
 if(index!=='B'){
  const scripts=['<script src="../../engine/systems/electrical-v7.js"></script>'];
  if(index==='D'||index==='E')scripts.push('<script src="../../engine/integration/isn-engine-start-dynamics-v1.js"></script>','<script src="../../engine/integration/isn-apu-load-dynamics-v1.js"></script>');
  scripts.push('<script src="./overhead-progressive-v8.js" defer></script>');
  html=html.replace('</body>',scripts.join('')+'</body>');
 }
 if(index==='E'){
  html=html.replace('</body>','<iframe title="PERF-0008 lightweight message echo" id="abEchoFrame" width="0" height="0" style="display:none" src="./overhead-echo-v8.html"></iframe></body>');
 }
 html=html.replace('فقط تست گرافیک و کلیک — بدون JavaScript، موتور برق، بک‌اند یا CDU',
  index==='B'?'مرحله B: ۱۱۲ چراغ و ۱۰ عقربه متحرک، فقط CSS، بدون JavaScript':
  index==='C'?'مرحله C: اضافه شدن مدل واقعی Electrical V7 به رندر نمایشی':
  index==='D'?'مرحله D: اضافه شدن محاسبات آموزشی موتور و APU':
  'مرحله E: اضافه شدن ارسال پیام بین صفحه و iframe آزمایشی');
 const name={B:'overhead-visual-only-v8.html',C:'overhead-electrical-v8.html',D:'overhead-engine-v8.html',E:'overhead-messaging-v8.html'}[index];
 fs.writeFileSync(path.join(target,name),html);
 return {file:name,scripts:(html.match(/<script\b/g)||[]).length,lamps:(html.match(/class="ab-lamp"/g)||[]).length,needles:(html.match(/class="ab-needle"/g)||[]).length};
}
function build(){
 const results=['B','C','D','E'].map(version);
 assert.equal(results[0].scripts,0,'B visual must have no browser JavaScript');
 assert.deepEqual(results.map(x=>x.lamps),[112,112,112,112]);
 assert.deepEqual(results.map(x=>x.needles),[10,10,10,10]);
 const echo='<!doctype html><html lang="en"><meta charset="utf-8"><title>Test iframe echo</title><body>'+
 '<script>window.addEventListener("message",event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.kind!=="perf8-ping")return;parent.postMessage({kind:"perf8-pong",seq:event.data.seq},location.origin);});parent.postMessage({kind:"perf8-ready"},location.origin);</script></body></html>';
 fs.writeFileSync(path.join(target,'overhead-echo-v8.html'),echo);
 fs.writeFileSync(path.join(target,'overhead-progressive-v8-meta.json'),JSON.stringify({reference:'PERF-0007 pure GUI',images:'identical original composite',lamps:112,needles:10,lanes:results,warning:'Incremental training kernels, NOT full Unified simulation'},null,2)+'\n');
 console.log('PERF-0008 progressive pages '+JSON.stringify(results));
 return results;
}
if(require.main===module)build();
module.exports={build};
