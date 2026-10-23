'use strict';
const assert=require('node:assert/strict');
const api=require('../stage9-advisory.js');
const base={version:'NPE_STAGE9_SIMULATOR_REFERENCE_GUIDANCE_v1',mode:'SIM_REFERENCE_TRACK',reference_only:true,
 fmc_legs_executable:false,command_authority:'SIMULATED_ADVISORY_ONLY',afds_commands:[],aircraft_actuator_commands:[],
 desired_true_track_deg:88.7,signed_cross_track_nm:.23,distance_to_fix_nm:5,to:'RUS'};
assert.ok(api.valid(base));assert.equal(api.safe(base).guidance,false);
assert.equal(api.valid({...base,afds_commands:[1]}),false);
assert.equal(api.valid({...base,command_authority:'AFDS'}),false);
assert.equal(api.valid({...base,fmc_legs_executable:true}),false);
assert.equal(api.valid({...base,desired_true_track_deg:NaN}),false);
assert.equal(api.safe({...base,mode:'SUSPENDED'}).mode,'SUSPENDED');
console.log('Stage9 advisory JS synthetic assertions PASSED');