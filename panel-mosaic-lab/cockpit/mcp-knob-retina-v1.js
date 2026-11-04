/* MCP-RETINA-0002 | visual-only optics; no AFDS or detent changes.
 * Use published native-size assets when available. If CI has not deployed
 * them, derive a smooth high-density display buffer from the prior images.
 * Upscaling does not recover lost photographic detail from 48/80px sources. */
(function(){
"use strict";
const root=document.documentElement;
const base=new URL("./assets/mcp-switches/retina/",document.currentScript.src);
const names=["course-480.webp","ias-480.webp","altitude-480.webp","bank-ring-480.webp","heading-sel-480.webp"];
const load=(src)=>new Promise((resolve,reject)=>{
 const img=new Image();
 img.onload=()=>resolve(img);img.onerror=()=>reject(Error("Unavailable image: "+src));
 img.src=src;
});
function texture(img,sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight){
 const canvas=document.createElement("canvas");canvas.width=canvas.height=480;
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
 ctx.drawImage(img,sx,sy,sw,sh,0,0,480,480);
 // Mild edge refinement after interpolating the tiny historical source.
 const im=ctx.getImageData(0,0,480,480),p=im.data,old=new Uint8ClampedArray(p);
 for(let y=1;y<479;y++)for(let x=1;x<479;x++){
  const i=(y*480+x)*4;
  if(old[i+3]<20)continue;
  for(let c=0;c<3;c++){
   const avg=(old[i-4+c]+old[i+4+c]+old[i-1920+c]+old[i+1920+c])/4;
   p[i+c]=Math.max(0,Math.min(255,Math.round(old[i+c]*1.18-avg*.18)));
  }
 }
 ctx.putImageData(im,0,0);
 return 'url("'+canvas.toDataURL("image/webp",.9)+'")';
}
async function derive(){
 const [course,ias,altitude]=await Promise.all([
  load(new URL("../COURSE_PHOTO_80.webp",base).href),
  load(new URL("../../mcp-ias-mach-knob.webp",base).href),
  load(new URL("../ALTITUDE_PHOTO_80.webp",base).href)
 ]);
 const chunks=await Promise.all([0,1,2,3].map(async i=>{
  const r=await fetch(new URL("../owner13-photo-part"+i+".b64",base).href);
  if(!r.ok)throw Error("Original owner13 atlas unavailable");
  return (await r.text()).replace(/[^A-Za-z0-9+/=]/g,"");
 }));
 const atlas=await load("data:image/webp;base64,"+chunks.join(""));
 if(atlas.naturalWidth!==192||atlas.naturalHeight!==192)throw Error("Bad owner13 atlas dimensions");
 const cell=(idx,zx,zy)=>{
  const col=idx%4,row=Math.floor(idx/4),w=48/zx,h=48/zy;
  return texture(atlas,col*48+(48-w)/2,row*48+(48-h)/2,w,h);
 };
 const variables={
  "--mcp-course-detail":texture(course),
  "--mcp-ias-detail":texture(ias),
  "--mcp-altitude-detail":texture(altitude),
  "--mcp-bank-ring-detail":cell(12,1.28,1.31),
  "--mcp-heading-sel-detail":cell(11,1.43,1.28)
 };
 for(const [k,v]of Object.entries(variables))root.style.setProperty(k,v);
 return "interpolated-480";
}
function enable(mode){
 root.dataset.mcpRetina=mode;
 root.classList.add("mcp-retina-ready");
 window.dispatchEvent(new CustomEvent("b737:mcp-retina-ready",{detail:{mode,visualOnly:true}}));
}
Promise.all(names.map(name=>load(new URL(name,base).href).then(im=>{
 if(im.naturalWidth<320||im.naturalHeight<320)throw Error("Undersized "+name);
}))).then(()=>enable("published-480")).catch(async()=>{
 try{enable(await derive());}
 catch(e){root.dataset.mcpRetina="legacy";console.warn("MCP retina fallback; using original registered art",String(e));}
});
})();
