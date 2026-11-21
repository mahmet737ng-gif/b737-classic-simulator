/* FCOM 10.32 EHSI rule layer. Owner-supplied SEPEHRAN 737CL FCOM Vol 2.
 * This file only decorates valid flight instrument data and explicitly
 * injected instructor test cases. It never invents sensor measurements.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737FCOM1032LiveV1=api;
})(globalThis,function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg';
 const COLORS=Object.freeze({white:'#eff5f5',green:'#41f585',
  magenta:'#ef6afc',cyan:'#65edfa',amber:'#ffb748',red:'#fa4554'});
 const MODES=['MAP','CTR_MAP','FULL_NAV','EXP_NAV','FULL_VOR_ILS','EXP_VOR_ILS','PLAN'];
 function windVisible(previous,speed,valid=true){
  if(valid!==true||!Number.isFinite(speed)||speed<0)return false;
  return previous===true?speed>=4:speed>6;
 }
 function makeSeatState(){
  const wind=new Map();
  return Object.freeze({
   prepare(seat,model,valid=true){
    if(!MODES.includes(model?.mode))throw Error('INVALID_FCOM_EHSI_MODE');
    const visible=windVisible(wind.get(seat)===true,model.windSpeed,valid);
    wind.set(seat,visible);
    if(!visible){
     model.windSpeed=null;
     model.windDirection=null;
    }
    model.fcom32WindVisible=visible;
    return model;
   },
   reset(seat){if(seat===undefined)wind.clear();else wind.delete(seat)},
   isWindVisible(seat){return wind.get(seat)===true}
  });
 }
 const MSG=Object.freeze({
  courseChangeAlert:{message:'ALERT',color:'amber',modes:['EXP_NAV','FULL_NAV'],slot:'center'},
  excessData:{message:'EXCESS DATA',color:'amber',modes:['MAP','CTR_MAP','EXP_NAV','PLAN'],slot:'left'},
  rnpAdvisory:{message:'UNABLE REQD NAV PERF-RNP',color:'amber',modes:['MAP','CTR_MAP'],slot:'center'},
  terrainFailure:{message:'TERR FAIL',color:'amber',modes:MODES,slot:'left'},
  terrainPosition:{message:'TERR POS',color:'amber',modes:MODES,slot:'left'},
  terrainInhibit:{message:'TERR INHIBIT',color:'amber',modes:MODES,slot:'left'},
  terrainRangeDisagree:{message:'TERR RANGE DISAGREE',color:'amber',modes:['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'],slot:'center'},
  mapTerrainRangeDisagree:{message:'MAP/TERR RANGE DISAGREE',color:'amber',modes:['MAP','CTR_MAP'],slot:'center'},
  terrainTest:{message:'TERR TEST',color:'cyan',modes:MODES,slot:'right'},
  terrainAlert:{message:'TERRAIN',color:'amber',modes:MODES,slot:'right'},
  wxrWeakStatus:{message:'WXR WEAK',color:'amber',modes:MODES,slot:'left'},
  wxrAttStatus:{message:'WXR ATT',color:'amber',modes:MODES,slot:'left'},
  wxrStabStatus:{message:'WXR STAB',color:'amber',modes:MODES,slot:'left'},
  mapRangeDisagree:{message:'MAP RANGE DISAGREE',color:'amber',modes:['MAP','CTR_MAP'],slot:'center'},
  wxrRangeDisagree:{message:'WXR RANGE DISAGREE',color:'amber',modes:['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'],slot:'center'},
  wxrMapRangeDisagree:{message:'WXR/MAP RANGE DISAGREE',color:'amber',modes:['MAP','CTR_MAP'],slot:'center'},
  wxrModeAndTilt:{message:'',color:'green',modes:['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'],slot:'left'},
 });
 const allowedMode=new Set(['MAP','CTR_MAP','FULL_NAV','EXP_NAV','FULL_VOR_ILS','EXP_VOR_ILS','PLAN']);
 function resolve(model={}, evidence={}){
  const result=[];
  if(!allowedMode.has(model.mode)||model.efis?.displayPower===false||model.efis?.sgValid===false)return result;
  const push=(id,on,extras={})=>{
   const rule=MSG[id];
   if(!rule||!rule.modes.includes(model.mode)||on!==true)return;
   result.push({id,...rule,...extras});
  };
  // A verified external evidence record is mandatory for all messages.
  // This is the same rule for live systems and isolated instructor labs.
  for(const [id,rec] of Object.entries(evidence)){
   if(rec?.valid!==true)continue;
   if(id==='terrainAlert')push(id,true,{color:rec.severity==='WARNING'?'red':'amber'});
   else if(id==='wxrModeAndTilt'){
    const mode=rec.mode;
    if(!['MAP','WX','WX+T','TEST'].includes(mode))continue;
    const tilt=Number.isFinite(rec.tiltDeg)?(rec.tiltDeg>=0?'+':'')+rec.tiltDeg.toFixed(1):'';
    const gain=rec.gainCalibrated===false?'VAR/':'';
    push(id,true,{message:gain+mode+(tilt?' '+tilt:'')});
   }else push(id,true);
  }
  // Precedence: combined mismatch displaces its two constituent messages.
  const has=id=>result.some(x=>x.id===id);
  if(has('wxrMapRangeDisagree'))return result.filter(x=>!['mapRangeDisagree','wxrRangeDisagree'].includes(x.id));
  if(has('mapTerrainRangeDisagree'))return result.filter(x=>x.id!=='terrainRangeDisagree');
  return result;
 }
 // Translate only explicitly validated observables into FCOM evidence.
 // No display text is inferred from missing FMC/EGPWS/WXR data.
 function liveEvidence(model,src,snapshot={}){
  const out={};
  const set=(id,on,extra={})=>{if(on===true)out[id]={valid:true,...extra}};
  const fmc=src?.fmc;
  if(fmc?.operational===true&&fmc.failed!==true){
   set('courseChangeAlert',Number.isFinite(fmc.courseChangeSeconds)&&fmc.courseChangeSeconds>=0&&
    fmc.courseChangeSeconds<=10&&fmc.rollToNextCourse!==true&&fmc.nextWaypointSequenced!==true);
   set('rnpAdvisory',Number.isFinite(fmc.anpNm)&&Number.isFinite(fmc.requiredRnpNm)&&
    fmc.specialRnpActive===true&&fmc.anpNm>fmc.requiredRnpNm);
  }
  const wx=model?.weather;
  if(wx?.sourceQuality==='VALID'){
   set('wxrWeakStatus',wx.calibrationFault===true);
   set('wxrAttStatus',wx.attitudeStabilizationLost===true);
   set('wxrStabStatus',wx.stabilizationOff===true);
   set('wxrModeAndTilt',wx.selected===true&&wx.healthy===true,{mode:wx.mode,tiltDeg:wx.tiltDeg,
    gainCalibrated:wx.gainCalibrated!==false});
   if(wx.healthy===true){
    set('mapRangeDisagree',wx.mapRangeDisagree===true);
    set('wxrRangeDisagree',wx.wxrRangeDisagree===true);
    set('wxrMapRangeDisagree',wx.mapRangeDisagree===true&&wx.wxrRangeDisagree===true);
   }
  }
  const terrain=model?.terrain;
  if(terrain?.sourceQuality==='VALID'){
   set('terrainFailure',terrain.failed===true);
   set('terrainPosition',terrain.positionUncertain===true);
   set('terrainInhibit',terrain.inhibited===true);
   set('terrainTest',terrain.testMode===true);
   set('terrainAlert',terrain.alert==='CAUTION'||terrain.alert==='WARNING',
    {severity:terrain.alert});
   if(terrain.failed!==true){
    set('terrainRangeDisagree',terrain.rangeMismatch===true);
    set('mapTerrainRangeDisagree',terrain.rangeMismatch===true&&terrain.mapRangeMismatch===true);
   }
  }
  const performance=model?.performance;
  if(performance?.sourceQuality==='VALID')set('excessData',performance.mapRefreshBelowLimit===true);
  return out;
 }
 function draw(svg,model,evidence={}){
  if(!svg)return [];
  svg.querySelector('[data-fcom1032-layer]')?.remove();
  const messages=resolve(model,evidence);
  if(!messages.length)return messages;
  const doc=svg.ownerDocument;
  const make=(parent,tag,attrs={},value)=>{
   const element=doc.createElementNS(NS,tag);
   for(const [key,val] of Object.entries(attrs))element.setAttribute(key,String(val));
   if(value!==undefined)element.textContent=String(value);
   parent.appendChild(element);return element;
  };
  const layer=make(svg,'g',{'data-fcom1032-layer':'true','pointer-events':'none'});
  const slots={center:{x:256,y:385,dy:20,anchor:'middle'},
   left:{x:58,y:250,dy:21,anchor:'start'},
   right:{x:451,y:245,dy:21,anchor:'end'}};
  const count={center:0,left:0,right:0};
  for(const item of messages){
   const slot=slots[item.slot],i=count[item.slot]++,y=slot.y+i*slot.dy;
   // Placement zones are calibrated EHSI glass coordinates. Do not resize the
   // approved EADI/EHSI photograph or its mounting aperture.
   const line=make(layer,'text',{x:slot.x,y,fill:COLORS[item.color],
    'text-anchor':slot.anchor,'font-family':'Lucida Console,monospace',
    'font-weight':'normal','font-size':item.message.length>22?12:16,
    'data-symbol':item.id},item.message);
   make(line,'title',{},'FCOM 10.32 '+item.id);
  }
  return messages;
 }
 return Object.freeze({version:'FCOM-10.32-LIVE-0001',
  COLORS,MSG,MODES,windVisible,makeSeatState,resolve,liveEvidence,draw});
});
