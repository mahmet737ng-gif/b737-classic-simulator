'use strict';
// Loaded only after the cockpit is usable or the user opens Updates.
// Download and installation are separate explicit actions; never interrupt a session.
function createUpdateController({version, packaged, getUpdater, publish = () => {}}) {
 let updater, checking, downloading;
 let state = {status: packaged ? 'idle' : 'development', currentVersion: version,
   nextVersion: null, percent: 0, error: null};
 const snapshot = () => ({...state});
 function set(patch) {state = {...state, ...patch};publish(snapshot());return snapshot();}
 function failed(error) {return set({status:'error', error:String(error?.code || 'UPDATE_UNAVAILABLE')});}
 function load() {
  if(updater)return updater;
  updater = getUpdater();
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  updater.on('checking-for-update', () => set({status:'checking',error:null}));
  updater.on('update-available', info => set({status:'available',nextVersion:info.version,percent:0,error:null}));
  updater.on('update-not-available', () => set({status:'current',nextVersion:null,error:null}));
  updater.on('download-progress', info => set({status:'downloading',percent:Math.max(0,Math.min(100,info.percent || 0))}));
  updater.on('update-downloaded', info => set({status:'downloaded',nextVersion:info.version,percent:100,error:null}));
  updater.on('error', failed);
  return updater;
 }
 async function check() {
  if(!packaged)return snapshot();
  if(checking)return checking;
  if(downloading || ['downloaded','installing'].includes(state.status))return snapshot();
  checking = (async()=>{try {set({status:'checking',error:null});await load().checkForUpdates();}
   catch(error){failed(error);}return snapshot();})();
  try{return await checking;}finally{checking=null;}
 }
 async function download() {
  if(downloading)return downloading;
  if(!packaged || !state.nextVersion || !['available','error'].includes(state.status))return snapshot();
  downloading = (async()=>{try {set({status:'downloading',percent:0,error:null});await load().downloadUpdate();}
   catch(error){failed(error);}return snapshot();})();
  try{return await downloading;}finally{downloading=null;}
 }
 function install() {
  if(!packaged || state.status!=='downloaded')return {accepted:false,...snapshot()};
  set({status:'installing'});
  // NSIS validates the downloaded package's SHA-512 before emitting update-downloaded.
  setImmediate(()=>updater.quitAndInstall(false,true));
  return {accepted:true,...snapshot()};
 }
 return {snapshot,check,download,install};
}
module.exports = {createUpdateController};
