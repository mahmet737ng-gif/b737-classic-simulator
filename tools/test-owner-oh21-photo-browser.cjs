'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const registry=require('../panel-mosaic-lab/cockpit/panel-photo-registry.v1.json');
const origin=process.env.B737_TEST_ORIGIN||'http://127.0.0.1:8788';
const output=path.resolve('artifacts/owner-oh21-qa');fs.mkdirSync(output,{recursive:true});
(async()=>{
const browser=await chromium.launch(process.env.CHROME_PATH?{headless:true,executablePath:process.env.CHROME_PATH}:{headless:true});
let failures=[];
try{
 for(const [family,key] of [['B737-300-500','OH21_300500'],['B737-400','OH21_400']]){
  const page=await browser.newPage({viewport:{width:1680,height:1120}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(family=>{localStorage.setItem('b737classic.aircraft-profile.v1',JSON.stringify({schema:'b737-classic-aircraft-profile/1',aircraftFamily:family,pressurization:'DCPCS',engineInstruments:'EIS'}));},family);
  await page.goto(origin+'/panel-mosaic-lab/cockpit/overhead-stage.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.B737OH21OwnerPhotoV1?.status()?.loaded,{timeout:60000});
  await page.waitForTimeout(1300);
  const report=await page.evaluate(({key,p})=>{
   const host=document.querySelector('#atlasAbsolute');
   const piece=host.querySelector('.atlas-piece[data-key="OH21"]');
   const photo=host.querySelector('.owner-oh21-photo-layer-v1 img');
   const x=Number.parseFloat(piece.style.left),y=Number.parseFloat(piece.style.top),w=Number.parseFloat(piece.style.width),h=Number.parseFloat(piece.style.height);
   const scale=Math.min(w/p.width,h/p.height),ox=x+(w-p.width*scale)/2,oy=y+(h-p.height*scale)/2;
   const controls=[];
   for(const [id,xy] of Object.entries(p.controls)){
    const node=id==='recirc-fan-l'?document.getElementById('toggle-recirc-fan-l-400'):
      id==='aircon-ovht-test'||id==='trip-reset'?host.querySelector('.b737-recess-unit[data-recessed-id="'+id+'"]'):
      host.querySelector('.mounted-toggle[data-control="'+id+'"]');
    const dx=node?Math.abs(Number.parseFloat(node.style.left)-(ox+xy[0]*scale)):999;
    const dy=node?Math.abs(Number.parseFloat(node.style.top)-(oy+xy[1]*scale)):999;
    controls.push({id,found:!!node,dx,dy});
   }
   const lights=[];
   for(const [id,rect] of Object.entries(p.lights)){
    const node=host.querySelector('.mounted-light[data-light="'+id+'"]');
    const dx=node?Math.abs(Number.parseFloat(node.style.left)-(ox+rect[0]*scale)):999;
    const dy=node?Math.abs(Number.parseFloat(node.style.top)-(oy+rect[1]*scale)):999;
    lights.push({id,found:!!node,dx,dy});
   }
   const cv=document.createElement('canvas');cv.width=photo.naturalWidth;cv.height=photo.naturalHeight;
   const ctx=cv.getContext('2d');ctx.drawImage(photo,0,0);
   const darkness=[];
   for(const [id,xy] of Object.entries(p.controls)){
    const cx=Math.round(xy[0]),cy=Math.round(xy[1]);
    const px=ctx.getImageData(cx-6,cy-6,12,12).data;let sum=0;
    for(let i=0;i<px.length;i+=4)sum+=(px[i]+px[i+1]+px[i+2])/3;
    darkness.push({id,mean:sum/(px.length/4)});
   }
   return {active:window.B737OH21OwnerPhotoV1.status(),imageLoaded:photo.complete,photoWidth:photo.naturalWidth,photoHeight:photo.naturalHeight,controls,lights,darkness};
  },{key,p:registry.panels[key]});
  const bad=report.controls.concat(report.lights).filter(a=>!a.found||a.dx>1||a.dy>1);
  const bright=report.darkness.filter(a=>a.mean>95);
  const defect={family,key,bad,bright,errors};
  if(bad.length||bright.length||errors.length)failures.push(defect);
  await page.screenshot({path:path.join(output,key+'-full.png'),fullPage:true});
  fs.writeFileSync(path.join(output,key+'-geometry.json'),JSON.stringify(report,null,2));
  console.log('OH21 '+family+': controls '+report.controls.length+', lamps '+report.lights.length+', misplaced '+bad.length+', bright sockets '+bright.length+', page errors '+errors.length);
  if(!bad.length&&!bright.length){
   if(family==='B737-400'){
    const left=page.locator('#toggle-recirc-fan-l-400');
    const prev=await page.evaluate(()=>window.B737Aircon400Oh21.getState().left);
    await left.click({timeout:6000});
    const next=await page.evaluate(()=>window.B737Aircon400Oh21.getState().left);
    assert.notEqual(prev,next,'400 left recirc does not change state');
   }else{
    const recirc=page.locator('#toggle-recirc-fan');
    const prev=await page.evaluate(()=>window.B737OverheadToggles.getState()['recirc-fan']);
    await recirc.click({timeout:6000});
    const next=await page.evaluate(()=>window.B737OverheadToggles.getState()['recirc-fan']);
    assert.notEqual(prev,next,'300/500 recirc does not change state');
   }
  }
  await page.close();
 }
}finally{await browser.close();}
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exitCode=1;}
else console.log('PASS: both photo variants, live switch actuation, screenshot and socket/geometry audit');
})().catch(e=>{console.error(e);process.exitCode=1});
