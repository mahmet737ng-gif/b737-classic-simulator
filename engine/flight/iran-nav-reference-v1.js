/* Public-domain airport and VOR reference positions (OurAirports).
 * Non-operational chart orientation only. NOT FMC AIRAC, NOT valid for flight.
 * OurAirports individual facility pages verified 2026-11-17; community-maintained,
 * NOTAM/availability not guaranteed. Never use for LNAV or procedure activation.
 */
(function(root,factory){
 'use strict';
 const rows=factory();
 if(typeof module==='object'&&module.exports)module.exports=rows;
 if(root?.document)root.B737IranNavReferenceV1=rows;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 return Object.freeze([
  // Public airport ARP reference points (not runway thresholds).
  Object.freeze({type:'AIRPORT',ident:'OIIE',lat:35.416100,lon:51.152199,verified:true}),
  Object.freeze({type:'AIRPORT',ident:'OIIP',lat:35.776100,lon:50.826698,verified:true}),
  Object.freeze({type:'AIRPORT',ident:'OIFM',lat:32.75083333,lon:51.86277778,verified:true,source:'IRAN_AIP_OIFM_AD2_2'}),
  Object.freeze({type:'VOR',ident:'ISN',lat:32.74697222,lon:51.82802778,verified:true,source:'IRAN_AIP_OIFM_AD2_19'}),
  Object.freeze({type:'NDB',ident:'IFN',lat:32.749,lon:51.88080556,verified:true,source:'IRAN_AIP_OIFM_AD2_19'}),
  Object.freeze({type:'NDB',ident:'VR',lat:35.34266667,lon:51.63716667,verified:true,source:'IRAN_AIP_ENR4_1'}),
  Object.freeze({type:'NDB',ident:'KAZ',lat:35.516701,lon:51.366901,verified:true,source:'OURAIRPORTS_REFERENCE_NOT_AIP_VERIFIED'}),
  // Public VOR-DME reference points. Operational service status is NOT verified.
  Object.freeze({type:'VOR',ident:'TRN',lat:35.696999,lon:51.283798,verified:true}),
  Object.freeze({type:'VOR',ident:'IKA',lat:35.409698,lon:51.178501,verified:true}),
  Object.freeze({type:'VOR',ident:'PIM',lat:35.762001,lon:50.851601,verified:true}),
  Object.freeze({type:'VOR',ident:'MSD',lat:36.231201,lon:59.650600,verified:true}),
  Object.freeze({type:'VOR',ident:'SYZ',lat:29.540199,lon:52.588799,verified:true}),
  Object.freeze({type:'VOR',ident:'BUZ',lat:28.951401,lon:50.826099,verified:true})
 ]);
});
