/* Native desktop updates. The web preview has no access to privileged IPC. */
(function(){
 'use strict';
 const native=window.cockpitDesktop;
 if(!native)return;
 const byId=id=>document.getElementById(id);
 const dialog=document.createElement('dialog');dialog.id='desktopUpdates';dialog.dir='rtl';
 dialog.style.cssText='max-width:520px;width:90%;border:1px solid #48647a;border-radius:14px;background:#101e2d;color:#eef3f8;padding:26px';
 dialog.innerHTML='<h2>به‌روزرسانی Cockpit Pro</h2><p id="desktopVersion"></p><p id="desktopUpdateStatus" role="status" aria-live="polite"></p><progress id="desktopUpdateProgress" max="100" value="0" style="width:100%" hidden></progress><p>هنگام دانلود می‌توانی به تمرین ادامه بدهی. نصب، برنامه را می‌بندد و دوباره باز می‌کند.</p><p><button class="soft" id="nativeCheck">بررسی نسخهٔ جدید</button> <button class="soft" id="nativeDownload" hidden>دانلود آپدیت</button> <button class="primary" id="nativeInstall" hidden>نصب و راه‌اندازی مجدد</button></p><button class="close" id="nativeUpdateClose">بستن</button>';
 document.body.append(dialog);
 const labels={idle:'برای بررسی نسخهٔ جدید کلیک کن.',development:'آپدیت در نسخهٔ نصب‌شدهٔ ویندوز فعال است.',
  checking:'در حال بررسی نسخهٔ جدید…',current:'آخرین نسخه نصب است.',available:'نسخهٔ جدید آمادهٔ دانلود است.',
  downloading:'در حال دانلود…',downloaded:'دانلود و بررسی فایل کامل شد؛ آمادهٔ نصب است.',
  installing:'در حال راه‌اندازی نصب…',error:'دریافت آپدیت انجام نشد. اتصال اینترنت را بررسی کن و دوباره تلاش کن.'};
 function paint(state){
  byId('desktopVersion').textContent='نسخهٔ نصب‌شده: '+state.currentVersion+(state.nextVersion?' ← '+state.nextVersion:'');
  byId('desktopUpdateStatus').textContent=labels[state.status]||labels.idle;
  const busy=['checking','downloading','installing'].includes(state.status);
  byId('nativeCheck').disabled=busy||state.status==='downloaded';
  byId('nativeDownload').hidden=!state.nextVersion||!['available','error'].includes(state.status);
  byId('nativeInstall').hidden=state.status!=='downloaded';
  byId('desktopUpdateProgress').hidden=state.status!=='downloading';
  byId('desktopUpdateProgress').value=state.percent||0;
  if(state.status==='downloading')byId('desktopUpdateStatus').textContent+=' '+Math.floor(state.percent||0)+'٪';
  if(byId('update'))byId('update').textContent=state.status==='downloaded'?'↻ نصب آپدیت':'↻ UPDATE · '+state.currentVersion;
 }
 const state=native.getState().then(info=>{paint(info.update);return info;});
 native.onUpdate(paint);
 async function run(method){try{paint(await native[method]());}catch{byId('desktopUpdateStatus').textContent=labels.error;}}
 byId('nativeCheck').onclick=()=>run('checkUpdates');
 byId('nativeDownload').onclick=()=>run('downloadUpdate');
 byId('nativeInstall').onclick=()=>run('installUpdate');
 byId('nativeUpdateClose').onclick=()=>dialog.close();
 function open(){dialog.showModal();}
 const setup=document.createElement('button');setup.className='soft';setup.textContent='↻ به‌روزرسانی برنامه';setup.onclick=open;
 document.querySelector('.start')?.append(setup);
 window.CockpitDesktopUI=Object.freeze({state,open,ready:report=>native.ready(report),saveProfile:profile=>native.saveProfile(profile)});
})();
