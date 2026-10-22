const assert=require('node:assert/strict');
const fs=require('fs');const vm=require('vm');const path=require('path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([A-Za-z0-9-]+)"/g)].map(m=>m[1]);
const registry=new Map();
function fake(tag='div'){
 const classes=new Set();return {tagName:tag.toUpperCase(),children:[],style:{},dataset:{},attributes:{},
 classList:{toggle(x,on){if(on===undefined){if(classes.has(x))classes.delete(x);else classes.add(x)}else if(on)classes.add(x);else classes.delete(x);},contains(x){return classes.has(x)},add(x){classes.add(x)}},
 addEventListener(event,fn){this['on'+event]=fn;},appendChild(child){this.children.push(child);return child;},
 setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k]},
 set innerText(x){this.textContent=x;},get innerText(){return this.textContent;},value:'',checked:false,textContent:'',src:''};
}
for(const id of ids)registry.set(id,fake('div'));
let onReady;
const document={getElementById(id){return registry.get(id)},createElement:fake,addEventListener(event,handler){if(event==='DOMContentLoaded')onReady=handler;}};
const ctx={document,console,window:null};ctx.window=ctx;vm.createContext(ctx);
for(const script of ['data/efis-map.js','engine.js','gestures.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,script),'utf8'),ctx,{filename:script});
assert.equal(typeof onReady,'function');onReady();
assert.equal(registry.get('hits').children.length,14);
assert.equal(registry.get('knobs').children.length,6);
assert.equal(registry.get('mode-read').textContent,'MAP');
assert.ok(registry.get('source-preview').src.endsWith('ehsi-map.png'));
const hit=id=>registry.get('hits').children.find(el=>el.dataset.id===id);
assert.ok(hit('EHSI_MODE'));hit('EHSI_MODE').onclick({});
assert.equal(registry.get('mode-read').textContent,'CTR MAP');
assert.ok(registry.get('source-preview').src.endsWith('ehsi-ctr_map.png'));
assert.ok(hit('WXR_BRT_INNER').classList.contains('inner-zone'));
assert.ok(hit('TFC').classList.contains('inner-zone'));
hit('NAV_AID').onclick({});hit('ARPT').onclick({});
assert.ok(registry.get('lights').children.find(x=>x.dataset.light==='NAV_AID').classList.contains('visible'));
hit('EHSI_RANGE').onclick({});assert.equal(registry.get('range-read').textContent,'20 NM');
assert.equal(registry.get('control-read').textContent.includes('10.30.4 #8'),true);
hit('DH_RST').onclick({});assert.match(registry.get('event-read').textContent,/RESET/);
console.log('PASS: DOM init, 14 controls, six FCOM-source knob sprites, mode image switching, selected overlays, independent ring centers');


// Mouse wheel scroll changes rotary detents; it never presses WXR pushbutton.
const range=hit('EHSI_RANGE'), wxr=hit('WXR');
let wheelPrevented=0;
const wheelEvent=deltaY=>({deltaY,deltaMode:0,preventDefault(){wheelPrevented++}});
range.onwheel(wheelEvent(-120));
assert.equal(registry.get('range-read').textContent,'40 NM');
wxr.onwheel(wheelEvent(-120));
assert.equal(registry.get('lights').children.find(x=>x.dataset.light==='WXR').classList.contains('visible'),false);
assert.equal(wheelPrevented,1);
// Touch/iPad swipe increments by one per 28px; synthesized click after swipe is swallowed.
const mode=hit('EHSI_MODE');
mode.onpointerdown({pointerId:12,button:0,clientX:100,clientY:100});
mode.onpointermove({pointerId:12,clientX:100,clientY:66,preventDefault(){}});
mode.onpointerup({pointerId:12});
assert.equal(registry.get('mode-read').textContent,'PLAN');
mode.onclick({preventDefault(){}});
assert.equal(registry.get('mode-read').textContent,'PLAN');
// A fresh tap still works.
mode.onpointerdown({pointerId:13,button:0,clientX:100,clientY:100});
mode.onpointerup({pointerId:13});
mode.onclick({});
assert.equal(registry.get('mode-read').textContent,'FULL NAV');
// Inner and outer concentric knobs are independent.
const outer=hit('EHSI_BRT_OUTER'),inner=hit('WXR_BRT_INNER');
outer.onwheel(wheelEvent(-100));
assert.match(registry.get('event-read').textContent,/EHSI_BRT_OUTER/);
inner.onwheel(wheelEvent(-100));
assert.match(registry.get('event-read').textContent,/WXR_BRT_INNER/);
console.log('PASS: wheel, touch swipe, tap, suppression of synthesized click, independent concentric controls');