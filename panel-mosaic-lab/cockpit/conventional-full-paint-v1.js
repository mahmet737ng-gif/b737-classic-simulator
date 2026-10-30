/* Display-only owner panorama paint matching. The uploaded PNG stays byte exact.
 * Gauge faces, scale numbers, lamps, labels and protected physical controls are excluded.
 */
(function(){'use strict';
const target=[134,148,158];
const faces=[[145,470,142],[179,777,84],[92,926,84],[258,926,84],[800,154,73],[1142,329,93],[1146,849,35]];
for(const x of [427,600])for(const y of [427,596,747,910])faces.push([x,y,80]);
for(const x of [805,973])for(const y of [431,591,748,909])faces.push([x,y,81]);
const ramp=(v,a,b)=>Math.max(0,Math.min(1,(v-a)/(b-a)));
function apply(img){if(img.dataset.paintMatched)return;
const doc=img.ownerDocument,c=doc.createElement('canvas');c.width=1463;c.height=1075;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
const frame=ctx.getImageData(0,0,c.width,c.height),a=frame.data;
for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
 if(faces.some(([cx,cy,r])=>(x-cx)**2+(y-cy)**2<r*r))continue;
 const i=(y*c.width+x)*4,r=a[i],g=a[i+1],b=a[i+2],lo=Math.min(r,g,b),hi=Math.max(r,g,b);
 // Ignore white printing, black apertures, chromatic text and warning marks.
 if(hi-lo>55||hi<58||lo<42||hi>225)continue;
 const ivory=x>=345&&x<705;
 const base=ivory?[197,205,200]:x>=1238?[82,89,94]:[85,95,109];
 if(ivory&&(lo<125||g<r-8||b>g+12))continue;
 if(!ivory&&(b<r-8||g<r-8))continue;
 const w=ramp(lo,42,65)*(1-ramp(hi,205,225))*(1-ramp(hi-lo,38,55));
 for(let k=0;k<3;k++)a[i+k]=Math.max(0,Math.min(255,a[i+k]+(target[k]-base[k])*w));
}
ctx.putImageData(frame,0,0);img.dataset.paintMatched='FO-PAINT-134-148-158';img.src=c.toDataURL('image/png');
}
window.B737ConventionalFullPaintV1=Object.freeze({apply,target});
})();
