/* MOBILE-COCKPIT-FIRST-0001 — on-demand shell overlays, no scene mutation. */
(function(){
 'use strict';
 const header=document.querySelector('body>header');
 const settings=header?.querySelector('.header-settings');
 const nav=header?.querySelector('nav');
 const toolbar=document.querySelector('.workbench .toolbar');
 if(!settings||!nav||!toolbar)return;
 const mobileQuery=window.matchMedia('(max-width:700px), (max-height:500px) and (pointer:coarse)');
 const labels=[
  ['views','☰','انتخاب پنل'],
  ['tools','⌕','ابزارها و زوم'],
  ['engines','N1','وضعیت APU و موتورها']
 ];
 const buttons={};
 const targetFor=name=>name==='views'?nav:name==='tools'?toolbar:document.getElementById('isnStartIndications');
 for(const [name,display,title] of labels){
  const btn=document.createElement('button');
  btn.type='button';btn.id='mobile-'+name+'-toggle';btn.className='unified-mobile-toggle';
  btn.textContent=display;btn.title=title;btn.setAttribute('aria-label',title);
  btn.setAttribute('aria-expanded','false');settings.insertBefore(btn,settings.querySelector('#aircraftSettingsOpen'));
  buttons[name]=btn;
  btn.addEventListener('click',()=>{
   const target=targetFor(name);if(!target||!mobileQuery.matches)return;
   const open=!target.classList.contains('mobile-open');
   closeAll();if(open){target.classList.add('mobile-open');btn.setAttribute('aria-expanded','true');}
  });
 }
 const closeAll=()=>{
  for(const name of Object.keys(buttons)){
   targetFor(name)?.classList.remove('mobile-open');
   buttons[name].setAttribute('aria-expanded','false');
  }
 };
 // Preserve the original inspector logic; this button is a mobile entry point.
 const inspectorOpen=document.createElement('button');
 inspectorOpen.id='mobileInspectorOpen';inspectorOpen.className='mobile-inspector-close';
 inspectorOpen.textContent='کنترل‌ها و اطلاعات فنی';inspectorOpen.type='button';
 toolbar.append(inspectorOpen);
 inspectorOpen.addEventListener('click',()=>{
  closeAll();
  document.getElementById('inspectorToggle')?.click();
 });
 const inspector=document.getElementById('inspector');
 if(inspector){
  const dismiss=document.createElement('button');
  dismiss.type='button';dismiss.className='mobile-inspector-close';
  dismiss.textContent='×  بستن کنترل‌ها';dismiss.setAttribute('aria-label','بستن کنترل‌ها');
  inspector.prepend(dismiss);
  dismiss.addEventListener('click',()=>{
   if(document.body.classList.contains('side-open'))document.getElementById('inspectorToggle')?.click();
  });
 }
 nav.addEventListener('click',event=>{
  if(event.target.closest('button[data-focus]'))closeAll();
 });
 document.addEventListener('pointerdown',event=>{
  if(!mobileQuery.matches)return;
  if(event.target.closest('.unified-mobile-toggle,body>header nav,.workbench .toolbar,#isnStartIndications'))return;
  closeAll();
 },{passive:true});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape')closeAll();
 });
 window.addEventListener('resize',()=>{
  if(!mobileQuery.matches)closeAll();
 });
 window.B737MobileShellV1=Object.freeze({close:closeAll});
})();
