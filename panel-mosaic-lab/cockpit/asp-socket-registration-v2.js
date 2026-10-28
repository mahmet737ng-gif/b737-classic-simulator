/* ASP-CENTER-0002: source-photo aperture + actual alpha silhouette registration.
 * Pure geometry helper: DOES NOT modify approved cockpit images or avionics.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.B737ASPSocketRegistrationV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const W=1122,H=888;
 const n=x=>Number(x);
 function extract(svg){
  // SVG geometry is the authoritative socket source, not guessed CSS.
  const mic=[...svg.matchAll(/<rect\b[^>]*x="([\d.]+)" y="114" width="100" height="104"[^>]*\/>/g)]
   .map(m=>({kind:'mic',x:n(m[1])+50,y:166,w:100,h:104}));
  const vol=[...svg.matchAll(/<circle\b[^>]*cx="([\d.]+)" cy="(348|571)" r="45"[^>]*\/>/g)]
   .map(m=>({kind:'volume',x:n(m[1]),y:n(m[2]),w:90,h:90}));
  // The photographic ring (r=45) is the actual measured aperture.
  if(mic.length!==7||vol.length!==13)throw Error('ASP photo: expected 7 MIC + 13 receiver apertures; found '+mic.length+'/'+vol.length);
  mic.sort((a,b)=>a.x-b.x);
  vol.sort((a,b)=>a.y-b.y||a.x-b.x);
  return Object.freeze([...mic,...vol].map(x=>Object.freeze(x)));
 }
 function mask(imageData,threshold=48){
  const {data,width,height}=imageData;
  if(!(width>0&&height>0&&data.length>=width*height*4))throw Error('Invalid image mask');
  const stride=width>1700?3:2,cols=new Float64Array(width),rows=new Float64Array(height);
  let count=0,alphaSum=0;
  const inc=(x,y,v)=>{cols[x]+=v;rows[y]+=v;alphaSum+=v;count++};
  for(let y=0;y<height;y+=stride)for(let x=0;x<width;x+=stride){
   const k=(y*width+x)*4,a=data[k+3];
   if(a>=threshold)inc(x,y,a);
  }
  if(count<20)throw Error('Sprite has no visible silhouette');
  // Fallback for source images that unexpectedly contain an opaque square:
  // segment the actual photo rather than calibrating to the square canvas.
  if(count>width*height/(stride*stride)*.94){
   cols.fill(0);rows.fill(0);count=0;alphaSum=0;
   const corners=[[0,0],[width-1,0],[0,height-1],[width-1,height-1]];
   const bg=[0,1,2].map(c=>corners.reduce((a,[x,y])=>a+data[(y*width+x)*4+c],0)/4);
   for(let y=0;y<height;y+=stride)for(let x=0;x<width;x+=stride){
    const k=(y*width+x)*4;
    const delta=Math.hypot(data[k]-bg[0],data[k+1]-bg[1],data[k+2]-bg[2]);
    if(delta>=26)inc(x,y,Math.min(255,delta));
   }
   if(count<20)throw Error('Cannot distinguish visible sprite from full-canvas background');
  }
  // 0.5%-99.5% trimmed silhouette bounds exclude stray alpha dust.
  function limit(hist,total,fract,fromEnd=false){
   let sum=0;
   if(fromEnd){for(let i=hist.length-1;i>=0;i--){sum+=hist[i];if(sum>=total*fract)return i;}}
   else{for(let i=0;i<hist.length;i++){sum+=hist[i];if(sum>=total*fract)return i;}}
   return 0;
  }
  const x0=limit(cols,alphaSum,.005),x1=limit(cols,alphaSum,.005,true);
  const y0=limit(rows,alphaSum,.005),y1=limit(rows,alphaSum,.005,true);
  if(x1<=x0||y1<=y0)throw Error('Degenerate ASP visible silhouette');
  return Object.freeze({x:x0,y:y0,w:x1-x0+stride,h:y1-y0+stride,cx:(x0+x1)/2,cy:(y0+y1)/2,width,height,coverage:count*stride*stride/(width*height)});
 }
 function fit(slot,silhouette,hostWidth,hostHeight,kind){
  const sx=hostWidth/W,sy=hostHeight/H,uniform=Math.min(sx,sy);
  if(!(sx>0&&sy>0&&uniform>0))throw Error('Invalid ASP host dimensions');
  // Respect the original knob/mic proportions. Do not stretch the PNG.
  const allowance=kind==='mic'?{x:.88,y:.92}:{x:1.03,y:1.03};
  const scale=Math.min(slot.w*uniform*allowance.x/silhouette.w,slot.h*uniform*allowance.y/silhouette.h);
  const w=slot.w*uniform,h=slot.h*uniform;
  return Object.freeze({
   left:w/2-silhouette.cx*scale,top:h/2-silhouette.cy*scale,
   imageW:silhouette.width*scale,imageH:silhouette.height*scale,
   hitW:w,hitH:h,
   centerX:slot.x*sx,centerY:slot.y*sy,
   visibleCenterX:slot.x*sx,visibleCenterY:slot.y*sy,
   visibleW:silhouette.w*scale,visibleH:silhouette.h*scale,
   scale
  });
 }
 function compareSockets(modelSockets,sourceSockets){
  if(modelSockets.length!==sourceSockets.length)throw Error('ASP model and SVG socket counts diverged');
  return modelSockets.map(m=>{
   const q=sourceSockets.find(s=>s.kind===m.kind&&Math.hypot(s.x-m.x,s.y-m.y)<.01);
   if(!q)throw Error('Missing measured aperture for '+m.kind+' '+m.channel);
   return Object.freeze({...q,channel:m.channel});
  });
 }
 return Object.freeze({version:'ASP-CENTER-0002',viewBox:Object.freeze([W,H]),extract,mask,fit,compareSockets});
});
