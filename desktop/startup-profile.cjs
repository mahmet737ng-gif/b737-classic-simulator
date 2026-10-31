'use strict';
async function startProfile(contents){
 contents.debugger.attach('1.3');
 await contents.debugger.sendCommand('Profiler.enable');
 await contents.debugger.sendCommand('Profiler.start');
 return async()=>{
  const {profile}=await contents.debugger.sendCommand('Profiler.stop');
  contents.debugger.detach();
  const counts=new Map(),nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();
  for(const node of profile.nodes)for(const child of node.children||[])parents.set(child,node.id);
  for(const id of profile.samples||[])for(let p=id;p;p=parents.get(p))counts.set(p,(counts.get(p)||0)+1);
  const interval=(profile.endTime-profile.startTime)/Math.max(1,profile.samples?.length||0)/1000;
  return [...counts].map(([id,count])=>({name:nodes.get(id).callFrame.functionName,
   file:nodes.get(id).callFrame.url.split('/').at(-1),line:nodes.get(id).callFrame.lineNumber+1,
   inclusiveMs:Math.round(count*interval)})).filter(n=>n.file).sort((a,b)=>b.inclusiveMs-a.inclusiveMs).slice(0,25);
 };
}
module.exports={startProfile};
