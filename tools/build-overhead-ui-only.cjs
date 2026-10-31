'use strict';
/* PERF-0007 — test-only, real no-JavaScript Overhead. Generates native HTML/CSS
 * from the approved map and approved owner sprites. It deliberately does not
 * load electrical engines, animations, iframe, event bridges or simulations.
 * This file executes in CI ONLY. Zero scripts execute in its generated page.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const map=require('../panel-mosaic-lab/interactive-overhead/model.js');
const root=path.resolve(__dirname,'..');
const source='panel-mosaic-lab/cockpit',interactive='panel-mosaic-lab/interactive-overhead';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const esc=v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const n=v=>Number(v.toFixed(4));
const toRelative=(origin,ref)=>path.posix.relative(source,path.posix.normalize(path.posix.join(origin,ref)));
const cssUrl=v=>'url("'+String(v).replace(/"/g,'%22')+'")';
function build(){
 const toggle=read(interactive+'/registry.json');
 const rotary=read(interactive+'/rotary-guards.json');
 const extra=read(interactive+'/lights-controls.json');
 const owner=read(source+'/guard-owner18-v1.json');
 const layout=read('panel-mosaic-lab/all-overhead/atlas-layout.json');
 const places=new Map(layout.placements.map(c=>[c.id,c]));
 const orig=(ref)=>toRelative(interactive,ref);
 const ownerImage=(color,name)=>toRelative(source,owner.artworkRoot+'runtime/'+owner.imageFiles[color][name]);
 const toggleSprite={
  Small:orig(toggle.visualFamilies.Small.asset),
  Standard:orig(toggle.assets['vertical-on'].url),
  down:orig(toggle.assets['vertical-off'].url)
 };
 const rotaryControls=[...rotary.rotaries,...extra.rotaries];
 const overheadGuards=owner.controls.filter(c=>places.has(c.panel));
 assert.equal(toggle.controls.length,58,'Unexpected approved overhead toggles');
 assert.equal(rotaryControls.length,20,'Unexpected approved overhead rotary registry');
 assert.equal(overheadGuards.length,13,'Unexpected owner-approved overhead guards count');
 const classes=[];
 const input=(key,i,checked,state)=>'<input class="state state-'+i+(i===state.last?' state-last':'')+'" id="'+key+'s'+i+'" name="'+key+'" type="radio" value="'+esc(state.value)+'" aria-label="'+esc(state.value)+'"'+(checked?' checked':'')+'>';
 function radios(key,values,selected){
  let html='';
  for(let i=0;i<values.length;i++)html+=input(key,i,i===selected,{last:values.length-1,value:values[i]});
  return html;
 }
 const nextLabels=(key,values)=>values.map((value,i)=>'<label class="cycle next-'+i+'" for="'+key+'s'+((i+1)%values.length)+'" title="'+esc(value)+' → '+esc(values[(i+1)%values.length])+'"></label>').join('');
 const readout=(label,values)=>'<span class="readout"><strong>'+esc(label)+'</strong> · '+values.map((value,i)=>'<span class="v'+i+'">'+esc(value)+'</span>').join('')+'</span>';
 let count=0;
 const toggles=toggle.controls.map((c,index)=>{
  const p=map.mapPoint(c,places.get(c.placementId));
  const values=c.states,selected=Math.max(0,values.indexOf(c.default));
  const key='t'+index,small=c.visualFamily==='Small',poses=c.axis==='horizontal'?[0,1,2]:(values.length===2?[3,4]:[3,1,4]);
  const vars=poses.map((frame,i)=>'--pos'+i+':'+n(frame*25)+'%;').join('');
  const style='left:'+n(p.x)+'px;top:'+n(p.y)+'px;width:'+n(p.diameter*1.65)+'px;height:'+n(p.diameter*1.65)+'px;'+vars+
   '--sprite:'+cssUrl(small?toggleSprite.Small:toggleSprite.Standard)+';--down:'+cssUrl(toggleSprite.down)+';'+
   '--size:'+n(p.diameter*1024/390)+'px;';
  return '<div class="ctl toggle" data-name="'+esc(c.id)+'" data-family="'+(small?'Small':'Standard')+'" data-axis="'+c.axis+'" role="group" aria-label="'+esc(c.label)+'" style="'+style+'">'+
    radios(key,values,selected)+'<span class="face" aria-hidden="true"></span>'+nextLabels(key,values)+readout(c.label,values)+'</div>';
 }).join('');
 const rotaries=rotaryControls.map((c,index)=>{
  const p=map.mapPoint(c,places.get(c.placementId)),key='r'+index;
  const values=c.mode==='continuous'?Array.from({length:11},(_,i)=>Math.round((c.min+(c.max-c.min)*i/10)*10)/10):c.states;
  const angles=c.mode==='continuous'?values.map(v=>c.angleMin+(v-c.min)/(c.max-c.min)*(c.angleMax-c.angleMin)):c.angles;
  const selected=c.mode==='continuous'?values.reduce((best,v,i)=>Math.abs(v-c.default)<Math.abs(values[best]-c.default)?i:best,0):Math.max(0,values.indexOf(c.default));
  const w=(c.imageAspect?p.diameter*1.5:p.diameter*288/204)*(c.renderScale||1),h=c.imageAspect?w/c.imageAspect:w*279/288;
  const pivot=c.visualPivot||[.5,.44];
  const style='left:'+n(p.x)+'px;top:'+n(p.y)+'px;width:'+n(p.diameter*1.10)+'px;height:'+n(p.diameter*1.25)+'px;'+
   angles.map((angle,i)=>'--angle'+i+':'+n(angle)+'deg;').join('');
  const pic=orig(rotary.assets[c.asset].url);
  const img='<img class="rotary-picture" src="'+esc(pic)+'" draggable="false" alt="" style="width:'+n(w)+'px;height:'+n(h)+'px;left:calc(50% - '+n(w*pivot[0])+'px);top:calc(50% - '+n(h*pivot[1])+'px);transform-origin:'+n(pivot[0]*100)+'% '+n(pivot[1]*100)+'%">';
  let legend='';
  if(c.legendAreas){
   for(const [detent,h] of Object.entries(c.legendAreas)){
    const state=values.indexOf(detent);if(state<0)continue;
    const pts=h.map(pt=>map.mapPoint({...c,sourcePoint:pt,bezelSourceDiameter:0},places.get(c.placementId)));
    const xx=pts.map(p=>p.x),yy=pts.map(p=>p.y),left=Math.min(...xx),top=Math.min(...yy);
    const width=Math.max(...xx)-left,height=Math.max(...yy)-top;
    if(width<=0||height<=0)continue;
    const clip='polygon('+pts.map(p=>n((p.x-left)/width*100)+'% '+n((p.y-top)/height*100)+'%').join(',')+')';
    legend+='<label class="detent-legend" for="'+key+'s'+state+'" aria-label="'+esc(c.label+' '+detent)+'" title="'+esc(detent)+'" style="left:'+n(left)+'px;top:'+n(top)+'px;width:'+n(width)+'px;height:'+n(height)+'px;clip-path:'+clip+'"></label>';
   }
  }
  return '<div class="ctl rotary" data-name="'+esc(c.id)+'" role="group" aria-label="'+esc(c.label)+'" style="'+style+'">'+
    radios(key,values,selected)+img+nextLabels(key,values)+readout(c.label,values)+'</div>'+legend;
 }).join('');
 const guards=overheadGuards.map((c,index)=>{
  const place=places.get(c.panel),[x,y,w,h]=c.rectPx;
  const a=map.mapPoint({id:c.id,sourcePoint:[x,y],bezelSourceDiameter:0},place);
  const b=map.mapPoint({id:c.id,sourcePoint:[x+w,y+h],bezelSourceDiameter:0},place);
  const key='g'+index,states=c.states,selected=Math.max(0,states.indexOf(c.initialState));
  const angle=owner.rules.rotateDegrees[c.hinge],assets={closed:ownerImage(c.color,'closed')};
  for(let i=0;i<states.length;i++)assets['open'+i]=ownerImage(c.color,states.length===2?(i===0?'open_up':'open_down'):['open_up','open_center','open_down'][i]);
  const vars=Object.entries(assets).map(([k,v])=>'--'+k+':'+cssUrl(v)+';').join('');
  const style='left:'+n(a.x)+'px;top:'+n(a.y)+'px;width:'+n(b.x-a.x)+'px;height:'+n(b.y-a.y)+'px;--guard-rotation:'+angle+'deg;'+vars;
  const choices=states.map((v,i)=>'<label for="'+key+'s'+i+'" title="'+esc(v)+'">'+esc(v)+'</label>').join('');
  return '<details class="ctl guard" data-name="'+esc(c.id)+'" style="'+style+'">'+
   '<summary title="'+esc(c.label)+' · click to open or close guard"><span class="guard-photo"></span><span class="readout"><strong>'+esc(c.label)+'</strong> · cover</span></summary>'+
   radios(key,states,selected)+'<div class="choices">'+choices+'</div></details>';
 }).join('');
 let rules='';
 for(let i=0;i<11;i++){
  rules+='.rotary .state-'+i+':checked~.rotary-picture{transform:rotate(var(--angle'+i+'));}\n';
 }
 for(let i=0;i<3;i++){
  rules+='.toggle .state-'+i+':checked~.face{background-position:var(--pos'+i+');}\n';
  rules+='.guard[open]:has(.state-'+i+':checked) .guard-photo{background-image:var(--open'+i+');}\n';
 }
 for(let i=0;i<11;i++){
  rules+='.ctl:has(.state-'+i+':checked) .next-'+i+'{display:block;}\n';
  rules+='.ctl .state-'+i+':checked~.readout .v'+i+'{display:inline;}\n';
 }
 const html='<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="theme-color" content="#09151d"><title>B737 Classic | Pure Overhead UI — PERF-0007</title><style>'+
  `*{box-sizing:border-box}html,body{margin:0;height:100%;background:#061018;color:#e8f2f5;font:14px/1.5 system-ui,sans-serif}
  .top{height:82px;padding:9px 16px;display:flex;gap:18px;align-items:center;justify-content:space-between;background:#101f28;border-bottom:1px solid #3b6372;position:relative;z-index:100}
  .top b{font-size:16px}.top small{display:block;color:#92bbca;font-size:11px}.controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .controls input{position:absolute;width:1px;height:1px;opacity:0}.controls label{background:#203541;border:1px solid #60818e;border-radius:6px;padding:5px 9px;cursor:pointer;font-size:12px}
  .controls input:checked+label{background:#366a75;color:white;border-color:#8edfe7}
  .viewport{height:calc(100dvh - 82px);width:100%;overflow:auto;direction:ltr;overscroll-behavior:contain}
  .board{position:relative;width:2220px;height:3312px;zoom:.35;background:url("./assets/overhead-composite-test.webp") 0 0 / 2220px 3312px no-repeat #212d35}
  .ctl{position:absolute;transform:translate(-50%,-50%);z-index:20;isolation:isolate;touch-action:manipulation}
  .ctl .state{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
  .ctl .cycle{position:absolute;inset:0;z-index:2;display:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .ctl .readout{display:none;position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:#041c29f0;border:1px solid #69adc0;border-radius:5px;padding:4px 7px;color:#e3fbfa;min-width:140px;max-width:280px;font:13px/1.3 system-ui;text-align:center;pointer-events:none;white-space:normal;z-index:200}
  .ctl:hover>.readout,.ctl:focus-within>.readout{display:block}
  .readout .v0,.readout .v1,.readout .v2,.readout .v3,.readout .v4,.readout .v5,.readout .v6,.readout .v7,.readout .v8,.readout .v9,.readout .v10{display:none}
  .toggle .face{display:block;position:absolute;top:50%;left:50%;width:var(--size);height:var(--size);transform:translate(-50%,-50%);background:var(--sprite) no-repeat 75% 50% / 500% 100%;pointer-events:none}
  .toggle[data-family="Standard"] .state-last:checked~.face{background-image:var(--down);background-size:100% 100%;background-position:50% 50%}
  .rotary .rotary-picture{display:block;position:absolute;max-width:none;pointer-events:none;transition:transform .09s linear;user-select:none}
  .detent-legend{position:absolute;z-index:25;cursor:pointer}.detent-legend:hover{background:rgba(86,212,232,.12)}
  .guard{z-index:40;transform:none;isolation:unset}.guard summary{display:block;width:100%;height:100%;list-style:none;cursor:pointer;position:relative}
  .guard summary::-webkit-details-marker{display:none}.guard .guard-photo{position:absolute;inset:0;background:var(--closed) center / 100% 100% no-repeat;transform:rotate(var(--guard-rotation));pointer-events:none}
  .guard[open] .choices{display:flex;flex-direction:column;position:absolute;z-index:70;left:75%;top:100%;min-width:145px;padding:5px;gap:4px;background:#102530;border:1px solid #71b1c6;border-radius:7px;box-shadow:0 7px 24px #000b}
  .guard .choices{display:none}.guard .choices label{display:block;font:11px/1.3 system-ui;cursor:pointer;text-align:center;color:#d8f7f7;padding:5px 7px;border:1px solid #526d78;border-radius:4px}
  .guard .choices label:hover{background:#285363}
  .guard[open] summary .readout{display:block;color:#9ce1ed}
  .legend{padding:8px 16px;font-size:12px;color:#9fc2c9;background:#101c23;border-top:1px solid #365464}
  body:has(#z20:checked) .board{zoom:.2}body:has(#z35:checked) .board{zoom:.35}body:has(#z50:checked) .board{zoom:.5}body:has(#z75:checked) .board{zoom:.75}body:has(#z100:checked) .board{zoom:1}
  @media(max-width:600px){.top{height:106px;padding:6px 9px;display:block}.top b{font-size:13px}.top small{font-size:10px}.controls{margin-top:6px;gap:5px}.viewport{height:calc(100dvh - 106px)}}
 `+rules+'</style></head><body data-no-js="true">'+
 '<header class="top"><div><b>737 CLASSIC · OVERHEAD · UI ONLY</b><small>فقط تست گرافیک و کلیک — بدون JavaScript، موتور برق، بک‌اند یا CDU</small></div>'+
 '<div class="controls"><span>ZOOM</span>'+[[20,'20%'],[35,'35%'],[50,'50%'],[75,'75%'],[100,'100%']].map(([v,label])=>'<input type="radio" id="z'+v+'" name="zoom"'+(v===35?' checked':'')+'><label for="z'+v+'">'+label+'</label>').join('')+'</div></header>'+
 '<main class="viewport"><div class="board" id="overheadPurePanel" role="group" aria-label="B737 overhead visual-only clickable control panel">'+toggles+rotaries+guards+'</div></main>'+
 '<footer class="legend">کلیک روی سوییچ: تغییر حالت ظاهری · کلیک روی ناب: حرکت به موقعیت بعدی · کلیک روی گارد: باز و بسته، سپس انتخاب وضعیت · اسکرول برای جابه‌جایی · بدون محاسبات فنی و بدون ذخیرهٔ وضعیت</footer>'+
 '</body></html>';
 assert.ok(!/<script\b/i.test(html),'Absolutely no JavaScript is allowed in the pure UI experiment');
 assert.ok(!/<iframe\b/i.test(html),'No hidden simulation iframes allowed');
 const output=path.join(root,'web-dist',source,'overhead-ui-only.html');
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);
 const info={file:'overhead-ui-only.html',controls:{toggles:toggle.controls.length,rotaries:rotaryControls.length,guards:overheadGuards.length},runtimeScripts:0,backendCalls:0,width:2220,height:3312};
 fs.writeFileSync(path.join(root,'web-dist',source,'overhead-ui-only-meta.json'),JSON.stringify(info,null,2)+'\n');
 console.log('PERF-0007 PURE UI TEST '+JSON.stringify(info));
 return info;
}
if(require.main===module)build();
module.exports={build};
