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
 const panels=Array.from(api.panels,p=>({id:p.id,x:p.x,y:p.y,w:p.w,h:p.h}));
 assert.equal(api.version,'PEDESTAL-FACEPLATES-0003');
 assert.equal(panels.length,6); // 5 radio faceplates + unaffected cargo/fire panel
 const comm=panels.filter(p=>p.id.startsWith('vhf-comm-'));
 const nav=panels.filter(p=>p.id.startsWith('vhf-nav-'));
 const xpdr=panels.filter(p=>p.id==='transponder-tcas');
 assert.equal(comm.length,2);
 assert.equal(nav.length,2);
 assert.equal(xpdr.length,1);
 assert.equal(comm[0].y,comm[1].y);
 assert.equal(comm[0].h,comm[1].h);
 assert.equal(nav[0].y,nav[1].y);
 assert.equal(nav[0].h,nav[1].h);
 assert.equal(xpdr[0].y,nav[0].y);
 assert.equal(xpdr[0].h,nav[0].h);
 assert.equal(nav[0].x+nav[0].w,xpdr[0].x);
 assert.equal(xpdr[0].x+xpdr[0].w,nav[1].x);
 assert.equal(comm[0].x,nav[0].x);
 assert.equal(comm[1].x,nav[1].x);
 for(const p of panels){assert(p.x>=0&&p.y>=0&&p.x+p.w<=1150&&p.y+p.h<=2273);}
 assert(!panels.some(p=>p.id==='transponder-tcas'&&p.y<900));
});
