'use strict';
/* 737 Classic CWS FMA visual acceptance in CAPT and F/O, EIS/Conventional.
 * Source FCOM 4.10.18: CWS P/R are yellow in 4th AFDS STATUS field,
 * not the blank PITCH/ROLL fields, whether one or both axes are CWS.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const fma=require('../../engine/afds/fma-mode-engine-v1.js');
const view=require('./eadi-fma-fcom-v2.js');
const freeze=JSON.parse(fs.readFileSync(path.join(__dirname,'eis-main-final-layout-v1.json'),'utf8'));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.equal(view.VERSION,'EADI-FMA-FCOM-0004-CWS-AXIS');
assert.ok(html.includes('EADI-FMA-FCOM-0004-CWS-AXIS'));
assert.ok(html.includes('B737-FMA-ENGINE-0002-CWS-AXIS'));
assert.equal(freeze.status,'OWNER_FINAL_EIS_GEOMETRY');
const listeners={};
const layers={},repaints=[];
let out={
 schema:'B737_MCP_AFDS_OUTPUT_V1',power:true,
 controls:{atArm:false,fd:{left:true,right:true}},
 modes:{thrust:null,vertical:'VS',lateral:null,autopilot:'CMD_A'},
 axisControl:{pitch:'CMD',roll:'CWS'}
};
const w={
 B737FmaModeEngineV1:fma,
 B737McpAFDSBridgeV1:{getOutput:()=>out},
 B737UnifiedEADIStage1:{
  registerLayer(seat,name,fn){
   assert.equal(name,'fma');layers[seat]=fn;return()=>{};
  },
  snapshot:()=>({stations:{CAPT:{pitch:0,bank:0},FO:{pitch:0,bank:0}}}),
  setAttitude(seat,p,b){repaints.push({seat,p,b});}
 },
 addEventListener(name,fn){(listeners[name]??=[]).push(fn);},
 setTimeout(fn,ms){return 1;},
 clearTimeout(){},
 console:{warn(){}}
};
const emit=(name,detail)=>{for(const fn of listeners[name]||[])fn({detail});};
function rendered(seat,now=Date.now()+20000){
 const ops=[];
 const ctx=new Proxy({},{
  set(o,k,v){o[k]=v;return true;},
  get(o,k){
   if(k==='fillText')return(text,x,y)=>ops.push({kind:'text',text,x,y,color:o.fillStyle});
   if(k==='lineTo')return(x,y)=>ops.push({kind:'divider',x,y});
   if(k==='fillRect')return(...p)=>ops.push({kind:'background',p});
   if(k==='strokeRect')return(...p)=>ops.push({kind:'transient-border',p});
   if(['save','restore','beginPath','stroke','moveTo'].includes(k))return()=>{};
   return o[k];
  }
 });
 view.render(ctx,seat,now);
 assert.equal(ops.filter(x=>x.kind==='divider').length,3,'Only 3 white separators');
 return ops;
}
assert.equal(view.bind(w),true);
for(const seat of ['CAPT','FO']){
 assert.equal(view.getState(seat).fields.pitch.active,'V/S');
 assert.equal(view.getState(seat).fields.roll.active,'');
 assert.equal(view.getState(seat).fields.afds.active,'CWS R');
 const texts=rendered(seat).filter(x=>x.kind==='text');
 assert.deepEqual(texts.map(x=>x.text),['V/S','CWS R']);
 assert.equal(texts[1].color,view.COLOR.yellow);
}
out={...out,modes:{...out.modes,vertical:null},
 axisControl:{pitch:'CWS',roll:'CWS'}};
emit('b737:mcp-afds-state',out);
for(const seat of ['CAPT','FO']){
 const mode=view.getState(seat).fields;
 assert.equal(mode.pitch.active,'');
 assert.equal(mode.roll.active,'');
 assert.equal(mode.afds.active,'CWS P');
 assert.equal(mode.afds.secondary,'CWS R');
 const texts=rendered(seat).filter(x=>x.kind==='text');
 assert.deepEqual(texts.map(x=>x.text),['CWS P','CWS R']);
 assert.equal(texts[0].color,view.COLOR.yellow);
 assert.equal(texts[1].color,view.COLOR.yellow);
 assert.ok(texts[0].y<texts[1].y,'CWS statuses must be stacked');
}
out={...out,modes:{...out.modes,vertical:'ALT_HLD',lateral:'HDG_SEL'},
 axisControl:{pitch:'CMD',roll:'CMD'}};
emit('b737:mcp-afds-state',out);
assert.equal(view.getState('CAPT').fields.afds.active,'CMD');
assert.equal(view.getState('FO').fields.afds.secondary,'');
assert.deepEqual(rendered('CAPT').filter(x=>x.kind==='text').map(x=>x.text),
 ['ALT HOLD','HDG SEL','CMD']);
// F/D-only with A/P off and blank pitch/roll does not create CWS.
out={...out,modes:{...out.modes,autopilot:null,vertical:null,lateral:null},
 axisControl:{pitch:'OFF',roll:'OFF'}};
emit('b737:mcp-afds-state',out);
assert.equal(view.getState('CAPT').fields.afds.active,'FD');
assert.equal(view.getState('CAPT').fields.afds.secondary,'');
assert.ok(repaints.some(x=>x.seat==='CAPT'));
assert.ok(repaints.some(x=>x.seat==='FO'));
console.log('PASS: CWS P/R only in yellow AFDS column, two-line status, 3 white dividers and unchanged EADI layout.');
