const registry=globalThis.B737_ANIMATION_REGISTRY;
let motor=B737_MOTION.createRegistryEngine(registry),disposers=[];
const q=id=>document.getElementById(id);
function build(){disposers.forEach(d=>d.dispose?.());disposers=[];const parent=q('controls');parent.replaceChildren();const controls=registry.panels[q('panel').value].controls;
 q('stats').textContent=`${controls.length} control definitions · ${registry.schema}`;
 for(const spec of controls){const box=document.createElement('article');const name=document.createElement('h3');name.textContent=spec.id;
 const source=document.createElement('p');source.textContent=spec.source.section;
 const actor=document.createElement('button');actor.className='actor '+(spec.motion.style==='rotate'?'rotary':spec.control_type);actor.title=spec.control_type+' / '+spec.motion.style;
 const r=document.createElement('div');r.className='readout';
 const s=motor.read(spec.id);r.textContent=String(s.value);box.append(name,source,actor,r);parent.appendChild(box);
 const d=motor.attach(spec.id,actor,{reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches});
 const g=B737_POINTER.bind(actor,motor,spec.id);const u=motor.subscribe(spec.id,(state)=>{r.textContent=String(state.value);q('event').textContent=spec.id+'\nvalue: '+state.value+'\npreviewAngle: '+state.angle+'°\nsource: '+spec.source.section+'\nUI-only angle; not FCOM aircraft calibration.'});
 disposers.push(d,g,{dispose:u});}
}
q('panel').onchange=build;q('reset').onclick=()=>{motor.reset();q('event').textContent='Reset'};build();