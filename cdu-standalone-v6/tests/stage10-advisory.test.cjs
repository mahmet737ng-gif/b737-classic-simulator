const assert=require('node:assert/strict');
const api=require('../stage10-advisory.js');
const sample={version:'STAGE10_LIVE_REFERENCE_NAV_v1',mode:'SIM_REFERENCE_TRACK',
 reference_only:true,fmc_executable:false,session_authority:'SIM_REFERENCE_ONLY',source:'AIRAC_2610_PRIVATE',
 afds_commands:[],servo_commands:[],lnav_commands:[],vnav_commands:[],
 fd:{flight_director_authority:false,autopilot_engaged:false,mode:'SIM_REF_FD_PREVIEW',bank_preview_deg:4},
 telemetry_seq:1,aircraft:{lat:35,lon:51,heading_true_deg:90,pressure_alt_ft:11000},
 desired_true_track_deg:91,signed_cross_track_nm:.2,distance_to_fix_nm:5,to:'RUS'};
assert(api.valid(sample));assert.equal(api.safe(sample).guidance_authority,false);
assert(!api.valid({...sample,afds_commands:[{turn:90}]}));
assert(!api.valid({...sample,fd:{...sample.fd,flight_director_authority:true}}));
assert(!api.valid({...sample,aircraft:{...sample.aircraft,lat:NaN}}));
assert(!api.valid({...sample,mode:'ACT_LNAV'}));
assert(!api.valid({...sample,to:'<svg>'}));
assert.equal(api.safe({...sample,servo_commands:[1]}),null);
console.log('Stage10 advisory 7 safety checks PASS');