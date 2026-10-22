'use strict';
const $=id=>document.getElementById(id);
const byId = Object.create(null);
const LOG=[];
const sim={mode:'standalone',page:'CRZ',subpage:1,scratch:'',message:'',call:false,fail:false,offset:false,brightness:1,active:{ORIGIN:'KSEA',DEST:'KJFK',FLIGHT:'DAL123',CI:'25',CRZ_ALT:'FL350',CRZ_SPEED:'.780',WPT1:'SEA',WPT2:'BKE',POS:'KSEA',OFFSET:'',N1:''},n1:{phase:'TAKEOFF',pmcMode:'UNKNOWN',pressureAltitudeFt:null,oatC:null,tatC:null,mach:null,iasKts:null,bleedMode:null,antiIceMode:null},pending:{},last:'—'};
function v(k){return Object.hasOwn(sim.pending,k)?sim.pending[k]:sim.active[k]||''}
function pendingCount(){return Object.keys(sim.pending).length}
function left(a='',b=''){let x=String(a).slice(0,24),y=String(b).slice(0,24);return (x+' '.repeat(Math.max(1,24-x.length-y.length))+y).slice(0,24)}
function epfsiN1(){
 const factory=window.EPFSI_N1_ENGINE;
 if(!factory)return {display:'---.-',calculated:false,canDriveAutothrottle:false,source:null,reason:'SOURCE_ENGINE_NOT_LOADED'};
 return factory.cduAdapter({registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000,...sim.n1});
}
function pageLines(){const mode=pendingCount()?'MOD':'ACT',a=Array(14).fill('');let p=sim.page;
 if(p==='CRZ'){
 a[0]=left(mode+' ECON CRZ','1/1');a[1]=left('CRZ ALT','OPT/MAX');a[2]=left(v('CRZ_ALT'),'FL340/361');a[3]=left('TGT SPD','TO T/D');a[4]=left(v('CRZ_SPEED'),'2004.5Z/100NM');a[5]=left('TURB N1','ACTUAL WIND');a[6]=left('87.3/ 87.3%','129/ 14');a[7]='FUEL AT KATL';a[8]='         12.5';a[10]='------------------------';a[11]=left('','ENG OUT>');a[13]=left('<LRC','RTA>');
 }else if(p==='RTE'){
 a[0]=left(mode+' RTE','1/2');a[1]=left('ORIGIN','DEST');a[2]=left(v('ORIGIN'),v('DEST'));a[3]=left('CO ROUTE','FLT NO');a[4]=left('—',v('FLIGHT'));a[5]=left('RUNWAY','ROUTE');a[6]=left('—','—');a[8]=left('','ACTIVATE>');a[11]=left('','<RTE LEGS');a[13]=left('<INDEX','LEGS>');
 }else if(p==='MENU'){
 a[0]=left('MENU','1/1');a[2]=left('<FMC','');a[4]=left('<ACARS','');a[6]=left('<CDU TEST','');a[12]=left('<INDEX','');
 }else if(p==='INDEX'){
 a[0]=left('INIT/REF INDEX','1/1');a[2]=left('<IDENT','POS INIT>');a[4]=left('<RTE','PERF INIT>');a[6]=left('<TAKEOFF','N1 LIMIT>');a[8]=left('<APPROACH','');a[13]=left('<MENU','');
 }else if(p==='IDENT'){
 a[0]=left('IDENT','1/1');a[2]=left('MODEL','ENG RATING');a[3]=left('B737-300','3B-1/20K');a[5]=left('NAV DATA','ACTIVE');a[6]=left('DEMO ONLY','TRAINER');a[13]=left('<INDEX','POS INIT>');
 }else if(p==='POS_INIT'){
 a[0]=left('POS INIT','1/2');a[2]=left('LAST POS','');a[3]=left('N 00 00.0','');a[5]=left('REF AIRPORT','');a[6]=left(v('POS'),'');a[8]=left('SET IRS POS','');a[9]=left('TRAINING ONLY','');a[13]=left('<INDEX','RTE>');
 }else if(p==='LEGS'){
 a[0]=left(mode+' RTE LEGS','1/1');a[2]=left(v('WPT1'),'');a[3]=left('TRACK ---','ALT ---');a[4]=left(v('WPT2'),'');a[5]=left('TRACK ---','ALT ---');a[7]=left('LATERAL OFFSET','');a[8]=left(v('OFFSET')||'OFF','');a[13]=left('<RTE','PROG>');
 }else if(p==='HOLD'){
 a[0]=left('RTE HOLD','1/1');a[2]=left('HOLD AT','');a[3]='ENTER FIX';a[5]=left('INBD CRS/DIR','LEG TIME');a[6]=left('---','1.0MIN');a[13]=left('<LEGS','');
 }else if(p==='PROG'){
 a[0]=left('PROGRESS','1/1');a[2]=left('TO','ETA/FUEL');a[3]=left(v('DEST'),'----Z/---.-');a[5]=left('GPS','IRS');a[6]=left('TRAINER','VIRTUAL');a[13]=left('<LEGS','');
 }else if(p==='CLB'||p==='DES'){
 a[0]=left(mode+' ECON '+p,'1/1');a[2]=left('ECON SPD','CRZ ALT');a[3]=left('280/.74',v('CRZ_ALT'));a[5]=left('SPEED/ALT','RESTR');a[6]=left('---/---','NONE');a[13]=left('<INDEX','');
 }else if(p==='DEP_ARR'){
 a[0]=left('DEP/ARR INDEX','1/1');a[2]=left(v('ORIGIN')+' DEP',v('DEST')+' ARR');a[6]=left('DATABASE','DEMO ONLY');a[13]=left('<RTE','');
 }else if(p==='FIX'){
 a[0]=left('FIX INFO','1/1');a[2]=left('FIX','RAD/DIS');a[3]=left(v('WPT1'),'---/---');a[13]=left('<LEGS','');
 }else if(p==='N1_LIMIT'){
 const n=epfsiN1();
 a[0]=left('N1 LIMIT','1/1');
 a[2]=left('TO N1','ENGINE');
 a[3]=left(v('N1')?v('N1')+'% MAN':n.display,'3B-1 / 20K');
 a[4]=left('PMC','AFM PAGE');
 a[5]=left(sim.n1.pmcMode,n.source?'PDF '+n.source.pdfPage:'---');
 a[7]=left('AFM AUTO N1','---.-');
 a[8]=left('SOURCE','NOT VERIFIED');
 a[10]=left('MANUAL N1','TRAINING ONLY');
 a[13]=left('<INDEX','TAKEOFF>');
 }else if(p==='TAKEOFF'){
 a[0]=left('TAKEOFF REF','1/1');a[2]=left('FLAPS','V1');a[3]=left('5','---');a[4]=left('VR','V2');a[5]=left('---','---');a[7]=left('RUNWAY','N1 REF');a[8]=left('---',v('N1')?v('N1')+' MAN':'---.-');a[10]=left('AFM N1','NOT VERIFIED');a[13]=left('<INDEX','');
 }else if(p==='PERF_INIT'){
 a[0]=left('PERF INIT','1/1');a[2]=left('GR WT','FUEL');a[3]=left('---.-','---.-');a[4]=left('COST INDEX','CRZ ALT');a[5]=left(v('CI'),v('CRZ_ALT'));a[13]=left('<INDEX','N1 LIMIT>');
 }else{a[0]=left(p,'1/1');a[13]=left('<INDEX','');}
 a[13]=a[13]||left('<INDEX','');
 return a;
}
function setMessage(message){sim.message=message;render()}
function writeScratch(t){if(sim.scratch==='DELETE')sim.scratch='';if(sim.scratch.length<28)sim.scratch+=t;sim.message='';render()}
function pressClr(all=false){if(sim.message){sim.message='';sim.scratch=''}else if(all){sim.scratch=''}else{sim.scratch=sim.scratch.slice(0,-1)}render()}
function validate(field,value){if(field==='ORIGIN'||field==='DEST'||field==='POS')return /^[A-Z]{4}$/.test(value);if(field==='CI')return /^\d{1,3}$/.test(value);if(field==='CRZ_ALT')return /^(FL\d{2,3}|\d{3,5})$/.test(value);if(field==='CRZ_SPEED')return /^\.?\d{2,3}$/.test(value);if(field==='N1')return /^\d{1,3}(\.\d)?$/.test(value)&&Number(value)>=0&&Number(value)<=106;if(field==='OFFSET')return /^(L|R)\d{1,2}(\.\d)?$/.test(value);if(field==='WPT1'||field==='WPT2')return /^[A-Z0-9]{2,7}$/.test(value);return value.length>0}
function assignField(field){let s=sim.scratch.trim().toUpperCase();if(!s){setMessage('INVALID ENTRY');return}if(s==='DELETE'){sim.pending[field]='';sim.scratch='';sim.message='';render();return}if(!validate(field,s)){setMessage('INVALID ENTRY');return}if(s===String(sim.active[field]??'').toUpperCase())delete sim.pending[field];else sim.pending[field]=s;sim.scratch='';sim.message='';render()}
function setPage(page){sim.page=page;sim.message='';render()}
function lsk(k){const p=sim.page;let x=null;if(p==='RTE'){x={'L1':'ORIGIN','R1':'DEST','R2':'FLIGHT'}[k];if(k==='R6')return setPage('LEGS');if(k==='L6')return setPage('INDEX')}else if(p==='LEGS'){x={'L1':'WPT1','L2':'WPT2','L4':'OFFSET'}[k];if(k==='L6')return setPage('RTE');if(k==='R6')return setPage('PROG')}else if(p==='CRZ'){x={'L2':'CRZ_SPEED','L1':'CRZ_ALT'}[k];if(k==='L6')return setPage('RTE')}else if(p==='POS_INIT'){x={'L3':'POS'}[k];if(k==='L6')return setPage('INDEX');if(k==='R6')return setPage('RTE')}else if(p==='PERF_INIT'){x={'L3':'CI','R3':'CRZ_ALT'}[k]}else if(p==='N1_LIMIT'){x={'L1':'N1'}[k]}else if(p==='FIX'){x={'L1':'WPT1'}[k]}
 if(x){assignField(x);return}
 const links={INDEX:{L1:'IDENT',R1:'POS_INIT',L2:'RTE',R2:'PERF_INIT',L3:'TAKEOFF',R3:'N1_LIMIT',L6:'MENU'},IDENT:{L6:'INDEX',R6:'POS_INIT'},MENU:{L1:'INDEX',L6:'INDEX'},PROG:{L6:'LEGS'},HOLD:{L6:'LEGS'},DEP_ARR:{L6:'RTE'},CLB:{L6:'INDEX'},DES:{L6:'INDEX'},TAKEOFF:{L6:'INDEX'},N1_LIMIT:{L6:'INDEX',R6:'TAKEOFF'},PERF_INIT:{L6:'INDEX',R6:'N1_LIMIT'}};
 if(links[p]?.[k]){setPage(links[p][k]);return}setMessage('KEY INACTIVE')
}
function press(key){sim.last=key;LOG.push({key,time:Date.now()});if(LOG.length>100)LOG.shift();const k=key.replace('CDU_CAPT_','');
 if(k.startsWith('LSK_')){lsk(k.slice(4));return}
 if(k==='EXEC'){if(pendingCount()){Object.assign(sim.active,sim.pending);sim.pending={};sim.message=''}else sim.message='NO MODIFICATION';render();return}
 if(k==='DIM_BRT'){sim.brightness=sim.brightness>=1?.4:Math.min(1,Number((sim.brightness+.15).toFixed(2)));render();return}
 if(k==='KEY_CLR'){pressClr();return}
 if(k==='KEY_DEL'){sim.scratch='DELETE';sim.message='';render();return}
 if(k.startsWith('KEY_')){let c=k.slice(4);if(c==='DOT')c='.';if(c==='PLUS_MINUS'){c=sim.scratch.startsWith('-')?'+':'-';if(sim.scratch.startsWith('-')||sim.scratch.startsWith('+'))sim.scratch=sim.scratch.slice(1);sim.scratch=c+sim.scratch;render();return}if(c==='SLASH')c='/';if(c==='SP')c=' ';writeScratch(c);return}
 const pages={INIT_REF:'INDEX',RTE:'RTE',CLB:'CLB',CRZ:'CRZ',DES:'DES',MENU:'MENU',LEGS:'LEGS',DEP_ARR:'DEP_ARR',HOLD:'HOLD',PROG:'PROG',N1_LIMIT:'N1_LIMIT',FIX:'FIX'};
 if(pages[k]){setPage(pages[k]);return}
 if(k==='PREV_PAGE'||k==='NEXT_PAGE'){if(sim.page==='RTE'){sim.subpage=sim.subpage===1?2:1;setMessage('PAGE 2 NOT IN DEMO')}else setMessage('END OF PAGES');return}
}
function makeControls(map){
 const target=$('clickmap');
 for(const c of map.controls){
  const el=document.createElement('button');el.type='button';el.className='hotspot '+c.shape;
  let [x1,y1,x2,y2]=c.bbox_px;
  Object.assign(el.style,{left:x1/1199*100+'%',top:y1/1312*100+'%',width:(x2-x1)/1199*100+'%',height:(y2-y1)/1312*100+'%'});
  el.dataset.short=c.label;el.title=c.label+' — '+c.id;el.setAttribute('aria-label',c.label);
  el.addEventListener('click',()=>press(c.id));
  let longTimer,wasLong=false;
  if(c.id.endsWith('KEY_CLR')){
   el.addEventListener('pointerdown',()=>{wasLong=false;longTimer=setTimeout(()=>{wasLong=true;pressClr(true)},750)});
   el.addEventListener('pointerup',()=>clearTimeout(longTimer));
   el.addEventListener('pointercancel',()=>clearTimeout(longTimer));
   el.addEventListener('click',e=>{if(wasLong)e.stopImmediatePropagation()},true);
  }
  el.addEventListener('focus',()=>{$('selected-code').textContent=JSON.stringify(c,null,2)});
  target.appendChild(el);byId[c.id]=el;
 }
 const outer=$('annunciators');
 for(const a of map.outputs){
  const el=document.createElement('div');el.id=a.id;
  el.className='annunciator '+a.color+(a.label==='EXEC'?' exec':'');
  const [x1,y1,x2,y2]=a.sprite_bbox_px;
  Object.assign(el.style,{left:x1/1199*100+'%',top:y1/1312*100+'%',width:(x2-x1)/1199*100+'%',height:(y2-y1)/1312*100+'%'});
  if(a.illuminated_sprite){const mask=document.createElement('img');mask.src=a.illuminated_sprite;mask.alt='';mask.draggable=false;mask.className='light-glyph';el.appendChild(mask)}
  outer.appendChild(el);byId[a.id]=el;
 }
}
function render(){let output=pageLines();if(sim.message)output[12]=sim.message;else if(sim.scratch)output[12]=sim.scratch.slice(0,24);let wrap=$('fmc-lines');wrap.textContent='';for(let i=0;i<14;i++){let row=document.createElement('div');row.className='fmc-line'+(i===12&&sim.message?' error':'');if(i===0){
  const m=/^(.*?)\s+(\d+\/\d+)\s*$/.exec(output[0]||'');
  if(m){row.className+=' fmc-header';const title=document.createElement('span');title.className='page-title';title.textContent=m[1].trim();const count=document.createElement('span');count.className='page-count';count.textContent=m[2];row.appendChild(title);row.appendChild(count)}
  else row.textContent=output[i]||' ';
 }else row.textContent=output[i]||' ';
 wrap.appendChild(row)}$('fmc-screen').style.opacity=1; $('fmc-lines').style.opacity=sim.brightness;
 const states={CALL:sim.call,FAIL:sim.fail,MSG:!!sim.message,OFST:sim.offset,EXEC:pendingCount()>0};for(const [key,on] of Object.entries(states)){const el=byId['CDU_CAPT_'+key+'_LIGHT'];if(el)el.classList.toggle('on',on)}
 $('page-now').textContent=sim.page;$('scratch-now').textContent=sim.message||sim.scratch||'—';$('pending-now').textContent=pendingCount();$('key-now').textContent=sim.last.replace('CDU_CAPT_','');}
function initializeN1Inputs(){
 const fields={ 'n1-pmc-mode':'pmcMode','n1-phase':'phase','n1-pressure-alt':'pressureAltitudeFt','n1-oat':'oatC','n1-tat':'tatC','n1-mach':'mach','n1-ias':'iasKts','n1-bleed':'bleedMode','n1-anti-ice':'antiIceMode'};
 for(const [id,k] of Object.entries(fields)){
  const el=document.getElementById(id);if(!el)continue;
  el.addEventListener('change',()=>{
   const raw=String(el.value??'').trim();
   sim.n1[k]=['pressureAltitudeFt','oatC','tatC','mach','iasKts'].includes(k)?(raw===''?null:Number(raw)):(raw===''?null:raw);
   render();
  });
 }
}
async function boot(){let map=window.CDU_MAP;if(!map)throw Error('CDU map not found');makeControls(map);initializeN1Inputs();render();$('reset').onclick=()=>{sim.page='CRZ';sim.scratch='';sim.message='';sim.pending={};sim.call=sim.fail=sim.offset=false;sim.brightness=1;sim.last='—';for(const id of ['call-test','fault-test','offset-test'])$(id).checked=false;render()};$('overlay-toggle').onclick=()=>{$('cdu-stage').classList.toggle('debug')};$('info-toggle').onclick=()=>{$('qa').hidden=!$('qa').hidden};for(const [id,key] of [['call-test','call'],['fault-test','fail'],['offset-test','offset']])$(id).addEventListener('change',e=>{sim[key]=e.target.checked;render()});$('test-message').onclick=()=>setMessage('CHECK FMC DATA');document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;let id=null;if(e.key==='Backspace')id='KEY_CLR';else if(e.key==='Enter')id='EXEC';else if(e.key===' ')id='KEY_SP';else if(e.key==='.')id='KEY_DOT';else if(e.key==='/')id='KEY_SLASH';else if(/^[a-z0-9]$/i.test(e.key))id='KEY_'+e.key.toUpperCase();if(id){e.preventDefault();press('CDU_CAPT_'+id)}})}
boot().catch(e=>{console.error(e);$('page-now').textContent='Data load failed — unzip ALL files and open using local server or Chromium with local file access';});
// Read-only integration test bridge. Does not alter CDU inputs, EXEC or navigation laws.
window.CDU_TEST_BRIDGE=Object.freeze({snapshot:()=>({page:sim.page,active:{...sim.active},pending:{...sim.pending},pendingCount:pendingCount(),message:sim.message,scratch:sim.scratch,lastKey:sim.last})});
