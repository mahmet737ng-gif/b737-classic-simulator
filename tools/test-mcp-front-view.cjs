'use strict';
/* MCP-PHOTO-0003: screenshots + DOM and image-decode verification of the prior
   isolated photographic parts. No CSS-drawn replica can satisfy the contract.
   Three switches: A/T OFF / ARM and captain/FO F/D OFF / ON. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const out='/tmp/b737-mcp-authentic-switches';fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:8788/panel-mosaic-lab/';
const S=['AT_ARM','FD_LEFT','FD_RIGHT'];
async function exercise(browser,kind){
 const page=await browser.newPage({viewport:{width:1900,height:950},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=base+(kind==='lab'?'mcp-panel/':'cockpit/');
 const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 assert.equal(r.status(),200);
 await page.waitForFunction(()=>Boolean(window.B737McpHardwareV1&&window.B737McpVisualV3)&&
  document.querySelectorAll('[data-piece="mcp"] .mcp-hw-real-face').length===3,null,{timeout:60000});
 const art=await page.evaluate(async()=>{
  const root=document.querySelector('[data-piece="mcp"]');
  const faces=[...root.querySelectorAll('.mcp-hw-real-face')];
  const src=getComputedStyle(faces[0]).backgroundImage;
  const match=src.match(/url\(["']?(.*?)["']?\)/);
  if(!match)throw Error('Missing actual photo-sheet URL');
  const img=new Image();img.src=match[1];await img.decode();
  const toggles=window.B737McpHardwareV1.geometry.filter(x=>['AT_ARM','FD_LEFT','FD_RIGHT'].includes(x.id));
  const knobs=[...root.querySelectorAll('.mcp-v3-knob')];
  const presses=[...root.querySelectorAll('.mcp-hw-push')];
  const knobImgs=knobs.map(n=>({name:n.dataset.control,
   bg:getComputedStyle(n.querySelector('.mcp-v3-course-face,.mcp-v3-plain-face')||n).backgroundImage}));
  return {img:{src:img.src,w:img.naturalWidth,h:img.naturalHeight},
   toggles,knobImgs,pushes:presses.length,svgMocks:root.querySelectorAll('.mcp-hw-at-hub,.mcp-hw-at-paddle,.mcp-hw-fd-shaft,.mcp-hw-silver-atlas').length,
   photos:faces.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height,
       source:getComputedStyle(n).backgroundImage,scale:getComputedStyle(n).backgroundSize}))};
 });
 assert.ok(art.img.src.endsWith('/MCP_FRONT_OWNER_PHOTOS_4POSE.webp'));
 assert.deepEqual([art.img.w,art.img.h],[160,160],'Physical A/T and F/D real states atlas dimensions');
 assert.equal(art.svgMocks,0,'No fabricated CSS switch components may be mounted');
 assert.equal(art.photos.length,3);assert.ok(art.photos.every(n=>n.w>10&&n.h>10&&n.source.includes('MCP_FRONT_OWNER_PHOTOS_4POSE.webp')));
 assert.equal(art.knobImgs.length,5);assert.equal(art.pushes,3);
 for(const [id,asset] of [['courseL','COURSE_PHOTO_80.webp'],['courseR','COURSE_PHOTO_80.webp'],
    ['heading','HEADING_PHOTO_80.webp'],['altitude','ALTITUDE_PHOTO_80.webp']]){
  assert.ok(art.knobImgs.find(n=>n.name===id)?.bg.includes(asset),'Approved original rotary photo missing: '+id);
 }
 assert.deepEqual(art.toggles.map(x=>x.id),S);
 for(const [id,coords] of [['AT_ARM',[357,181,66,68]],['FD_LEFT',[203,321,36,51]],['FD_RIGHT',[1903,321,36,51]]]){
  const t=art.toggles.find(x=>x.id===id);
  assert.deepEqual([t.x,t.y,t.w,t.h],coords,'Never move established source pivot '+id);
 }
 const states={};
 for(const mode of ['OFF','ON']){
  const values={AT_ARM:mode==='ON'?'ARM':'OFF',FD_LEFT:mode,FD_RIGHT:mode};
  if(kind==='lab'){
   await page.evaluate(values=>{for(const [key,val] of Object.entries(values))window.B737McpHardwareV1.setState(key,val)},values);
  }else{
   await page.evaluate(values=>{
    const state=window.B737McpHardwareV1.getState();
    for(const [id,val] of Object.entries(values))
     if(state[id]!==val)document.querySelector('[data-piece="mcp"] [data-mcp-hardware="'+id+'"]').click();
   },values);
  }
  await page.waitForTimeout(120);
  const snap=await page.evaluate(()=>{
   const result={};
   for(const id of ['AT_ARM','FD_LEFT','FD_RIGHT']){
    const el=document.querySelector('[data-piece="mcp"] [data-mcp-hardware="'+id+'"]');
    const image=el.querySelector('.mcp-hw-real-face'),css=getComputedStyle(image);
    result[id]={value:el.dataset.state,position:css.backgroundPosition,bg:css.backgroundImage,
      size:css.backgroundSize,visible:css.display!=='none',w:image.getBoundingClientRect().width};
   }
   return result;
  });
  for(const [id,expected]of Object.entries(values)){
   assert.equal(snap[id].value,expected);
   assert.equal(snap[id].visible,true);
   assert.ok(snap[id].bg.includes('MCP_FRONT_OWNER_PHOTOS_4POSE.webp'));
   assert.equal(snap[id].size,'200% 200%');
   assert.equal(snap[id].position,
      id==='AT_ARM'?(mode==='ON'?'100% 0%':'0% 0%'):(mode==='ON'?'100% 100%':'0% 100%'),
      id+' '+mode+' must use the real previous-design photo state, not rotate an artificial knob');
  }
  states[mode]=snap;
  console.log('MCP_RESTORED_ART_STATE',JSON.stringify({page:kind,mode,positions:Object.fromEntries(S.map(id=>[id,snap[id].position]))}));
  if(kind==='lab'){
   const full=await page.locator('#stage').screenshot({path:path.join(out,'actual-MCP-'+mode+'.png'),animations:'disabled'});
   const shot=await page.locator('#stage').screenshot({type:'jpeg',quality:76,animations:'disabled'});
   console.log('MCP_RESTORED_ART_PREVIEW',mode,shot.toString('base64'));
  }
 }
 assert.deepEqual(errors.filter(x=>/MCP|SyntaxError|failed to|Cannot read/.test(x)),[],'Page error');
 await page.close();
 return {kind,art,states,errors};
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const runs=[await exercise(browser,'lab'),await exercise(browser,'unified')];
  const record={schema:'b737.mcp.real-source-photo-0003',date:'2026-10-26',runs,
   originalPhotoUnchanged:true,sourcePivotsUnchanged:true};
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(record,null,2)+'\n');
  console.log('MCP_ACTUAL_PHOTOS_PASS',JSON.stringify({pages:2,physicalSwitches:3,states:2,
   sourcePhoto:'MCP_FRONT_OWNER_PHOTOS_4POSE.webp',dimensions:[160,160],sourceGeometryIntact:true}));
 }finally{await browser.close()}
})().catch(e=>{console.error('MCP_ACTUAL_PHOTOS_FAILED',e.stack||String(e));process.exitCode=1});
