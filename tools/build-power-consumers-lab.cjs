'use strict';
/** Build browser runtime from the exact CommonJS simulation modules.
 * Usage: node tools/build-power-consumers-lab.cjs [--check]
 */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=[
  'engine/network/electrical-power-pilot.cjs',
  'engine/network/pump-sensor-warning-engine.cjs',
  'engine/network/integrated-aircraft-kernel.cjs'
];
function makeBrowserRuntime() {
  const [electrical,consumer,kernel]=files.map(p=>
    fs.readFileSync(path.join(root,p),'utf8').trim());
  const wrap=(name,body,needsRequire=false)=>
    'const '+name+'=(function(){const module={exports:{}};const exports=module.exports;'+
    (needsRequire ?
      "const require=(p)=>{if(p==='./electrical-power-pilot.cjs')return electrical;"+
      "if(p==='./pump-sensor-warning-engine.cjs')return consumers;"+
      "throw new Error('Unknown browser module '+p);};" : '')+
    '\n'+body+'\nreturn module.exports;})();\n';
  return "(function(){'use strict';\n"+wrap('electrical',electrical)+
    wrap('consumers',consumer)+wrap('kernel',kernel,true)+
    'globalThis.B737PowerNetwork=Object.freeze(kernel);\n})();\n';
}
const dest=path.join(root,'power-consumers-lab/runtime.js');
const expected=makeBrowserRuntime();
if(process.argv.includes('--check')){
  if(!fs.existsSync(dest)||fs.readFileSync(dest,'utf8')!==expected){
    console.error('power-consumers-lab/runtime.js out of sync; rebuild it');
    process.exitCode=1;
  }else console.log('Browser runtime matches the CJS engine exactly');
}else{
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,expected,'utf8');
  console.log('Wrote '+dest);
}
