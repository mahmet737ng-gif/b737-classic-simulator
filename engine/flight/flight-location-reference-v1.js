/* Unified flight-position reference, shared by Flight Scenario, CDU and EHSI.
 * Pure client-side source catalog; never treats a selected location as an
 * aligned IRS position or an operational FMC route.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){
  const instance=api.create(root,root.B737FlightScenarioCoreV1?.AIRPORTS);
  if(Array.isArray(root.B737IranNavReferenceV1))instance.setCatalog(root.B737IranNavReferenceV1);
  root.B737UnifiedFlightLocationV1=instance;
 }
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const R=Math.PI/180,EARTH_NM=3440.065;
 const VALID_TYPES=new Set(['VOR','NDB','AIRPORT','WAYPOINT']);
 const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 const normalize=(point)=>{if(!point||!finite(point.lat,-90,90)||!finite(point.lon,-180,180))throw Error('INVALID_FLIGHT_LOCATION');return Object.freeze({lat:point.lat,lon:point.lon,icao:/^[A-Z0-9]{4}$/.test(point.icao||'')?point.icao:null,source:point.source||'SCENARIO_REFERENCE'});};
 function offsets(center,point){
  const a=center.lat*R,b=point.lat*R,d=(point.lon-center.lon)*R;
  const q=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(d/2)**2;
  const nm=2*EARTH_NM*Math.asin(Math.min(1,Math.sqrt(q)));
  const bearing=Math.atan2(Math.sin(d)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(d));
  return {x:nm*Math.sin(bearing),y:nm*Math.cos(bearing),distanceNm:nm};
 }
 function create(host,airports){
  let selected=null,catalog=[];
  const publish=()=>host?.dispatchEvent?.(new host.CustomEvent('b737:flight-location-reference',{detail:selected}));
  return Object.freeze({
   getLocation:()=>selected,
   choose(point){selected=normalize(point);publish();return selected;},
   clear(){selected=null;publish();},
   setCatalog(rows){
    if(!Array.isArray(rows))throw Error('LOCATION_CATALOG_REQUIRED');
    catalog=rows.filter(r=>VALID_TYPES.has(r?.type)&&/^[A-Z0-9._-]{2,12}$/.test(r.ident||'')&&finite(r.lat,-90,90)&&finite(r.lon,-180,180)&&r.verified===true)
     .map(r=>Object.freeze({type:r.type,ident:r.ident,lat:r.lat,lon:r.lon,verified:true}));
    publish();return catalog.length;
   },
   mapObjects(center,options={},rangeNm=40,additional=[]){
    if(!center||!finite(center.lat,-90,90)||!finite(center.lon,-180,180))return [];
    const seeds=[...Object.values(airports||{}).map(a=>({type:'AIRPORT',ident:a.icao,lat:a.lat,lon:a.lon,verified:true})),
      ...catalog,...additional];
    const seen=new Set(),out=[];
    for(const obj of seeds){
     if(!obj||!VALID_TYPES.has(obj.type)||!finite(obj.lat,-90,90)||!finite(obj.lon,-180,180)||
        !/^[A-Z0-9._-]{2,12}$/.test(obj.ident||''))continue;
     const on=obj.type==='AIRPORT'?options.arpt:obj.type==='WAYPOINT'?options.wpt:options.navAid;
     if(!on)continue;
     const v=offsets(center,obj);
     if(v.distanceNm>Math.max(1,Number(rangeNm)||40)*1.3||v.distanceNm<.03)continue;
     const id=obj.type+'@'+obj.ident+'@'+obj.lat+'@'+obj.lon;
     if(seen.has(id))continue;seen.add(id);
     out.push({name:obj.ident,x:v.x,y:v.y,on:true,
      shape:obj.type==='AIRPORT'?'airport':obj.type==='WAYPOINT'?'star':'nav'});
    }
    return out;
   }
  });
 }
 return Object.freeze({create,offsets,normalize});
});
