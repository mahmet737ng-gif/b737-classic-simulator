'use strict';
/* Owner video scene regression: 1000166701/1000166702, 2026-10-26.
 * Only simulate events established by Classic FCOM; videos are visual, not certification.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'../video-evidence-2026-10-26.json'),'utf8'));
const {createEngine}=require('../engine.js');
assert.equal(evidence.videos.reduce((sum,x)=>sum+x.decoded_frames,0),911);
assert.deepEqual(evidence.layout_observed.central_column_top_down,['WHEEL_WELL','FAULT','APU_DET_INOP','APU_BOTTLE_DISCHARGED']);
const e=createEngine(),go=cmd=>e.dispatch(cmd),lights=()=>e.evaluate().indications;
go({type:'TEST',value:'FAULT_INOP'});
for(const lamp of ['FAULT','APU_DET_INOP','MASTER_CAUTION','OVHT_DET'])assert.equal(lights()[lamp],true,'Fault test: '+lamp);
for(const lamp of ['ENG1_FIRE','ENG2_FIRE','APU_FIRE','WHEEL_WELL','L_BOTTLE_DISCHARGED','APU_BOTTLE_DISCHARGED'])assert.equal(lights()[lamp],false,'False positive during fault test: '+lamp);
go({type:'TEST',value:null});
assert.equal(lights().FAULT,false);assert.equal(lights().APU_DET_INOP,false);
go({type:'TEST',value:'OVHT_FIRE'});
for(const lamp of ['ENG1_FIRE','ENG2_FIRE','APU_FIRE','ENG1_OVERHEAT','ENG2_OVERHEAT','WHEEL_WELL','FIRE_BELL','MASTER_FIRE_WARN'])assert.equal(lights()[lamp],true,'Fire test: '+lamp);
for(const lamp of ['EXT_L','EXT_R','EXT_APU'])assert.equal(lights()[lamp],false,'Green lamp should not illuminate on fire test: '+lamp);
go({type:'TEST',value:null});
assert.equal(lights().ENG1_FIRE,false);assert.equal(lights().APU_FIRE,false);assert.equal(lights().WHEEL_WELL,false);
for(const value of ['EXT_1','EXT_2']){
 go({type:'TEST',value});
 for(const lamp of ['EXT_L','EXT_R','EXT_APU'])assert.equal(lights()[lamp],true,'Continuity test '+value+' '+lamp);
 for(const lamp of ['FAULT','WHEEL_WELL','APU_BOTTLE_DISCHARGED'])assert.equal(lights()[lamp],false,'No discharge on '+value+' '+lamp);
 go({type:'TEST',value:null});
 for(const lamp of ['EXT_L','EXT_R','EXT_APU'])assert.equal(lights()[lamp],false,'Return to center '+value+' '+lamp);
}
console.log('PASS 911-frame video scenario references / FAULT, FIRE and EXT indications independent and momentary');
