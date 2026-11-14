/* N1 + EGT photographic precision bench. Standalone: no writes to Unified.
 * Original owner-panel bitmap, owner needle photograph and verified mark scanner.
 */
(function(){
'use strict';
const calibration=window.B737PhotoDetentCalibrationV1;
const font=window.B737EISDotDigitsV1;
if(!calibration||!font){document.getElementById('source-status').textContent='خطای بارگذاری موتور کالیبراسیون یا دیجیت‌ها';return;}
const NS='http://www.w3.org/2000/svg';
const PHOTO='./assets/p2-conventional-full-owner-20261030.png?v=CONV-FULL-0001';
const NEEDLE='./assets/conventional-needle-photo-v1.svg?v=CONV-NEEDLE-0001';
const entries=[
 {id:'n1_1',signal:'n1',engine:'engine1',label:'N1 · ENGINE 1',initial:60.3,max:120,step:.1,decimals:1},
 {id:'n1_2',signal:'n1',engine:'engine2',label:'N1 · ENGINE 2',initial:22.0,max:120,step:.1,decimals:1},
 {id:'egt_1',signal:'egt',engine:'engine1',label:'EGT · ENGINE 1',initial:587,max:1000,step:1,decimals:0},
 {id:'egt_2',signal:'egt',engine:'engine2',label:'EGT · ENGINE 2',initial:445,max:1000,step:1,decimals:0}
];
const cards=new Map(),measurements=new Map();
let showMarks=false,photoReady=false;
const byId=id=>document.getElementById(id);
const status=byId('source-status');
function svgNode(parent,tag,attributes){
 const n=document.createElementNS(NS,tag);
 for(const [key,value]of Object.entries(attributes||{}))n.setAttribute(key,String(value));
 if(parent)parent.appendChild(n);
 return n;
}
function labelNode(tag,className,text,parent){
 const e=document.createElement(tag);if(className)e.className=className;
 if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e;
}
const format=(entry,value)=>font.format(value,{decimals:entry.decimals,integerDigits:entry.signal==='n1'?3:4});
const angleFor=(entry,value)=>calibration.angle(entry.signal,entry.engine,value);
// The photographic needle asset has a small clockwise registration bias.
// Correct the *painted image only*; detent angles, ECU values and dot digits
// remain untouched. Negative is counterclockwise in SVG rotation.
const NEEDLE_VISUAL_OFFSET_DEG=-1.8;
const needleRenderAngle=calibratedAngle=>calibratedAngle+NEEDLE_VISUAL_OFFSET_DEG;
const vector=(degree,radius)=>({x:Math.sin(degree*Math.PI/180)*radius,
 y:-Math.cos(degree*Math.PI/180)*radius});
function addDotDigits(target,entry,formatted){
 target.replaceChildren();
 const layout=font.layout(formatted),scale=.64;
 const x=-layout.width*scale/2,y=-52;
 const group=svgNode(target,'g',{transform:'translate('+x+' '+y+') scale('+scale+')'});
 for(const cell of layout.cells){
  const glyph=font.glyphs[cell.character];
  const cellGroup=svgNode(group,'g',{transform:'translate('+cell.x+' 0)'});
  for(const point of glyph.points){
   svgNode(cellGroup,'circle',{cx:point.x,cy:point.y,r:.48,fill:'#a4a750',
    'fill-opacity':'.91'});
  }
 }
}
function markSet(entry,svgLayer){
 svgLayer.replaceChildren();
 const profile=calibration.getProfile(entry.signal,entry.engine);
 for(let i=0;i<profile.values.length;i++){
  const angle=profile.angles[i],p1=vector(angle,57),p2=vector(angle,69);
  const line=svgNode(svgLayer,'line',{x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y,
   stroke:i===0?'#3affbd':i===profile.values.length-1?'#ffce78':'#66d9f8',
   'stroke-width':i===0||i===profile.values.length-1?1.15:.7,'stroke-opacity':'.82'});
  line.setAttribute('data-tick-value',String(profile.values[i]));
  line.setAttribute('data-tick-angle',String(angle));
  const mark=vector(angle,79);
  if(i===0||i===profile.values.length-1||i%2===0){
   const t=svgNode(svgLayer,'text',{x:mark.x,y:mark.y,'text-anchor':'middle',
    'dominant-baseline':'central',fill:'#a5e2ef','font-size':'6.6','font-family':'monospace'});
   t.textContent=String(entry.signal==='n1'?profile.values[i]:profile.values[i]/100);
  }
 }
 svgLayer.style.opacity=showMarks?'1':'0';
}
function update(entry,value){
 if(!Number.isFinite(value))return;
 const card=cards.get(entry.id);
 const bounded=Math.max(0,Math.min(entry.max,value));
 const theta=angleFor(entry,bounded);
 const renderedTheta=needleRenderAngle(theta);
 const text=format(entry,bounded);
 if(!card||!Number.isFinite(theta))throw Error('No gauge pointer calibration '+entry.id);
 card.value=bounded;card.slider.value=String(bounded);
 card.pointer.setAttribute('transform','rotate('+renderedTheta.toFixed(4)+') scale(.51)');
 card.pointer.dataset.angle=renderedTheta.toFixed(4);
 card.pointer.dataset.calibratedAngle=theta.toFixed(4);
 card.pointer.dataset.visualOffsetDeg=String(NEEDLE_VISUAL_OFFSET_DEG);
 card.pointer.dataset.value=String(bounded);
 card.digits.dataset.text=text;
 card.digits.dataset.value=String(bounded);
 addDotDigits(card.digits,entry,text);
 card.valueLabel.textContent=text+(entry.signal==='egt'?' °C':' %');
 card.angleLabel.textContent='NEEDLE '+renderedTheta.toFixed(2)+'° · CAL '+theta.toFixed(2)+'°';
 const p=calibration.getProfile(entry.signal,entry.engine);
 card.sourceLabel.textContent=p.status;
 card.sourceLabel.className=p.status==='PHOTO_VERIFIED'?'ok':'warn';
 for(const b of card.buttons)b.classList.toggle('selected',Math.abs(Number(b.dataset.value)-bounded)<entry.step/2);
 return {value:bounded,angle:theta,renderAngle:renderedTheta,
  visualOffsetDeg:NEEDLE_VISUAL_OFFSET_DEG,text,status:p.status};
}
function build(entry){
 const article=labelNode('article','card',undefined,byId('gauges'));article.dataset.gauge=entry.id;
 labelNode('h2','',entry.label,article);
 labelNode('p','subtitle',entry.signal==='n1'?'0–120 % N1 · 13 photographed white graduations':
  '0–1000 °C · 11 photographed white graduations',article);
 const holder=labelNode('div','dialframe',undefined,article);
 const svg=svgNode(holder,'svg',{class:'dial',viewBox:'-106 -106 212 212',role:'img',
  'aria-label':entry.label+' real original photograph with live needle and numerical readout'});
 const center=calibration.CENTERS[entry.signal][entry.engine==='engine1'?0:1];
 svgNode(svg,'image',{href:PHOTO,x:-center[0],y:-center[1],width:1463,height:1075,
  'preserveAspectRatio':'none','data-source-photograph':'original-owner-asset'});
 const back=svgNode(svg,'rect',{x:-36,y:-57,width:72,height:25,rx:1,
  fill:'#292d29','fill-opacity':'.98','data-numeric-aperture':entry.id});
 const digits=svgNode(svg,'g',{'data-photo-digits':entry.id,
  'aria-label':'Numerical value of '+entry.label});
 const pointer=svgNode(svg,'g',{'data-photo-pointer':entry.id});
 svgNode(pointer,'image',{href:NEEDLE,x:-40,y:-140,width:80,height:160,
  'preserveAspectRatio':'xMidYMid meet'});
 const overlay=svgNode(svg,'g',{'data-calibration-marks':entry.id,
  'pointer-events':'none'});
 overlay.style.transition='opacity .18s';
 const main=labelNode('div','card-numeric',undefined,article);
 const valueLabel=labelNode('strong','',undefined,main),angleLabel=labelNode('span','',undefined,main);
 const slider=labelNode('input','',undefined,article);slider.type='range';slider.min='0';
 slider.max=String(entry.max);slider.step=String(entry.step);slider.id='range-'+entry.id;
 slider.setAttribute('aria-label',entry.label+' numeric value');
 const detents=labelNode('div','detents',undefined,article),buttons=[];
 const profile=calibration.getProfile(entry.signal,entry.engine);
 for(const value of profile.values){
  const button=labelNode('button','detent',String(entry.signal==='n1'?value:value/100),detents);
  button.type='button';button.dataset.value=String(value);
  button.setAttribute('aria-label',entry.label+' detent '+value);
  button.addEventListener('click',()=>update(entry,value));
  buttons.push(button);
 }
 const metrics=labelNode('div','metrics',undefined,article);
 const sourceLabel=labelNode('span','',undefined,metrics);
 labelNode('span','', 'ZERO = FIRST WHITE MARK',metrics);
 labelNode('span','',entry.signal==='n1'?'10% / tick':'100°C / tick',metrics);
 const state={entry,article,svg,pointer,back,digits,overlay,slider,valueLabel,angleLabel,
  sourceLabel,buttons,value:entry.initial};
 cards.set(entry.id,state);
 slider.addEventListener('input',()=>update(entry,Number(slider.value)));
 markSet(entry,overlay);
 update(entry,entry.initial);
}
function refresh(){
 for(const e of entries){const state=cards.get(e.id);markSet(e,state.overlay);update(e,state.value);}
}
function audit({count=1000,seed=191737}={}){
 if(!Number.isInteger(count)||count<1||count>100000)throw Error('Invalid test size');
 let rng=(seed>>>0)||1,checks=0,maxRawError=0,maxDotError=0,failures=0;
 const results=[];
 for(const e of entries){
  const p=calibration.getProfile(e.signal,e.engine);
  const points=[...p.values,...calibration.detents(e.signal,e.engine,8).map(x=>x.value)];
  const n=count/entries.length;
  for(let j=0;j<n;j++){
   rng=(Math.imul(1664525,rng)+1013904223)>>>0;
   points.push(rng/4294967296*e.max);
  }
  let worst=0,worstDot=0;
  for(const x of points){
   const theta=angleFor(e,x),back=calibration.valueAt(e.signal,e.engine,theta);
   const rawError=Math.abs(back-x);
   const number=Number(format(e,x));
   const digitError=Math.abs(number-x);
   worst=Math.max(worst,rawError);worstDot=Math.max(worstDot,digitError);
   maxRawError=Math.max(maxRawError,rawError);maxDotError=Math.max(maxDotError,digitError);
   if(!Number.isFinite(theta)||rawError>1e-6||digitError>(e.signal==='n1'?.0500001:.500001))failures++;
   checks++;
  }
  results.push({gauge:e.id,firstAngle:p.angles[0],lastAngle:p.angles.at(-1),
   source:p.status,checks:points.length,maxNeedleValueError:worst,maxDisplayRounding:worstDot});
 }
 return Object.freeze({pass:failures===0,checks,randomCount:count,failures,
  maxNeedleValueError:maxRawError,maxDisplayRounding:maxDotError,results});
}
const api=Object.freeze({VERSION:'N1-EGT-PHOTO-LAB-0002',entries,
 NEEDLE_VISUAL_OFFSET_DEG,
 setValue(id,value){const e=entries.find(e=>e.id===id);if(!e)throw Error('Unknown gauge');return update(e,value);},
 getValue(id){return cards.get(id)?.value;},
 getProfile(signal,engine){const p=calibration.getProfile(signal,engine);return{values:[...p.values],angles:[...p.angles],status:p.status};},
 audit,photoReady:()=>photoReady,sourceState:()=>status.textContent,showMarks:()=>showMarks});
window.B737N1EGTPrecisionLabV1=api;
for(const entry of entries)build(entry);
byId('marks-toggle').addEventListener('click',()=>{
 showMarks=!showMarks;byId('marks-toggle').setAttribute('aria-pressed',String(showMarks));
 byId('marks-toggle').textContent=showMarks?'پنهان‌کردن خطوط کالیبراسیون':'نمایش خطوط کالیبراسیون';
 refresh();
});
byId('reset').addEventListener('click',()=>{for(const e of entries)update(e,e.initial);});
function runReport(){
 const report=audit({count:1000});
 const text='STATUS '+(report.pass?'PASS':'FAIL')+
 '\nPHOTO SCAN '+(photoReady?'COMPLETED':'NOT VERIFIED')+
 '\nCHECKS '+report.checks+' (including '+report.randomCount+' seeded random samples)'+
 '\nMAX INVERSE NEEDLE ERROR '+report.maxNeedleValueError.toExponential(2)+
 '\nMAX NUMERIC ROUNDING ERROR '+report.maxDisplayRounding.toFixed(4)+
 '\n'+report.results.map(r=>r.gauge+'  ZERO '+r.firstAngle.toFixed(2)+'°  LAST '+
 r.lastAngle.toFixed(2)+'°  '+r.source+'  '+r.checks+' checks').join('\n');
 byId('audit-result').textContent=text;
 return report;
}
byId('random-audit').addEventListener('click',runReport);
const img=new Image();
img.onload=()=>{
 try{
  if(img.naturalWidth!==1463||img.naturalHeight!==1075)throw Error('Wrong original photograph size');
  const c=document.createElement('canvas');c.width=1463;c.height=1075;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
  const frame=ctx.getImageData(0,0,1463,1075);
  let passed=0;
  for(const e of entries){
   const result=calibration.photoScan(frame,e.signal,e.engine);
   measurements.set(e.id,result);
   if(result.passed&&calibration.applyPhotoScan(result))passed++;
  }
  photoReady=passed===4;
  status.className=photoReady?'good':'warn';
  status.textContent=photoReady?'PHOTO SCAN 4/4 · ثبت مستقل تمام خطوط N1 و EGT موفق':
   'PHOTO SCAN '+passed+'/4 · برخی خطوط نیازمند بازبینی تصویری هستند';
  refresh();runReport();
 }catch(error){photoReady=false;status.className='warn';
  status.textContent='PHOTO SCAN ERROR · '+error.message;runReport();}
};
img.onerror=()=>{photoReady=false;status.className='warn';
 status.textContent='تصویر اصلی بارگذاری نشد؛ فقط کالیبراسیون مرجع در دسترس است';runReport();};
img.src=PHOTO;
})();