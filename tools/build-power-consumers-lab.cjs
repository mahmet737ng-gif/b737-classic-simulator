'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const modules=[
 ['electrical','electrical-power-pilot.cjs'],
 ['feederAudit','electrical-feeder-audit.v0.2.cjs'],
 ['consumers','pump-sensor-warning-engine.cjs'],
 ['pressurePhysics','pressure-distribution.v0.2.cjs'],
 ['feederMap','electrical-consumer-feeders.cjs'],
 ['fluidObservations','fluid-pressure-engine.cjs'],
 ['kernel','integrated-aircraft-kernel.cjs']
];
function makeBrowserRuntime(){
 const bodies=modules.map(([name,file])=>[name,fs.readFileSync(path.join(root,'engine/network',file),'utf8').trim()]);
 const requireBlock="const require=(p)=>{"+
 "if(p==='./electrical-power-pilot.cjs')return electrical;"+
 "if(p==='./electrical-feeder-audit.v0.2.cjs')return feederAudit;"+
 "if(p==='./pump-sensor-warning-engine.cjs')return consumers;"+
 "if(p==='./pressure-distribution.v0.2.cjs')return pressurePhysics;"+
 "if(p==='./electrical-consumer-feeders.cjs')return feederMap;"+
 "if(p==='./fluid-pressure-engine.cjs')return fluidObservations;"+
 "throw new Error('Unknown browser module '+p);};";
 return "(function(){'use strict';\n"+bodies.map(([name,body])=>
   'const '+name+'=(function(){const module={exports:{}};const exports=module.exports;'+
   (name==='consumers'||name==='kernel'?requireBlock:'')+'\n'+body+
   '\nreturn module.exports;})();\n').join('')+
   'globalThis.B737PowerNetwork=Object.freeze(kernel);\n})();\n';
}
const dest=path.join(root,'power-consumers-lab/runtime.js');
const expected=makeBrowserRuntime();
if(process.argv.includes('--check')){
 if(!fs.existsSync(dest)||fs.readFileSync(dest,'utf8')!==expected){
  console.error('Browser runtime does not match the model source');process.exitCode=1;
 }else console.log('Browser runtime matches source');
}else{
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.writeFileSync(dest,expected,'utf8');console.log('Updated browser runtime');
}
