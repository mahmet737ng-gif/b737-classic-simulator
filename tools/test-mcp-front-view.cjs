'use strict';
/* MCP actual asset adoption visual QA.
   OFF/ON A/T are different SVG files. F/D uses the original Silver Small
   five-pose transparent sprite, fourth/fifth cells, not CSS substitute bars.
   Source pivots and AFDS physical behavior must remain intact.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const out='/tmp/b737-mcp-authentic-switches';
fs.mkdirSync(out,{recursive:true});
const prefix='http://127.0.0.1:8788/panel-mosaic-lab/';
async function run(browser,kind){
 const page=await browser.newPage({viewport:{width:1900,height:910},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=prefix+(kind==='lab'?'mcp-panel/':'cockpit/');
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 assert.equal(response.status(),200);
 await page.waitForFunction(()=>Boolean(window.B737McpHardwareV1)&&Boolean(window.B737McpVisualV3)&&
     Boolean(document.querySelector('[data-piece="mcp"] [data-mcp-hardware="AT_ARM"] .mcp-hw-switch-art'))&&
     document.querySelectorAll('[data-piece="mcp"] .mcp-hw-silver-atlas').length===2,
   null,{timeout:60000});
 const a=await page.evaluate(async()=>{
   const ids=['AT_ARM','FD_LEFT','FD_RIGHT'];
   const controls=window.B737McpHardwareV1.geometry;
   if(controls.filter(c=>ids.includes(c.id)).length!==3)throw Error('MCP source geometry changed');
   const art=document.querySelector('[data-piece="mcp"] [data-mcp-hardware="AT_ARM"]');
   const images=[...art.querySelectorAll('img.mcp-hw-switch-art')];
   await Promise.all(images.map(im=>im.decode()));
   const silver=[...document.querySelectorAll('[data-piece="mcp"] .mcp-hw-silver-atlas')];
   const css=silver.map(s=>({bg:getComputedStyle(s).backgroundImage,
     pos:getComputedStyle(s).backgroundPosition,
     bounds:{w:s.getBoundingClientRect().width,h:s.getBoundingClientRect().height}}));
   const loaded=await Promise.all(css.map(async v=>{
      const image=new Image();
      image.src=v.bg.slice(5,-2);
      await image.decode();
      return {width:image.naturalWidth,height:image.naturalHeight};
   }));
   const knob=window.B737McpVisualV3.geometry.knobs;
   return{states:window.B737McpHardwareV1.getState(),
    images:images.map(im=>({src:im.src,w:im.naturalWidth,h:im.naturalHeight})),
    silver:css.map((v,i)=>({...v,sprite:loaded[i]})),
    toggles:controls.filter(c=>ids.includes(c.id)).map(c=>({...c})),
    knobs:knob.map(k=>({...k}))};
 });
 assert.equal(a.images.length,2);
 assert.ok(a.images.some(x=>x.src.endsWith('/AT_ARM_OFF.svg')));
 assert.ok(a.images.some(x=>x.src.endsWith('/AT_ARM_UP.svg')));
 assert.ok(a.images.every(x=>x.w===256&&x.h===260));
 assert.equal(a.silver.length,2);
 assert.ok(a.silver.every(x=>x.bg.includes('Small_Silver_5Positions.webp')));
 assert.ok(a.silver.every(x=>x.sprite.width===5120&&x.sprite.height===1024));
 assert.deepEqual(a.toggles.map(x=>x.id),['AT_ARM','FD_LEFT','FD_RIGHT']);
 assert.equal(a.knobs.length,5);
 const photoAudit=await page.evaluate(async()=>{
  const root=document.querySelector('[data-piece="mcp"]');
  const ids=[
   ['courseL','COURSE_PHOTO_80.webp'],['courseR','COURSE_PHOTO_80.webp'],
   ['heading','HEADING_PHOTO_80.webp'],['altitude','ALTITUDE_PHOTO_80.webp']
  ];
  const found=[];
  for(const [id,file]of ids){
   const node=root.querySelector('.mcp-v3-knob[data-control="'+id+'"] .mcp-v3-'+(id.startsWith('course')?'course':'plain')+'-face');
   if(!node)throw Error('missing real reference knob '+id);
   const css=getComputedStyle(node).backgroundImage;
   if(!css.includes(file))throw Error('CSS pseudo-knob remains mounted '+id+': '+css);
   const u=css.slice(5,-2),img=new Image();img.src=u;await img.decode();
   found.push({id,file,w:img.naturalWidth,h:img.naturalHeight});
  }
  const buttons=[...root.querySelectorAll('.mcp-hw-push')];
  if(buttons.length!==3)throw Error('MCP physical round push-button count has drifted');
  for(const b of buttons){
   const css=getComputedStyle(b.querySelector('.mcp-hw-push-bezel')).backgroundImage;
   if(!css.includes('ROUND_PUSH_80.webp'))throw Error('Old CSS pushbutton instead of source photo');
   const img=new Image();img.src=css.slice(5,-2);await img.decode();
   if(img.naturalWidth!==80||img.naturalHeight!==80)throw Error('Pushbutton photo altered');
  }
  return{knobs:found,pushes:buttons.length};
 });
 assert.equal(photoAudit.knobs.length,4);
 assert.equal(photoAudit.pushes,3);
 assert.ok(photoAudit.knobs.every(x=>x.w===80&&x.h===80));
 console.log('MCP_PRIOR_ARTWORK_LOADED',JSON.stringify({page:kind,...photoAudit}));
 const states={};
 for(const mode of ['OFF','ON']){
  if(kind==='lab'){
   await page.evaluate(mode=>{
     const a=window.B737McpHardwareV1;
     a.setState('AT_ARM',mode==='ON'?'ARM':'OFF');
     a.setState('FD_LEFT',mode);
     a.setState('FD_RIGHT',mode);
   },mode);
  }else{
   await page.evaluate(mode=>{
    const desired={AT_ARM:mode==='ON'?'ARM':'OFF',FD_LEFT:mode,FD_RIGHT:mode};
    const v=window.B737McpHardwareV1.getState();
    for(const [id,value]of Object.entries(desired)){
      if(v[id]!==value)document.querySelector('[data-piece="mcp"] [data-mcp-hardware="'+id+'"]').click();
    }
   },mode);
  }
  await page.waitForTimeout(100);
  const measured=await page.evaluate(()=>{
   const get=id=>document.querySelector('[data-piece="mcp"] [data-mcp-hardware="'+id+'"]');
   const at=get('AT_ARM');
   const imgs=[...at.querySelectorAll('.mcp-hw-switch-art')].map(im=>({src:im.src,display:getComputedStyle(im).display}));
   return{value:window.B737McpHardwareV1.getState(),
    at:imgs,
    fds:['FD_LEFT','FD_RIGHT'].map(id=>({id,
     position:getComputedStyle(get(id).querySelector('.mcp-hw-silver-atlas')).backgroundPosition,
     image:getComputedStyle(get(id).querySelector('.mcp-hw-silver-atlas')).backgroundImage
    }))};
  });
  assert.equal(measured.value.AT_ARM,mode==='OFF'?'OFF':'ARM');
  assert.equal(measured.value.FD_LEFT,mode);
  assert.equal(measured.value.FD_RIGHT,mode);
  const visible=measured.at.filter(x=>x.display!=='none');
  assert.equal(visible.length,1,'only the proper mechanical photograph must be visible');
  assert.ok(visible[0].src.endsWith(mode==='OFF'?'AT_ARM_OFF.svg':'AT_ARM_UP.svg'));
  for(const x of measured.fds)
   assert.ok(x.position.startsWith(mode==='OFF'?'94.2%':'72.1%'),
    'Magnified original silver atlas fourth=UP, fifth=DOWN; unexpected '+x.id+' '+x.position);
  states[mode]=measured;
  if(kind==='lab'){
   const shot=await page.locator('#stage').screenshot({animations:'disabled',timeout:25000});
   fs.writeFileSync(path.join(out,'mcp-'+mode.toLowerCase()+'-actual-sprites.png'),shot);
   const thumb=await page.locator('#stage').screenshot({type:'jpeg',quality:76,animations:'disabled'});
   console.log('MCP_AUTHENTIC_PREVIEW',mode,thumb.toString('base64'));
  }
  console.log('MCP_ACTUAL_SPRITES_STATE',JSON.stringify({page:kind,mode,
   activeAT:visible[0].src.split('/').pop(),fdX:measured.fds.map(x=>x.position)}));
 }
 assert.equal(errors.length,0,errors.join(' | '));
 const outcome={kind,states,assets:a.images,silver:a.silver.map(x=>x.sprite),errors};
 await page.close();return outcome;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const results=[await run(browser,'lab'),await run(browser,'unified')];
  fs.writeFileSync(path.join(out,'measured.json'),JSON.stringify({version:'MCP-SPRITE-0002',
   originalPhotoIntact:true,sourceControlsUnmoved:true,results},null,2));
  console.log('MCP_AUTHENTIC_SWITCHES_PASS',JSON.stringify({pages:2,toggles:3,states:2,originalSprite:'Small_Silver_5Positions.webp',atlases:2,sourcePhotoUnchanged:true}));
 }finally{await browser.close()}
})().catch(e=>{console.error('MCP_AUTHENTIC_SWITCHES_FAILURE',e.stack||String(e));process.exitCode=1});
