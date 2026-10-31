'use strict';
const $=id=>document.getElementById(id);
const map=window.CDU_MAP, pages=window.CDU_PAGES, core=window.CDU_ENGINE;
const state=core.makeState('IDENT');
const preflight=window.B737CDUPreflightEvidenceV1;
if(!preflight)throw Error('FCOM_CDU_PREFLIGHT_EVIDENCE_NOT_LOADED');
const contract=window.B737FCOMScreenContractV1;
if(!contract)throw Error('FCOM_CDU_SCREEN_CONTRACT_NOT_LOADED');
const procedureLedger=window.B737CDUTransitionLedgerV1?.create({
 seat:new URLSearchParams(window.location.search).get('seat')==='FO'?'FO':'CAPT',
 validPages:Object.keys(pages),now:()=>Date.now()
});
const byId={};
function n1EstimateV19(){
 // V19 estimate is calibrated only to a legacy B1/20K demonstration.
 // User-selected B1/18.5K, B3/20K and C1/23.5K must NOT reuse that curve.
 const selected=state.engineInstallation;
 if(selected&&!(selected.variant==='CFM56-3B1'&&selected.ratingLbf===20000))return null;
 const engine=window.EPFSI_ESTIMATED_N1_V19;
 if(!engine)return null;
 const altitude=$('n1-v6-altitude');
 const phase=$('n1-v6-phase');
 const lever=$('n1-v6-lever');
 const altText=altitude?String(altitude.value??'').trim():'';
 const altFt=altText!==''&&Number.isFinite(Number(altText))?Number(altText):null;
 const leverText=lever?String(lever.value??'').trim():'';
 const context=window.EPFSI_SCENARIO_DEFAULTS?.normalize?.({pressureAltitudeFt:altFt})||{
  weatherMode:'ISA',antiIceMode:'OFF',engineBleedMode:'ON',acPacks:'AUTO',pressureAltitudeFt:altFt};
 return engine.estimate({registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',
  ratingLbf:20000,...context,phase:phase?.value||'TAKEOFF',
  thrustLeverPct:leverText!==''&&Number.isFinite(Number(leverText))?Number(leverText):null});
}

function position(el,box){const [x1,y1,x2,y2]=box;Object.assign(el.style,{left:x1/1199*100+'%',top:y1/1312*100+'%',width:(x2-x1)/1199*100+'%',height:(y2-y1)/1312*100+'%'});}
function makeControls(){const click=$('clickmap');for(const c of map.controls){let el=document.createElement('button');el.type='button';el.className='hotspot '+c.shape;position(el,c.bbox_px);el.title=c.label+' — '+c.id;el.dataset.short=c.label;el.setAttribute('aria-label',c.label);let handled=false,timer;el.addEventListener('pointerdown',()=>{if(c.id.endsWith('KEY_CLR')){handled=false;timer=setTimeout(()=>{handled=true;core.press(state,pages,c.id,{longPress:true});update()},700)}});el.addEventListener('pointerup',()=>clearTimeout(timer));el.addEventListener('pointerleave',()=>clearTimeout(timer));el.addEventListener('pointercancel',()=>clearTimeout(timer));el.addEventListener('click',()=>{if(!handled){send(c.id)}else handled=false});el.addEventListener('focus',()=>{if($('selected-code'))$('selected-code').textContent=JSON.stringify(c,null,2)});click.appendChild(el);byId[c.id]=el;}
 const outputs=$('annunciators');for(const a of map.outputs){const el=document.createElement('div');el.id=a.id;el.className='annunciator '+a.color+(a.label==='EXEC'?' exec':'');let b=a.sprite_bbox_px;position(el,b);if(a.illuminated_sprite){const pic=document.createElement('img');pic.className='light-glyph';pic.src=a.illuminated_sprite;el.appendChild(pic);}outputs.appendChild(el);byId[a.id]=el;}}
function updateEHSI(){ if(window.EHSI_ENGINE){ if((state.navdbActive||state.stage5Committed) && state.ehsi?.options) state.ehsi.options.demoRoute=false; window.EHSI_ENGINE.renderToDom(state,core,$('ehsi-svg'),document); window.CDU_NAV_MAP?.render(state,$('ehsi-svg')); window.CDU_STAGE5_MAP?.render(state,$('ehsi-svg')); window.CDU_STAGE9_ADVISORY?.render(state,$('ehsi-svg')); window.CDU_STAGE10_ADVISORY?.render(state,$('ehsi-svg')); } }
const TITLE_PLAIN=new Set(['MENU','INDEX','IDENT','POS_INIT','MESSAGES','MSG_RECALL','NAV_DATA','NAV_OPTIONS','SUPP_NAV','POS_REF','FIX','PROG','PROG2','HOLD','DEP_ARR','DEPARTURES','ARRIVALS']);
function shown(val){return String(val??'').replace(/\{([A-Z_0-9]+)\}/g,(_,key)=>core.readValue(state,key,state.page)||'----');}
function displayCell(cell){if(!cell)return ''; if(cell.field){const get=(field,page)=>core.readValue(state,field,page);return window.CDU_PROMPT_POLICY_V1?.placeholder(state.page,cell,get)||get(cell.field,state.page)||(cell.required?'□□□□':'-----');} return shown(cell.value||'');}
function makePairRow(topPct,leftText,rightText,isScratch=false,isSmall=false){const d=document.createElement('div'); d.className='fmc-line'+(isScratch?' scratch':'')+(isSmall?' fmc-small':'')+' fmc-pairline'; d.style.top=topPct+'%'; const l=document.createElement('span'); l.className='fmc-left'; l.textContent=leftText||''; const r=document.createElement('span'); r.className='fmc-right'; r.textContent=rightText||''; if(isScratch){l.classList.add('full'); r.remove(); d.appendChild(l);} else {d.appendChild(l); d.appendChild(r);} return d;}
/* FCOM Vol.2 11.40.32: DEP/ARR INDEX is a THREE-COLUMN origin/dest
 * page, not a generic route-field menu. Keep the approved photo & LSK map.
 */
function makeDepArrTriplet(topPct,leftText,centerText,rightText,isSmall=false){
 const row=makePairRow(topPct,leftText,rightText,false,isSmall);
 row.classList.add('fmc-dep-arr-index');
 const center=document.createElement('span');
 center.className='fmc-center';
 center.textContent=centerText||'';
 Object.assign(center.style,{
   position:'absolute',left:'32%',width:'36%',top:'0',textAlign:'center',
   whiteSpace:'pre',overflow:'visible',font:'inherit',lineHeight:'inherit',color:'inherit'
 });
 row.appendChild(center);
 return row;
}
// Shared display geometry: LSK page fields must end ABOVE the independent scratchpad.
const CDU_DISPLAY_GEOMETRY=Object.freeze({
 screenTop:1312*0.0765, screenHeight:1312*0.375,
 scratchpadTop:565, lineHeight:1312*0.375*0.049, clearGap:6
});
function lskTextTops(number){
 const lsk=map.controls.find(c=>c.id==='CDU_CAPT_LSK_L'+number);
 if(!lsk)throw Error('CDU_LSK_GEOMETRY_MISSING_'+number);
 const cy=(lsk.bbox_px[1]+lsk.bbox_px[3])/2;
 let labelY=cy-13, valueY=cy+10;
 // Keep the bottom LSK's two lines together and strictly above scratchpad.
 // Applies to INDEX, DEP/ARR, and every other core CDU page.
 const maxValueY=CDU_DISPLAY_GEOMETRY.scratchpadTop-
   CDU_DISPLAY_GEOMETRY.clearGap-CDU_DISPLAY_GEOMETRY.lineHeight;
 const shift=Math.max(0,valueY-maxValueY);
 labelY-=shift;valueY-=shift;
 const percent=y=>(y-CDU_DISPLAY_GEOMETRY.screenTop)/CDU_DISPLAY_GEOMETRY.screenHeight*100;
 return {label:percent(labelY),value:percent(valueY)};
}
function renderDepArrIndex(box){
 const airport=(name)=>String(core.readValue(state,name,'RTE')||'').toUpperCase();

 // L1 / R1: departure and arrival for ORIGIN; R2: DEST arrival only.
 box.appendChild(makeDepArrTriplet(lskTextTops(1).value,'<DEP',airport('ORIGIN'),'ARR>'));
 box.appendChild(makeDepArrTriplet(lskTextTops(2).value,'',airport('DEST'),'ARR>'));
 // L6 / R6: reference-only OTHER airport entry via scratchpad.
 box.appendChild(makeDepArrTriplet(lskTextTops(6).label,'DEP','OTHER','ARR',true));
 box.appendChild(makeDepArrTriplet(lskTextTops(6).value,'<----','','---->'));
}
function v19SafeN1(){const r=n1EstimateV19();return r?.status==='SIM_ESTIMATE'?r:null;}
// Force the user-approved green Boeing CDU typography on the LIVE rows.
// Inline-important values win over historical v5 CSS and global nth-child
// font selectors which incorrectly shrink DEP/ARR selectable prompts.
function applyCDUScreenTypography(box){
 const green='#4bf58a';
 const stage=document.getElementById('cdu-stage');
 const stageWidth=stage?.getBoundingClientRect().width||790;
 const width=box.getBoundingClientRect().width||stageWidth*.4865;
 const target=stageWidth*.0247;
 // At least 24 uppercase A characters must fit the scratchpad without
 // horizontal clipping. Measure the actual loaded font; scale only if needed.
 const canvas=applyCDUScreenTypography.canvas||(applyCDUScreenTypography.canvas=document.createElement('canvas'));
 const ctx=canvas.getContext('2d');
 let px=target;
 if(ctx){
  ctx.font=target+'px BoeingCDULarge';
  const textWidth=ctx.measureText('AAAAAAAAAAAAAAAAAAAAAAAA').width;
  if(textWidth>0)px=Math.min(target,target*(width*.946*.98/textWidth));
 }
 box.style.setProperty('color',green,'important');
 box.style.setProperty('font-size',px+'px','important');
 const nodes=box.querySelectorAll('.fmc-line');
 for(const el of nodes){
  const small=el.classList.contains('fmc-small');
  const f=small?'BoeingCDUSmall':'BoeingCDULarge';
  const size=small?Math.min(px,stageWidth*.0230):px;
  for(const node of [el,...el.querySelectorAll('*')]){
   node.style.setProperty('color',green,'important');
   node.style.setProperty('font-family',f,'important');
   node.style.setProperty('font-size',size+'px','important');
   node.style.setProperty('font-weight','400','important');
  }
 }
 box.dataset.fontColor=green;
 box.dataset.promptPolicy=window.CDU_PROMPT_POLICY_V1?.VERSION||'NOT_LOADED';
 box.dataset.fontFit24='true';
}
function update(){const box=$('fmc-lines'); const frame=document.createElement('div');
 const {screenTop,screenHeight}=CDU_DISPLAY_GEOMETRY;
 const page=pages[state.page]; const tag=(core.pendingCount(state)>0)?'MOD ':'ACT ';
 const header=document.createElement('div'); header.className='fmc-line fmc-header'; header.style.top=((117-screenTop)/screenHeight*100)+'%';
 const ht=document.createElement('span'); ht.className='fmc-header-title'; ht.textContent=(TITLE_PLAIN.has(state.page)?'':tag)+page.title;
 const hc=document.createElement('span'); hc.className='fmc-header-count'; hc.textContent=(page.page_number||1)+'/'+page.page_count; header.appendChild(ht); header.appendChild(hc); frame.appendChild(header);
 const n1=v19SafeN1();
 if(state.page==='DEP_ARR')renderDepArrIndex(frame);
 else for(let row=1;row<=6;row++){ const pair=page.rows[row-1]; const {label:labelTop,value:valueTop}=lskTextTops(row);
   let labelL=pair?.[0]?.label||'',labelR=pair?.[1]?.label||'';
   let valueL=displayCell(pair?.[0]),valueR=displayCell(pair?.[1]);
   if(state.page==='INDEX'){
     // The FCOM INDEX figure has large selectable prompts on the LSK rows,
     // with no small field titles. L6 is absent in the photographed variant.
     valueL=row===6?(state.indexOffsetAvailable===true?'<OFFSET':''):labelL;
     valueR=row===6&&state.fmcOnGroundVerified===false?'NAV STATUS>':labelR;
     labelL='';labelR='';
   }
   if(state.page==='IDENT'){
     const sources=state.preflightEvidence||{};
     const ids=[['MODEL','ENG_RATING'],['NAV_DATA','ACTIVE'],[null,'INACTIVE'],
       ['OP_PROGRAM',null],[null,'SUPP_DATA'],[null,null]][row-1];
     valueL=ids[0]?preflight.identValue(ids[0],sources):valueL;
     valueR=ids[1]?preflight.identValue(ids[1],sources):valueR;
   }
   if(state.page==='POS_INIT'){
     const sources=state.preflightEvidence||{};
     if(row===1){valueL=preflight.lastPosition(sources);valueR='';}
     if(row===3&&!core.readValue(state,'REF_AIRPORT','POS_INIT'))valueL='-----';
     if(row===4){valueR=preflight.irsPositionPrompt(sources);}
     if(row===5){
       valueL=preflight.clock(sources);
       if(!preflight.irsHeadingAvailable(sources)){labelR='';valueR='';}
       else valueR=preflight.posValue('IRS_HDG',sources,state.active);
     }
   }
   if(row===1&&state.depArrSelection&&['DEPARTURES','ARRIVALS'].includes(state.page))
     valueL=state.depArrSelection.airport||valueL;
   if(n1&&state.page==='N1_LIMIT'&&row===1){labelR='20K N1 EST';valueR=n1.maxN1Pct.toFixed(1)+'% EST';}
   if(n1&&state.page==='TAKEOFF'&&row===3){labelL='TO N1 EST';valueL=n1.maxN1Pct.toFixed(1)+'% EST';}
   frame.appendChild(makePairRow(labelTop,labelL,labelR,false,true));
   const valueLine=makePairRow(valueTop,valueL,valueR);
   if(state.page==='POS_INIT'&&row===1){
     valueLine.querySelector('.fmc-left')?.classList.add('full');
   }
   frame.appendChild(valueLine);
 }
 frame.appendChild(makePairRow(((CDU_DISPLAY_GEOMETRY.scratchpadTop-screenTop)/screenHeight*100), state.message||state.scratch||'', '', true));
 const renderers={
  NAVDB_LEGS:window.CDU_NAV_API?.paint,
  STAGE5:window.CDU_STAGE5_API?.paint,
  STAGE6:window.CDU_STAGE6_API?.paint,
  PROGRESS:window.CDU_REFERENCE_PROGRESS_API?.paint,
  STAGE10_ADVISORY:window.CDU_STAGE10_ADVISORY?.paint?
    node=>window.CDU_STAGE10_ADVISORY.paint(node,state):null
 };
 const output=window.CDU_SCREEN_COMPOSITOR_V1?.compose({
   frame,state,renderers,onError:items=>console.warn('CDU SCREEN OWNER ERROR',items)
 });
 if(!output)throw Error('AUTHORITATIVE_CDU_SCREEN_COMPOSITOR_NOT_LOADED');
 // Single atomic update to the VISIBLE CDU. Optional reference adapters never
 // receive or mutate the live DOM and cannot erase a FCOM-owned screen.
 box.replaceChildren(...frame.childNodes);
 applyCDUScreenTypography(box);
 box.dataset.screenOwner=output.owner;
 box.dataset.sourceVerified=String(output.sourceVerified);
 box.dataset.compositorVersion=output.version;
 box.style.opacity=state.brightness;
 const all=core.lights(state);if(state.stage6AwaitingExec)all.EXEC=true;
 for(const [l,on] of Object.entries(all)){const el=byId['CDU_CAPT_'+l+'_LIGHT'];if(el)el.classList.toggle('on',on)}
 $('page-now').textContent=state.page;$('scratch-now').textContent=state.message||state.scratch||'—';$('pending-now').textContent=core.pendingCount(state);$('key-now').textContent=state.lastKey;
 const review=contract.compile(pages,state.page);
 box.dataset.layoutVerification=review.verification.layout;
 box.dataset.behaviorVerification=review.verification.behavior;
 box.dataset.sourceFolio=review.source.folio||'UNVERIFIED';
 const ref=pages[state.page].source_ref;
 $('current-reference').textContent='FCOM '+(ref?.folio_family||'UNKNOWN')+' / PDF near '+(ref?.pdf_page_near||'?')+
   ' — layout '+review.verification.layout+'; behavior '+review.verification.behavior;
 $('current-status').textContent='SOURCE: '+(pages[state.page].source_status||'UNVERIFIED')+
   ' / unresolved static cell issues: '+review.issues.length;
 const status=$('n1-v6-est-status');
 if(status&&state.engineInstallation&&!n1)status.textContent=
  'ENGINE '+state.engineInstallation.label+' · '+state.engineInstallation.rating+
  ' · N1 EST NOT CALIBRATED FOR SELECTED VARIANT';
 if(status&&n1)status.textContent='SIM EST / '+n1.phase+': MAX '+n1.maxN1Pct.toFixed(1)+
  '% / PRESENT ENG1 '+n1.presentN1Pct[1].toFixed(1)+'% / ENG2 '+n1.presentN1Pct[2].toFixed(1)+'%';
 updateEHSI();
}
function send(k){
 const prior=procedureLedger?.capture(state)||null;
 try{const before=state.page;
 if(window.CDU_STAGE6_API?.beforeKey?.(k)){update();return;}
 if(window.CDU_STAGE5_API?.beforeKey?.(k)){update();return;}
 core.press(state,pages,k);window.CDU_NAV_API?.afterPage?.(k);window.CDU_NAV_API?.afterKey?.(k);
 window.CDU_STAGE5_API?.afterPage?.(k);window.CDU_STAGE5_API?.afterKey?.(k,before);
 window.CDU_STAGE6_API?.afterPage?.(k);window.CDU_STAGE6_API?.afterKey?.(k,before);update()
 }finally{
  if(prior)try{procedureLedger.record(k,prior,procedureLedger.capture(state))}
  catch(err){console.warn('CDU PROCEDURE TRACE ERROR',err);}
 }
}
function reset(){const fresh=core.makeState('IDENT');Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,fresh);['call-test','fault-test','offset-test'].forEach(k=>$(k).checked=false);window.EHSI_ENGINE?.syncPanel(state,document);update()}
function init(){if(!map||!pages||!core)throw Error('CDU data is missing');makeControls();update();$('reset').onclick=reset;$('overlay-toggle').onclick=()=>$('cdu-stage').classList.toggle('debug');$('info-toggle').onclick=()=>$('qa').hidden=!$('qa').hidden;
 for(const [el,k] of [['call-test','call'],['fault-test','fail'],['offset-test','offsetGuidance']])$(el).addEventListener('change',e=>{state[k]=e.target.checked;update()});
 $('test-message').onclick=()=>{state.message='CHECK FMC DATA';update()};
 document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;let key=null;
 if(e.key==='Backspace')key='KEY_CLR';else if(e.key==='Enter')key='EXEC';else if(e.key===' ')key='KEY_SP';else if(e.key==='.')key='KEY_DOT';else if(e.key==='/')key='KEY_SLASH';else if(e.key==='-')key='KEY_PLUS_MINUS';else if(/^[A-Z0-9]$/i.test(e.key))key='KEY_'+e.key.toUpperCase();if(key){e.preventDefault();send('CDU_CAPT_'+key)}});
 for(const id of ['n1-v6-phase','n1-v6-altitude','n1-v6-lever']){
  const el=$(id);if(el)el.addEventListener('change',update);
 }
 $('page-select').addEventListener('change',e=>{core.choose(state,pages,e.target.value);update()});
 Object.keys(pages).sort().forEach(key=>{const option=document.createElement('option');option.value=key;option.textContent=key;$('page-select').appendChild(option)});
 new MutationObserver(()=>{$('page-select').value=state.page}).observe($('page-now'),{childList:true});$('page-select').value=state.page;
 window.EHSI_ENGINE?.initControls(state,core,document,updateEHSI);
 // Recalculate after font faces load and after responsive stage resizing.
 const refreshType=()=>{const screen=$('fmc-lines');if(screen)applyCDUScreenTypography(screen);};
 if(document.fonts?.ready)document.fonts.ready.then(refreshType).catch(err=>console.warn('CDU FONT LOAD',err));
 window.addEventListener('resize',refreshType,{passive:true});
 
}
window.CDU_PROCEDURE_AUDIT_V1=procedureLedger;
window.CDU_SCREEN_QA_V1=Object.freeze({
 getCurrent:()=>contract.grid(pages,state.page,{
   readValue:(field,page)=>core.readValue(state,field,page),
   readScratch:()=>state.scratch,readMessage:()=>state.message,
   indexOffsetAvailable:state.indexOffsetAvailable,
   fmcOnGroundVerified:state.fmcOnGroundVerified
 }),
 getPage:id=>contract.compile(pages,id),
 getMasterAudit:()=>contract.audit(pages),
 getVisualOwner:()=>({
   owner:document.getElementById('fmc-lines')?.dataset.screenOwner||null,
   compositor:document.getElementById('fmc-lines')?.dataset.compositorVersion||null
 }),
 getDisplayStyle:()=>{
  const box=document.getElementById('fmc-lines');
  const large=box?.querySelector('.fmc-line:not(.fmc-small)');
  const small=box?.querySelector('.fmc-line.fmc-small');
  return {color:large?getComputedStyle(large).color:null,
   largeFamily:large?getComputedStyle(large).fontFamily:null,
   largeSize:large?getComputedStyle(large).fontSize:null,
   smallFamily:small?getComputedStyle(small).fontFamily:null,
   smallSize:small?getComputedStyle(small).fontSize:null,
   loadedLarge:document.fonts?.check('16px BoeingCDULarge')??null,
   loadedSmall:document.fonts?.check('16px BoeingCDUSmall')??null,
   fit24:box?.dataset.fontFit24||null,
   promptPolicy:box?.dataset.promptPolicy||null};
 },
 getPromptAudit:()=>window.CDU_PROMPT_POLICY_V1?.audit(pages,(field,page)=>core.readValue(state,field,page))
});
window.updateStage5View=update;
init();
