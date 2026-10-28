/* PMC front-panel state and source-photo registration; no engine model override. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737PMCGlassModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const source=Object.freeze({width:1731,height:909});
 const atlas=Object.freeze({x:3,y:3,width:2214,height:1019});
 // Upper hinge and horizontal extents of the two existing PMC cases in OH-05.
 // A square cover uses the displayed case width, with its top on that hinge.
 const sockets=Object.freeze([1,2].map((engine,i)=>Object.freeze({engine,x:1039+172*i,y:434,width:74})));
 function bounds(engine){
  const p=sockets.find(p=>p.engine===engine);if(!p)throw Error('Unknown PMC engine');
  const size=p.width*atlas.width/source.width;
  return Object.freeze({left:atlas.x+p.x*atlas.width/source.width,top:atlas.y+p.y*atlas.height/source.height,width:size,height:size});
 }
 function controller(saved={}){
  const states={};
  for(const p of sockets)states[p.engine]={on:typeof saved?.[p.engine]?.on==='boolean'?saved[p.engine].on:true,open:false};
  function view(engine,test=false){const s=states[engine];if(!s)throw Error('Unknown PMC engine');return Object.freeze({engine,on:s.on,open:s.open,onSymbol:s.on,inop:!s.on||test});}
  return Object.freeze({
   view,
   cover(engine,open){if(!states[engine]||typeof open!=='boolean')return false;states[engine].open=open;return true;},
   press(engine){const s=states[engine];if(!s||!s.open)return false;s.on=!s.on;return true;},
   snapshot(){return Object.fromEntries(sockets.map(p=>[p.engine,{on:states[p.engine].on}]));}
  });
 }
 return Object.freeze({version:'PMC-GLASS-0001',source,atlas,sockets,bounds,controller});
});
