/* CB-RESULTS-0001 — live suggestion list using the existing authoritative
   CB viewer.find() and viewer.focusByKey() API. No invented CB records.
*/
(function(){
 'use strict';
 const search=document.getElementById('cbSearch');
 const find=document.getElementById('cbFind');
 const bar=document.getElementById('toolbar');
 const status=document.getElementById('cbSrStatus');
 const api=window.B737_CB_MRG_VIEWER;
 if(!search||!bar||!api)return;
 const list=document.createElement('div');
 list.id='cbResults';list.setAttribute('role','listbox');
 list.setAttribute('aria-label','Circuit breaker search results');
 list.hidden=true;bar.append(list);
 search.setAttribute('aria-controls','cbResults');
 search.setAttribute('aria-expanded','false');
 search.setAttribute('aria-autocomplete','list');
 let rows=[],selected=-1,searchVersion=0;
 const LIMIT=40;
 function hide(){
  list.hidden=true;search.setAttribute('aria-expanded','false');selected=-1;
 }
 function setActive(n){
  if(!rows.length)return;
  selected=Math.max(0,Math.min(rows.length-1,n));
  rows.forEach((r,i)=>{
   r.element.dataset.current=String(i===selected);
   r.element.setAttribute('aria-selected',String(i===selected));
  });
  rows[selected].element.scrollIntoView({block:'nearest'});
 }
 function focusResult(entry){
  const key=entry.key;
  if(!key)return;
  hide();
  search.blur(); // close mobile keyboard to maximize the visible CB panel
  const launch=()=>{
   if(api.focusByKey(key)){
    status.textContent='Focused '+entry.panel+' '+entry.position+' · '+entry.label;
   }
  };
  // Mobile keyboard dismissal changes the viewport size; let it settle before
  // starting the existing smooth, center-anchored camera animation.
  if(window.visualViewport&&window.visualViewport.height<window.innerHeight*.82){
   window.setTimeout(launch,260);
  }else requestAnimationFrame(launch);
 }
 function draw(){
  const query=search.value.trim();
  list.replaceChildren();rows=[];selected=-1;
  if(!query){hide();return;}
  const matches=api.find(query);
  search.setAttribute('aria-expanded','true');list.hidden=false;
  if(!matches.length){
   const info=document.createElement('div');info.className='cb-results-note';
   info.textContent='No matching circuit breakers';list.append(info);return;
  }
  const buttons=new Map([...document.querySelectorAll('#cbPanels .cb-knob')].map(b=>[b.dataset.key,b]));
  for(const entry of matches.slice(0,LIMIT)){
   const cb=buttons.get(entry.key);
   if(!cb)continue;
   const label=cb.dataset.label||entry.key;
   const prefix=entry.panel+' '+entry.position+' ';
   const name=label.startsWith(prefix)?label.slice(prefix.length):label;
   const button=document.createElement('button');
   button.type='button';button.className='cb-result';button.setAttribute('role','option');
   button.setAttribute('aria-selected','false');
   const id=document.createElement('span');id.className='cb-ref';id.textContent=entry.panel+' '+entry.position;
   const title=document.createElement('span');title.className='cb-name';title.textContent=name;
   button.append(id,title);list.append(button);
   const option={...entry,label:name,element:button};
   rows.push(option);
   button.addEventListener('click',()=>focusResult(option));
  }
  if(matches.length>LIMIT){
   const note=document.createElement('div');note.className='cb-results-note';
   note.textContent='Showing '+LIMIT+' of '+matches.length+' matches · type more to narrow the results';
   list.append(note);
  }
  if(!rows.length){hide();}
 }
 search.addEventListener('input',()=>{searchVersion++;draw();});
 search.addEventListener('focus',()=>{if(search.value.trim())draw();});
 search.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'&&rows.length){e.preventDefault();setActive(selected<0?0:selected+1);}
  else if(e.key==='ArrowUp'&&rows.length){e.preventDefault();setActive(selected<0?rows.length-1:selected-1);}
  else if(e.key==='Escape'&&!list.hidden){e.preventDefault();hide();}
  else if(e.key==='Enter'&&rows.length&&!list.hidden){
   // Select the highlighted suggestion; otherwise keep existing Find behavior.
   if(selected>=0){e.preventDefault();e.stopImmediatePropagation();focusResult(rows[selected]);}
  }
 },true);
 find?.addEventListener('click',()=>hide());
 document.addEventListener('pointerdown',e=>{
  if(!bar.contains(e.target))hide();
  else if(e.target===find)hide();
 },true);
 window.B737_CB_LiveResultsV1=Object.freeze({count:()=>rows.length,refresh:draw});
})();
