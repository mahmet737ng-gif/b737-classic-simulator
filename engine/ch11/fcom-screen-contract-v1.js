/* FCOM screen contract and 24x14 character-grid audit.
 * Catalog/verification only: it NEVER promotes an unverified trainer page to
 * aircraft-authoritative status. Renderer geometry is owned by a separate
 * single-writer compositor. Training use only, not for flight.
 */
(function(root,factory){'use strict';const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;
 if(root)root.B737FCOMScreenContractV1=a;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const COLUMNS=24, ROWS=14,MAX_LSK=6;
 const DECLARED=Object.freeze({
  DEP_ARR:Object.freeze({layout:'FCOM_LAYOUT_AUDITED',behavior:'PARTIAL',
   folio:'11.40.32',behaviorFolio:'11.40.33',note:'INDEX ONLY; procedures database unverified'})
 });
 const READINESS=Object.freeze(['SOURCE_NOT_VERIFIED','FCOM_LAYOUT_AUDITED','FCOM_BEHAVIOR_AUDITED','FULLY_VERIFIED']);
 const norm=s=>String(s??'').replace(/[\r\n\t]/g,' ');
 const shallowCell=(cell,lsk)=>({lsk,label:norm(cell?.label),value:cell?.value??null,
  field:cell?.field??null,action:cell?.action??null,
  format:cell?.format??null,sourceVerification:cell?.source_verification||'UNVERIFIED'});
 function compile(pages,id){
  if(!pages||typeof pages!=='object')throw Error('CDU_PAGE_REGISTRY_REQUIRED');
  const page=pages[id];if(!page)throw Error('UNKNOWN_CDU_PAGE_'+id);
  if(!Array.isArray(page.rows)||page.rows.length!==MAX_LSK)throw Error('CDU_PAGE_REQUIRES_6_LSK_ROWS_'+id);
  const issues=[],keys=[],rows=[];
  for(let i=0;i<MAX_LSK;i++){
   const pair=page.rows[i];
   if(!Array.isArray(pair)||pair.length!==2)throw Error('CDU_ROW_REQUIRES_L_R_PAIR_'+id+'_'+(i+1));
   const left=shallowCell(pair[0],'L'+(i+1)),right=shallowCell(pair[1],'R'+(i+1));
   keys.push(left,right);rows.push([left,right]);
   for(const cell of [left,right]){
    if(cell.label.length>12)issues.push({type:'LABEL_OVER_12_COLUMNS',key:cell.lsk,chars:cell.label.length});
    if(typeof cell.value==='string'&&cell.value.length>12)issues.push({
     type:'LITERAL_OVER_12_COLUMNS',key:cell.lsk,chars:cell.value.length});
    if(cell.action?.type==='navigate'&&!pages[cell.action.page])issues.push({
     type:'BROKEN_PAGE_LINK',key:cell.lsk,nextPage:cell.action.page});
   }
  }
  const declared=DECLARED[id],reference=page.source_ref||{};
  const status=declared?.layout||'SOURCE_NOT_VERIFIED';
  const variant={airframe:'B737_CLASSIC_300_400_500',
   installedSoftware:'UNVERIFIED',airframeSerial:'29340_NOT_VERIFIED_FOR_THIS_PAGE'};
  return {schema:'B737_FCOM_CDU_SCREEN_CONTRACT_V1',id,
   title:norm(page.title),source:{document:reference.source||null,folio:reference.folio_family||null,
    pdfPageNear:reference.pdf_page_near??null,sourceStatus:page.source_status||'UNVERIFIED'},
   verification:{layout:status,behavior:declared?.behavior||'UNVERIFIED',full:'NOT_VERIFIED',
    requiresSourceArtwork:status!=='FCOM_LAYOUT_AUDITED',notes:declared?.note||null},
   grid:{columns:COLUMNS,rows:ROWS,headerRow:0,scratchpadRow:13,
    pairs:rows,keys,centralFields:id==='DEP_ARR'?{row1:'ORIGIN',row2:'DEST',row5:'OTHER'}:null},
   variant,issues};
 }
 function grid(pages,id,{readValue,readScratch,readMessage}={}){
  const spec=compile(pages,id);
  const surface=Array.from({length:ROWS},()=>Array(COLUMNS).fill(' '));
  const issues=[...spec.issues];
  function put(row,col,text,tag){
   const value=norm(text),out={row,col,text:value,tag};
   if(row<0||row>=ROWS||col<0||col>=COLUMNS)throw Error('OUTSIDE_24x14_GRID');
   const size=Math.min(value.length,COLUMNS-col);
   if(value.length>size)issues.push({type:'OUTSIDE_24_COLUMNS',tag,row,col,length:value.length});
   for(let i=0;i<size;i++){
    const now=surface[row][col+i];
    if(now!==' '&&now!==value[i])issues.push({type:'COLUMN_COLLISION',tag,row,col:col+i,existing:now,upcoming:value[i]});
    surface[row][col+i]=value[i];
   }
   return out;
  }
  const head=spec.title,pg=pages[id];
  if(id==='DEP_ARR'){
   put(0,0,head,'HEADER');
   put(0,21,'1/1','PAGE_COUNT');
   // Source folio 11.40.32; the value display uses currently entered RTE.
   const origin=norm(typeof readValue==='function'?readValue('ORIGIN','RTE'):'');
   const dest=norm(typeof readValue==='function'?readValue('DEST','RTE'):'');
   put(2,0,'<DEP','L1');put(2,10,origin,'ORIGIN');put(2,20,'ARR>','R1');
   put(4,10,dest,'DEST');put(4,20,'ARR>','R2');
   put(10,0,'DEP','OTHER_DEP');put(10,10,'OTHER','OTHER');put(10,21,'ARR','OTHER_ARR');
   put(11,0,'<----','L6');put(11,20,'---->','R6');
  }else{
   put(0,0,head,'HEADER');
   const count=(pg.page_number||1)+'/'+(pg.page_count||1);
   put(0,COLUMNS-count.length,count,'PAGE_COUNT');
   for(let i=0;i<MAX_LSK;i++){
    const [l,r]=spec.grid.pairs[i];
    const display=cell=>{
     if(cell.field){
      const x=typeof readValue==='function'?norm(readValue(cell.field,id)):'';
      return x||(pages[id].rows[i][cell.lsk.startsWith('L')?0:1]?.required?'□□□□':'-----');
     }
     return norm(cell.value);
    };
    const labelY=1+2*i,valueY=2+2*i;
    put(labelY,0,l.label,l.lsk+'_LABEL');
    put(labelY,Math.max(12,COLUMNS-r.label.length),r.label,r.lsk+'_LABEL');
    const lv=display(l),rv=display(r);
    put(valueY,0,lv,l.lsk+'_VALUE');
    put(valueY,Math.max(12,COLUMNS-rv.length),rv,r.lsk+'_VALUE');
   }
  }
  const msg=typeof readMessage==='function'?norm(readMessage()):'';
  const scratch=msg||norm(typeof readScratch==='function'?readScratch():'');
  put(13,0,scratch.slice(0,COLUMNS),'SCRATCHPAD');
  if(scratch.length>COLUMNS)issues.push({type:'SCRATCHPAD_OVER_24_COLUMNS',length:scratch.length});
  return {spec,lines:surface.map(x=>x.join('')),issues,sourceVerified:spec.verification.full==='FULLY_VERIFIED'};
 }
 function audit(pages){
  const ids=Object.keys(pages||{}),specs=ids.map(id=>compile(pages,id));
  const incomplete=specs.filter(p=>p.verification.full!=='FULLY_VERIFIED');
  return {schema:'B737_CDU_SCREEN_AUDIT_V1',total:specs.length,
   fullyVerified:specs.length-incomplete.length,layoutAudited:specs.filter(p=>p.verification.layout==='FCOM_LAYOUT_AUDITED').length,
   needsSourceReview:incomplete.map(s=>s.id),issues:specs.flatMap(x=>x.issues.map(i=>({page:x.id,...i}))),
   pages:specs};
 }
 return Object.freeze({COLUMNS,ROWS,MAX_LSK,READINESS,DECLARED,compile,grid,audit});
});
