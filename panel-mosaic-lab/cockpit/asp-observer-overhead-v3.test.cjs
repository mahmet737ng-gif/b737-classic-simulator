'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=__dirname;
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const reg=require('./asp-socket-registration-v2.js');
const model=require('./asp-controls-model-v1.js');
const overhead=read('overhead-stage.html'),main=read('index.html');
const iframeModule=read('asp-observer-overhead-v3.js');
const bridge=read('asp-observer-parent-bridge-v3.js');
const existing=read('asp-bare-overlay-v1.js');
const renderer=read('asp-controls-v1.js');
test('20 original photographed sockets remain exact when mapped into OH-04 nonuniform overhead atlas',()=>{
 const w=379*2214/1731,h=283*1019/909;
 const expectedCenter={x:3+(953+379/2)*2214/1731,y:3+(56+283/2)*1019/909};
 const src=reg.extract(read('assets/asp-bare-aft-overhead-v3.svg'));
 const matched=reg.compareSockets(model.sockets,src);
 assert.equal(matched.length,20);assert.equal(matched.filter(x=>x.kind==='mic').length,7);
 assert.equal(matched.filter(x=>x.kind==='volume').length,13);
 // Use the exact 1254-pixel source with an asymmetric alpha silhouette. A
 // visually off-center PNG must still land at the precise center of the socket.
 const fakeShape={x:88,y:22,w:880,h:950,cx:490,cy:493,width:1254,height:1254};
 for(const socket of matched){
  const p=reg.fit(socket,fakeShape,w,h,socket.kind);
  const centerX=p.left+fakeShape.cx*p.imageW/fakeShape.width;
  const centerY=p.top+fakeShape.cy*p.imageH/fakeShape.height;
  assert(Math.abs(centerX-p.hitW/2)<1e-9,'OBS visible x-center offset: '+socket.channel);
  assert(Math.abs(centerY-p.hitH/2)<1e-9,'OBS visible y-center offset: '+socket.channel);
  assert(p.visibleW>0&&p.visibleH>0);
 }
 assert.equal(expectedCenter.x,3+(953+379/2)*2214/1731);
 assert.equal(expectedCenter.y,3+(56+283/2)*1019/909);
 assert.notEqual(w/1122,h/888,'OBS requires independent native X/Y atlas placement and uniform PNG sprite scaling');
});
test('observer panel is mounted inside the actual overhead iframe and follows atlas layout',()=>{
 assert(overhead.includes('<base href="../all-overhead/">'));
 assert(overhead.includes('asp-observer-overhead-v3.js?v=ASP-OBS-IFRAME-0004'));
 const order=['asp-controls-model-v1.js','asp-socket-registration-v2.js','asp-observer-overhead-v3.js','asp-controls-v1.js'];
 for(let i=1;i<order.length;i++)assert(overhead.indexOf(order[i-1])<overhead.indexOf(order[i]),'Overhead script order: '+order[i]);
 assert(overhead.includes('asp-controls-v1.css?v=ASP-CENTER-0003-OBS'));
 assert(iframeModule.includes("getElementById('atlasAbsolute')"),'Must be inside native atlas, not outer parent region');
 assert(iframeModule.includes("root.B737ASPOnlyObserver=true"),'Scoped 1-station mode must load before shared controls');
 assert(iframeModule.includes('x:953,y:56,w:379,h:283'),'OH-04 atlas source bounds must not drift');
 assert(iframeModule.includes("atlasRoot,{childList:true}"),'Observer panel must survive asynchronous atlas replaceChildren redraw');
 assert(renderer.includes("root.addEventListener('b737:asp-observer-mounted',mount)"),'New OBS sprite controls must mount after atlas redraw');
 assert(iframeModule.includes('data-seat="OBS"'),'OBS controls are unique to observer');
 assert(main.includes('asp-observer-parent-bridge-v3.js?v=ASP-OBS-IFRAME-0003'));
 assert(bridge.includes("e.source!==iframe().contentWindow"),'Reject untrusted frames');
 assert(bridge.includes("e.origin!==root.location.origin"),'Reject cross-origin messages');
 assert(bridge.includes("source:'actual-overhead-photo'"));
 assert(bridge.includes("visibility:hidden!important"),'Old parent OBS art must not cover native atlas');
 assert(existing.includes("id:'CAPT'")&&existing.includes("id:'FO'"),'Do not remove pedestal stations');
 assert(!bridge.includes('pedestal-radio'),'Parent bridge must not move pedestal');
});
test('source positions measured and held, while approved PNG bytes and two pedestal stations untouched',()=>{
 assert(renderer.includes("OBS_FRAME=root.B737ASPOnlyObserver===true"));
 assert(renderer.includes("assetRoot=OBS_FRAME?'../cockpit/':'./'"));
 assert(renderer.includes('if(mounted.size===(OBS_FRAME?1:3))'));
 assert(renderer.includes("registrar.fit(slot,silhouette,hostW,hostH,kind)"));
 assert(renderer.includes('const base=assetRoot+'));
 const spec=JSON.parse(read('asp-controls-v1.json'));
 for(const [name,meta] of Object.entries(spec.assets)){
  const bytes=fs.readFileSync(path.join(root,'assets/asp-controls-v1',name));
  assert.equal(bytes.length,meta.bytes,'Approved owner PNG bytes changed: '+name);
 }
 assert.equal(model.sockets.length,20);
});
test('actual iframe mount and downstream OBS audio event are recognized without a duplicate panel',()=>{
 let found=null,msg=null,queue={};
 const atlas={children:[],querySelector:()=>found,append(n){found=n;this.children.push(n)}};
 const doc={readyState:'loading',getElementById:id=>id==='atlasAbsolute'?atlas:null,
  createElement:tag=>({tag,dataset:{},style:{},append(n){this.child=n},querySelectorAll(){return []}}),
  addEventListener:(name,fn)=>{queue[name]=fn;}};
 const listeners={};
 const win={location:{origin:'https://example.org'},addEventListener:(name,fn)=>{listeners[name]=fn;},
   dispatchEvent(){},console:{error(){}}};
 const parent={postMessage:(message,target)=>{msg={message,target}}};
 const CustomEvent=class{constructor(name,args){this.type=name;this.detail=args.detail}};
 vm.runInNewContext(iframeModule,{window:win,parent,document:doc,CustomEvent,MutationObserver:class{observe(node,options){assert(node);assert(options.childList);}}});
 assert.equal(typeof queue.DOMContentLoaded,'function');queue.DOMContentLoaded();
 assert.equal(win.B737ASPOnlyObserver,true);
 assert.equal(atlas.children.length,1);assert.equal(atlas.children[0].dataset.seat,'OBS');
 assert.equal(atlas.children[0].dataset.panel,'OH-04');
 assert.equal(win.B737ASPObserverOverhead.audit().mounted,true);
 win.B737ASPObserverOverhead.install();assert.equal(atlas.children.length,1,'No duplicate OBS mount');
 listeners['b737:asp-control']({detail:{seat:'OBS',kind:'mic',channel:'HF-1',selected:true}});
 assert.equal(msg.message.type,'b737:asp-obs-control');assert.equal(msg.message.detail.channel,'HF-1');
 assert.equal(msg.target,'https://example.org');
});
