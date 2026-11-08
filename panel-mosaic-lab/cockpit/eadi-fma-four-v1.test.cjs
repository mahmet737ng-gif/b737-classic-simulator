'use strict';
/* FCOM Classic four-column FMA; no glass, ADI, or immutable EIS changes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=require('./eadi-fma-four-v1.js');
const src=fs.readFileSync(__dirname+'/eadi-fma-four-v1.js','utf8');
const index=fs.readFileSync(__dirname+'/index.html','utf8');
const eadi=fs.readFileSync(__dirname+'/eadi-stage1-unified-v1.js','utf8');
assert.equal(api.VERSION,'EADI-FMA-FOUR-0001');
assert.deepEqual(api.FIELDS,['at','pitch','roll','afds']);
assert.deepEqual(api.LABELS,['A/T','PITCH','ROLL','A/P']);
assert.equal(api.LAYOUT.columnWidth*4,api.LAYOUT.w);
assert.ok(api.LAYOUT.y+api.LAYOUT.h<=101,'FMA does not obscure F/O bank pointer');
assert.equal(eadi.includes('const ADI_CONTENT_SCALE=0.85;'),true);
assert.equal(eadi.includes("const futureSlots=Object.freeze(['fma'"),true);
assert.ok(!src.includes('setInterval('),'No FMA polling is allowed');
assert.ok(!src.includes('requestAnimationFrame('),'No idle FMA render loop');
const mcp={schema:'B737_MCP_AFDS_OUTPUT_V1',power:true,
 controls:{atArm:true,fd:{left:true,right:false}},
 modes:{thrust:'SPEED',vertical:'ALT_HLD',lateral:'HDG_SEL',autopilot:null}};
assert.deepEqual(api.projectMcp(mcp,'CAPT'),{
 at:{active:'MCP SPD',armed:''},pitch:{active:'ALT HOLD',armed:''},
 roll:{active:'HDG SEL',armed:''},afds:{active:'FD'}});
assert.equal(api.projectMcp(mcp,'FO').afds.active,'');
assert.equal(api.projectMcp({...mcp,modes:{...mcp.modes,autopilot:'CMD_B'}},'FO').afds.active,'CMD');
assert.equal(api.projectMcp({...mcp,power:null},'CAPT').at.active,'');
assert.equal(api.projectMcp({...mcp,power:false},'CAPT').afds.active,'');
assert.equal(api.projectMcp({...mcp,schema:'UNVERIFIED'},'CAPT'),null);
assert.deepEqual(api.projectMcp({...mcp,controls:{atArm:true,fd:{left:false,right:false}},
 modes:{thrust:null,vertical:null,lateral:null,autopilot:null}},'CAPT').at,
 {active:'',armed:'ARM'});
api.setModes('CAPT',{at:{active:'N1'},pitch:{active:'VNAV PTH',armed:'G/S'},
 roll:{active:'LNAV'},afds:{active:'CMD'}},1000);
const before=api.snapshot('CAPT');
assert.equal(before.fields.pitch.armed,'G/S');
assert.throws(()=>api.setModes('CAPT',{roll:{active:'APPROACH-UNKNOWN'},pitch:{active:''}},1200),/Unsupported/);
assert.deepEqual(api.snapshot('CAPT'),before,'Invalid AFDS input must be atomic');
assert.equal(api.snapshot('FO').fields.pitch.active,'','Captain cannot overwrite F/O');
const draw=[];
const ctx=new Proxy({},{get(t,k){
 if(k==='fillText')return(...args)=>{draw.push(['text',...args])};
 if(k==='strokeRect')return(...args)=>{draw.push(['border',...args])};
 if(k==='fillRect')return(...args)=>{draw.push(['ground',...args])};
 if(k==='save'||k==='restore'||k==='beginPath'||k==='moveTo'||k==='lineTo'||k==='stroke')return()=>{};
 return t[k];
},set(t,k,v){t[k]=v;return true;}});
api.render(ctx,'CAPT',1100);
for(const [i,label]of api.LABELS.entries()){
 const k=draw.findIndex(d=>d[0]==='text'&&d[1]===label);
 assert.ok(k>=0,'Missing FMA section '+label);
 if(i)assert.ok(draw.findIndex(d=>d[0]==='text'&&d[1]===api.LABELS[i-1])<k,
 'Classic sequence must be A/T – PITCH – ROLL – A/P');
}
for(const label of ['N1','VNAV PTH','G/S','LNAV','CMD'])
 assert.ok(draw.some(d=>d[0]==='text'&&d[1]===label),'missing FMA state '+label);
assert.ok(draw.filter(d=>d[0]==='border').length>=5,'Four boxes + mode highlight');
const callbacks=new Map(),events=new Map(),redraw=[];
const win={
 B737UnifiedEADIStage1:{
  registerLayer(seat,name,cb){
   assert.equal(name,'fma');callbacks.set(seat,cb);return()=>{};
  },
  mount(){},
  snapshot(){return{stations:{CAPT:{pitch:0,bank:0},FO:{pitch:0,bank:0}}}},
  setAttitude(seat,p,b){redraw.push([seat,p,b]);}
 },
 addEventListener(name,cb){events.set(name,cb)},
 setTimeout(fn,ms){assert.ok(ms>0&&ms<=10000);return 1;},
 clearTimeout(){},
 document:{readyState:'complete'}
};
assert.equal(api.bind(win),true);
assert.deepEqual([...callbacks.keys()],['CAPT','FO']);
assert.equal(api.bind(win),true,'bind is idempotent');
assert.equal(callbacks.size,2);
assert.equal(api.applyAfds(mcp),true);
assert.equal(api.snapshot('CAPT').fields.at.active,'MCP SPD');
assert.equal(api.snapshot('CAPT').fields.afds.active,'FD');
assert.equal(api.snapshot('FO').fields.afds.active,'');
events.get('b737:mcp-afds-state')({detail:{...mcp,power:false}});
for(const seat of ['CAPT','FO']){
 const x=api.snapshot(seat).fields;
 assert.equal(x.at.active,'');
 assert.equal(x.pitch.active,'');
 assert.equal(x.roll.active,'');
 assert.equal(x.afds.active,'');
 assert.ok(callbacks.get(seat));
}
assert.ok(redraw.some(x=>x[0]==='CAPT'));
assert.ok(redraw.some(x=>x[0]==='FO'));
const start=index.indexOf('eadi-stage1-unified-v1.js');
const plug=index.indexOf('eadi-fma-four-v1.js');
assert.ok(start>=0&&plug>start,'FMA script must run AFTER EADI extension slots');
assert.ok(index.includes('EADI-FMA-FOUR-0001'));
console.log('PASS: Classic 4 FMA sections, live powered MCP modes, white ARM, isolated seats, no fabricated state, frozen ADI geometry.');
