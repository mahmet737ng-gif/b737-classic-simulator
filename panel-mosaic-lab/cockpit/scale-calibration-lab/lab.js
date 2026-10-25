(async function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const q = name => document.querySelector('input[name="'+name+'"]:checked');
  const engine = window.B737GaugeScaleEngineV2;
  if (!engine) { $('status').textContent='ERROR: missing scale engine'; return; }
  const data = await fetch('../../../engine/instruments/gauge-survey-stage2-3.json')
    .then(r=>{if(!r.ok)throw Error('Registry HTTP '+r.status);return r.json();})
    .catch(error=>{ $('status').textContent=error.message; return null; });
  if(!data)return;
  const faces = data.faces, faceMap=new Map(faces.map(f=>[f.id,f]));
  const storageKey='b737-gauge-survey-stage2-4-v1';
  let drafts={};
  try {drafts=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};} catch {drafts={};}
  let current=null, mode='primary', zoom=1, target=null;
  const stateKey=()=>current.id+'::'+mode;
  const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(drafts));}catch{}};
  const fresh=()=>({
    kind:current.kind==='linear_indicator'?'linear':'rotary',
    source:current.source, sourceSha256:current.sourceSha256,
    pivot:current.pivot?{x:current.pivot.x,y:current.pivot.y}:null,
    pivotEvidence:current.pivot?'legacy_visual_placement_not_measured':null,
    direction:'clockwise',unit:current.legacyAngularPreview?.unit||'',
    marks:[],status:'draft_unverified',updated:null
  });
  const draft=()=>drafts[stateKey()]||(drafts[stateKey()]=fresh());
  const txt=(msg,error=false)=>{ $('status').textContent=msg;$('status').className=error?'warn':'ok';};
  const escapeXml = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const svg=(name,attrs={})=>{
    const el=document.createElementNS('http://www.w3.org/2000/svg',name);
    for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
    $('marksOverlay').appendChild(el);return el;
  };
  function paint(){
    if(!current)return;
    const d=draft(), overlay=$('marksOverlay');
    overlay.replaceChildren();
    if(d.pivot){
      svg('circle',{cx:d.pivot.x,cy:d.pivot.y,r:8,stroke:'#03d5ee','stroke-width':2.5,fill:'none'});
      svg('path',{d:'M '+(d.pivot.x-12)+' '+d.pivot.y+' h 24 M '+d.pivot.x+' '+(d.pivot.y-12)+' v 24',
        stroke:'#03d5ee','stroke-width':2});
    }
    for(const p of d.marks){
      svg('circle',{cx:p.x,cy:p.y,r:p.major?6:4,stroke:'#000','stroke-width':1,fill:p.major?'#ffcf64':'#ef8fa6'});
      const t=svg('text',{x:p.x+9,y:p.y-7,fill:'#fff',stroke:'#06111b','stroke-width':2.2,
        'paint-order':'stroke','font-size':Math.max(12,$('sourceImage').naturalWidth/120),
        'font-weight':'bold'});t.textContent=(p.label||String(p.value));
    }
    if(target){
      if(target.position&&d.pivot&&target.angleDeg!==null){
        const r=d.marks.length ? Math.max(24, d.marks.reduce((s,p)=>s+Math.hypot(p.x-d.pivot.x,p.y-d.pivot.y),0)/d.marks.length*0.82):80;
        const a=target.angleDeg*Math.PI/180;
        svg('line',{x1:d.pivot.x,y1:d.pivot.y,x2:d.pivot.x+r*Math.sin(a),y2:d.pivot.y-r*Math.cos(a),
          stroke:'#7aff96','stroke-width':3});
      } else if(target.position){
        svg('circle',{cx:target.position.x,cy:target.position.y,r:8,fill:'#7aff96'});
      }
    }
    $('marks').textContent=d.marks.length
      ? d.marks.slice().sort((a,b)=>a.value-b.value).map(m=>
        m.value+' → ('+m.x.toFixed(1)+', '+m.y.toFixed(1)+') '+(m.major?'major':'minor')).join('\n')
      : 'هیچ خطی روی تصویر منبع ثبت نشده است.';
  }
  function zoomToFit(){
    const img=$('sourceImage');if(!img.naturalWidth)return;
    const viewport=$('work');
    zoom=Math.min(1,(viewport.clientWidth-50)/img.naturalWidth,(viewport.clientHeight-50)/img.naturalHeight);
    zoom=Math.max(.05,zoom);
    resize();
  }
  function resize(){
    let img=$('sourceImage'), w=img.naturalWidth||current.imageWidth||600,
      h=img.naturalHeight||current.imageHeight||600;
    $('holder').style.width=w*zoom+'px';
    $('holder').style.height=h*zoom+'px';
    $('marksOverlay').setAttribute('viewBox','0 0 '+w+' '+h);
    $('marksOverlay').setAttribute('preserveAspectRatio','none');
    paint();
  }
  function mount(){
    current=faceMap.get($('face').value);if(!current)return;
    mode=current.scales.find(s=>s.mode===$('scale').value)?.mode||current.scales[0].mode;
    const d=draft();target=null;
    $('kind').value=d.kind; $('direction').value=d.direction;$('unit').value=d.unit;
    $('note').textContent=[
      current.id,'Panel: '+current.panel,
      'Source: '+current.source,
      'Legacy pivot: '+(current.pivot?'available; needs visual verification':'NOT FOUND'),
      'Source SHA-256: '+(current.sourceSha256||'not yet recorded'),
      'Scale labels: '+(current.scales.find(s=>s.mode===mode)?.labelCandidates||[]).join(' | '),
      'Measured ticks: '+d.marks.length,
      'STATE: Draft only. Never treated as a verified aircraft reading.'
    ].join('\n');
    const img=$('sourceImage');img.onload=()=>{ 
      if(current.imageWidth&&img.naturalWidth!==current.imageWidth)
        txt('SOURCE DIMENSION MISMATCH: registry '+current.imageWidth+' vs actual '+img.naturalWidth,true);
      else txt('Original source ready. Pick pivot and then add EVERY printed tick.');
      zoomToFit();
    };
    img.onerror=()=>txt('Unable to load original: '+current.source,true);
    img.src='../../../'+current.source; paint();
  }
  function setFace(){
    current=faceMap.get($('face').value);
    const select=$('scale');select.replaceChildren();
    current.scales.forEach(s=>select.add(new Option(s.mode,s.mode)));
    mount();
  }
  for(const f of faces){
    const o=new Option(f.panel+' · '+f.id, f.id);
    $('face').add(o);
  }
  $('face').addEventListener('change',setFace);
  $('scale').addEventListener('change',mount);
  $('kind').addEventListener('change',()=>{draft().kind=$('kind').value;save();paint();});
  $('direction').addEventListener('change',()=>{draft().direction=$('direction').value;save();});
  $('unit').addEventListener('change',()=>{draft().unit=$('unit').value;save();});
  $('marksOverlay').addEventListener('click',e=>{
    if(!current)return;
    const img=$('sourceImage');const r=$('marksOverlay').getBoundingClientRect();
    const x=(e.clientX-r.left)*img.naturalWidth/r.width;
    const y=(e.clientY-r.top)*img.naturalHeight/r.height;
    if(!Number.isFinite(x+y)||x<0||y<0||x>=img.naturalWidth||y>=img.naturalHeight)return;
    const d=draft(),p={x:Math.round(x*100)/100,y:Math.round(y*100)/100};
    if(q('action')?.value==='pivot'){
      d.pivot=p;d.pivotEvidence='clicked_on_native_source';target=null;
    }else{
      const input=$('value').value.trim();
      if(!input){txt('Enter the numeric value of the printed tick before clicking',true);return;}
      const value=Number(input);if(!Number.isFinite(value)){txt('Invalid numeric value',true);return;}
      const tick={...p,value,label:$('labelText').value.trim()||null,major:$('major').checked,
        evidence:'measured_source_pixels'};
      d.marks=d.marks.filter(m=>m.value!==value);
      d.marks.push(tick);d.marks.sort((a,b)=>a.value-b.value);
      $('value').value='';$('labelText').value='';
    }
    d.updated=new Date().toISOString();save();paint();
    txt('Saved draft point at x='+p.x+', y='+p.y+' source pixels.');
  });
  $('work').addEventListener('wheel',e=>{
    if(!e.ctrlKey&&!e.altKey)return;
    e.preventDefault();zoom=Math.max(.05,Math.min(4,zoom*(e.deltaY<0?1.15:.87)));resize();
  },{passive:false});
  $('deleteLast').onclick=()=>{
    const d=draft();d.marks.pop();target=null;save();paint();txt('Last mark removed');
  };
  $('clearScale').onclick=()=>{
    if(!confirm('Clear all marks/pivot for '+stateKey()+'?'))return;
    drafts[stateKey()]=fresh();target=null;save();mount();
  };
  function compileCurrent(){
    const d=draft(), marks=d.marks.slice().sort((a,b)=>a.value-b.value);
    if(!d.sourceSha256)throw Error('Source hash missing: cannot pass verification');
    return engine.compile({
      id:current.id+'::'+mode,kind:d.kind,unit:d.unit,source:{
        asset:d.source,sha256:d.sourceSha256,width:$('sourceImage').naturalWidth,height:$('sourceImage').naturalHeight
      },pivot:d.pivot, direction:d.direction, marks,
      min:marks[0]?.value,max:marks.at(-1)?.value,status:'draft'
    });
  }
  $('preview').onclick=()=>{
    try{
      const vtext=$('reading').value.trim();if(!vtext)throw Error('Enter a numerical engine reading');
      const value=Number(vtext), scale=compileCurrent();
      target=scale.locate(value);paint();
      txt('DRAFT PREVIEW ONLY\nValue: '+value+' '+scale.unit+'\nAngle: '+
       (target.angleDeg===null?'linear':target.angleDeg.toFixed(4)+' deg')+
       '\nBetween: '+target.bracket.join(' to ')+
       '\nResult: '+target.status);
    }catch(e){target=null;paint();txt('CANNOT PREVIEW: '+e.message,true);}
  };
  $('qa').onclick=()=>{
    try{
      const scale=compileCurrent();
      let max=0;
      for(const m of scale.marks){
        const actual=scale.locate(m.value);
        const error=scale.kind==='rotary'
          ?Math.abs(actual.angleDeg-m.angle)
          :Math.hypot(actual.position.x-m.x,actual.position.y-m.y);
        max=Math.max(max,error);
      }
      txt('SELF-CONSISTENCY QA: '+scale.marks.length+
        ' registered marks | max deviation '+max.toExponential(2)+
        '\nPASS mathematical interpolation only. Physical image alignment still needs review.');
    }catch(e){txt('QA BLOCKED: '+e.message,true);}
  };
  $('export').onclick=()=>{
    const payload={schema:'b737.gauge-native-pixel-drafts.v1',
      status:'UNVERIFIED_DO_NOT_PUBLISH',base:'gauge-survey-stage2-3.json',
      savedAt:new Date().toISOString(),drafts};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],
      {type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='b737-gauge-drafts.json';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('importButton').onclick=()=>$('import').click();
  $('import').onchange=async e=>{
    try{
      const f=e.target.files?.[0];if(!f)return;
      const obj=JSON.parse(await f.text());
      if(obj.schema!=='b737.gauge-native-pixel-drafts.v1'||typeof obj.drafts!=='object')
        throw Error('Invalid draft schema');
      let n=0;
      for(const [key,value]of Object.entries(obj.drafts)){
        const id=key.split('::')[0];
        if(!faceMap.has(id)||!Array.isArray(value.marks))continue;
        // Imported data are always drafts, regardless of the input's assertions.
        drafts[key]={...value,status:'draft_unverified'};
        n++;
      }
      save();mount();txt('Imported '+n+' UNVERIFIED gauge scale drafts.');
    }catch(e){txt('Import rejected: '+e.message,true);}
    e.target.value='';
  };
  $('count').textContent=faces.length+' faces · 3 unresolved · STAGE 2–4 DRAFT';
  setFace();
})().catch(error=>{console.error(error);document.getElementById('status').textContent=error.message;});