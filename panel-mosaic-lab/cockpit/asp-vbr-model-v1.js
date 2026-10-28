/* Three physical V/B/R detents; image index is the recessed upper notch. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737ASPVBRModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const positions=Object.freeze(['V','B','R']),angles=Object.freeze([-45,0,45]);
 const socket=Object.freeze({x:702,y:747,hit:150,baseDiameter:104});
 const image=Object.freeze({width:1254,height:1254,pivotX:626.6753137115194,pivotY:601.4506340581195,baseDiameter:808.6592505372294});
 function create(){
  const state=new Map(['CAPT','FO','OBS'].map(s=>[s,1]));
  function read(seat){if(!state.has(seat))throw Error('Unknown ASP station');const index=state.get(seat);return Object.freeze({seat,index,position:positions[index],angle:angles[index]});}
  function select(seat,index){read(seat);if(!Number.isInteger(index))throw Error('Invalid VBR detent');state.set(seat,Math.max(0,Math.min(2,index)));return read(seat);}
  return Object.freeze({read,select,step(seat,delta){if(!Number.isInteger(delta))throw Error('Invalid VBR step');return select(seat,read(seat).index+delta);}});
 }
 return Object.freeze({version:'ASP-VBR-SILVER-0001',positions,angles,socket,image,create});
});
