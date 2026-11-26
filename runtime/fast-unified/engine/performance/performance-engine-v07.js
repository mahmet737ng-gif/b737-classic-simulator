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
  const used=[],corr={};let v,source,proxy=null,assumedTemperatureEnvelope=null;
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
    assumedTemperatureEnvelope={minimumC:min,maximumC:max,altFt,oatC,takeoffRating};
     if(assumedC<min||assumedC>max){const e=Error('ASSUMED_TEMP_OUTSIDE_ENVELOPE');e.details=assumedTemperatureEnvelope;throw e;}
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
  return result(n,p,used,{mode,source,proxy,corrections:corr,baseN1Pct:v,takeoffRating,assumedTemperatureEnvelope,trainingOnly:true});
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
 const safe=fn=>{try{return fn()}catch(e){return{status:'UNAVAILABLE',reason:String(e.message||e),details:e.details??null,n1Pct:null,trainingOnly:true}}};
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
 // Shared departure input owner: CDU validation and the committed N1 schedule
 // must use the same airport, pressure altitude and OAT. Never recalculate
 // departure thrust from the airborne pressure altitude.
 let groundDeparture=null;
 function takeoffContext(origin,override={}){
  const ctx=liveContext();
  const scenario=root.B737UnifiedFlightScenarioV1;
  const f=scenario?.getDiagnostics?.()?.active===true?scenario.getState?.():null;
  const loc=root.B737UnifiedFlightLocationV1?.getLocation?.();
  const ground=root.B737UnifiedAvionicsNetworkV1?.getSignal?.('aircraft.airground');
  const ecu=root.B737ISNCockpitV1?.getECUState?.()?.aircraft;
  const onGround=typeof f?.airborne==='boolean'?!f.airborne:typeof f?.onGround==='boolean'?f.onGround:ground?.quality==='VALID'&&typeof ground.value?.onGround==='boolean'?ground.value.onGround:ecu?.onGround;
  const current=String(f?.icao||loc?.icao||'').toUpperCase();
  const requested=String(origin||current||'').toUpperCase();
  const airport=/^[A-Z]{4}$/.test(requested)?requested:'';
  const key=[ctx.model,ctx.rating,airport].join('/');
  const matched=!airport||!current||airport===current;
  const explicit=Number.isFinite(override.altFt);
  const airportRef=root.B737FlightScenarioCoreV1?.AIRPORTS?.[airport];
  const field=airportRef?.elevationFt;
  let altFt=null,oatC=null,altitudeSource='DEPARTURE_UNAVAILABLE',oatSource='DEPARTURE_UNAVAILABLE';
  if(explicit){
   altFt=override.altFt;altitudeSource='EXPLICIT_STANDALONE_REFERENCE';
   oatC=Number.isFinite(override.oatC)?override.oatC:matched?ctx.oatC:null;
   oatSource=Number.isFinite(override.oatC)?'PILOT_ENTRY':matched?ctx.contextQuality?.oat:'ISA_ASSUMPTION';
  }else if(onGround===false&&groundDeparture?.key===key){
   ({altFt,oatC,altitudeSource,oatSource}=groundDeparture);
  }else if(onGround===true&&matched&&Number.isFinite(ctx.altFt)&&(ctx.contextQuality?.altitude==='ADC'||f)){
   altFt=ctx.altFt;oatC=ctx.oatC;altitudeSource='GROUND_PRESSURE_ALTITUDE';oatSource=ctx.contextQuality?.oat;
  }else if(Number.isFinite(field)){
   // Published simulator field elevation is NOT observed pressure altitude.
   // In the absence of a departure pressure sample, the reference explicitly
   // assumes 1013.25 hPa; never substitute the altitude of another airport.
   altFt=field;altitudeSource='AIRPORT_ELEVATION_STANDARD_PRESSURE_TRAINING';
   if(onGround===true&&matched){oatC=ctx.oatC;oatSource=ctx.contextQuality?.oat;}
  }else if(onGround!==false&&matched&&Number.isFinite(ctx.altFt)){
   altFt=ctx.altFt;oatC=ctx.oatC;altitudeSource='GROUND_TRAINING_REFERENCE';oatSource=ctx.contextQuality?.oat;
  }
  if(!Number.isFinite(oatC)&&Number.isFinite(altFt)){oatC=Math.max(-56.5,15-.0019812*altFt);oatSource='ISA_ASSUMPTION';}
  if(!explicit&&onGround===true&&matched&&Number.isFinite(altFt)&&Number.isFinite(oatC))groundDeparture={key,altFt,oatC,altitudeSource,oatSource};
  if(Number.isFinite(override.oatC)){oatC=override.oatC;oatSource='PILOT_ENTRY';}
  return {...ctx,...override,altFt,oatC,departureAirport:airport,departureMatched:matched,onGround,
   contextQuality:{...ctx.contextQuality,altitude:altitudeSource,oat:oatSource}};
 }
 function takeoff(origin,mode,override={}){
  const x={...takeoffContext(origin,override),mode};
  const context={airport:x.departureAirport,altFt:x.altFt,oatC:x.oatC,quality:x.contextQuality};
  const unavailable=(reason,details=null)=>({status:'UNAVAILABLE',reason,details,n1Pct:null,trainingOnly:true,takeoffContext:context});
  if(!Number.isFinite(x.altFt)||!Number.isFinite(x.oatC))return unavailable('DEPARTURE_CONDITIONS_UNAVAILABLE');
  if(mode==='R-TO'&&(!Number.isFinite(x.assumedC)||x.assumedC<=x.oatC))return unavailable('INVALID_ASSUMED_TEMP_CONFIGURATION',{oatC:x.oatC,altFt:x.altFt});
  const result=safe(()=>n1(x));
  if(result.status==='TRAINING_TABLE'&&mode==='R-TO'){
   const full=safe(()=>n1({...x,mode:'TO',assumedC:null}));
   if(full.status!=='TRAINING_TABLE'||!Number.isFinite(full.n1Pct))return unavailable(full.reason||'FULL_RATED_N1_UNAVAILABLE',result.assumedTemperatureEnvelope);
   if(result.n1Pct>full.n1Pct+.01)return unavailable('REDUCED_N1_ABOVE_RATED',result.assumedTemperatureEnvelope);
  }
  return {...result,contextQuality:x.contextQuality,takeoffContext:context};
 }
 function live(mode,override={}){const x={...liveContext(),...override,mode};return {...safe(()=>n1(x)),contextQuality:x.contextQuality};}
 // Display-only training estimate, never consumed by coupledLimits or A/T.
 function displayLimit(mode,override={}){
  const ctx={...liveContext(),...override};const r=live(mode,override);
  if(r.status==='TRAINING_TABLE'&&finite(r.n1Pct))return r;
  if(!['GA','CON','CLB','CLB-1','CLB-2','CRZ'].includes(mode)||!variants[ctx.model]||!finite(ctx.altFt)||!finite(ctx.oatC))return r;
  if(mode==='CON'&&ctx.engines===2){const o=live('CON',{...override,engines:1});if(o.status==='TRAINING_TABLE'&&finite(o.n1Pct))return {...o,status:'TRAINING_ESTIMATE',source:'OEI_REFERENCE_DISPLAY_ONLY',reason:r.reason};}
  // Same documented simulator surrogate as ISN thrust planner; not AFM data.
  const base={GA:96.5,CON:94,CLB:92,'CLB-1':92,'CLB-2':92,CRZ:88}[mode];
  const isa=15-.0019812*ctx.altFt;
  const fade=Math.max(0,Math.min(1,1-ctx.altFt/15000));
  const reduced=mode==='CLB-1'?3*fade:mode==='CLB-2'?6*fade:0;
  const value=Math.max(0,Math.min(97,base-.08*Math.max(0,ctx.altFt)/1000-.025*Math.max(0,ctx.oatC-isa)-reduced));
  return {status:'TRAINING_ESTIMATE',n1Pct:value,mode,source:'ISN_TRAINING_SURROGATE_DISPLAY_ONLY',reason:r.reason,trainingOnly:true};
 }
 function livePerformance(kind,override={}){const x={...liveContext(),...override,kind};return safe(()=>flightPerformance(x));}
 // Shared committed FMC thrust schedule. No CDU-page dependence or manual bug feedback.
 const parseTemp=v=>{const m=/^([+-]?\d+(?:\.\d+)?)\s*(?:°?([CF]))?$/i.exec(String(v??'').trim());return m?(m[2]?.toUpperCase()==='F'?(Number(m[1])-32)*5/9:Number(m[1])):null;};
 let departure=null;
 function coupledLimits(request){
  const bank=root.B737UnifiedFmc?.snapshot?.(),active=bank?.active;
  const ctx=liveContext(),toga=root.B737UnifiedTOGACh4V1?.getState?.(),scenario=root.B737UnifiedFlightScenarioV1;
  const f=scenario?.getDiagnostics?.()?.active===true?scenario.getState?.():null;
  const ecu=root.B737ISNCockpitV1?.getECUState?.()?.aircraft;
  const onGround=typeof f?.airborne==='boolean'?!f.airborne:typeof f?.onGround==='boolean'?f.onGround:ecu?.onGround;
  const invalid=reason=>({valid:false,mode:null,reason,referencePct:null,atLimitPct:null,trainingOnly:true});
  if(!active||!variants[ctx.model])return invalid('FMC_OR_PROFILE_UNAVAILABLE');
  const profileKey=ctx.model+'/'+ctx.rating;
  if(departure?.profileKey!==profileKey)departure=null;
  const manual=active.N1_MANUAL_MODE;
  const selectedClimb=['CLB','CLB-1','CLB-2'].includes(active.CLB_DERATE)?active.CLB_DERATE:'CLB';
  let mode=request||(toga?.phase==='GA'?'GA':toga?.phase==='TO'&&!toga?.n1SelectedAfterArm?'TO':onGround===true?'TO':ctx.engines===1?'CON':manual&&manual!=='AUTO'?manual:String(f?.phase||'').includes('CRUISE')?'CRZ':onGround===false?'CLB':null);
  if(!mode)return invalid('FLIGHT_PHASE_UNAVAILABLE');
  if(mode==='CLB')mode=selectedClimb;
  if(['CLB-1','CLB-2'].includes(mode)&&ctx.altFt>=15000)mode='CLB';
  const options={clb2Available:true};
  if(mode==='TO'){
   const derate=active.TO_DERATE||'TO',base=ctx.model.replace(/W$/,'');
   const rating=derate==='TO'?ctx.rating:derate==='TO-1'&&base==='737-300'&&ctx.rating===22000?20000:derate==='TO-1'&&base==='737-400'&&ctx.rating===23500?22000:null;
   if(!rating)return invalid('FIXED_DERATE_TABLE_UNAVAILABLE');
   const oat=parseTemp(active.OAT),sel=parseTemp(active.SEL_TEMP);
   const origin=active.ORIGIN||'';
   const signature=[profileKey,origin,derate,oat,sel].join('/');
   if(onGround===false){if(departure?.signature===signature)return departure.packet;return invalid('GROUND_DEPARTURE_LIMIT_NOT_CAPTURED');}
   const o={...options,takeoffRating:rating,...(oat===null?{}:{oatC:oat})};
   const dep=takeoffContext(origin,o);
   if(!dep.departureMatched)return invalid('DEPARTURE_LOCATION_MISMATCH');
   const full=takeoff(origin,'TO',o),reduced=sel===null?full:takeoff(origin,'R-TO',{...o,assumedC:sel});
   if(full.status!=='TRAINING_TABLE'||reduced.status!=='TRAINING_TABLE'||!finite(full.n1Pct)||!finite(reduced.n1Pct))return invalid(reduced.reason||full.reason||'N1_TABLE_UNAVAILABLE');
   if(sel!==null&&reduced.n1Pct>full.n1Pct+.01)return invalid('REDUCED_N1_ABOVE_RATED');
   const packet={valid:true,mode:sel===null?'TO':'R-TO',rating,derate,referencePct:full.n1Pct,atLimitPct:reduced.n1Pct,source:reduced.source,proxy:reduced.proxy,pages:reduced.pages,takeoffContext:reduced.takeoffContext,trainingOnly:true};
   if(onGround===true)departure={profileKey,signature,packet};
   return packet;
  }
  const r=live(mode,options);
  if(r.status!=='TRAINING_TABLE'||!finite(r.n1Pct))return invalid(r.reason||'N1_TABLE_UNAVAILABLE');
  return {valid:true,mode:mode==='GA'?'G/A':mode.startsWith('CLB-')?'R-CLB':mode,referencePct:r.n1Pct,atLimitPct:r.n1Pct,source:r.source,proxy:r.proxy,pages:r.pages,trainingOnly:true};
 }
 return Object.freeze({coupledLimits,version:'N1-v0.7-PERF-v0.5',variants,selectedRating,n1,flightPerformance,live,displayLimit,livePerformance,liveContext,takeoffContext,takeoff,safe,counts:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length]))});
};const api=make(root,root.B737N1TablesV07,root.B737PerfTablesV05);root.B737PerformanceEngineV07=api;if(typeof module==='object'&&module.exports)module.exports=api;})(globalThis);
