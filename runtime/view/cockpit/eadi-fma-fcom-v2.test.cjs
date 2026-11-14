'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const engine=require('../../engine/afds/fma-mode-engine-v1.js');
const view=require('./eadi-fma-fcom-v2.js');
const index=fs.readFileSync(__dirname+'/index.html','utf8');
const eadi=fs.readFileSync(__dirname+'/eadi-stage1-unified-v1.js','utf8');
const frozen=JSON.parse(fs.readFileSync(__dirname+'/eis-main-final-layout-v1.json','utf8'));
assert.equal(view.VERSION,'EADI-FMA-FCOM-0004-CWS-AXIS');
assert.deepEqual(view.FIELDS,['at','pitch','roll','afds']);
assert.deepEqual(view.SECTION,['A/T MODE','PITCH MODE','ROLL MODE','AFDS MODE']);
assert.equal(view.LAYOUT.w,view.LAYOUT.segment*4);
assert.ok(view.LAYOUT.y+view.LAYOUT.h<=103);
assert.equal(eadi.includes('const ADI_CONTENT_SCALE=0.85;'),true);
assert.ok(index.includes('eadi-fma-fcom-v2.js?v=EADI-FMA-FCOM-0004-CWS-AXIS'));
assert.ok(index.indexOf('fma-mode-engine-v1.js')<
 index.indexOf('eadi-fma-four-v1.js'));
assert.ok(index.indexOf('eadi-fma-four-v1.js')<
 index.indexOf('eadi-fma-fcom-v2.js'));
const actions=[];
const ctx=new Proxy({},{get(t,k){
 if(k==='fillText')return(...args)=>actions.push(['text',...args]);
 if(k==='strokeRect')return(...args)=>actions.push(['rect',...args]);
 if(k==='fillRect')return(...args)=>actions.push(['ground',...args]);
 if(k==='moveTo')return(...args)=>actions.push(['move',...args]);
 if(k==='lineTo')return(...args)=>actions.push(['line',...args]);
 if(['save','restore','beginPath','stroke'].includes(k))return()=>{};
 return t[k];
},set(t,k,v){t[k]=v;return true;}});
const handlers={};const painter={},redraws=[];let last=0;
const output={
 schema:'B737_MCP_AFDS_OUTPUT_V1',power:true,
 controls:{atArm:true,fd:{left:true,right:false}},
 modes:{thrust:'SPEED',vertical:'ALT_HLD',lateral:'HDG_SEL',autopilot:'CMD_A'}
};
const win={
 B737FmaModeEngineV1:engine,
 B737McpAFDSBridgeV1:{getOutput:()=>output},
 B737UnifiedEADIStage1:{
  registerLayer(seat,name,callback){assert.equal(name,'fma');painter[seat]=callback;return()=>{};},
  snapshot:()=>({stations:{CAPT:{pitch:0,bank:0},FO:{pitch:0,bank:0}}}),
  setAttitude(seat,p,b){redraws.push(seat);}
 },
 addEventListener(name,fn){handlers[name]=fn;},
 setTimeout(){last++;return last;},
 clearTimeout(){},
 console:{warn(){}}
};
assert.equal(view.bind(win),true);
assert.equal(view.bind(win),true);
assert.deepEqual(Object.keys(painter),['CAPT','FO']);
assert.equal(view.getState('CAPT').fields.at.active,'MCP SPD');
assert.equal(view.getState('CAPT').fields.afds.active,'CMD');
assert.equal(view.getState('FO').fields.afds.active,'CMD');
const previous=view.getState('CAPT');
actions.length=0;
painter.CAPT(ctx);
// three separators only, no surrounding rectangular cell border
const lines=actions.filter(x=>x[0]==='line');
assert.equal(lines.length,3);
assert.equal(actions.filter(x=>x[0]==='ground').length,1);
assert.equal(actions.filter(x=>x[0]==='rect').length,0); // initial display has no fabricated mode change
const words=actions.filter(x=>x[0]==='text').map(x=>x[1]);
assert.deepEqual(words,['MCP SPD','ALT HOLD','HDG SEL','CMD']);
assert.ok(!words.includes('A/T MODE'),'Printed headings must not obscure reference font');
// An actual new MCP mode must transiently highlight ONLY that mode.
handlers['b737:mcp-afds-state']({detail:{
 ...output,modes:{...output.modes,lateral:'LNAV'}}});
actions.length=0;
view.render(ctx,'CAPT');
assert.equal(actions.filter(x=>x[0]==='rect').length,1,
 'FCOM changed-mode highlight must be temporary and per-mode');
actions.length=0;
view.render(ctx,'CAPT',Date.now()+15000);
assert.equal(actions.filter(x=>x[0]==='rect').length,0,
 'No permanent boxes after the 10s FCOM mode change highlight');
assert.equal(actions.filter(x=>x[0]==='line').length,3);
handlers['b737:mcp-afds-state']({detail:{...output,power:false}});
assert.equal(view.getState('CAPT').fields.at.active,'');
assert.equal(view.getState('FO').fields.afds.active,'');
assert.ok(redraws.includes('CAPT')&&redraws.includes('FO'));
assert.equal(frozen.eadi.stations.CAPT.w,198);
assert.equal(frozen.eadi.stations.FO.w,173.44);
console.log('PASS: Three white FMA dividers, green 4-mode lettering, 10s-only highlight and event-driven seat separation.');
