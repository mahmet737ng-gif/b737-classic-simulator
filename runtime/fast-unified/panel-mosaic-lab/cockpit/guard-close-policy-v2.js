/* Pure FCOM-mapped guard behavior. Separate switch handle from irreversible system effects. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737GuardClosePolicy=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 function targetIndex(c){
  if(c.closePolicy?.onClose!=='force')throw Error('Guard close policy missing '+c.id);
  const i=c.states.indexOf(c.closePolicy.target);
  if(i<0)throw Error('Unknown guarded target '+c.id);
  return i;
 }
 function effectsCopy(x){return x&&typeof x==='object'&&!Array.isArray(x)?{...x}:{};}
 function initialState(c,saved){
  const closed=typeof saved?.closed==='boolean'?saved.closed:true;
  const index=Number.isInteger(saved?.index)&&saved.index>=0&&saved.index<c.states.length?saved.index:targetIndex(c);
  const effects=effectsCopy(saved?.effects);
  if(!closed&&c.irreversible&&c.states[index]===c.irreversible.detent)effects[c.irreversible.effect]=true;
  return {index:closed?targetIndex(c):index,closed,effects};
 }
 function transition(c,state,action,detent){
  const previous={index:state.index,closed:state.closed,effects:effectsCopy(state.effects)};
  const next={index:state.index,closed:state.closed,effects:effectsCopy(state.effects)};
  let accepted=true;
  if(action==='close'){next.closed=true;next.index=targetIndex(c);}
  else if(action==='open')next.closed=false;
  else if(action==='cycle'){if(next.closed)next.closed=false;else next.index=(next.index+1)%c.states.length;}
  else if(action==='set'){const i=c.states.indexOf(detent);if(next.closed||i<0)accepted=false;else next.index=i;}
  else accepted=false;
  let triggeredEffect=null;
  if(accepted&&c.irreversible&&action!=='close'&&
    c.states[next.index]===c.irreversible.detent&&
    !next.closed&&!next.effects[c.irreversible.effect]){
     triggeredEffect=c.irreversible.effect;next.effects[triggeredEffect]=true;
  }
  if(!accepted)return {accepted:false,next:previous,previous,triggeredEffect:null,changed:false};
  return {accepted:true,next,previous,triggeredEffect,changed:
   previous.index!==next.index||previous.closed!==next.closed||!!triggeredEffect};
 }
 function validate(controls){
  const ids=new Set();
  for(const c of controls){
   if(ids.has(c.id))throw Error('Duplicate guarded switch '+c.id);
   ids.add(c.id);targetIndex(c);
   if(c.irreversible&&(!c.states.includes(c.irreversible.detent)||!c.irreversible.effect))throw Error('Invalid irreversible event '+c.id);
   if(c.geometryLock){
    const g=c.geometryLock;
    if(!g.approved||JSON.stringify(g.rectPx)!==JSON.stringify(c.rectPx)||g.hinge!==c.hinge||g.panel!==c.panel||g.color!==c.color)
     throw Error('LOCKED geometry changed '+c.id);
   }
  }
  return true;
 }
 return Object.freeze({targetIndex,initialState,transition,validate});
});
