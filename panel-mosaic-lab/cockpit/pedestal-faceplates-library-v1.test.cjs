const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('two COMM, two NAV and one centered transponder fit native pedestal bays',()=>{
 const script=fs.readFileSync(path.join(__dirname,'pedestal-faceplates-library-v1.js'),'utf8');
 const window={addEventListener:()=>{}};
 const document={currentScript:{src:'https://example.test/pedestal-faceplates-library-v1.js'},
  readyState:'loading',addEventListener:()=>{}};
 vm.runInNewContext(script,{window,document,URL,location:{href:'https://example.test'}});
 const api=window.B737UnifiedPedestalFaceplates;
 const panels=Array.from(api.panels,p=>({id:p.id,x:p.x,y:p.y,w:p.w,h:p.h,sourceWidth:p.sourceWidth,sourceHeight:p.sourceHeight,bayY:p.bayY,bayHeight:p.bayHeight}));
 assert.equal(api.version,'PEDESTAL-FACEPLATES-0005');
 assert.equal(panels.length,6); // 2 COMM, 2 NAV, center TCAS and center Cargo Fire
 const comm=panels.filter(p=>p.id.startsWith('vhf-comm-'));
 const nav=panels.filter(p=>p.id.startsWith('vhf-nav-'));
 const xpdr=panels.filter(p=>p.id==='transponder-tcas');
 const cargo=panels.find(p=>p.id==='cargo-fire');
 assert.equal(comm.length,2);
 assert.equal(nav.length,2);
 assert.equal(xpdr.length,1);
 assert(cargo,'center Cargo Fire panel must exist');
 const centerY=p=>p.y+p.h/2;
 assert(Math.abs(centerY(comm[0])-centerY(comm[1]))<1e-8);
 assert(Math.abs(centerY(comm[0])-centerY(cargo))<1e-8,'Cargo Fire aligned with both COMM bays');
 assert.equal(comm[0].x+comm[0].w,cargo.x,'Cargo Fire touches captain COMM bay');
 assert.equal(cargo.x+cargo.w,comm[1].x,'Cargo Fire touches FO COMM bay');
 assert.equal(cargo.bayY,comm[0].bayY,'Cargo Fire uses upper radio row');
 assert.equal(cargo.bayHeight,comm[0].bayHeight);
 assert(Math.abs(centerY(nav[0])-centerY(nav[1]))<1e-8);
 assert(Math.abs(centerY(xpdr[0])-centerY(nav[0]))<1e-8);
 assert.equal(nav[0].x+nav[0].w,xpdr[0].x);
 assert.equal(xpdr[0].x+xpdr[0].w,nav[1].x);
 assert.equal(comm[0].x,nav[0].x);
 assert.equal(comm[1].x,nav[1].x);
 for(const p of panels){
  assert(p.x>=0&&p.y>=0&&p.x+p.w<=1150&&p.y+p.h<=2273);
  // Never distort natural bitmap circles to fill a too-tall bay.
  assert(Math.abs(p.w/p.h-p.sourceWidth/p.sourceHeight)<1e-9,p.id+' natural aspect ratio');
  assert(p.y>=p.bayY-1e-9,p.id+' within slot top');
  assert(p.y+p.h<=p.bayY+p.bayHeight+1e-9,p.id+' within slot bottom');
 }
 assert.equal(xpdr[0].sourceWidth,1799);
 assert.equal(xpdr[0].sourceHeight,699);
 assert(xpdr[0].h<145,'TCAS panel must not vertically stretch the circular knob cutouts');
 assert(!panels.some(p=>p.id==='transponder-tcas'&&p.y<900));
});
