'use strict';
const {contextBridge,ipcRenderer} = require('electron');
if(process.isMainFrame)contextBridge.exposeInMainWorld('cockpitDesktop',Object.freeze({
 getState:()=>ipcRenderer.invoke('desktop:state'),
 checkUpdates:()=>ipcRenderer.invoke('desktop:update-check'),
 downloadUpdate:()=>ipcRenderer.invoke('desktop:update-download'),
 installUpdate:()=>ipcRenderer.invoke('desktop:update-install'),
 saveProfile:profile=>ipcRenderer.invoke('desktop:profile',profile),
 ready:report=>ipcRenderer.invoke('desktop:ready',report),
 onUpdate:callback=>{
  const listener=(_event,state)=>callback(state);
  ipcRenderer.on('desktop:update-state',listener);
  return ()=>ipcRenderer.removeListener('desktop:update-state',listener);
 }
}));
