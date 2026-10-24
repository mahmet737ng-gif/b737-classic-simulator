(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FlapLeverModel=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const DETENTS=Object.freeze([0,1,2,5,10,15,25,30,40]);
 const GATES=Object.freeze([1,15]);
 function indexOf(value){const i=DETENTS.indexOf(Number(value));if(i<0)throw Error('Unknown B737 FLAP detent '+value);return i;}
 function gatedTarget(current,requested){
  const from=indexOf(current),to=indexOf(requested);
  if(to===from)return DETENTS[from];
  if(to>from){for(const gate of GATES){const g=indexOf(gate);if(g>from&&g<to)return gate;}}
  else {for(const gate of [...GATES].reverse()){const g=indexOf(gate);if(g<from&&g>to)return gate;}}
  return DETENTS[to];
 }
 function sequence(current,requested){
  const last=gatedTarget(current,requested),a=indexOf(current),b=indexOf(last),inc=Math.sign(b-a),out=[];
  if(!inc)return out;
  for(let i=a+inc;inc>0?i<=b:i>=b;i+=inc)out.push(DETENTS[i]);
  return out;
 }
 function swipe(current,direction){
  const index=indexOf(current),dir=Math.sign(Number(direction));
  return DETENTS[Math.max(0,Math.min(DETENTS.length-1,index+dir))];
 }
 function nativePoint(texture,source){
  const win=texture.sourceWindow;
  const nx=texture.x+(source.x-win.x)*texture.w/win.w;
  const ny=texture.y+(source.y-win.y)*texture.h/win.h;
  return Object.freeze({x:nx,y:ny});
 }
 return Object.freeze({DETENTS,GATES,indexOf,gatedTarget,sequence,swipe,nativePoint});
});
