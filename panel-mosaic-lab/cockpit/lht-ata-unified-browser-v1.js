/* LHT-ATA-UNIFIED-0001: Additive, read-only Lufthansa ATA source index.
 * Contract: maps private PDF section ranges to EXISTING Unified functional
 * region/subsystem IDs and exposes LIVE OBSERVATION of existing control states.
 * No engine input, switch movement, control law, hitbox, atlas or Red Zone edit.
 */
(function () {
  'use strict';
  const DATA = '../../engine/maps/lht-ata-unified-bindings-v1.json';
  let registry = null, dialog = null, selected = null, search = '', refreshTimer = null;
  const byId = id => document.getElementById(id);
  const element = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = String(text);
    if (cls) node.className = cls;
    return node;
  };
  const getFrame = () => {
    try {
      const frame = byId('overheadFrame');
      return frame && frame.contentWindow && frame.contentWindow.location.origin === location.origin
        ? frame.contentWindow : null;
    } catch (_) { return null; }
  };
  function liveState() {
    const child = getFrame();
    let toggles = null, rotaries = null, lamps = null;
    try { toggles = child?.B737OverheadToggles?.getState?.() || null; } catch (_) {}
    try { rotaries = child?.B737RotaryGuards?.getState?.()?.rotaries || null; } catch (_) {}
    try { lamps = child?.B737OverheadLights?.getState?.()?.lights || null; } catch (_) {}
    return { toggle: toggles, rotary: rotaries, lamp: lamps };
  }
  function observe(sectionId) {
    const section = registry?.sections.find(s => s.section_id === sectionId);
    if (!section) return [];
    const state = liveState();
    return section.control_ports.map(p => ({
      ...p,
      available: state[p.kind] != null && Object.prototype.hasOwnProperty.call(state[p.kind], p.id),
      value: state[p.kind] && Object.prototype.hasOwnProperty.call(state[p.kind], p.id)
        ? state[p.kind][p.id] : null
    }));
  }
  const allSections = () => registry?.sections || [];
  const byRegion = regionId => allSections().filter(s => s.subsystems.some(x => x.region_ids.includes(regionId)));
  const byControl = controlId => allSections().filter(s => s.control_ports.some(x => x.id === controlId));
  const find = query => {
    const q = String(query || '').trim().toLowerCase();
    return allSections().filter(s => !q || [s.section_id,s.ata,s.title,
      ...s.subsystems.map(x => x.id),...s.control_ports.map(x => x.id)]
      .some(v => String(v).toLowerCase().includes(q)));
  };
  function focusRegion(regionId) {
    const locationId = regionId.startsWith('OVERHEAD') ? 'overhead'
      : regionId.startsWith('MAIN') ? 'main'
      : regionId.startsWith('PEDESTAL') ? 'pedestal' : null;
    if (!locationId) return false;
    const button = document.querySelector('[data-focus="' + locationId + '"]');
    if (!button) return false;
    dialog?.close();
    button.click();
    return true;
  }
  function addStyle() {
    const style = element('style');
    style.id = 'lhtAtaStyles';
    style.textContent = `
      #lhtAtaDialog {position:fixed;inset:5vh 5vw;margin:auto;padding:0;border:1px solid #78899a;
        border-radius:12px;background:#13212c;color:#edf4fa;width:min(1050px,90vw);height:min(760px,90vh);
        max-width:none;max-height:none;box-shadow:0 20px 80px #0009;z-index:99999;font-family:Arial,sans-serif}
      #lhtAtaDialog::backdrop {background:rgba(0,0,0,.68)}
      #lhtAtaDialog .lht-top {display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:14px;
        border-bottom:1px solid #4b667b;background:#182d3d}
      #lhtAtaDialog .lht-top strong {margin-inline-end:auto;font-size:16px}
      #lhtAtaDialog input {flex:1;min-width:180px;background:#081722;color:white;border:1px solid #658094;
        border-radius:6px;padding:8px;font-size:14px}
      #lhtAtaDialog button {background:#25465c;border:1px solid #658094;border-radius:6px;color:white;
        cursor:pointer;padding:7px 9px}
      #lhtAtaDialog button:focus-visible {outline:3px solid #e7c875}
      #lhtAtaDialog .lht-layout {display:grid;grid-template-columns:minmax(225px,32%) minmax(0,1fr);
        height:calc(100% - 68px);min-height:0;direction:rtl}
      #lhtAtaDialog .lht-list {overflow:auto;border-left:1px solid #425f73;padding:10px}
      #lhtAtaDialog .lht-list button {display:block;width:100%;margin:0 0 7px;text-align:right}
      #lhtAtaDialog .lht-list button[aria-pressed="true"] {border-color:#e0bd63;background:#4d523e}
      #lhtAtaDialog .lht-detail {overflow:auto;padding:18px;line-height:1.7}
      #lhtAtaDialog .lht-subsystem {border-top:1px solid #4d6576;padding:8px 0}
      #lhtAtaDialog .lht-code {font:12px monospace;direction:ltr;unicode-bidi:plaintext;display:inline-block}
      #lhtAtaDialog .lht-small {font-size:12px;color:#b9cddd}
      #lhtAtaDialog .lht-status {border:1px solid #62798c;border-radius:5px;padding:2px 5px;margin:3px;
        display:inline-block;font-size:12px;direction:ltr}
      #lhtAtaDialog .lht-ports {margin-top:10px}
      #lhtAtaDialog .lht-port {display:flex;align-items:center;flex-wrap:wrap;gap:8px;
        padding:5px;border-bottom:1px dotted #546978}
      @media(max-width:650px){#lhtAtaDialog{inset:1vh 1vw;width:98vw;height:98vh}
        #lhtAtaDialog .lht-layout{grid-template-columns:1fr;grid-template-rows:33% 67%}
        #lhtAtaDialog .lht-list{border-left:0;border-bottom:1px solid #425f73}}
    `;
    document.head.append(style);
  }
  function showDetail() {
    const area = byId('lhtAtaDetail');
    if (!area || !registry) return;
    area.replaceChildren();
    const section = allSections().find(s => s.section_id === selected);
    if (!section) { area.append(element('p','یک بخش ATA انتخاب کنید.'));return; }
    area.append(element('h2','ATA ' + section.ata + ' — ' + section.title));
    area.append(element('p','صفحات PDF اصلی: ' + section.pdf_pages.start + ' تا ' + section.pdf_pages.end +
      ' (فایل خصوصی: ' + section.private_pdf_name + ')','lht-small'));
    area.append(element('p','وضعیت: تطبیق شناسه‌های موجود Unified؛ اعتبارسنجی دستورالعمل‌ها و Effectivity هنوز انجام نشده است.','lht-small'));
    area.append(element('p','محدوده مدل: ' + section.variant_scope,'lht-small'));
    if (!section.subsystems.length) area.append(element('p','برای این فصل، پنل یا زیرسیستم قابل‌اطمینانی در نقشه فعلی ثبت نشده است.'));
    for (const sub of section.subsystems) {
      const line = element('div',null,'lht-subsystem');
      line.append(element('strong',sub.id,'lht-code'));
      if (!sub.region_ids.length) line.append(element('span',' — ناحیه تصویری مشخص نشده','lht-small'));
      for (const id of sub.region_ids) {
        const btn = element('button',id,'lht-code');btn.type='button';
        btn.title='فقط نمایش بخش اصلی پنل؛ تغییر سوئیچ انجام نمی‌شود';
        btn.addEventListener('click',()=>focusRegion(id));
        line.append(btn);
      }
      area.append(line);
    }
    const ports = element('div',null,'lht-ports');
    ports.append(element('h3','شناسه کنترل‌های فعلی و وضعیت زنده (فقط خواندنی)'));
    const observations = observe(selected);
    if (!observations.length) ports.append(element('p','کنترل زنده معتبر در این بخش شناسایی نشده؛ اتصال فقط در سطح زیرسیستم است.','lht-small'));
    for (const p of observations) {
      const line = element('div',null,'lht-port');
      line.append(element('span',p.kind + ': ' + p.id,'lht-code'));
      let value;
      if (!p.available) value='داده زنده در دسترس نیست';
      else if (p.value===true) value='ON / روشن';
      else if (p.value===false) value='OFF / خاموش';
      else value=String(p.value);
      line.append(element('span',value,'lht-small'));
      ports.append(line);
    }
    area.append(ports);
    area.append(element('p','این صفحه صرفاً فهرست منبع و مشاهده حالت کنترل‌هاست؛ از متن Lufthansa قانون جدید شبیه‌سازی استخراج یا فعال نشده است.','lht-small'));
  }
  function showList() {
    const list=byId('lhtAtaList'); if(!list)return;
    list.replaceChildren();
    for(const section of find(search)) {
      const button=element('button','ATA '+section.ata+' · '+section.title);button.type='button';
      button.setAttribute('aria-pressed',String(section.section_id===selected));
      button.addEventListener('click',()=>{selected=section.section_id;showList();showDetail();});
      list.append(button);
    }
    if(!list.children.length)list.append(element('p','موردی یافت نشد.'));
  }
  function mount() {
    if(byId('lhtAtaOpen'))return;
    addStyle();
    const button=element('button','ATA · LHT'); button.id='lhtAtaOpen';button.type='button';
    button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','lhtAtaDialog');
    const cb=byId('cbPanelOpen');
    if(cb?.parentNode)cb.insertAdjacentElement('afterend',button);
    else document.querySelector('header .header-settings')?.append(button);
    dialog=element('dialog');dialog.id='lhtAtaDialog';dialog.setAttribute('aria-label','نقشه ATA لوفتهانزا و پنل‌های Unified');
    const top=element('div',null,'lht-top');top.append(element('strong','Lufthansa ATA → Unified · 23 Sections'));
    const input=element('input');input.id='lhtAtaSearch';input.type='search';input.placeholder='جست‌وجوی ATA، پنل، سوئیچ...';
    input.setAttribute('aria-label','جست‌وجو');
    input.addEventListener('input',()=>{search=input.value;showList();});top.append(input);
    const close=element('button','بستن');close.type='button';close.addEventListener('click',()=>dialog.close());top.append(close);
    const layout=element('div',null,'lht-layout');const list=element('div',null,'lht-list');list.id='lhtAtaList';
    const detail=element('div',null,'lht-detail');detail.id='lhtAtaDetail';layout.append(list,detail);
    dialog.append(top,layout);document.body.append(dialog);
    button.addEventListener('click',()=>{showList();showDetail();if(typeof dialog.showModal==='function')dialog.showModal();});
    dialog.addEventListener('close',()=>{if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}});
    button.addEventListener('click',()=>{if(refreshTimer)clearInterval(refreshTimer);
      refreshTimer=setInterval(()=>{if(dialog.open)showDetail();},1500);});
  }
  async function boot() {
    try {
      const response=await fetch(DATA,{cache:'no-store'});
      if(!response.ok)throw Error('ATA index HTTP '+response.status);
      const next=await response.json();
      if(next.schema!=='b737classic.lht-ata-unified-region-control-link.v1'||next.sections.length!==23)
        throw Error('Invalid ATA registry schema / section count');
      registry=next;selected=registry.sections[0].section_id;
      window.B737LHTATAUnifiedV1=Object.freeze({
        getSections:()=>structuredClone(registry.sections),
        getByPanel:region=>structuredClone(byRegion(region)),
        getByControl:id=>structuredClone(byControl(id)),
        observeSection:id=>structuredClone(observe(id)),
        search:q=>structuredClone(find(q)),
        focusRegion
      });
      mount();
      window.dispatchEvent(new CustomEvent('b737:lht-ata-index-ready',{detail:{sections:23,readOnly:true}}));
    } catch(error) { console.warn('Lufthansa ATA map not loaded',error); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();