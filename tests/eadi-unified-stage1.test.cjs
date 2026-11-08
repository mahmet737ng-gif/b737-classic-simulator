/* B737 EADI Stage 1: no-polling, independent-seat and future-layer contract. */
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/../panel-mosaic-lab/cockpit/eadi-stage1-unified-v1.js','utf8');
let timers=0,draws=0;
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={};this.parentElement=null;this.isConnected=false;}
 appendChild(child){this.children.push(child);child.parentElement=this;child.isConnected=true;}
 setAttribute(){}
 querySelector(q){if(q==='canvas')return this.children.find(c=>c.tag==='canvas');const m=q.match(/data-eadi-stage1-seat="(CAPT|FO)"/);return m?this.children.find(x=>x.dataset.eadiStage1Seat===m[1]):null;}
 getContext(){return new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get(t,k){if(k in t)return t[k];return()=>{if(k==='fill'||k==='stroke')draws++;}},set(t,k,v){t[k]=v;return true;}});}
}
const native=new Element('div'),events={},doc={readyState:'complete',querySelector:s=>s==='#region-main .region-native'?native:null,createElement:t=>new Element(t)};
const root={document:doc,addEventListener:(name,fn)=>events[name]=fn,requestAnimationFrame:()=>timers++,setInterval:()=>timers++};
vm.runInNewContext(code,{window:root,document:doc,console,Math,Map,Object,Number,String,TypeError,Error});
const a=root.B737UnifiedEADIStage1;
assert.equal(a.snapshot().mounted,true);
assert.equal(native.children.length,2);
const capt=a.snapshot().stations.CAPT,fo=a.snapshot().stations.FO;
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.011,
  'EADI socket coordinate drift: '+actual+' should equal '+expected);
close(fo.x,1612.75);close(fo.y,263.40);close(fo.w,173.44);close(fo.h,147.14);
close(capt.x,343.36);
close(capt.y,229.31);
close(capt.w,165.63);
close(capt.h,146.32);
assert.equal(native.children[0].style.borderRadius,'7% / 8%');
assert.equal(native.children[1].style.borderRadius,'7% / 8%');
assert.ok(draws>0);
assert.equal(a.snapshot().futureSlots.length,11);
assert.equal(a.setAttitude('CAPT',7.5,24).bank,24);
assert.equal(a.snapshot().stations.FO.pitch,0);
a.setAttitude('FO',-10,-30);
assert.equal(a.snapshot().stations.CAPT.pitch,7.5);
assert.equal(a.snapshot().stations.FO.pitch,-10);
a.setPower('FO',false);
assert.equal(a.snapshot().stations.FO.powered,false);
events['b737:cockpit-mounted']();
assert.equal(native.children.length,2);
assert.equal(timers,0);
console.log('EADI STAGE1 TESTS PASSED');
