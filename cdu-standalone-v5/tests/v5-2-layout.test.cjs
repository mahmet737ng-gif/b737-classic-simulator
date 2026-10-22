const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const map=JSON.parse(fs.readFileSync(path.join(root,'data/cdu-map.json'),'utf8'));
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
assert.equal(map.revision,'5.2-hotfix');
for(let n=1;n<=6;n++) {
 const a=map.controls.find(c=>c.id==='CDU_CAPT_LSK_L'+n);
 const b=map.controls.find(c=>c.id==='CDU_CAPT_LSK_R'+n);
 assert(Math.abs((a.bbox_px[1]+a.bbox_px[3]-b.bbox_px[1]-b.bbox_px[3])/2)<=1, `LSK row ${n} not aligned`);
 assert(a.bbox_px[0]>=140&&a.bbox_px[2]<=215);
 assert(b.bbox_px[0]>=875&&b.bbox_px[2]<=955);
}
for(let n=0;n<12;n++){
 const lbl=n===9?'DOT':n===10?'0':n===11?'PLUS_MINUS':String(n+1);
 const btn=map.controls.find(c=>c.id==='CDU_CAPT_KEY_'+lbl);
 assert(btn,'numeric button '+lbl);
 const [x1,y1,x2,y2]=btn.bbox_px;
 assert(x1>=205&&x2<=424&&y1>=954&&y2<=1223,'numeric button face bounds');
}
assert(css.includes('.fmc-pairline .fmc-right{right:0;width:47.5%;text-align:right}'));
assert(app.includes("const r=document.createElement('span')"));
assert(app.includes("r.className='fmc-right'"));
console.log('PASS v5.2: 12 photographed LSK faces, 12 numeric button faces, and right edge anchored LSK text');