/* Native desktop updates. The web preview has no access to privileged IPC. */
(function(){
 'use strict';
 const native=window.cockpitDesktop;
 if(!native)return;
 const byId=id=>document.getElementById(id);
 const dialog=document.createElement('dialog');dialog.id='desktopUpdates';dialog.dir='rtl';
 dialog.style.cssText='max-width:520px;width:90%;border:1px solid #48647a;border-radius:14px;background:#101e2d;color:#eef3f8;padding:26px';
 dialog.innerHTML='<h2>Cockpit Pro Updates</h2><p id="desktopVersion"></p><p id="desktopUpdateStatus" role="status" aria-live="polite"></p><progress id="desktopUpdateProgress" max="100" value="0" style="width:100%" hidden></progress><p>Training remains available during download. Installation closes and restarts the app.</p><p><button class="soft" id="nativeCheck">Check for Updates</button> <button class="soft" id="nativeDownload" hidden>Download Update</button> <button class="primary" id="nativeInstall" hidden>Install and Restart</button></p><button class="close" id="nativeUpdateClose">Close</button>';
 document.body.append(dialog);
 const labels={idle:'Click to check for updates.',development:'Updates are enabled in the installed Windows build.',
  checking:'Checking for Updates…',current:'Latest Version Installed.',available:'Update Available for Download.',
  downloading:'Downloading…',downloaded:'Download and file verification completed; ready to install.',
  installing:'Launching Installer…',error:'Update failed. Check internet connectivity and retry.'};
 function paint(state){
  byId('desktopVersion').textContent='Installed Version: '+state.currentVersion+(state.nextVersion?' ← '+state.nextVersion:'');
  byId('desktopUpdateStatus').textContent=labels[state.status]||labels.idle;
  const busy=['checking','downloading','installing'].includes(state.status);
  byId('nativeCheck').disabled=busy||state.status==='downloaded';
  byId('nativeDownload').hidden=!state.nextVersion||!['available','error'].includes(state.status);
  byId('nativeInstall').hidden=state.status!=='downloaded';
  byId('desktopUpdateProgress').hidden=state.status!=='downloading';
  byId('desktopUpdateProgress').value=state.percent||0;
  if(state.status==='downloading')byId('desktopUpdateStatus').textContent+=' '+Math.floor(state.percent||0)+'%';
  if(byId('update'))byId('update').textContent=state.status==='downloaded'?'↻ Install Update':'↻ UPDATE · '+state.currentVersion;
 }
 const state=native.getState().then(info=>{paint(info.update);return info;});
 native.onUpdate(paint);
 async function run(method){try{paint(await native[method]());}catch{byId('desktopUpdateStatus').textContent=labels.error;}}
 byId('nativeCheck').onclick=()=>run('checkUpdates');
 byId('nativeDownload').onclick=()=>run('downloadUpdate');
 byId('nativeInstall').onclick=()=>run('installUpdate');
 byId('nativeUpdateClose').onclick=()=>dialog.close();
 function open(){dialog.showModal();}
 const setup=document.createElement('button');setup.className='soft';setup.textContent='↻ Update App';setup.onclick=open;
 document.querySelector('.start')?.append(setup);
 window.CockpitDesktopUI=Object.freeze({state,open,ready:report=>native.ready(report),saveProfile:profile=>native.saveProfile(profile)});
})();
