'use strict';
const assert=require('node:assert/strict');
const Model=require('../../engine/efis/classic-speed-tape-engine-v1.js');
const Tape=require('./eadi-speed-tape-v1.js');
const ys=new Map();
const canvas=new Proxy({},{get:(t,k)=>{
 if(k==='fillText')return (string,x,y)=>{const v=String(string);if(/^(240|260|280|300|320|340)$/.test(v)&&x<210)ys.set(v,y);};
 if(k==='measureText')return () =>({width:30});
 if(k==='createLinearGradient')return()=>({addColorStop(){}});
 if(k==='canvas')return{width:900,height:720};
 return (...args)=>{};
},set:(t,k,v)=>{t[k]=v;return true;}});
function paint(ias,time){
 let s=Model.initialState('CAPT');
 s=Model.transition(s,{type:'ADC',valid:true,casKt:ias,timeMs:time,pressureAltitudeFt:2000});
 ys.clear();Tape.draw(canvas,Model.view(s));
 return Object.fromEntries(ys);
}
const at280=paint(280,1000);
const at300=paint(300,2000);
assert.ok(at280[300]<at280[280], 'High IAS number must be ABOVE low IAS, not below');
assert.ok(at300[320]<at300[280], '320 kt must be above 280 kt on speed tape');
assert.ok(at300[300]>at280[300],
 'As actual IAS increases, existing 300-kt tick scrolls DOWN toward the current-speed index');
assert.equal(Tape.TAPE.pxPerKt,5.2);
const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'eadi-speed-tape-v1.js'),'utf8');
// In the rolling CAS window the NEXT numeral must enter from ABOVE and
// travel downward when IAS increases. This matches existing scale tick motion
// and photo-instrument / standby drums.
assert.ok(source.includes('[[1,f.previous],[0,f.digit],[-1,f.next]]'),
 'EADI upcoming IAS drum number must be above current digit');
assert.ok(source.includes('y+(j+f.fraction)*34'),
 'EADI digits must move DOWN with increasing indicated speed');

console.log('PASS EADI IAS scale: high speeds above lower speeds and correct downward tape scroll on acceleration');
