"use strict";
/** Browser + Node, pure compound-control logic; no DOM or image dependency. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.B737Compound = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function children(catalog) { return catalog.groups.flatMap(g => g.children.map(c => ({ ...c, groupId:g.id, centerPx:g.centerPx, panel:g.panel }))); }
  function makeState(catalog) { const out = {}; for (const c of children(catalog)) out[c.id] = c.state.initial; return out; }
  function findChild(catalog,id) { return children(catalog).find(c=>c.id===id); }
  function inHit(hit, dx,dy) { const r=Math.hypot(dx,dy); return hit.shape==='circle'?r<=hit.radiusPx : hit.shape==='annulus' && r>hit.innerRadiusPx && r<=hit.outerRadiusPx; }
  function hitTest(catalog, panel, x,y) {
    const matches=[];
    for(const g of catalog.groups) if(g.panel===panel) for (const child of g.children) if(inHit(child.hit,x-g.centerPx[0],y-g.centerPx[1]))matches.push(child);
    // The center child wins for any accidental overlap.
    matches.sort((a,b)=>a.role==='inner'?-1:b.role==='inner'?1:0);
    return matches.length ? matches[0].id : null;
  }
  function apply(catalog,prev,id,action,arg) {
    const child=findChild(catalog,id);
    if (!child) return {ok:false,reason:'UNKNOWN_CONTROL',state:prev};
    if (!['STEP','SET','RELEASE'].includes(action)) return {ok:false,reason:'UNKNOWN_ACTION',state:prev};
    if(action==='STEP' && (!Number.isFinite(arg) || !Number.isInteger(arg))) return {ok:false,reason:'INVALID_STEP',state:prev};
    const spec=child.state, old=prev[id]; let value=old;
    if(action==='RELEASE') {
      if(!spec.springReturn) return {ok:false,reason:'NOT_SPRING_LOADED',state:prev};
      if(old===spec.springReturn.from) value=spec.springReturn.to;
    } else if(spec.kind==='enum') {
      if (action==='SET') {
        if(!spec.detents.includes(arg)) return {ok:false,reason:'INVALID_DETENT',state:prev};
        value=arg;
      } else {
        const k=spec.detents.indexOf(old),delta=Math.sign(arg||0);
        value=spec.detents[Math.min(spec.detents.length-1,Math.max(0,k+delta))];
      }
    } else if (spec.kind==='integer-wrap') {
      const step=spec.step||1;
      const raw=action==='SET'?arg:(old+(arg||0)*step);
      if(!Number.isFinite(raw))return {ok:false,reason:'INVALID_NUMBER',state:prev};
      const span=spec.max-spec.min+1;
      value=((Math.round(raw)-spec.min)%span+span)%span+spec.min;
    } else if (spec.kind==='number') {
      const raw=action==='SET'?arg:old+(arg||0)*(spec.step||1);
      if(!Number.isFinite(raw))return {ok:false,reason:'INVALID_NUMBER',state:prev};
      value=Math.round(Math.max(spec.min,Math.min(spec.max,raw))*1000)/1000;
    } else return {ok:false,reason:'UNKNOWN_STATE_KIND',state:prev};
    const state=Object.assign({},prev,{[id]:value});
    return {ok:true,changed:value!==old,state,event:{controlId:id,command:child.command,previous:old,value,mode:action}};
  }
  function validate(catalog) {
    const errors=[],ids=new Set();
    for(const g of catalog.groups) {
      const m=catalog.masters[g.panel];
      if(!m)errors.push('UNKNOWN_PANEL:'+g.id);
      else if(g.centerPx[0]<0||g.centerPx[1]<0||g.centerPx[0]>=m.nativeWidth||g.centerPx[1]>=m.nativeHeight)errors.push('PIVOT_OUTSIDE_IMAGE:'+g.id);
      for (const c of g.children) {
        if(ids.has(c.id))errors.push('DUPLICATE_ID:'+c.id);ids.add(c.id);
        if(c.hit.shape==='annulus' && !(c.hit.innerRadiusPx>=0&&c.hit.innerRadiusPx<c.hit.outerRadiusPx))errors.push('BAD_ANNULUS:'+c.id);
      }
      const inner=g.children.filter(c=>c.role==='inner'); const outer=g.children.filter(c=>c.role==='outer');
      if (inner.length!==1||outer.length!==1)errors.push('MISSING_INNER_OR_OUTER:'+g.id);
      if(inner.length&&outer.length&&inner[0].hit.radiusPx>outer[0].hit.innerRadiusPx)errors.push('CROSS_REGION:'+g.id);
    }
    return errors;
  }
  return Object.freeze({children,makeState,findChild,hitTest,apply,validate});
});