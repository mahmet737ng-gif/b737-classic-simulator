'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const m=JSON.parse(fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/assets/mcp-switches/native/FD_NATIVE_MANIFEST.json')));
 assert.equal(m.sourceUntouched,true);assert.deepEqual(m.stateIndex,{ON:3,OFF:4});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 for(const part of ['mcp-panel','cockpit']){
  const page=await browser.newPage({viewport:{width:1860,height:900},deviceScaleFactor:1});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  const base='http://127.0.0.1:8788/panel-mosaic-lab/'+part+'/';
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('[data-piece="mcp"] .mcp-hw-at .mcp-hw-real-face',{timeout:60000});
  const results=[];
  for(const [state,hardware] of (part==='cockpit'?[['OFF',{AT_ARM:'OFF',FD_LEFT:'OFF',FD_RIGHT:'OFF'}]]:[['OFF',{AT_ARM:'OFF',FD_LEFT:'OFF',FD_RIGHT:'OFF'}],['ON',{AT_ARM:'ARM',FD_LEFT:'ON',FD_RIGHT:'ON'}]])){
   await page.evaluate(values=>{
    for(const [key,st]of Object.entries(values))window.B737McpHardwareV1.setState(key,st);
   },hardware);
   await page.waitForTimeout(200);
   const data=await page.evaluate(async()=>{
    const node=id=>document.querySelector('[data-piece="mcp"] [data-mcp-hardware="'+id+'"] .mcp-hw-real-face');
    const res={};
    for(const id of ['AT_ARM','FD_LEFT','FD_RIGHT']){
     const e=node(id);assert(e);
     const style=getComputedStyle(e),match=style.backgroundImage.match(/url\("?(.*?)"?\)/);
     if(!match)throw Error(id+' missing native face');
     const src=match[1].replace(/"$/,'');
     const image=new Image();image.src=src;await image.decode();
     const b=e.getBoundingClientRect();
     res[id]={src:src.substring(src.lastIndexOf('/')+1),width:image.naturalWidth,height:image.naturalHeight,box:[b.width,b.height],display:style.display};
    }
    function assert(v){if(!v)throw Error('Real-face DOM missing')}
    return res;
   });
   assert.equal(data.AT_ARM.src,state==='OFF'?'AT_ARM_OFF.svg':'AT_ARM_UP.svg');
   for(const id of ['FD_LEFT','FD_RIGHT']){
    assert.equal(data[id].src,'FD_'+state+'_NATIVE.png');
    assert.ok(data[id].width>=160&&data[id].height>=160);
    assert.ok(data[id].box[0]>0&&data[id].box[1]>0);
   }
   assert.equal(data.AT_ARM.width,256);assert.equal(data.AT_ARM.height,260);
   results.push({state,faces:data});
   console.log('MCP_NATIVE_RENDER_PASS',part,state,JSON.stringify(data));
  }
  // Unified is controlled by AFDS and may forbid ARM/ON while MCP POWER is UNKNOWN.
  // Validate real OFF assets in Unified; exercise both states on the independent MCP hardware lab.
  assert.ok(!errs.some(x=>/mcp|SyntaxError/.test(x)),JSON.stringify(errs));
  const file='/tmp/mcp-native-'+part+'.png';
  await page.locator('[data-piece="mcp"]').first().screenshot({path:file,animations:'disabled'});
  console.log('MCP_NATIVE_PAGE_PASS',JSON.stringify({part,states:results.map(x=>x.state),screenshot:file}));
  await page.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error('MCP_NATIVE_RENDER_FAILED',e.stack||String(e));process.exitCode=1});
