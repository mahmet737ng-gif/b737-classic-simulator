(function(){
'use strict';
function ready(){
 const button=document.getElementById('guarded17Open');
 const dialog=document.getElementById('guarded17Dialog');
 const close=document.getElementById('guarded17Close');
 if(!button||!dialog||!close)return;
 const frame=dialog.querySelector('iframe');
 function show(){
  if(frame&&!frame.getAttribute('src'))frame.setAttribute('src',frame.dataset.src);
  if(!dialog.open)dialog.showModal();
 }
 function hide(){if(dialog.open)dialog.close();}
 button.addEventListener('click',show);
 close.addEventListener('click',hide);
 dialog.addEventListener('click',event=>{if(event.target===dialog)hide();});
 const params=new URLSearchParams(window.location.search);
 if(params.get('guarded17')==='1'||params.get('guards')==='17')show();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
else ready();
})();
