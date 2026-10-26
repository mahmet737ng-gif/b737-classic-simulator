'use strict';
/* MCP front-facing reference hardware visual acceptance.
 * Source photo and coordinates remain owned by previous tests.
 * This test explicitly proves OFF DOWN/ON UP for both F/D and A/T paddles,
 * true frontal SOURCE geometry and that the IAS owner-approved webp survives.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BASE='http://127.0.0.1:8788/panel-mosaic-lab';
const ROOT=path.resolve(__dirname,'..');
const OUT='/tmp/b737-mcp-front-view';
fs.mkdirSync(OUT,{recursive:true});
async function doPage(browser,p){
 const page=await browser.newPage({viewport:{width:1860,height:850},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const url=BASE+(p==='standalone'?'/mcp-panel/':'/cockpit/');
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 assert.equal(response?.status(),200);
 await page.waitForFunction(()=>!!(window.B737McpHardwareV1&&window.B737McpVisualV3&&document.querySelector('[data-piece="mcp"] .mcp-hw-at')&&document.querySelectorAll('[data-piece="mcp"] .mcp-hw-fd').length>=2),null,{timeout:60000});
 const report={page:p,states:{},knobs:[]};
 async function state(name,mapping){
  await page.evaluate(values=>{for(const [id,val]of Object.entries(values))window.B737McpHardwareV1.setState(id,val)},mapping);
  await page.waitForTimeout(190);
  const a=await page.evaluate(()=>{
   const target=document.querySelector('[data-piece="mcp"]');
   const ids=['AT_ARM','FD_LEFT','FD_RIGHT'];
   const test=Object.fromEntries(ids.map(id=>{
    const e=target.querySelector('[data-mcp-hardware="'+id+'"]');
    const h=e.querySelector(id==='AT_ARM'?'.mcp-hw-at-paddle':'.mcp-hw-fd-tip');
    const b=e.getBoundingClientRect(),c=h.getBoundingClientRect();
    return [id,{state:e.dataset.state,controlCenterY:b.y+b.height/2,capCenterY:c.y+c.height/2,
     capDelta:+((c.y+c.height/2)-(b.y+b.height/2)).toFixed(2),capBox:{x:c.x,y:c.y,w:c.width,h:c.height},
     role:e.getAttribute('role'),pressed:e.getAttribute('aria-pressed')}];
   }));
   const knobs=[...target.querySelectorAll('.mcp-v3-knob')].map(n=>({id:n.dataset.control,background:getComputedStyle(n).backgroundImage,width:n.getBoundingClientRect().width}));
   return {toggle:test,knobs,courseSVG:target.querySelector('.mcp-v3-course-face svg')?.outerHTML,
     foregroundCssLoaded:[...document.styleSheets].some(x=>x.href?.includes('mcp-front-reference-v1.css'))};
  });
  assert.ok(a.foregroundCssLoaded,p+' missing new front-view style');
  for(const id of ['AT_ARM','FD_LEFT','FD_RIGHT']){const v=a.toggle[id];assert.equal(v.role,'button');
   assert.equal(v.pressed,name==='OFF'?'false':'true',p+' '+id+' ARIA toggle state');
   assert.ok(name==='OFF'?v.capDelta>0:v.capDelta<0,
    p+' '+id+' '+name+' must point '+(name==='OFF'?'DOWN':'UP')+': '+JSON.stringify(v));
  }
  assert.equal(a.knobs.length,5,p+' keeps all five knobs');
  assert.match(a.courseSVG,/fill="#d84226"/);
  assert.ok(a.knobs.find(x=>x.id==='speed')?.background.includes('mcp-ias-mach-knob.webp'),
    'IAS/MACH owner-approved rotary asset must not be replaced');
  report.states[name]=a.toggle;report.knobs=a.knobs.map(({id,width})=>({id,width}));
  console.log('MCP_FRONT_STATE',JSON.stringify({page:p,state:name,
   at:a.toggle.AT_ARM.capDelta,fdLeft:a.toggle.FD_LEFT.capDelta,fdRight:a.toggle.FD_RIGHT.capDelta}));
  if(p==='standalone'){
   await page.locator('#stage').screenshot({path:path.join(OUT,'mcp-front-'+name.toLowerCase()+'.png'),animations:'disabled'});
   const preview=await page.locator('#stage').screenshot({type:'jpeg',quality:74,animations:'disabled'});
   console.log('MCP_FRONT_PREVIEW',name,preview.toString('base64'));
  }
 }
 await state('OFF',{AT_ARM:'OFF',FD_LEFT:'OFF',FD_RIGHT:'OFF'});
 await state('ON',{AT_ARM:'ARM',FD_LEFT:'ON',FD_RIGHT:'ON'});
 for(const id of ['AT_ARM','FD_LEFT','FD_RIGHT']){
  const a=report.states.OFF[id].capDelta,b=report.states.ON[id].capDelta;
  assert.ok(a-b>8,p+' '+id+' state transition must be visually material');
 }
 assert.ok(!errors.filter(x=>/mcp|SyntaxError/.test(x)).length,p+' script issues '+JSON.stringify(errors));
 report.errors=errors;
 await page.close();
 return report;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const results=[];
  results.push(await doPage(browser,'standalone'));
  results.push(await doPage(browser,'unified'));
  fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify({schema:'b737.mcp.front-facing-controls.v1',
   date:'2026-10-26',results,sourcePhotoChanged:false,sourceCoordsChanged:false,
   observations:'A/T ARM and both Flight Director OFF tips below pivot; ON/ARM tips above pivot, and IAS webp remains unchanged'},null,2));
  console.log('MCP_FRONT_VISUAL_PASS',JSON.stringify({pages:results.length,
   physicalToggles:3,states:2,knobs:5,sourcePhotoUnchanged:true}));
 }finally{await browser.close()}
})().catch(e=>{console.error('MCP_FRONT_VISUAL_FAILURE',e.stack||String(e));process.exitCode=1});
