'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=__dirname,root=path.resolve(dir,'../..');
const M=require('./fire-lights-model.js');
const audit=JSON.parse(fs.readFileSync(path.join(root,'fire-protection-lab/reference/unified-11-indicator-aperture-audit-v3.json'),'utf8'));
const assembly=JSON.parse(fs.readFileSync(path.join(dir,'assembly.json'),'utf8'));
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const css=fs.readFileSync(path.join(dir,'fire-lights-unified.css'),'utf8');
const ui=fs.readFileSync(path.join(dir,'fire-lights-unified.js'),'utf8');
let count=0;function check(test,label){count++;assert.ok(test,label)}
function corners(rect){return {tl:[rect.left,rect.top],tr:[rect.left+rect.width,rect.top],bl:[rect.left,rect.top+rect.height],br:[rect.left+rect.width,rect.top+rect.height]};}
function error(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
check(M.validate(),'Model validation');
check(M.version==='FIRELAMP-0003','V3 version');
check(M.SLOTS.length===11,'Eight face modules and three green test rings');
check(audit.corners.length===8,'Independent eight aperture corner measurements exist');
check(audit.rounds.length===3,'Three independent circle measurements');
check(M.SLOTS.filter(x=>x.type==='rect').length===8,'Rectangle count');
check(M.SLOTS.filter(x=>x.type==='round').length===3,'Circle count');
check(M.BASE.width===2172&&M.BASE.height===724,'Natural plate geometry');
let maxCornerError=0,maxCircleError=0;
for(const slot of M.SLOTS){
 const box=M.region(slot);
 check(box.left>=0&&box.top>=0&&box.left+box.width<=2172&&box.top+box.height<=724,'Inside photo '+slot.id);
 if(slot.type==='rect'){
  const target=audit.corners.find(c=>c.id===slot.id);
  check(!!target,'Independent aperture target '+slot.id);
  const observed=corners(box);
  for(const name of ['tl','tr','bl','br']){
   const distance=error(observed[name],target.aperture[name]);
   maxCornerError=Math.max(maxCornerError,distance);
   check(distance<=audit.qaThresholds.maxCornerErrorPx,slot.id+' '+name+' photo mismatch '+distance.toFixed(3)+' px');
  }
  for(const on of [false,true]){
   const src=M.file(slot,on);
   check(src.includes('/fire-lamps-v2/'),'Database-derived lens face');
   const pathToAsset=path.resolve(dir,src);
   check(fs.existsSync(pathToAsset),'SVG source exists '+slot.id+' '+on);
   const svg=fs.readFileSync(pathToAsset,'utf8');
   check(svg.includes('scale(0.75)'),'Approved 75% lettering '+slot.id+' '+on);
  }
 } else {
  const physical=audit.rounds.find(x=>x.id===slot.id);
  check(!!physical,'Circle '+slot.id+' measured');
  const centerError=error([slot.cx,slot.cy],physical.center);
  maxCircleError=Math.max(centerError,maxCircleError);
  check(centerError<=audit.qaThresholds.maxCircleCenterErrorPx,'Circle center error '+slot.id);
  check(slot.radius===physical.visibleBezelRadius,'60px bezel includes 42px internal green lens');
  check(physical.innerLensRadius===21,'42px opening center '+slot.id);
  for(const on of [false,true])check(fs.existsSync(path.resolve(dir,M.file(slot,on))),'Green OFF/ON artwork '+slot.id);
 }
}
const L=M.map.L_BOTTLE_DISCHARGED,R=M.map.R_BOTTLE_DISCHARGED;
check(L.cy===R.cy,'Bottle lamps must be side by side');
check(M.region(L).left+M.region(L).width<M.region(R).left,'Two bottle faces must not overlap');
const base=assembly.regions.find(r=>r.id==='pedestal').placements.find(p=>p.id==='fire-protection');
check(base.asset==='panel-mosaic-lab/cockpit/assets/FIRE_PROTECTION_BARE_STANDARD_SLOTS_V2_ORIGINAL.svg','Approved image unchanged');
check(base.presentation==='contain','Photo is letterboxed by contain');
const hostWidth=base.w,hostHeight=base.h;
const scale=Math.min(hostWidth/M.BASE.width,hostHeight/M.BASE.height);
const displayW=M.BASE.width*scale,displayH=M.BASE.height*scale,offsetX=(hostWidth-displayW)/2;
check(offsetX>0,'Letterboxing is significant and must be compensated');
check(Math.abs(displayH-hostHeight)<1e-6,'Display height is full host height');
check(Math.abs(displayW/hostHeight-3)<1e-6,'Fitted image retains 3:1 aspect');
check(ui.includes('Math.min(hostW/model.BASE.width,hostH/model.BASE.height)'),'Runtime compensates for contain');
check(ui.includes("((hostW-imageW)/2)")&&ui.includes("((hostH-imageH)/2)"),'X/Y fitted-image offsets in runtime');
const patch=audit.localPatch;
check(fs.existsSync(path.join(root,patch.file)),'Locally repaired bottle slot patch exists');
check(ui.includes('bottle-slots-horizontal-patch.svg'),'Physical bottle rows patched on base');
check(ui.includes('const p=model.percent(slot)'),'Lamps anchored in fitted photo layer');
check(css.includes('.texture-piece[data-piece="fire-protection"]'),'CSS scoped to fire panel only');
check(!css.includes('data-piece="throttle-quadrant"'),'Throttle untouched');
check(html.includes('fire-lights-model.js?v=FIRELAMP-0003'),'Unified loads V3 model');
check(html.includes('fire-lights-unified.js?v=FIRELAMP-0003'),'Unified loads V3 renderer');
check(html.includes('fire-lights-unified.css?v=FIRELAMP-0003'),'Unified loads V3 CSS');
new vm.Script(ui,{filename:'fire-lights-unified.js'});
// A pairwise audit detects accidental overlap among the eleven new surfaces.
for(let i=0;i<M.SLOTS.length;i++)for(let j=i+1;j<M.SLOTS.length;j++){
 const a=M.region(M.SLOTS[i]),b=M.region(M.SLOTS[j]);
 check(!(a.left<b.left+b.width&&b.left<a.left+a.width&&a.top<b.top+b.height&&b.top<a.top+a.height),
   'Lamp faces overlap: '+M.SLOTS[i].id+' / '+M.SLOTS[j].id);
}
console.log('PASS FIRELAMP-0003 '+count+' checks; 32 independently compared rectangular corners max_error='+maxCornerError+'px; 3 ring centers max_error='+maxCircleError+'px; photo contain calibration and isolated bottle patch checked.');
