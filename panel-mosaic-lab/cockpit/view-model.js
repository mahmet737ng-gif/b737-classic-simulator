(function(root,factory){const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;if(root)root.B737CockpitView=a;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function validate(a){const ids=new Set();for(const r of a.regions){if(ids.has(r.id))throw Error('Duplicate region');ids.add(r.id);if(r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>a.canvas.width||r.y+r.h>a.canvas.height)throw Error('Invalid region '+r.id);for(const p of r.placements||[]){const s=a.assets[p.asset];if(!s)throw Error('Missing source '+p.id);if(p.x<0||p.y<0||p.w<=0||p.h<=0||p.x+p.w>r.nativeWidth+.1||p.y+p.h>r.nativeHeight+2)throw Error('Placement out of bounds '+p.id);if(!p.sourceWindow&&Math.abs(p.w/p.h-s.dimensions[0]/s.dimensions[1])>.0001)throw Error('Source aspect distorted '+p.id);}}if(!['overhead','main','pedestal'].every(id=>ids.has(id)))throw Error('Three cockpit regions required');return true;}
 function fit(region,width,height){return clamp(Math.min((width-42)/region.w,(height-65)/region.h),.04,2);}
 function zoomAnchor(current,next,left,top,x,y,before={x:0,y:0},after={x:0,y:0}){next=clamp(next,.04,2);return {zoom:next,left:Math.max(0,(left+x-before.x)/current*next+after.x-x),top:Math.max(0,(top+y-before.y)/current*next+after.y-y)};}
 return Object.freeze({validate,fit,zoomAnchor,clamp});
});
