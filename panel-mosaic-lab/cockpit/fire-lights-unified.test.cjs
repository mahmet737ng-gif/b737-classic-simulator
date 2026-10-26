'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=__dirname,root=path.resolve(dir,'../..');
const M=require('./fire-lights-model.js');
const frameAudit=JSON.parse(fs.readFileSync(path.join(root,'fire-protection-lab/reference/unified-11-indicator-frame-glass-v4.json'),'utf8'));
const glassAudit=JSON.parse(fs.readFileSync(path.join(root,'fire-protection-lab/reference/unified-11-indicator-aperture-audit-v3.json'),'utf8'));
const assembly=JSON.parse(fs.readFileSync(path.join(dir,'assembly.json'),'utf8'));
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const css=fs.readFileSync(path.join(dir,'fire-lights-unified.css'),'utf8');
const ui=fs.readFileSync(path.join(dir,'fire-lights-unified.js'),'utf8');
let count=0;
function check(value,label){count++;assert.ok(value,label);}
function corners(b){return {tl:[b.left,b.top],tr:[b.left+b.width,b.top],bl:[b.left,b.top+b.height],br:[b.left+b.width,b.top+b.height]};}
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function separate(a,b){return a.left>=b.left+b.width||b.left>=a.left+a.width||a.top>=b.top+b.height||b.top>=a.top+a.height;}
check(M.validate(),'Valid lamp model');
check(M.version==='FIRELAMP-0004','V4 frame-plus-glass model');
check(frameAudit.placements.length===8&&glassAudit.corners.length===8,'Eight independent outer and inner measurements');
check(M.SLOTS.length===11,'11 lamps');
check(M.SLOTS.filter(x=>x.type==='round').length===3,'Three circles unchanged');
let maxFrame=0,maxGlass=0,maxCircle=0;
for(const slot of M.SLOTS){
 const outer=M.region(slot),inner=M.faceRegion(slot);
 check(outer.left>=0&&outer.top>=0&&outer.left+outer.width<=2172&&outer.top+outer.height<=724,'Outer within 2172×724 '+slot.id);
 check(inner.left>=outer.left&&inner.top>=outer.top&&inner.left+inner.width<=outer.left+outer.width&&inner.top+inner.height<=outer.top+outer.height,'Glass fully within frame '+slot.id);
 if(slot.type==='rect'){
  const outerReference=frameAudit.placements.find(p=>p.id===slot.id);
  const glassReference=glassAudit.corners.find(p=>p.id===slot.id);
  check(Boolean(outerReference&&glassReference),'Independent photo and glass measurements '+slot.id);
  const fc=corners(outer),gc=corners(inner);
  for(const c of ['tl','tr','bl','br']){
   const ef=dist(fc[c],outerReference.frameCorners[c]),eg=dist(gc[c],glassReference.aperture[c]);
   maxFrame=Math.max(maxFrame,ef);maxGlass=Math.max(maxGlass,eg);
   check(ef<=frameAudit.acceptance.maxFrameCornerDeltaPx,slot.id+' frame '+c+' mismatch '+ef.toFixed(2));
   check(eg<=frameAudit.acceptance.maxGlassCornerDeltaPx,slot.id+' face '+c+' mismatch '+eg.toFixed(2));
  }
  // Four fasteners remain visible because the mounted image fills only
  // the inner aperture (not the frame). No opaque paint on outer wrapper.
  const fp=M.facePercent(slot);
  check(Number.parseFloat(fp.left)>0&&Number.parseFloat(fp.top)>0,'Inlaid glass offset '+slot.id);
  check(Number.parseFloat(fp.width)<100&&Number.parseFloat(fp.height)<100,'Glass smaller than housing '+slot.id);
  for(const state of [false,true]){
   const src=path.resolve(dir,M.file(slot,state));
   check(fs.existsSync(src),'ON/OFF face asset '+slot.id+' '+state);
   check(fs.readFileSync(src,'utf8').includes('scale(0.75)'),'Locked-source-derived 75% legend '+slot.id+' '+state);
  }
 } else {
  const ref=glassAudit.rounds.find(x=>x.id===slot.id);
  check(Boolean(ref),'Reference circle '+slot.id);
  const e=dist([slot.cx,slot.cy],ref.center);maxCircle=Math.max(maxCircle,e);
  check(e<=2,'Round indicator center '+slot.id);
  check(slot.radius===30&&ref.visibleBezelRadius===30,'Approved 60px circle '+slot.id);
  check(outer.width===60&&outer.height===60,'Exact 60px surface '+slot.id);
 }
}
for(let i=0;i<M.SLOTS.length;i++)for(let j=i+1;j<M.SLOTS.length;j++){
 check(separate(M.region(M.SLOTS[i]),M.region(M.SLOTS[j])),'Outer frames overlap '+M.SLOTS[i].id+' '+M.SLOTS[j].id);
}
const L=M.region(M.map.L_BOTTLE_DISCHARGED),R=M.region(M.map.R_BOTTLE_DISCHARGED);
check(L.top===R.top&&L.width===R.width&&L.height===R.height,'Two bottle frames same size and aligned');
check(L.left+L.width<R.left,'Bottle lamps side by side, no overlap');
const marker=frameAudit.independentScreenshotCheck;
const scaleWheel=marker.wheelWellSelection[2]/M.region(M.map.WHEEL_WELL).width;
const scaleEngine2=marker.engine2Selection[2]/M.region(M.map.ENG2_OVERHEAT).width;
check(Math.abs(scaleWheel-scaleEngine2)<0.02,'Two independent Paint selection outlines support same image scale');
const physical=assembly.regions.find(x=>x.id==='pedestal').placements.find(x=>x.id==='fire-protection');
check(physical.asset.endsWith('FIRE_PROTECTION_BARE_STANDARD_SLOTS_V2_ORIGINAL.svg'),'Locked source unchanged');
check(physical.presentation==='contain','Letterboxed panel source');
const scale=Math.min(physical.w/2172,physical.h/724);
check((physical.w-2172*scale)/2>0,'Horizontal contain padding exists');
check(ui.includes('const inset=model.facePercent(slot)'),'Renderer uses independently measured glass inset');
check(ui.includes("node.dataset.geometry=slot.type==='rect'?'outer-frame-plus-inset-glass'"),'Frame wrapper explicitly visible');
check(ui.includes('Math.min(hostW/model.BASE.width,hostH/model.BASE.height)'),'Contain compensation');
check(ui.includes('bottle-slots-horizontal-patch.svg'),'Same localized bottle patch');
check(css.includes('z-index:1;background:transparent;'),'Full frame wrapper cannot occlude screws');
check(!css.includes('z-index:1;background:#050505;'),'Removed former opaque housing black fill');
check(css.includes('.texture-piece[data-piece="fire-protection"]'),'Scoped to Fire Panel');
check(!css.includes('data-piece="throttle-quadrant"'),'No unrelated panel touch');
for(const file of ['fire-lights-model.js','fire-lights-unified.js','fire-lights-unified.css']){
 check(html.includes(file+'?v=FIRELAMP-0004'),'Unified loads V4 '+file);
}
new vm.Script(ui,{filename:'fire-lights-unified.js'});
console.log('PASS FIRELAMP-0004 '+count+' assertions, 32 frame corners error='+maxFrame+'px, 32 glass corners error='+maxGlass+'px, 3 circle centers error='+maxCircle+'px, Paint selection scale cross-check PASS.');
