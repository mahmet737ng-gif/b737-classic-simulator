/* IRS-ISDU-CUE-0001 · Frontend-only white cues, without backend integration.
 * Each of the TWO lens apertures in ENT and CLR retains its original OFF photo;
 * a discrete photometric-white asset is rendered ONLY in the ON state.
 * Protected OH01-OH25 mosaic and all OWNER18 switches remain unmodified.
 */
(function(root){
  'use strict';
  const KEYS=Object.freeze(['ENT','CLR']);
  const SIDES=Object.freeze(['left','right']);
  const state={ENT:[false,false],CLR:[false,false]};
  let panel=null;
  function validate(key){if(!KEYS.includes(key))throw new RangeError('Unknown ISDU cue '+key);}
  function validSide(side){
    if(side===0||side==='left')return 0;
    if(side===1||side==='right')return 1;
    throw new RangeError('Unknown ISDU cue aperture '+side);
  }
  function keyButton(key){
    return document.querySelector('#irsKeypadMounted .irs-photo-key[data-isdu-key="'+key+'"]');
  }
  function mountLenses(){
    if(!KEYS.every(k=>!!keyButton(k)))return false;
    for(const key of KEYS){
      const button=keyButton(key);
      for(let i=0;i<2;i++){
        const side=SIDES[i];
        let lens=button.querySelector('.irs-cue-lens[data-side="'+side+'"]');
        if(!lens){
          lens=document.createElement('span');
          lens.className='irs-cue-lens';
          lens.dataset.side=side;
          lens.setAttribute('aria-hidden','true');
          button.append(lens);
        }
        lens.dataset.lit=String(state[key][i]);
      }
      button.dataset.cueLeft=String(state[key][0]);
      button.dataset.cueRight=String(state[key][1]);
    }
    return true;
  }
  function snapshot(){return {ENT:[...state.ENT],CLR:[...state.CLR],frontendOnly:true};}
  function render(){
    mountLenses();
    if(!panel||!panel.isConnected)return;
    for(const key of KEYS){
      for(let i=0;i<2;i++){
        const b=panel.querySelector('[data-irs-cue-key="'+key+'"][data-irs-cue-index="'+i+'"]');
        if(b){
          b.setAttribute('aria-pressed',String(state[key][i]));
          b.textContent=(i===0?'چپ':'راست')+(state[key][i]?' · ON':' · OFF');
        }
      }
    }
    const n=state.ENT.filter(Boolean).length+state.CLR.filter(Boolean).length;
    const status=panel.querySelector('#irsCueTestStatus');
    if(status)status.textContent='WHITE CUES '+n+'/4 ON · VISUAL ONLY';
  }
  function notify(){
    root.dispatchEvent(new CustomEvent('b737:irs-cue-visual-change',{detail:snapshot()}));
  }
  function setCueLamp(key,side,lit){
    validate(key);
    const index=validSide(side);
    if(typeof lit!=='boolean')throw new TypeError('ISDU cue state must be boolean');
    state[key][index]=lit;
    render();notify();
    return snapshot();
  }
  function setCue(key,lit){
    validate(key);
    if(typeof lit!=='boolean')throw new TypeError('ISDU cue state must be boolean');
    state[key][0]=lit;
    state[key][1]=lit;
    render();notify();
    return snapshot();
  }
  function setAll(lit){
    if(typeof lit!=='boolean')throw new TypeError('ISDU cue state must be boolean');
    for(const key of KEYS){state[key][0]=lit;state[key][1]=lit;}
    render();notify();
    return snapshot();
  }
  function makeTestPanel(){
    const inspector=document.getElementById('inspector');
    if(!inspector)return;
    if(document.getElementById('irsCueTestPanel')){
      panel=document.getElementById('irsCueTestPanel');return;
    }
    panel=document.createElement('section');
    panel.id='irsCueTestPanel';
    panel.setAttribute('aria-label','IRS ISDU cue light test controls');
    const heading=document.createElement('h2');
    heading.textContent='IRS · تست چراغ‌های ENT / CLR';
    panel.append(heading);
    const note=document.createElement('p');
    note.textContent='هر کلید دو چراغ سفید مستقل دارد. فقط تست ظاهری است؛ اتصال واقعی به IRS بعداً انجام می‌شود.';
    panel.append(note);
    for(const key of KEYS){
      const row=document.createElement('div');
      row.className='irs-cue-pair';
      const label=document.createElement('b');
      label.className='irs-cue-name';label.textContent=key;
      row.append(label);
      for(let i=0;i<2;i++){
        const btn=document.createElement('button');
        btn.type='button';
        btn.dataset.irsCueKey=key;
        btn.dataset.irsCueIndex=String(i);
        btn.setAttribute('aria-label',key+' '+(i===0?'left':'right')+' cue lamp');
        btn.addEventListener('click',()=>setCueLamp(key,i,!state[key][i]));
        row.append(btn);
      }
      panel.append(row);
    }
    const actions=document.createElement('div');
    actions.className='irs-cue-actions';
    for(const [label,act] of [
      ['ENT هر دو',()=>setCue('ENT',!state.ENT.every(Boolean))],
      ['CLR هر دو',()=>setCue('CLR',!state.CLR.every(Boolean))],
      ['همه روشن',()=>setAll(true)],
      ['همه خاموش',()=>setAll(false)]
    ]){
      const b=document.createElement('button');
      b.type='button';b.textContent=label;b.addEventListener('click',act);actions.append(b);
    }
    panel.append(actions);
    const status=document.createElement('p');
    status.id='irsCueTestStatus';
    status.setAttribute('role','status');
    panel.append(status);
    inspector.insertBefore(panel,inspector.children[1]||null);
    render();
  }
  function revealTest(){
    makeTestPanel();
    if(!panel)return;
    if(root.innerWidth<=1000&&!document.body.classList.contains('side-open')){
      document.getElementById('inspectorToggle')?.click();
    }
    panel.scrollIntoView({block:'nearest'});
  }
  function makeLauncher(){
    if(document.getElementById('irsCueTestOpen'))return;
    const nav=document.querySelector('header nav');
    if(!nav)return;
    const b=document.createElement('button');
    b.id='irsCueTestOpen';b.type='button';
    b.textContent='IRS CUES TEST';
    b.setAttribute('aria-controls','irsCueTestPanel');
    b.addEventListener('click',revealTest);
    const jump=document.getElementById('irsPanelJump');
    if(jump?.parentNode===nav)jump.insertAdjacentElement('afterend',b);
    else nav.append(b);
  }
  function boot(){
    makeTestPanel();makeLauncher();
    const observer=new MutationObserver(()=>{
      if(mountLenses()){observer.disconnect();render();}
    });
    if(!mountLenses())observer.observe(document.documentElement,{subtree:true,childList:true});
    root.addEventListener('b737:cockpit-mounted',()=>{mountLenses();render();});
    render();
  }
  root.B737ISDUCues=Object.freeze({setCueLamp,setCue,setAll,reset:()=>setAll(false),getState:snapshot,mountLenses});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})(window);
