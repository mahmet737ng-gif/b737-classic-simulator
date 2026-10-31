'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..','panel-mosaic-lab/cockpit');
test('unchanged MCP power, lamps and values never rebuild its SVG; changes remain synchronous',()=>{
 const source=fs.readFileSync(path.join(root,'mcp-visual-v3.js'),'utf8');
 const value=source.slice(source.indexOf('function setValue('),source.indexOf('\nfunction step('));
 const start=source.indexOf('window.B737McpVisualV3=Object.freeze({');
 const api=source.slice(start,source.indexOf('\n});',start)+4);
 let paints=0,events=0;const sandbox={window:{dispatchEvent(){}},W:2172,H:433,CustomEvent:class{},values:{speed:312,lamps:{LNAV:false}},powerState:null,
  displays:[],lamps:[],knobs:[],mount(){},repaint(){paints++;},event(){events++;},console};
 vm.runInNewContext(value+'\n'+api,sandbox);
 const m=sandbox.window.B737McpVisualV3;
 for(let i=0;i<100;i++){m.setPower(null);m.setLamps({LNAV:false});m.setLamp('LNAV',false);m.setValue('speed',312);}
 assert.equal(paints,0);assert.equal(events,0);
 m.setPower(true);m.setLamps({LNAV:true});m.setValue('speed',313);
 assert.equal(paints,3);assert.equal(events,1);assert.equal(m.getState().speed,313);
 assert.throws(()=>m.setPower('ON'),/power must/);
});
test('same source sprite is decoded and measured once across concurrent panel realms; failures can retry',async()=>{
 const source=fs.readFileSync(path.join(root,'asp-controls-v1.js'),'utf8');
 const fn=source.slice(source.indexOf(' async function silhouette('),source.indexOf('\n async function prepareRegistration('));
 const tasks=new Map();let decoded=0,measured=0,failed=false;
 class Image{constructor(){this.naturalWidth=12;this.naturalHeight=10;}async decode(){decoded++;if(this.src.includes('retry')&&!failed){failed=true;throw Error('decode failed');}}}
 const registrar={mask:data=>{measured++;return {width:data.width,height:data.height,cx:5.5,cy:4.5};}};
 function realm(){const context={Image,URL,maskTasks:tasks,SOURCE_MASKS:{},assetRoot:'./',registrar,document:{baseURI:'https://example.test/cockpit/',createElement:()=>({getContext:()=>({clearRect(){},drawImage(){},getImageData:()=>({width:12,height:10})})})}};vm.runInNewContext(fn+';this.measure=silhouette;',context);return context.measure;}
 const a=realm(),b=realm();const results=await Promise.all([a('./source.png'),b('https://example.test/cockpit/source.png'),a('./source.png')]);
 assert.equal(decoded,1);assert.equal(measured,1);assert.ok(results.every(r=>r.cx===5.5&&r.cy===4.5));
 await assert.rejects(a('./retry.png'),/decode failed/);assert.equal(tasks.has('https://example.test/cockpit/retry.png'),false);
 await b('./retry.png');assert.equal(measured,2);
});

test('approved ASP source masks are hash-pinned and require no renderer pixel scan',async()=>{
 const source=fs.readFileSync(path.join(root,'asp-controls-v1.js'),'utf8');
 const catalog=JSON.parse(source.match(/ const SOURCE_MASKS=Object\.freeze\((\{[^\n]+\})\);/)[1]);
 const crypto=require('node:crypto');
 for(const [name,item]of Object.entries(catalog)){
  const bytes=fs.readFileSync(path.join(root,'assets/asp-controls-v1',name));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);
 }
 const fn=source.slice(source.indexOf(' async function silhouette('),source.indexOf('\n async function prepareRegistration('));
 const context={URL,SOURCE_MASKS:catalog,assetRoot:'./',maskTasks:new Map(),Image:class{constructor(){throw Error('Approved sources must not be decoded for measurement');}},document:{baseURI:'https://example.test/cockpit/'}};
 vm.runInNewContext(fn+';this.measure=silhouette;',context);
 for(const [name,item]of Object.entries(catalog)){const result=await context.measure('./assets/asp-controls-v1/'+name);assert.equal(result.cx,item.mask.cx);assert.equal(result.cy,item.mask.cy);assert.equal(result.width,item.mask.width);assert.ok(Object.isFrozen(result));}
});
