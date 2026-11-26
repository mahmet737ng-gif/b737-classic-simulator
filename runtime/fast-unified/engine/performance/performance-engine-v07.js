/* B737 Classic central educational performance engine. No extrapolation; preserves source and proxy labels. */
(function(root){const make=function makeEngine(root,raw,perf){
 'use strict';
 const variants=Object.freeze({"737-300":{"model":"737-300","registration":"EP-FSI","rating":20000,"ratings":[20000,22000]},"737-300W":{"model":"737-300W","registration":"EP-FSV","rating":20000,"ratings":[20000,22000]},"737-500":{"model":"737-500","registration":"EP-FSA","rating":20000,"ratings":[18500,20000]},"737-500W":{"model":"737-500W","registration":"EP-FSG","rating":20000,"ratings":[18500,20000]},"737-400":{"model":"737-400","registration":"EP-AOA","rating":22000,"ratings":[22000,23500]}});
 const ratingMap=Object.freeze({'CFM56-3B1':18500,'CFM56-3B3':20000,'CFM56-3B2':22000,'CFM56-3C1':23500});
 function selectedRating(model){const profile=root.B737AircraftProfileStore?.get?.();return profile?.aircraftModel===model?ratingMap[profile.engineVariant]??variants[model]?.rating:variants[model]?.rating;}
 const unpack=t=>t.rows.map(r=>Object.fromEntries(t.fields.map((k,i)=>[k,r[i]])));
 const rows=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,unpack(v)]));
 const by=(data,keys)=>{const m=new Map;for(const r of data){const k=keys.map(x=>r[x]).join('|');if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m};
 const q=by(rows.qrh,['model','rating','mode']), b=by(rows.bleed,['model','rating','mode','kind']), ft=by(rows.to,['model','installed_rating','rating','pmc','pack']), fr=by(rows.fcomReduced,['model','installed_rating','rating','kind']), qr=by(rows.reduced,['kind']), old=by(rows.legacy,['source','model','rating','phase','pmc','pack']);
 const fail=m=>{throw Error(m)};
 const finite=Number.isFinite;
 function bracket(xs,x){const a=[...new Set(xs)].sort((a,b)=>a-b);if(!finite(x)||!a.length||x<a[0]||x>a[a.length-1])fail('OUTSIDE_TABLE_DOMAIN');if(a.includes(x))return [x];const i=a.findIndex(y=>y>x);return[a[i-1],a[i]]}
 function grid(rs,axes,values,out,used=[]){if(!rs?.length)fail('TABLE_UNAVAILABLE');if(!axes.length){if(rs.length!==1)fail('AMBIGUOUS_CELL');if(String(rs[0].quality||'').includes('review_required'))fail('SOURCE_CELL_WITHHELD');const v=typeof out==='function'?out(rs[0]):rs[0][out];if(!finite(v))fail('MISSING_CELL');used.push(rs[0]);return v}const [axis,...rest]=axes,[x,...other]=values,bs=bracket(rs.map(r=>r[axis]),x);const y=bs.map(a=>grid(rs.filter(r=>r[axis]===a),rest,other,out,used));return bs.length===1?y[0]:y[0]+(y[1]-y[0])*(x-bs[0])/(bs[1]-bs[0])}
 const fetch=(m,...args)=>m.get(args.join('|'));
 const result=(v,p,used,extra={})=>({status:'TRAINING_TABLE',n1Pct:v,model:p.model,registration:p.registration,rating:p.rating,pages:[...new Set(used.map(r=>r.page))],quality:[...new Set(used.map(r=>r.quality).filter(Boolean))],...extra});
 const unpackPerf=(name,keys)=>perf[name].map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]])));
 const pp={cruise:unpackPerf('cruise',['page','alt','weight','n1','maxTat','ias','mach','ff','tas','stdTat']),limit:unpackPerf('cruise_limit',['page','alt','tat','n1','eai','wai']),oei:unpackPerf('oei_ceiling',['page','speed','rating','weight','isa','ceiling','eai','wai']),optimum:unpackPerf('optimum',['page','isa','weight','opt','tat','margin','max','limited']).map(r=>({...r,isa:Number(r.isa)})),climb:unpackPerf('climb_slice',['page','isa','alt','weight','time','fuel','dist','tas'])};
 function n1(input){
  const spec=variants[input.model];if(!spec)fail('MODEL_REQUIRED');const rating=input.rating??selectedRating(input.model);if(!spec.ratings.includes(rating))fail('INVALID_RATING_FOR_MODEL');const p={...spec,rating};
  const {mode,altFt,tatC,oatC,iasKt,engines=2,packs='AUTO',engineAI=false,wingAI=false,pmc='ON',assumedC=null}=input;
  const takeoffRating=input.takeoffRating??p.rating;
  if(takeoffRating!==p.rating&&(!['TO','R-TO'].includes(mode)||!rows.to.some(r=>r.model===p.model.replace(/W$/,'')&&r.installed_rating===p.rating&&r.rating===takeoffRating)))fail('FIXED_DERATE_TABLE_UNAVAILABLE');
  if(!['AUTO','OFF','HIGH'].includes(packs)||![1,2].includes(engines)||!['ON','OFF'].includes(pmc))fail('INVALID_CONFIGURATION');
  const used=[],corr={};let v,source,proxy=null;
  const nativeQ=(model,mode)=>fetch(q,model,p.rating,mode);let tableModel=p.model;
  const baseModel=p.model.replace(/W$/,'');
  const markProxy=model=>{if(model!==p.model){if(input.allowProxy!==true)fail('NATIVE_WINGLET_N1_NOT_EXTRACTED');proxy=model+'/'+(p.rating/1000)+'K (N1 ONLY)';}return model;};
  if(mode==='TO'||mode==='R-TO'){
   if(wingAI)fail('TO_WING_AI_CORRECTION_NOT_AVAILABLE');
   if(mode==='R-TO'||finite(assumedC)){
    if(pmc!=='ON'||packs==='HIGH'||!finite(assumedC)||assumedC<=oatC)fail('INVALID_ASSUMED_TEMP_CONFIGURATION');
    let reducedModel=baseModel;if(baseModel==='737-300'&&p.rating===20000){if(input.allowProxy!==true)fail('NATIVE_300_ASSUMED_TEMP_NOT_AVAILABLE');reducedModel='737-500';}markProxy(reducedModel);
    const k=kind=>baseModel==='737-400'&&p.rating===22000?fetch(qr,kind):fetch(fr,reducedModel,p.rating,takeoffRating,kind);
    const maxRows=k('max_assumed_temp');if(!maxRows?.length)fail('ASSUMED_TEMP_NOT_AVAILABLE');
    const max=grid(maxRows,['x','y'],[altFt,Math.max(Math.min(...maxRows.map(r=>r.y)),oatC)],'value',used), min=grid(k('min_assumed_temp'),['x'],[altFt],'value',used);
    if(assumedC<min||assumedC>max)fail('ASSUMED_TEMP_OUTSIDE_ENVELOPE');
    v=grid(k('assumed_n1_base'),['x','y'],[altFt,assumedC],'value',used)-grid(k('assumed_n1_delta'),['x','y'],[oatC,assumedC-oatC],'value',used)+(packs==='OFF'?1:0);source=baseModel==='737-400'&&p.rating===22000?'QRH_REDUCED':'FCOM_TRAINING_REDUCED';
   }else{
    if(packs==='HIGH')fail('TO_HIGH_PACK_CORRECTION_NOT_AVAILABLE');
    const pack=pmc==='ON'?'AUTO':packs;
    const native=fetch(ft,baseModel,p.rating,takeoffRating,pmc,pack);
    if(baseModel==='737-400'&&p.rating===22000){v=grid(fetch(old,'FPPM',baseModel,p.rating,'TO',pmc,pack),['alt_ft','temp_c'],[altFt,oatC],'n1',used);source='FPPM';}
    else if(native?.length){markProxy(baseModel);v=grid(native,['alt_ft','oat_c'],[altFt,oatC],'n1',used);source='FCOM_TRAINING';}
    else if(baseModel==='737-300'&&p.rating===20000){
      markProxy(baseModel);
      try{if(pmc!=='ON'||packs!=='AUTO'||engineAI)fail('AFM_CORRECTION_NOT_COMPLETE');v=grid(fetch(old,'AFM',baseModel,p.rating,'TO','ON','AUTO'),['alt_ft','temp_c'],[altFt,oatC],'n1',used);source='AFM_PARTIAL_TRACE';}
      catch(e){if(input.allowProxy!==true)throw e;used.length=0;v=grid(fetch(ft,'737-500',20000,20000,pmc,pack),['alt_ft','oat_c'],[altFt,oatC],'n1',used);source='FCOM_TRAINING_PROXY';proxy='737-500/20K';}
    }else fail('TAKEOFF_TABLE_FOR_SELECTED_RATING_UNAVAILABLE');
    if(pmc==='ON'&&packs==='OFF')corr.packs_off=1;
   }
  }else if(mode==='CRZ'){
   if(p.model!=='737-400'||p.rating!==22000)fail('CRUISE_LIMIT_VARIANT_NOT_EXTRACTED');
   if(packs!=='AUTO'||wingAI&&!engineAI)fail('CRUISE_CORRECTION_NOT_AVAILABLE');
   v=grid(pp.limit,['alt','tat'],[altFt,tatC],r=>r.n1+(wingAI?r.wai:engineAI?r.eai:0),used);source='FPPM_400_CRUISE_LIMIT';
  }else{
   let m=mode==='CON'?(engines===1?'MCT_OEI':'MCT_INITIAL'):mode==='CLB-1'||mode==='CLB-2'?'CLB':mode;
   if(m==='MCT_INITIAL'||m==='MCT_OEI'){if(engines!==1||packs!=='AUTO')fail('MCT_TABLE_REQUIRES_OEI_AUTO_PACKS');}
   if(m==='CLB'&&engines!==2)fail('CLB_REQUIRES_TWO_ENGINES');
   if(!['CLB','GA','MCT_INITIAL','MCT_OEI'].includes(m))fail('MODE_NOT_SUPPORTED');
   if(wingAI&&m!=='GA'&&!engineAI)fail('WING_ONLY_CORRECTION_NOT_AVAILABLE');
   if(!nativeQ(tableModel,m)?.length&&tableModel!==baseModel&&nativeQ(baseModel,m)?.length)tableModel=markProxy(baseModel);
   const axes=m==='MCT_OEI'?['alt_ft','ias_kt','tat_c']:['alt_ft','tat_c'],vs=m==='MCT_OEI'?[altFt,iasKt,tatC]:[altFt,tatC];
   if(mode==='CON'&&engines===1){try{v=grid(fetch(q,tableModel,p.rating,m),axes,vs,'n1',used);}catch(e){if(e.message==='SOURCE_CELL_WITHHELD')throw e;used.length=0;m='MCT_INITIAL';v=grid(fetch(q,tableModel,p.rating,m),['alt_ft','tat_c'],[altFt,tatC],'n1',used);}}else v=grid(fetch(q,tableModel,p.rating,m),axes,vs,'n1',used);
   function c(kind){const rr=fetch(b,tableModel,p.rating,m,kind);if(!rr?.length)fail('CORRECTION_UNAVAILABLE_'+kind);return grid(rr,['x'],[rr[0].axis==='tat_c'?tatC:altFt],'delta_n1',used);}
   if(packs==='OFF')corr.packs_off=c('packs_off');if(packs==='HIGH')corr.packs_high=c('packs_high');
   if(m==='GA'){if(wingAI)corr.wing_ai=c(engines===2?'wing_ai_aEO':'wing_ai_OEI');}
   else if(wingAI)corr.engine_wing_ai=c('engine_wing_ai');else if(engineAI)corr.engine_ai=c('engine_ai');
   if(mode==='CLB-1'||mode==='CLB-2'){if(mode==='CLB-2'&&input.clb2Available!==true)fail('CLB2_EFFECTIVITY_NOT_SELECTED');corr.reduced_climb_sim_linear=-3*(mode==='CLB-2'?2:1)*Math.max(0,Math.min(1,1-altFt/15000));}
   source='QRH_'+m;
  }
  const n=v+Object.values(corr).reduce((s,x)=>s+x,0);
  return result(n,p,used,{mode,source,proxy,corrections:corr,baseN1Pct:v,takeoffRating,trainingOnly:true});
 }
 function flightPerformance(input){
  const {model,kind,altFt,weightKg,isaDeltaC,margin=1.3,speed='LRC',rating='MCT',engineAI=false,wingAI=false}=input;
  if(model!=='737-400'||(input.engineRating??selectedRating(model))!==22000)fail('FPPM_400_22K_ONLY');
  if(wingAI&&!engineAI)fail('WING_ONLY_NOT_AVAILABLE');
  const used=[],out={model,kind,source:'FPPM_737-400_22K',trainingOnly:true};
  if(kind==='LRC'){for(const k of ['n1','ias','mach','ff','tas','stdTat'])out[k]=grid(pp.cruise,['alt','weight'],[altFt,weightKg],k,used);}
  else if(kind==='CLIMB'){if(weightKg!==60000)fail('CLIMB_60T_ONLY');for(const k of ['time','fuel','dist','tas']){try{out[k]=grid(pp.climb,['isa','alt'],[isaDeltaC,altFt],k,used)}catch(e){if(!['dist','tas'].includes(k)||altFt>=6000||altFt<1500)throw e;out[k]=null}}}
  else if(kind==='OEI_CEILING'){out.ceilingFt=grid(pp.oei.filter(r=>String(r.speed)===String(speed)&&r.rating===rating),['weight','isa'],[weightKg,Math.max(10,isaDeltaC)],r=>r.ceiling+(wingAI?r.wai:engineAI?r.eai:0),used);}
  else if(kind==='OPTIMUM'){for(const k of ['opt','tat','max'])out[k]=grid(pp.optimum,['isa','weight','margin'],[Math.max(10,isaDeltaC),weightKg,margin],k,used);}
  else fail('PERFORMANCE_KIND_UNSUPPORTED');
  out.pages=[...new Set(used.map(r=>r.page))];return out;
 }
 const safe=fn=>{try{return fn()}catch(e){return{status:'UNAVAILABLE',reason:String(e.message||e),n1Pct:null,trainingOnly:true}}};
 function liveContext(){
  const model=root.B737AircraftProfileStore?.get?.()?.aircraftModel;
  const f=root.B737UnifiedFlightScenarioV1?.getState?.();
  const signal=key=>{const r=root.B737UnifiedAvionicsNetworkV1?.getSignal?.(key);return r?.quality==='VALID'?r.value:null};
  const c=signal('flightcontext.state'),adc=signal('airdata.adc1')||signal('airdata.adc2');
  const ecu=root.B737ISNCockpitV1?.getECUState?.()?.aircraft;
  const activeScenario=root.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active===true?f:null;
  const altFt=[adc?.pressureAltitudeFt,c?.pressureAltitudeFt,activeScenario?.altitudeFt,ecu?.pressureAltitudeFt].find(finite);
  const oatC=[adc?.satC,c?.oatC,activeScenario?.oatC,ecu?.oatC].find(finite);
  const iasKt=[adc?.casKt,c?.iasKt,activeScenario?.iasKt,ecu?.iasKt].find(finite);
  const isa=finite(altFt)?Math.max(-56.5,15-.0019812*altFt):null;
  const sat=finite(oatC)?oatC:isa;
  const mach=[adc?.mach,f?.mach].find(finite);
  const estimatedMach=finite(mach)?mach:finite(iasKt)&&finite(altFt)?Math.min(.9,iasKt/661/Math.sqrt(Math.max(.25,Math.pow(Math.max(.74,1-altFt/145442),4.256)))):null;
  const measuredTat=[adc?.tatC,signal('environment.tat')?.tatC].find(finite);
  const tatC=finite(measuredTat)?measuredTat:finite(sat)&&finite(estimatedMach)?(sat+273.15)*(1+.2*estimatedMach*estimatedMach)-273.15:null;
  const prop=root.B737ISNCockpitV1?.getPropulsionSnapshot?.()?.engines;
  const count=prop?['engine1','engine2'].filter(k=>prop[k]?.running).length:2;
  return {model,rating:selectedRating(model),engineRating:selectedRating(model),altFt,oatC:sat,tatC,iasKt,weightKg:c?.massKg,isaDeltaC:finite(sat)&&finite(isa)?sat-isa:null,engines:count===1?1:2,packs:'AUTO',engineAI:false,wingAI:false,pmc:'ON',allowProxy:true,clb2Available:false,contextQuality:{altitude:finite(adc?.pressureAltitudeFt)?'ADC':'TRAINING_REFERENCE',oat:finite(oatC)?'OBSERVED':'ISA_ASSUMPTION',tat:finite(measuredTat)?'OBSERVED':'TRAINING_ESTIMATE',configuration:'REFERENCE_AUTO_PACKS_ANTIICE_OFF_PMC_ON'}};
 }
 function live(mode,override={}){const x={...liveContext(),...override,mode};return {...safe(()=>n1(x)),contextQuality:x.contextQuality};}
 function livePerformance(kind,override={}){const x={...liveContext(),...override,kind};return safe(()=>flightPerformance(x));}
 return Object.freeze({version:'N1-v0.7-PERF-v0.5',variants,selectedRating,n1,flightPerformance,live,livePerformance,liveContext,safe,counts:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length]))});
};const api=make(root,root.B737N1TablesV07,root.B737PerfTablesV05);root.B737PerformanceEngineV07=api;if(typeof module==='object'&&module.exports)module.exports=api;})(globalThis);
