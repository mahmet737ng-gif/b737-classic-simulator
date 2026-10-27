/* IRS/ISDU FRONTEND ONLY — reference-driven, no avionics backend.
   Model variants from owner's FCOM: Honeywell and Litton. Visual construction
   is an original scalable UI; it does NOT redistribute the copyrighted
   FCOM figure or claim pixel equivalence to proprietary source art.
   Owner18 guards and final overhead mosaic are strictly untouched. */
(function () {
  'use strict';
  function build() {
    if (document.getElementById('irsIsduOpen')) return;
    const toolbar = document.querySelector('.workbench .toolbar .tools:last-child');
    if (!toolbar) return;
    const open = document.createElement('button');
    open.id = 'irsIsduOpen'; open.type = 'button';
    open.className = 'irs-isdu-open';
    open.textContent = 'IRS · ISDU';
    open.setAttribute('aria-haspopup','dialog');
    open.setAttribute('aria-controls','irsIsduDialog');
    toolbar.append(open);
    const dlg = document.createElement('dialog');
    dlg.id = 'irsIsduDialog';
    dlg.className = 'irs-isdu-dialog';
    dlg.setAttribute('aria-labelledby','irsIsduTitle');
    dlg.innerHTML = `
      <div class="irs-isdu-head" dir="ltr"><div>
        <h2 id="irsIsduTitle">IRS DISPLAY UNIT · FRONTEND</h2>
        <small>737 Classic · 90° front view · visual-only preview</small>
      </div><button class="irs-isdu-close" type="button" aria-label="Close IRS display">×</button></div>
      <div class="irs-isdu-tabs" role="group" aria-label="ISDU equipment variant" dir="ltr">
        <button type="button" data-isdu-variant="honeywell" aria-pressed="true">Honeywell</button>
        <button type="button" data-isdu-variant="litton" aria-pressed="false">Litton · draft</button>
      </div>
      <div class="irs-isdu-unit" data-isdu-unit="honeywell" dir="ltr">
        <div class="irs-isdu-top-label">IRS DISPLAY</div>
        <div class="irs-isdu-readouts" aria-label="Inertial system LCD display">
          <span class="irs-isdu-lcd" aria-label="left window">N4732.4</span><span class="irs-isdu-lcd" aria-label="right window">W12218.6</span>
        </div>
        <div class="irs-isdu-lower">
          <div class="irs-isdu-selectors">
            <label class="irs-isdu-control">DSPL SEL
              <select class="irs-isdu-select" aria-label="ISDU display selector">
                <option>PPOS</option><option>TK/GS</option><option>WIND</option><option>HDG/STS</option><option>TEST</option>
              </select></label>
            <label class="irs-isdu-control">BRT
              <input class="irs-isdu-brightness" type="range" min="10" max="100" value="82" aria-label="ISDU display brightness" /></label>
            <label class="irs-isdu-control">SYS DSPL
              <select class="irs-isdu-system" aria-label="Displayed IRS">
                <option>L</option><option>R</option>
              </select></label>
          </div>
          <div class="irs-isdu-keypad" role="group" aria-label="ISDU keyboard"></div>
        </div>
        <div class="irs-isdu-unit-footer">ISDU · AFT OVERHEAD</div>
      </div>
      <p class="irs-isdu-disclaimer" dir="rtl">این مرحله فقط نمایش ظاهری و واکنش بصری کلیدهاست. هیچ مختصات یا فرمانی هنوز به موتور IRS، FMC یا برق ارسال نمی‌شود. چیدمان اورهد و ۱۸ سوئیچ محافظ‌دار قفل‌شده بدون تغییر باقی می‌مانند.</p>
      <div class="irs-isdu-key-status" role="status" dir="ltr">VISUAL PREVIEW · NO IRS BACKEND</div>`;
    document.body.append(dlg);
    const unit=dlg.querySelector('.irs-isdu-unit');
    const pad=dlg.querySelector('.irs-isdu-keypad');
    const status=dlg.querySelector('.irs-isdu-key-status');
    const valueSets={
      honeywell:[['1',''],['2','N'],['3',''],['4','W'],['5','H'],['6','E'],['7',''],['8','S'],['9',''],['ENT',''],['0',''],['CLR','']],
      litton:[['1','N'],['2',''],['3',''],['4','W'],['5',''],['6','E'],['7',''],['8','S'],['9',''],['ENT',''],['0',''],['CLR','']]
    };
    function renderPad(kind) {
      pad.replaceChildren();
      pad.classList.toggle('irs-isdu-source',kind==='honeywell');
      pad.title=kind==='honeywell'?'FCOM source-image keypad; click targets are visually transparent':'Litton: source-informed provisional frontend geometry';
      for (const [val,compass] of valueSets[kind]) {
        const key=document.createElement('button');
        key.type='button'; key.className='irs-isdu-key';
        key.dataset.key=val; key.setAttribute('aria-label',compass?compass+' '+val:val);
        if(compass){const hint=document.createElement('span');hint.className='irs-isdu-compass';hint.textContent=compass;key.append(hint);}
        const main=document.createElement('span');main.textContent=val;key.append(main);
        key.addEventListener('click',()=>{
          status.textContent='KEY '+val+' · VISUAL ONLY';
          pad.querySelectorAll('.is-pressed').forEach(x=>x.classList.remove('is-pressed'));
          key.classList.add('is-pressed');
        });
        pad.append(key);
      }
    }
    function selectVariant(kind) {
      if(!valueSets[kind]) return;
      unit.dataset.isduUnit=kind;
      dlg.querySelectorAll('[data-isdu-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.isduVariant===kind)));
      status.textContent=kind==='honeywell'?'HONEYWELL · FCOM SOURCE KEYPAD · UI ONLY':'LITTON · DRAWN PLACEHOLDER · SOURCE IMAGE PENDING';
      renderPad(kind);
    }
    dlg.querySelectorAll('[data-isdu-variant]').forEach(btn=>btn.addEventListener('click',()=>selectVariant(btn.dataset.isduVariant)));
    dlg.querySelector('.irs-isdu-close').addEventListener('click',()=>dlg.close());
    open.addEventListener('click',()=>dlg.showModal());
    dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
    dlg.querySelector('.irs-isdu-brightness').addEventListener('input',e=>{
      unit.style.setProperty('--isdu-brightness',String(Number(e.target.value)/100));
    });
    dlg.querySelector('.irs-isdu-select').addEventListener('change',e=>{status.textContent='DSPL '+e.target.value+' · VISUAL ONLY';});
    dlg.querySelector('.irs-isdu-system').addEventListener('change',e=>{status.textContent='SYS '+e.target.value+' · VISUAL ONLY';});
    selectVariant('honeywell');
    window.B737IRSISDUFrontend=Object.freeze({open:()=>dlg.showModal(),element:dlg,selectVariant});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true}); else build();
})();