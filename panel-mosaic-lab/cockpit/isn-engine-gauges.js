(function(){
 'use strict';
 const model=window.B737ISNEngineGaugeModel,ns='http://www.w3.org/2000/svg';
 if(!model)return;
 let layer=null,last=null;
 const element=(parent,tag,attrs={})=>{const node=document.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));
  parent.append(node);return node;
 };
 function mount(){const piece=document.querySelector('#region-main .texture-piece[data-piece="engine"]');
  if(!piece||piece.querySelector('[data-isn-engine-gauges]'))return;
  const svg=element(piece,'svg',{'data-isn-engine-gauges':'ISN-0005',viewBox:'0 0 1235 1274',
   role:'img','aria-label':'Engine 1 and 2 training N2 and EGT indications'});
  svg.classList.add('isn-engine-gauges');
  for(const spec of model.gauges){
   const group=element(svg,'g',{'data-gauge':spec.id});
   const pointer=element(group,'g',{'data-pointer':'',transform:`translate(${spec.cx} ${spec.cy}) rotate(-120)`});
   element(pointer,'path',{d:`M -2 9 L 0 -${spec.radius} L 2 9 Z`,fill:'#f0f1e9',stroke:'#3d4647','stroke-width':'.7'});
   element(group,'circle',{cx:spec.cx,cy:spec.cy,r:4.4,fill:'#262d2b',stroke:'#e9e8e1','stroke-width':'1.1'});
   const value=element(group,'text',{'data-value':'',x:spec.cx,y:spec.cy+27,'text-anchor':'middle',
    fill:'#f3f3eb','font-size':'20','font-family':'ui-monospace,Consolas,monospace','font-weight':'700'});
   value.textContent='—';
  }
  layer=svg;render(last);
 }
 function render(indications){last=indications||last;if(!layer||!last)return;
  for(const spec of model.gauges){const signal=last.engines?.[spec.engine]?.[spec.signal],group=layer.querySelector('[data-gauge="'+spec.id+'"]');
   const pointer=group.querySelector('[data-pointer]'),value=group.querySelector('[data-value]');
   const degrees=model.angle(signal?.value??null,spec.max);
   pointer.style.visibility=degrees===null?'hidden':'visible';
   if(degrees!==null)pointer.setAttribute('transform',`translate(${spec.cx} ${spec.cy}) rotate(${degrees})`);
   value.textContent=signal?.value===null||signal?.value===undefined?'—':String(Math.round(signal.value));
  }
 }
 window.addEventListener('b737:cockpit-mounted',mount);
 window.addEventListener('b737:isn-start-indications',event=>{render(event.detail);mount();});
 if(document.querySelector('#region-main'))mount();
})();
