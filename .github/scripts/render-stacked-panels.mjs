import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1012,height:3800},deviceScaleFactor:1,colorScheme:'dark'});
 const issues=[];
 page.on('pageerror',e=>issues.push(String(e)));
 const response=await page.goto('http://127.0.0.1:8765/panels-stacked/index.html',{waitUntil:'networkidle',timeout:120000});
 if(!response||!response.ok())throw Error('Stacked source page failed');
 await page.waitForFunction(()=>{
  const frames=[...document.querySelectorAll('#real-panels iframe')];
  return frames.length===2 && frames.every(frame=>{
   if(frame.dataset.ready!=='true')return false;
   const doc=frame.contentDocument;
   return doc && doc.querySelector('.panel') && [...doc.images].every(img=>img.complete && img.naturalWidth>0);
  });
 },{timeout:60000});
 await page.locator('#real-panels').screenshot({path:'panels-stacked/composite.png',animations:'disabled',timeout:60000});
 const bounds=await page.locator('#real-panels').boundingBox();
 console.log(JSON.stringify({output:'panels-stacked/composite.png',bounds,issues}));
 if(issues.length)throw Error('Panel JavaScript errors: '+issues.join('; '));
}finally{await browser.close();}
