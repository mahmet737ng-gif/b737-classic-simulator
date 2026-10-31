'use strict';
const processBegan=performance.now();
const {app,BrowserWindow,session,shell,dialog,ipcMain,Menu}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {createLocalServer,listenLocal}=require('./local-server.cjs');
const {createUpdateController}=require('./update-controller.cjs');
const CONTENT_ROOT=app.isPackaged?path.join(process.resourcesPath,'app-content'):path.resolve(__dirname,'..');
const ENTRY='panel-mosaic-lab/desktop-shell/index.html';
const smoke=process.argv.includes('--startup-smoke');
const profiling=process.argv.includes('--startup-profile');
const software=process.argv.includes('--software-rendering');
if(software)app.disableHardwareAcceleration();
const timeline={moduleLoaded:performance.now()-processBegan};
const mark=name=>{timeline[name]=performance.now()-processBegan;};
const smokeData=process.argv.find(x=>x.startsWith('--smoke-user-data='));
if(smoke&&smokeData)app.setPath('userData',smokeData.slice('--smoke-user-data='.length));
const settingsFile=path.join(app.getPath('userData'),'desktop-settings.json');
let settings={};try{settings=JSON.parse(fs.readFileSync(settingsFile,'utf8'));}catch{}
let writeQueue=Promise.resolve();
function persist(){
 const data=JSON.stringify(settings);
 writeQueue=writeQueue.catch(()=>{}).then(async()=>{await fs.promises.mkdir(path.dirname(settingsFile),{recursive:true});await fs.promises.writeFile(settingsFile+'.tmp',data);await fs.promises.rename(settingsFile+'.tmp',settingsFile);});
 return writeQueue;
}
let server,window,baseUrl,updaterTimer,reported=false,stopProfile;
const updates=createUpdateController({version:app.getVersion(),packaged:app.isPackaged&&!smoke,
 getUpdater:()=>require('electron-updater').autoUpdater,
 publish:state=>{if(window&&!window.isDestroyed())window.webContents.send('desktop:update-state',state);}});
function isLocal(url){try{return new URL(url).origin===baseUrl;}catch{return false;}}
function authorized(event){return window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&isLocal(event.senderFrame.url);}
function handle(channel,handler){ipcMain.handle(channel,(event,...args)=>{if(!authorized(event))throw Error('Untrusted desktop request');return handler(...args);});}
handle('desktop:state',()=>{mark('firstRendererIPC');return {version:app.getVersion(),packaged:app.isPackaged,smoke,
 profile:settings.profile||null,resume:settings.resume===true,update:updates.snapshot()};});
handle('desktop:update-check',()=>updates.check());
handle('desktop:update-download',()=>updates.download());
handle('desktop:update-install',async()=>{await persist();return updates.install();});
handle('desktop:profile',async input=>{
 const model=require(path.join(CONTENT_ROOT,'engine/config/aircraft-profile-v1.js'));
 const profile=model.normalize(input);model.validate(profile);
 settings.profile=profile;settings.resume=true;await persist();return profile;
});
handle('desktop:ready',async input=>{
 if(reported)return null;
 if(!input||input.main!==true||input.controls!==true||!Number.isFinite(input.loadMs)||input.loadMs<0)throw Error('Invalid readiness report');
 reported=true;
 const report={version:app.getVersion(),readyAtMs:Date.now(),processToUsableMs:performance.now()-processBegan,
  cockpitLoadMs:input.loadMs,targetMs:5000,main:true,controls:true,secondaryReady:input.secondaryReady===true};
 report.timeline=timeline;report.rendering=software?'software':'default';
 if(smoke){
  const began=performance.now();
  report.interaction=await window.webContents.executeJavaScript(`(()=>{
   const w=document.getElementById('cockpit').contentWindow;
   const control=w.document.querySelector('[data-mcp-hardware="FD_LEFT"]');
   const before=w.B737McpHardwareV1.getState().FD_LEFT;
   control.click();const after=w.B737McpHardwareV1.getState().FD_LEFT;control.click();
   return {responded:before!==after,restored:w.B737McpHardwareV1.getState().FD_LEFT===before};
  })()`);
  report.interaction.roundTripMs=performance.now()-began;
  if(stopProfile)report.cpuHotspots=await stopProfile();
  const image=await window.webContents.capturePage();
  await fs.promises.writeFile(path.join(app.getPath('userData'),'startup.png'),image.toPNG());
 }
 await fs.promises.writeFile(path.join(app.getPath('userData'),'startup-report.json'),JSON.stringify(report,null,2));
 // Update networking and the updater dependency stay out of the startup path.
 if(!smoke)updaterTimer=setTimeout(()=>updates.check(),15000);
 else setTimeout(()=>app.quit(),100);
 return report;
});
async function createWindow(){
 Menu.setApplicationMenu(null);
 const iconFile=path.join(CONTENT_ROOT,'branding','cockpit-pro','CockpitPro_Windows_Icon.ico');
 const options={width:1580,height:920,minWidth:1000,minHeight:650,show:false,
  backgroundColor:'#0a111d',title:'Cockpit Pro · B737 Classic',
  webPreferences:{preload:path.join(__dirname,'preload.cjs'),partition:'persist:cockpit-pro',
   nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,
   allowRunningInsecureContent:false,spellcheck:false}};
 if(fs.existsSync(iconFile))options.icon=iconFile;
 window=new BrowserWindow(options);window.setMenuBarVisibility(false);
 mark('windowCreated');
 if(profiling)stopProfile=await require('./startup-profile.cjs').startProfile(window.webContents);
 window.webContents.setWindowOpenHandler(({url})=>{
  if(isLocal(url))return {action:'allow',overrideBrowserWindowOptions:{
   webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}}};
  if(/^https:\/\/(github\.com|www\.github\.com|electronjs\.org)\//.test(url))shell.openExternal(url);
  return {action:'deny'};
 });
 window.webContents.on('will-navigate',(event,url)=>{if(!isLocal(url)){
  event.preventDefault();if(/^https:\/\/(github\.com|www\.github\.com)\//.test(url))shell.openExternal(url);
 }});
 window.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='F11'){window.setFullScreen(!window.isFullScreen());event.preventDefault();}});
 window.once('ready-to-show',()=>window?.show());
 window.webContents.on('dom-ready',()=>{mark('shellDomReady');if(!window.isVisible())window.show();});
 window.webContents.on('did-fail-load',(_e,code,description,_url,isMainFrame)=>{
  if(isMainFrame){console.error('Local load failed',code,description);dialog.showMessageBox(window,{type:'error',title:'Cockpit Pro',message:'Local application files could not load',detail:String(description)});}
 });
 await window.loadURL(baseUrl+'/'+ENTRY);
 if(!window.isVisible())window.show();
}
async function start(){
 mark('electronReady');
 if(!fs.existsSync(path.join(CONTENT_ROOT,ENTRY))){dialog.showErrorBox('Cockpit Pro','The installed app-content folder is incomplete.');app.quit();return;}
 const ses=session.fromPartition('persist:cockpit-pro');
 ses.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 // Performance smoke tests must succeed with every external request blocked.
 if(smoke)ses.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!/^http:\/\/127\.0\.0\.1:\d+\//.test(details.url)&&!details.url.startsWith('devtools:')}));
 server=createLocalServer({root:CONTENT_ROOT,entry:ENTRY,version:app.getVersion()});
 const preferred=Number.isInteger(settings.port)&&settings.port>1024&&settings.port<65536?settings.port:0;
 const port=await listenLocal(server,preferred);
 settings.port=port;await persist();baseUrl='http://127.0.0.1:'+port;
 mark('serverReady');
 server.on('error',err=>{console.error('Local server failed',err.message);app.quit();});
 await createWindow();
}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
 app.whenReady().then(start).catch(err=>{dialog.showErrorBox('Cockpit Pro',err.stack||String(err));app.quit();});
 app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',()=>{clearTimeout(updaterTimer);try{server?.close();}catch{}});
}
