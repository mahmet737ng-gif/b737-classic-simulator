'use strict';
// Regenerate the release WebPs with Node and Python Pillow. The original
// cleaner code supplies the pixels, and the production atlas supplies placement.
const path=require('node:path');
process.chdir(path.resolve(__dirname,'..'));
const fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process'),crypto=require('node:crypto');
const dir='panel-mosaic-lab/cockpit/',output=dir+'performance/boot-art/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const readPixels=file=>cp.execFileSync('python3',['-c','from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert("RGBA").tobytes())',file],{maxBuffer:12*1024*1024});
const encode=(pixels,w,h)=>cp.execFileSync('python3',['-c','from PIL import Image; import sys; Image.frombytes("RGBA",tuple(map(int,sys.argv[1:3])),sys.stdin.buffer.read()).save(sys.stdout.buffer,"WEBP",lossless=True,exact=True,method=6)',w,h],{input:pixels,maxBuffer:4*1024*1024});
function pack(pixels,width,height,label){
 const bytes=encode(pixels,width,height),hash=sha(bytes),url=output+label+'-'+hash.slice(0,20)+'.webp';
 fs.writeFileSync(url,bytes);
 const decoded=readPixels(url);
 assertPixels(decoded,pixels);
 return {url,width,height,bytes:bytes.length,sha256:hash};
}
function assertPixels(a,b){
 if(a.length!==b.length)throw Error('Image dimensions changed');
 // RGB under zero alpha carries no visible pixel.
 for(let i=0;i<a.length;i+=4){
  if(a[i+3]!==b[i+3]||(a[i+3]&&(!a.subarray(i,i+3).equals(b.subarray(i,i+3)))))throw Error('Changed pixel '+i/4);
 }
}
const art={};
(async()=>{
 for(const [id,source,width,height,cleaner,fn] of [
  ['oh10','OH10-ELEC-LOSSLESS-9a1ca4d6cfb2.png',1095,1436,'ac-dc-static-needle-cleaner.js','renderCleanPhoto'],
  ['oh12','OH12-BUS-TRANS-09319c17e7d0.png',1024,1536,'apu-egt-static-needle-cleaner-v1.js','cleanedImage']
 ]){
  const file='panel-mosaic-lab/assets/locked/2026-10-23/'+source;
  const original=readPixels(file);let result;
  const context={window:{B737AcDcMeteringModel:require(process.cwd()+'/'+dir+'ac-dc-metering-model.js')},
   document:{createElement:()=>({getContext:()=>({
    drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(original)}),
    putImageData(frame){result=Buffer.from(frame.data);}
   }),toBlob(resolve){resolve(true);}})},ImageData:class{constructor(data){this.data=data;}}};
  const script=fs.readFileSync(dir+cleaner,'utf8');
  const exposed=script.replace(/\}\)\(window\);\s*$/,'root.buildMask='+fn+';})(window);');
  if(exposed===script)throw Error('Cleaner module shape changed');
  vm.runInNewContext(exposed,context);
  await context.window.buildMask({naturalWidth:width,naturalHeight:height});
  let changed=0;const rgba=Buffer.alloc(original.length);
  for(let i=0;i<rgba.length;i+=4){
   if(original.readUInt32LE(i)===result.readUInt32LE(i))continue;
   if(result[i+3]!==255)throw Error('Unexpected partial-alpha patch pixel');
   result.copy(rgba,i,i,i+4);changed++;
  }
  art[id]={...pack(rgba,width,height,id+'-needle-mask'),source:file,sourceSha256:sha(fs.readFileSync(file)),changed};
 }
 const source=dir+'assets/engine-start-lever-reference-v2.png',master=readPixels(source);
 for(const [id,x] of [['engine1',420],['engine2',1095]]){
  const y=340,width=655,height=365,rgba=Buffer.alloc(width*height*4);
  for(let row=0;row<height;row++){
   const at=((row+y)*2172+x)*4;
   master.copy(rgba,row*width*4,at,at+width*4);
  }
  art[id]={...pack(rgba,width,height,id+'-start-lever'),source,sourceSha256:sha(fs.readFileSync(source))};
 }
 fs.writeFileSync(output+'manifest.json',JSON.stringify(art,null,2)+'\n');
 console.log(Object.entries(art).map(([id,x])=>[id,x.bytes,x.changed]));
})().catch(error=>{console.error(error);process.exitCode=1;});
