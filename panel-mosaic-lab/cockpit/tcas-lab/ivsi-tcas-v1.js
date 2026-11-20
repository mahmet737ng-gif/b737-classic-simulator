/* TCAS Encounter Lab IVSI/TCAS instructor display only.
 * Illustrative Classic vertical-speed/RA colors; not an airborne certified IVSI.
 * Same TCAS engine output is shared with the EADI and EHSI.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.B737TcasIVSIV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const SVG='http://www.w3.org/2000/svg';
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const fmt=v=>v===null?'—':(v>=0?'+':'-')+String(Math.round(Math.abs(v)/100)).padStart(2,'0');
 function model(own={},output={}){
  const vs=Number.isFinite(own.vsFpm)?own.vsFpm:0,ra=output.ra||null;
  const zones=[],min=Number.isFinite(ra?.min)?ra.min:null,max=Number.isFinite(ra?.max)?ra.max:null;
  if(min!==null){zones.push({kind:'RED',from:-6000,to:min});
   if(max===null&&!ra.preventive)zones.push({kind:'GREEN',from:min,to:Math.min(6000,min+1500)});}
  if(max!==null){zones.push({kind:'RED',from:max,to:6000});
   if(min===null&&!ra.preventive)zones.push({kind:'GREEN',from:Math.max(-6000,max-1500),to:max});}
  if(min!==null&&max!==null&&min<=max)zones.push({kind:'GREEN',from:min,to:max});
  return {vs,raId:ra?.id||null,advisory:output.advisory||null,
   zones,needleAngle:angle(vs),
   targets:(output.targets||[]).filter(t=>['RA','TA','PROX','OTHER'].includes(t.kind))
    .sort((a,b)=>({RA:0,TA:1,PROX:2,OTHER:3}[a.kind]-{RA:0,TA:1,PROX:2,OTHER:3}[b.kind])||((a.distance??Infinity)-(b.distance??Infinity)))
    .slice(0,3).map(t=>({id:t.id||'',kind:t.kind,rangeNm:t.distance,
     relativeAltitude:t.relativeAltitude??null,altitudeText:Number.isFinite(t.relativeAltitude)?fmt(t.relativeAltitude):'--',
     trend:Number.isFinite(t.verticalRate)&&Math.abs(t.verticalRate)>=500?(t.verticalRate>0?'UP':'DOWN'):null}))
  };
 }
 function angle(rate){return -140+((clamp(rate,-6000,6000)+6000)/12000)*280;}
 function point(cx,cy,r,deg){const t=deg*Math.PI/180;return [cx+Math.sin(t)*r,cy-Math.cos(t)*r];}
 function render(svg,own,output){
  if(!svg)return null;
  const state=model(own,output),doc=svg.ownerDocument||document;
  const add=(parent,tag,attr={},txt)=>{
   const el=doc.createElementNS(SVG,tag);
   for(const [name,value] of Object.entries(attr))el.setAttribute(name,String(value));
   if(txt!==undefined)el.textContent=String(txt);
   parent.appendChild(el);return el;
  };
  const colors={RED:'#ff4949',GREEN:'#20ed72',WHITE:'#e6f1f8',TA:'#ffca43',BLACK:'#060b10',PROX:'#ecf2f9'};
  svg.replaceChildren();svg.setAttribute('viewBox','0 0 420 590');
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  svg.setAttribute('role','img');svg.setAttribute('aria-label','TCAS integrated vertical speed display');
  svg.setAttribute('data-ra-id',state.raId||'NONE');
  add(svg,'rect',{x:0,y:0,width:420,height:590,fill:colors.BLACK});
  add(svg,'text',{x:210,y:30,fill:'#95c7d7','font-size':19,'text-anchor':'middle','font-family':'sans-serif','font-weight':'bold'},'INTEGRATED VSI / TCAS');
  add(svg,'circle',{cx:210,cy:225,r:175,fill:'#091722',stroke:'#456074','stroke-width':3});
  // Numeric VS scale, independent of flight-director or autopilot state.
  for(let rate=-6000;rate<=6000;rate+=1000){
   const a=angle(rate),p=point(210,225,159,a),q=point(210,225,174,a);
   add(svg,'line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],stroke:'#c2d5df','stroke-width':rate===0?3:1.8});
   if(rate%2000===0){
    const lab=point(210,225,133,a);
    add(svg,'text',{x:lab[0],y:lab[1]+5,fill:colors.WHITE,'font-size':17,'text-anchor':'middle','font-family':'sans-serif'},rate===0?'0':String(rate/1000));
   }
  }
  for(const zone of state.zones){
   const from=clamp(zone.from,-6000,6000),to=clamp(zone.to,-6000,6000);
   if(to<=from)continue;
   const paths=[];
   for(let r=from;r<=to;r+=Math.max(20,(to-from)/32))paths.push(point(210,225,181,angle(r)));
   paths.push(point(210,225,181,angle(to)));
   add(svg,'polyline',{points:paths.map(p=>p.join(',')).join(' '),fill:'none',
    stroke:colors[zone.kind],'stroke-width':11,'stroke-linecap':'butt',
    'data-zone':zone.kind,'data-from-fpm':zone.from,'data-to-fpm':zone.to});
  }
  const tip=point(210,225,117,state.needleAngle);
  add(svg,'line',{x1:210,y1:225,x2:tip[0],y2:tip[1],stroke:'#fcf9f0','stroke-width':5,'stroke-linecap':'round','data-layer':'vs-needle'});
  add(svg,'circle',{cx:210,cy:225,r:12,fill:'#d7e1ea',stroke:'#111c27','stroke-width':4});
  add(svg,'text',{x:210,y:279,fill:colors.WHITE,'font-size':25,'font-weight':'bold','text-anchor':'middle','font-family':'monospace'},Math.round(state.vs)+' FPM');
  add(svg,'text',{x:210,y:313,fill:state.raId?colors.RED:'#a1b7c7','font-size':16,'text-anchor':'middle','font-family':'sans-serif'},state.raId?'RA: '+state.raId.replaceAll('_',' '):'NO RESOLUTION ADVISORY');
  add(svg,'line',{x1:24,y1:414,x2:396,y2:414,stroke:'#355168','stroke-width':1});
  add(svg,'text',{x:26,y:436,fill:'#8cd2ed','font-size':16,'font-family':'sans-serif','font-weight':'bold'},'TRACKED TRAFFIC');
  if(!state.targets.length)add(svg,'text',{x:27,y:473,fill:'#b9cbd6','font-size':15},'NO TRAFFIC');
  for(const [index,t] of state.targets.entries()){
   const y=468+index*35,color=t.kind==='RA'?colors.RED:t.kind==='TA'?colors.TA:colors.PROX;
   const row=add(svg,'g',{'data-target-id':t.id,'data-kind':t.kind});
   add(row,'text',{x:27,y,fill:color,'font-size':14,'font-weight':'bold','font-family':'sans-serif'},t.kind);
   add(row,'text',{x:101,y,fill:color,'font-size':14,'font-family':'monospace'},Number(t.rangeNm||0).toFixed(1)+' NM');
   add(row,'text',{x:227,y,fill:color,'font-size':14,'font-family':'monospace'},t.altitudeText);
   if(t.trend)add(row,'text',{x:325,y,fill:color,'font-size':20,'font-weight':'bold','data-trend':t.trend},t.trend==='UP'?'↑':'↓');
  }
  return state;
 }
 return Object.freeze({model,angle,render});
});
