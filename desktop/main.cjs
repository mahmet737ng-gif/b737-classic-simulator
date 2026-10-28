'use strict';
/**
 * Cockpit Pro Windows Offline Shell
 * Serves the unchanged GitHub project from 127.0.0.1 so ALL existing relative
 * URLs, cockpit iframe messaging, and static training labs use one local origin.
 */
const {app, BrowserWindow, session, shell, dialog} = require('electron');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

const CONTENT_ROOT=app.isPackaged
  ? path.join(process.resourcesPath,'app-content')
  : path.resolve(__dirname,'..');
const ENTRY='panel-mosaic-lab/desktop-shell/index.html';
const TYPES={
 '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.mjs':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.gif':'image/gif','.webp':'image/webp','.bmp':'image/bmp','.ico':'image/x-icon',
 '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf',
 '.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.mp4':'video/mp4',
 '.webm':'video/webm','.pdf':'application/pdf','.wasm':'application/wasm',
 '.xml':'application/xml','.txt':'text/plain; charset=utf-8','.map':'application/json'
};

let server,window,baseUrl;
function insideRoot(candidate){
 const rel=path.relative(CONTENT_ROOT,candidate);
 return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);
}
function fileForPath(urlPath){
 let target;
 try{target=decodeURIComponent(urlPath);}catch{return null;}
 if(target.includes('\0')||target.includes('\\'))return null;
 if(target==='/'||target==='')target='/'+ENTRY;
 const loc=path.resolve(CONTENT_ROOT,'.'+target);
 if(!insideRoot(loc))return null;
 return loc;
}
function reply(res,status,message){
 res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
 res.end(message);
}
function serve(req,res){
 if(!['GET','HEAD'].includes(req.method))return reply(res,405,'Method not allowed');
 let pathName;
 try{pathName=new URL(req.url,'http://localhost').pathname;}catch{return reply(res,400,'Invalid path');}
 let loc=fileForPath(pathName);
 if(!loc)return reply(res,403,'Not permitted');
 fs.stat(loc,(err,info)=>{
  if(err)return reply(res,404,'Not found');
  if(info.isDirectory()){loc=path.join(loc,'index.html');
   if(!insideRoot(loc))return reply(res,403,'Not permitted');
   try{info=fs.statSync(loc);}catch{return reply(res,404,'Not found');}
  }
  if(!info.isFile())return reply(res,404,'Not a file');
  const size=info.size;
  const headers={
   'Content-Type':TYPES[path.extname(loc).toLowerCase()]||'application/octet-stream',
   'Content-Length':size,
   'Cache-Control':'no-store',
   'X-Content-Type-Options':'nosniff',
   'Accept-Ranges':'bytes'
  };
  let start=0,end=size-1,status=200;
  if(req.headers.range){
   const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
   if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end();}
   if(!m[1]){const suffix=Number(m[2]);start=Math.max(0,size-suffix);}
   else {start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}
   if(start>size-1||end<start){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end();}
   status=206;
   headers['Content-Range']='bytes '+start+'-'+end+'/'+size;
   headers['Content-Length']=end-start+1;
  }
  res.writeHead(status,headers);
  if(req.method==='HEAD')return res.end();
  const stream=fs.createReadStream(loc,{start,end});
  stream.on('error',error=>{console.error('[local-file]',error.message);res.destroy(error);});
  stream.pipe(res);
 });
}
function isLocal(url){
 try{const parsed=new URL(url);return parsed.origin===baseUrl;}catch{return false;}
}
async function createWindow(){
 const iconFile=path.join(CONTENT_ROOT,'branding','cockpit-pro','CockpitPro_Windows_Icon.ico');
 const options={
  width:1580,height:920,minWidth:1000,minHeight:650,
  show:false,backgroundColor:'#0a111d',title:'Cockpit Pro · B737 Classic',
  webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,
    webSecurity:true,allowRunningInsecureContent:false,spellcheck:false}
 };
 if(fs.existsSync(iconFile))options.icon=iconFile;
 window=new BrowserWindow(options);
 window.setMenuBarVisibility(false);
 window.webContents.setWindowOpenHandler(({url})=>{
  if(isLocal(url))return {action:'allow',overrideBrowserWindowOptions:{
   webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}}};
  if(/^https:\/\/(github\.com|www\.github\.com|electronjs\.org)\//.test(url))shell.openExternal(url);
  return {action:'deny'};
 });
 window.webContents.on('will-navigate',(event,url)=>{
  if(!isLocal(url)){
   event.preventDefault();
   if(/^https:\/\/(github\.com|www\.github\.com)\//.test(url))shell.openExternal(url);
  }
 });
 window.webContents.on('before-input-event',(event,input)=>{
  if(input.type==='keyDown'&&input.key==='F11'){window.setFullScreen(!window.isFullScreen());event.preventDefault();}
 });
 window.on('ready-to-show',()=>window?.show());
 window.webContents.on('did-fail-load',(_e,errorCode,description,url,isMainFrame)=>{
  if(isMainFrame){
   console.error('Cockpit Pro: local load failed',errorCode,description,url);
   dialog.showMessageBox(window,{type:'error',title:'Cockpit Pro',message:'Local application files could not load',detail:String(description)});
  }
 });
 await window.loadURL(baseUrl+'/'+ENTRY);
 if(!window.isVisible())window.show();
}
async function start(){
 if(!fs.existsSync(path.join(CONTENT_ROOT,ENTRY))){
  dialog.showErrorBox('Cockpit Pro · Missing Offline Files',
    'The installed app-content folder is incomplete.\n'+path.join(CONTENT_ROOT,ENTRY));
  app.quit();return;
 }
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 server=http.createServer(serve);
 server.on('error',err=>{console.error('[CockpitPro offline server]',err);dialog.showErrorBox('Cockpit Pro',err.message);app.quit();});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 baseUrl='http://127.0.0.1:'+server.address().port;
 await createWindow();
}
const single=app.requestSingleInstanceLock();
if(!single)app.quit();
else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
 app.whenReady().then(start).catch(err=>{dialog.showErrorBox('Cockpit Pro',err.stack||String(err));app.quit();});
 app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',()=>{try{server?.close();}catch{}});
}
