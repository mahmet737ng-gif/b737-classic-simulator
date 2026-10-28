/* IRS ISDU 13-position incandescent-style segment display, visual v2.
 * 737 Classic reference: 6 latitude glyphs | 7 longitude glyphs, one row.
 * Positions and photometric appearance calibrated from owner's 1183x1536 photo.
 * FCOM only informs the user-visible layout. NO live inertial data is fabricated.
 * Independent, additive module. Immutable overhead and LOWER SYS DSPL untouched.
 */
(function(root){
'use strict';
const MODES=Object.freeze(['TEST','TK/GS','PPOS','WIND','HDG/STS']);
const SOURCE=Object.freeze({x:434,y:238,w:299,h:39});
const ATLAS=Object.freeze({x:3,y:3,w:2214,h:1019,sourceW:1731,sourceH:909});
const RECT=Object.freeze({left:ATLAS.x+SOURCE.x*ATLAS.w/ATLAS.sourceW,top:ATLAS.y+SOURCE.y*ATLAS.h/ATLAS.sourceH,width:SOURCE.w*ATLAS.w/ATLAS.sourceW,height:SOURCE.h*ATLAS.h/ATLAS.sourceH});
const NS='http://www.w3.org/2000/svg';
const LEFT=Object.freeze([18,76,134,192,250,308]),RIGHT=Object.freeze([430,488,546,604,662,720,778]);
const TOP_DOTS=Object.freeze([179,370,624,801]),BOTTOM_DOTS=Object.freeze([334,799]);
const STROKES=Object.freeze({
 a:'M7 10 L12 5 H35 L40 10 L35 15 H12 Z',
 b:'M42 12 L47 17 V40 L42 45 L37 40 V17 Z',
 c:'M42 52 L47 57 V80 L42 85 L37 80 V57 Z',
 d:'M12 82 H35 L40 87 L35 92 H12 L7 87 Z',
 e:'M6 52 L11 57 V80 L6 85 L1 80 V57 Z',
 f:'M6 12 L11 17 V40 L6 45 L1 40 V17 Z',
 g:'M12 45 H35 L40 49 L35 53 H12 L7 49 Z',
 nl:'M12 18 L18 18 L36 70 L30 70 Z',
 ns:'M9 75 L17 66 L17 24 L9 19 Z',
 nr:'M31 75 L39 66 L39 24 L31 19 Z',
 w1:'M7 21 L13 21 L19 71 L13 71 Z',
 w2:'M19 71 L24 65 L28 77 L24 84 Z',
 w3:'M25 77 L31 65 L36 71 L30 83 Z',
 w4:'M35 71 L42 21 L48 21 L41 71 Z'
});
const GLYPHS=Object.freeze({
 '0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd',
 '6':'afgecd','7':'abc','8':'abcdefg','9':'abfgcd',
 '-':'g',' ':'',N:'efbcnl',S:'afgcd',E:'afged',W:'w1w2w3w4',H:'fegbc'
});
const DOT_POSITIONS=Object.freeze({top:TOP_DOTS,bottom:BOTTOM_DOTS});
let element=null,mode='PPOS',brightness=82,typed='',lastEntered='',latHem='N',lonHem='E',active=false,testActive=false,testTimer=null;
let pendingTestReturn=false,segments=[],dots=[];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function elSvg(name,attributes){
 const n=document.createElementNS(NS,name);
 for(const [k,v] of Object.entries(attributes||{}))n.setAttribute(k,String(v));
 return n;
}
function emit(reason){
 root.dispatchEvent(new CustomEvent('b737:irs-display-segments-change',{detail:{reason,mode,brightness,active,testActive,typed,lastEntered,frontendOnly:true}}));
}
function snapshot(){return {mode,brightness,active,testActive,typed,lastEntered,latHem,lonHem,leftCells:6,rightCells:7,characters:13,dots:{top:4,bottom:2},frontendOnly:true};}
function cells(){
 if(!active)return Array(13).fill(' ');
 if(testActive)return ['N',...Array(5).fill('8'),'W',...Array(6).fill('8')];
 if(!typed&&!lastEntered)return Array(13).fill(' ');
 const input=typed||lastEntered;
 const lat=input.slice(0,5),lon=input.slice(5,11);
 const a=['N'===latHem||'S'===latHem?latHem:'N',...lat.padStart(5,' ').split('')];
 const b=[lonHem,...lon.padStart(6,' ').split('')];
 return a.concat(b);
}
function render(){
 if(!element)return;
 const values=cells(),light=brightness/100;
 element.dataset.active=String(active);
 element.dataset.test=String(testActive);
 element.dataset.brightness=String(brightness);
 element.dataset.mode=mode;
 element.style.setProperty('--irs-filament-light',String(light));
 const luminous=active&&brightness>0;
 for(let i=0;i<13;i++){
  const wanted=new Set((GLYPHS[values[i]]||'').match(/w[1-4]|nl|ns|nr|[a-g]/g)||[]);
  // 7 numeric filaments + additional hemisphere strokes.
  const cell=segments[i];
  if(!cell)continue;
  cell.group.dataset.char=values[i];
  for(const [name,path] of cell.paths){
   const on=luminous&&wanted.has(name);
   path.setAttribute('data-on',String(on));
  }
 }
 for(const dot of dots){
  // All six points light under segment test. In PPOS, the two lower
  // fractional indicators illuminate when input digits exist.
  const on=luminous&&(testActive||(!!(typed||lastEntered)&&dot.type==='bottom'));
  dot.node.setAttribute('data-on',String(on));
 }
 const rendered=values.join('');
 element.setAttribute('aria-label','IRS segmented front-end display '+(testActive?'segment test':rendered.trim()||'blank')+'; brightness '+brightness+' percent');
}
function refreshSources(){
 const s=root.B737IRSDisplaySelector?.getState?.()||root.B737IRSUpperSelector?.getState?.();
 if(s){
  if(MODES.includes(s.mode))mode=s.mode;
  if(Number.isFinite(s.brightness))brightness=clamp(s.brightness,0,100);
 }
}
function setMode(next){
 if(!MODES.includes(next))return mode;
 mode=next;
 if(mode==='TEST')startTest();
 else render();
 return mode;
}
function setBrightness(n){
 if(!Number.isFinite(n))throw new TypeError('Brightness must be a finite number');
 brightness=clamp(Math.round(n),0,100);render();return brightness;
}
function clearTest(){
 if(testTimer!==null){root.clearTimeout?.(testTimer);testTimer=null;}
}
function finishTest(){
 clearTest();testActive=false;
 if(pendingTestReturn){
  pendingTestReturn=false;
  const a=root.B737IRSDisplaySelector;
  const b=root.B737IRSUpperSelector;
  if(a?.getState?.().mode==='TEST')a.setMode('TK/GS','segmented-test-return');
  else if(b?.getMode?.()==='TEST')b.setMode('TK/GS','segmented-test-return');
  mode='TK/GS';
 }
 render();emit('test-end');
}
function startTest(){
 clearTest();active=true;testActive=true;pendingTestReturn=mode==='TEST';
 render();emit('test-start');
 if(root.setTimeout)testTimer=root.setTimeout(finishTest,10000);
}
function press(key){
 const k=String(key);
 if(!/^(?:[0-9]|ENT|CLR)$/.test(k))return snapshot();
 active=true;
 if(k==='CLR'){typed='';lastEntered='';}
 else if(k==='ENT'){
  if(typed){lastEntered=typed;typed='';}
 }else{typed=(typed+k).slice(0,11);}
 if(testActive){testActive=false;clearTest();}
 render();emit('key-'+k);return snapshot();
}
function hemisphere(value){
 const n=String(value).toUpperCase();
 if(['N','S'].includes(n))latHem=n;
 else if(['E','W'].includes(n))lonHem=n;
 else return;
 active=true;render();emit('hemisphere-'+n);
}
function makeCell(svg,x,id){
 const group=elSvg('g',{transform:'translate('+x+' 9)',class:'irs-segment-cell','data-slot':id});
 const paths=[];
 for(const [name,shape] of Object.entries(STROKES)){
  const p=elSvg('path',{d:shape,'data-seg':name,'data-on':'false',class:'irs-filament'});
  group.appendChild(p);paths.push([name,p]);
 }
 svg.appendChild(group);
 segments.push({group,paths});
}
function makeDot(svg,x,y,type,ix){
 const halo=elSvg('circle',{cx:x,cy:y,r:5.2,class:'irs-dot-halo','data-on':'false'});
 const n=elSvg('circle',{cx:x,cy:y,r:2.9,class:'irs-fraction-dot','data-on':'false','data-position':type+'-'+ix});
 svg.appendChild(halo);svg.appendChild(n);dots.push({node:n,halo,type});
}
function mount(){
 const region=document.getElementById('region-overhead');
 if(!region)return null;
 const existing=region.querySelector('#irsSegmentDisplayMounted');
 if(existing){element=existing;render();return element;}
 const box=document.createElement('div');
 box.id='irsSegmentDisplayMounted';box.className='irs-segment-display';
 box.dataset.version='IRS-SEGMENT-13-V2';box.dataset.frontendOnly='true';
 Object.assign(box.style,Object.fromEntries(Object.entries(RECT).map(([k,v])=>[k,v+'px'])));
 box.setAttribute('role','group');box.setAttribute('tabindex','0');
 box.title='13-character IRS filament display (demo) · click for 10s segment test';
 const svg=elSvg('svg',{viewBox:'0 0 835 106',preserveAspectRatio:'none',class:'irs-segment-canvas','aria-hidden':'true'});
 const filter=elSvg('defs');
 const glow=elSvg('filter',{id:'irsSegGlowV2',x:'-60%',y:'-60%',width:'220%',height:'220%'});
 glow.appendChild(elSvg('feGaussianBlur',{stdDeviation:'3.6'}));
 filter.appendChild(glow);svg.appendChild(filter);
 const back=elSvg('rect',{x:0,y:0,width:835,height:106,fill:'transparent'});
 svg.appendChild(back);
 segments=[];dots=[];
 LEFT.forEach((x,i)=>makeCell(svg,x,i));RIGHT.forEach((x,i)=>makeCell(svg,x,i+6));
 TOP_DOTS.forEach((x,i)=>makeDot(svg,x,12,'top',i));
 BOTTOM_DOTS.forEach((x,i)=>makeDot(svg,x,100,'bottom',i));
 box.appendChild(svg);
 box.addEventListener('click',()=>startTest());
 box.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();startTest();}});
 region.append(box);element=box;refreshSources();render();
 return element;
}
function boot(){
 if(!mount()){
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
 }
 document.addEventListener('b737:irs-visual-key',e=>{if(e.detail?.key)press(e.detail.key);});
 function changed(d){
  if(!d)return;
  if(d.mode&&MODES.includes(d.mode)&&d.mode!==mode)setMode(d.mode);
  if(Number.isFinite(d.brightness))setBrightness(d.brightness);
 }
 root.addEventListener('b737:irs-upper-visual-change',e=>changed(e.detail));
 root.addEventListener('b737:irs-dspl-sel-change',e=>changed(e.detail));
 root.addEventListener('b737:cockpit-mounted',mount);
 document.addEventListener('keydown',e=>{
  if(e.altKey&&['N','S','E','W'].includes(String(e.key).toUpperCase())&&
     !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))hemisphere(e.key);
 });
}
root.B737IRSSegmentDisplay=Object.freeze({mount,press,setMode,setBrightness,hemisphere,startTest,finishTest,getState:snapshot,getElement:()=>element,sourceRect:SOURCE,layout:{left:LEFT,right:RIGHT,topDots:TOP_DOTS,bottomDots:BOTTOM_DOTS}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
