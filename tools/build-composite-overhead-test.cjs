'use strict';
/* Build a *real single WebP* from the rendered approved atlas, only in web-dist.
 * Does not write to the repository's protected assets or approved renderer.
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../web-dist'),prefix='/b737-classic-simulator/';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local');if(!u.pathname.startsWith(prefix)){res.writeHead(404);return res.end();}
 const file=path.resolve(root,decodeURIComponent(u.pathname.slice(prefix.length)));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try{const stat=fs.statSync(file);if(!stat.isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',stat.size);
  fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port+prefix+'panel-mosaic-lab/cockpit/';
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const page=await browser.newPage({viewport:{width:2400,height:3550},deviceScaleFactor:1});
  await page.goto(base+'overhead-stage.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('#atlasAbsolute .atlas-piece').length>=19,null,{timeout:60000});
  // Same original source pixels and exact source strips; no control/lamp faces
  // are baked into the texture, because they must stay live and interactive.
  await page.evaluate(async()=>{
   const images=[...document.querySelectorAll('#atlasAbsolute img.atlas-photo')];
   const files=[...new Set(images.map(img=>new URL(img.dataset.perfSource,document.baseURI).href))];
   const sources=new Map();
   await Promise.all(files.map(async src=>{
    const image=new Image();image.decoding='async';image.src=src;await image.decode();sources.set(src,image);
   }));
   for(const img of images){
    const src=new URL(img.dataset.perfSource,document.baseURI).href;
    // Reuse decoded original textures; freeze subsequent image-loader refresh
    // by not presenting these temporary export clones to the loader.
    img.removeAttribute('data-perf-source');
    img.src=src;
    await img.decode();
   }
   document.querySelector('#board').style.transform='scale(1)';
   document.querySelector('#sizer').style.width='2220px';
   document.querySelector('#sizer').style.height='3312px';
  });
  await page.addStyleTag({content:`
   #atlasAbsolute .atlas-piece > :not(.atlas-image-window){visibility:hidden!important}
   #atlasAbsolute .atlas-image-window > :not(.atlas-source-strip){visibility:hidden!important}
   #atlasAbsolute .atlas-geometry-stamp{display:none!important}
   #atlasAbsolute .atlas-piece {outline:0!important;cursor:default!important}
   #atlasAbsolute .atlas-piece::before,#atlasAbsolute .atlas-piece::after{content:none!important}
   #atlasAbsolute .atlas-photo{visibility:visible!important}
  `});
  const rect=await page.locator('#atlasAbsolute').boundingBox();
  assert.ok(rect&&Math.abs(rect.width-2220)<2&&Math.abs(rect.height-3312)<2,'Composite source must preserve exact 2220x3312 coordinate space');
  const png=await page.locator('#atlasAbsolute').screenshot({animations:'disabled',timeout:60000});
  const imageData=await page.evaluate(async base64=>{
   const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=2220;canvas.height=3312;
   canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,2220,3312);
   return canvas.toDataURL('image/webp',0.85);
  },png.toString('base64'));
  assert.ok(imageData.startsWith('data:image/webp;base64,'),'Chrome must create a genuine WebP');
  const bytes=Buffer.from(imageData.split(',')[1],'base64');
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  const output=path.join(root,'panel-mosaic-lab/cockpit/assets/overhead-composite-test.webp');
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
  const measures={width:2220,height:3312,bytes:bytes.length,quality:0.85,source:'original locked atlas via browser screenshot',experimental:true};
  fs.writeFileSync(path.join(root,'panel-mosaic-lab/cockpit/composite-test-meta.json'),JSON.stringify(measures,null,2)+'\n');
  console.log('COMPOSITE A/B WebP created '+Math.round(bytes.length/1024)+' KiB from approved 2220x3312 atlas');
  // The comparison must run the real whole cockpit, not just a static photo.
  const test=await browser.newPage({viewport:{width:1580,height:920}});
  await test.goto(base+'unified-composite-test.html',{waitUntil:'domcontentloaded',timeout:60000});
  await test.waitForFunction(()=>document.documentElement.dataset.unifiedUsableMs,null,{timeout:60000});
  await test.locator('[data-focus="overhead"]').first().click();
  const oh=test.frameLocator('#overheadFrame');
  await oh.locator('#atlasAbsolute .atlas-piece').first().waitFor({timeout:45000});
  await oh.locator('html[data-composite-image-ready="true"]').waitFor({timeout:30000});
  const verify=await oh.locator('#atlasAbsolute').evaluate(node=>({
   pieces:node.querySelectorAll('.atlas-piece').length,
   originalPhotosLoaded:node.querySelectorAll('img.atlas-photo[src]').length,
   composite:getComputedStyle(node).backgroundImage
  }));
  assert.ok(verify.pieces>=19,'Hotspot geometry must remain mounted');
  assert.equal(verify.originalPhotosLoaded,0,'Composite experiment must not download original mosaic photos');
  assert.ok(verify.composite.includes('overhead-composite-test.webp'));
  console.log('COMPOSITE A/B interactive stage OK: '+JSON.stringify(verify));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
