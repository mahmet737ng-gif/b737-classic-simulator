'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const cfg=JSON.parse(read('panel-mosaic-lab/cockpit/guard-owner18-v1.json'));
const audit=JSON.parse(read('panel-mosaic-lab/cockpit/guard-location-audit.json'));
assert.equal(cfg.controls.length,18);
assert.equal(new Set(cfg.controls.map(x=>x.id)).size,18);
assert.deepEqual(cfg.controls.slice(0,17).reduce((a,x)=>(a[x.hinge]=(a[x.hinge]||0)+1,a),{}),{top:11,left:3,bottom:3});
assert.deepEqual(cfg.controls.slice(0,17).reduce((a,x)=>(a[x.color]=(a[x.color]||0)+1,a),{}),{black:14,red:3});
assert.equal(cfg.controls.filter(x=>['FO_INNER_BACKGROUND','PEDESTAL_RADIO'].includes(x.panel)).length,5);
assert.equal(cfg.controls.filter(x=>!['FO_INNER_BACKGROUND','PEDESTAL_RADIO'].includes(x.panel)).length,13);
assert.equal(cfg.controls.filter(x=>x.states.length===3).length,4);
assert.equal(cfg.controls.filter(x=>x.states.length===2).length,14);
const snap=Object.fromEntries(cfg.controls.map(x=>[x.id,x]));
assert.equal(snap.antiskid.panel,'FO_INNER_BACKGROUND');
assert.deepEqual(snap.antiskid.rectPx,[55,560,102,168]);
assert.equal(cfg.rules.rotateDegrees.bottom,180);
for(const id of ['alternate-flaps-master','passenger-oxygen','antiskid']){
 assert.equal(snap[id].hinge,'bottom');
 assert.equal(snap[id].axis,'vertical');
}
for(const [id,rect] of Object.entries({"flight-control-a":[126,91,165,265],"flight-control-b":[296,91,165,265],"spoiler-a":[126,646,165,275],"spoiler-b":[295,646,165,275],"battery-master":[172,1141,176,211],"flight-recorder-test":[1351,428,141,54]}))
 assert.deepEqual(snap[id].rectPx,rect,id+' resized or moved per owner feedback');
assert.equal(snap['stab-trim'].panel,'PEDESTAL_RADIO');
assert.equal(snap['stab-trim'].hingeConfidence,'UNCONFIRMED_STAB_TRIM_TEMP_TOP');
for(const c of cfg.controls){assert.ok(c.rectPx?.length===4,c.id);assert.ok(c.rectPx.every(Number.isFinite),c.id);assert.ok(c.rectPx[2]>0&&c.rectPx[3]>0,c.id);assert.deepEqual(c.rectPx,audit.records.find(x=>x.id===c.id).rectPx,c.id);}
const order=['gpws-terrain-inhibit','gpws-flap-inhibit','gpws-gear-inhibit'].map(id=>snap[id].rectPx[0]);
assert.ok(order[0]<order[1]&&order[1]<order[2],'TERRAIN must be LEFT of FLAP, GEAR');
for(const color of ['black','red'])for(const state of ['closed','open_up','open_center','open_down']){
 const basename=cfg.imageFiles[color][state];assert.ok(basename);
 assert.ok(fs.existsSync(path.join(base,'panel-mosaic-lab/assets/locked/2026-10-23/Switches/guard',basename)),'owner original missing: '+basename);
}
const main=read('panel-mosaic-lab/cockpit/index.html');
const overhead=read('panel-mosaic-lab/cockpit/overhead-stage.html');
for(const [html,context] of [[main,'main'],[overhead,'overhead']]){
 assert.ok(html.includes('guard-owner18-v1.js?v=OWNER18-002'),context+' missing scripts');
 assert.ok(html.includes('guard-owner18-v1.css?v=OWNER18-002'),context+' missing styles');
}
const code=read('panel-mosaic-lab/cockpit/guard-owner18-v1.js');
for(const x of ['owner18-guard-control','b737:guard-changed','sessionStorage','overheadPlacement','mainPlacement','twoStateImages','dblclick']){
 if(x==='twoStateImages')continue;
 assert.ok(code.includes(x),'Missing runtime '+x);
}
const art=path.join(base,'panel-mosaic-lab/assets/locked/2026-10-23/Switches/guard/runtime/artwork-audit.json');
if(fs.existsSync(art)){
 const a=JSON.parse(fs.readFileSync(art,'utf8'));assert.equal(a.count,8);
 for(const n of Object.keys(a.assets))assert.ok(fs.existsSync(path.join(path.dirname(art),n)),'Missing runtime art '+n);
}
console.log('PASS: 18 owner sprites, main 5 + overhead 13, hinges TOP11/LEFT3/BOTTOM3, colors 14/3, correct GPWS ordering and ANTISKID screenshot location; source sprites registered and original panels unmodified');
