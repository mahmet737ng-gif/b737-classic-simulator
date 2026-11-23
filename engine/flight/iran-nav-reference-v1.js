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
  Object.freeze({"type":"NDB","ident":"AA","lat":35.6337,"lon":51.4178,"verified":true,"source":"COMMUNITY_NOT_AIP_VERIFIED"}),
  Object.freeze({"type":"NDB","ident":"RUS","lat":35.4451,"lon":50.9013,"verified":true,"source":"COMMUNITY_NOT_AIP_VERIFIED"}),
  Object.freeze({"type":"NDB","ident":"PIM","lat":35.7618,"lon":50.8494,"verified":true,"source":"COMMUNITY_NOT_AIP_VERIFIED"}),
  Object.freeze({"type":"NDB","ident":"HSA","lat":32.9326,"lon":51.5601,"verified":true,"source":"COMMUNITY_NOT_AIP_VERIFIED"}),
  Object.freeze({"type":"NDB","ident":"SKD","lat":32.3055,"lon":50.8386,"verified":true,"source":"COMMUNITY_NOT_AIP_VERIFIED"}),
  Object.freeze({"type":"VOR","ident":"SKD","lat":32.2798,"lon":50.8549,"verified":true,"source":"OURAIRPORTS_COMMUNITY"}),
  Object.freeze({"type":"VOR","ident":"RUS","lat":35.44547222,"lon":50.90536111,"verified":true,"source":"IRAN_AIP_ENR41"}),
  // Public VOR-DME reference points. Operational service status is NOT verified.
  Object.freeze({type:'VOR',ident:'TRN',lat:35.696999,lon:51.283798,verified:true}),
  Object.freeze({type:'VOR',ident:'IKA',lat:35.409698,lon:51.178501,verified:true}),
  Object.freeze({type:'VOR',ident:'PIM',lat:35.762001,lon:50.851601,verified:true}),
  Object.freeze({type:'VOR',ident:'MSD',lat:36.231201,lon:59.650600,verified:true}),
  Object.freeze({type:'VOR',ident:'SYZ',lat:29.540199,lon:52.588799,verified:true}),
  Object.freeze({type:'VOR',ident:'BUZ',lat:28.951401,lon:50.826099,verified:true})
 ]);
});
