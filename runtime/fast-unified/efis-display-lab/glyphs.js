/* Authored stroke glyphs. Coordinates describe display units, independent of platform fonts. */
(function(root){
 const shapes = {
  A:'0,7 0,2 2,0 4,2 4,7|0,4 4,4',B:'0,7 0,0 3,0 4,1 4,2.5 3,3.5 0,3.5|3,3.5 4,4.5 4,6 3,7 0,7',
  C:'4,1 3,0 1,0 0,1 0,6 1,7 3,7 4,6',D:'0,7 0,0 2.5,0 4,1.5 4,5.5 2.5,7 0,7',
  E:'4,0 0,0 0,7 4,7|0,3.5 3,3.5',F:'4,0 0,0 0,7|0,3.5 3,3.5',G:'4,1 3,0 1,0 0,1 0,6 1,7 4,7 4,4 2.5,4',
  H:'0,0 0,7|4,0 4,7|0,3.5 4,3.5',I:'0,0 4,0|2,0 2,7|0,7 4,7',J:'4,0 4,6 3,7 1,7 0,6 0,5',
  K:'0,0 0,7|4,0 0,4 4,7',L:'0,0 0,7 4,7',M:'0,7 0,0 2,3.3 4,0 4,7',N:'0,7 0,0 4,7 4,0',
  O:'1,0 3,0 4,1 4,6 3,7 1,7 0,6 0,1 1,0',P:'0,7 0,0 3,0 4,1 4,3 3,4 0,4',
  Q:'1,0 3,0 4,1 4,6 3,7 1,7 0,6 0,1 1,0|2,4.5 4.4,7.5',
  R:'0,7 0,0 3,0 4,1 4,3 3,4 0,4|2,4 4,7',S:'4,1 3,0 1,0 0,1 0,2.5 1,3.5 3,3.5 4,4.5 4,6 3,7 1,7 0,6',
  T:'0,0 4,0|2,0 2,7',U:'0,0 0,6 1,7 3,7 4,6 4,0',V:'0,0 0,1 2,7 4,1 4,0',
  W:'0,0 0,7 2,4 4,7 4,0',X:'0,0 4,7|4,0 0,7',Y:'0,0 2,3.5 4,0|2,3.5 2,7',Z:'0,0 4,0 0,7 4,7',
  0:'1,0 3,0 4,1 4,6 3,7 1,7 0,6 0,1 1,0',1:'1,1 2.5,0 2.5,7|1,7 4,7',
  2:'0,1 1,0 3,0 4,1 4,2.5 0,6 0,7 4,7',3:'0,0 3,0 4,1 4,2.5 3,3.5 1.5,3.5|3,3.5 4,4.5 4,6 3,7 0,7',
  4:'3,7 3,0 0,5 4,5',5:'4,0 0,0 0,3 3,3 4,4 4,6 3,7 1,7 0,6',
  6:'3.5,0 1,0 0,1.5 0,6 1,7 3,7 4,6 4,4.5 3,3.5 0,3.5',7:'0,0 4,0 1,7',
  8:'1,0 3,0 4,1 4,2.5 3,3.5 1,3.5 0,2.5 0,1 1,0|1,3.5 0,4.5 0,6 1,7 3,7 4,6 4,4.5 3,3.5',
  9:'4,3.5 1,3.5 0,2.5 0,1 1,0 3,0 4,1 4,5.5 3,7 1,7',
  '.':'1.8,7 2.1,7', '/':'0,7 4,0', '+':'0,3.5 4,3.5|2,1.5 2,5.5', '-':'0,3.5 4,3.5',
  '°':'1,0 2.5,0 2.5,1.6 1,1.6 1,0', ':':'2,2 2.2,2|2,5.5 2.2,5.5',
  '(':'3,0 1,2 1,5 3,7',')':'1,0 3,2 3,5 1,7','?':'0,1 1,0 3,0 4,1 4,2 2,4 2,5|2,7 2.2,7'
 };
 const strokes=Object.fromEntries(Object.entries(shapes).map(([char,s])=>[char,s.split('|').map(line=>line.split(' ').map(point=>point.split(',').map(Number)))]));
 function visit(value,x,y,size,align,draw,aspect=1){
  const letters=String(value).toUpperCase(), scale=size/10, step=6.1*scale*aspect;
  if(align==='middle'||align==='center') x-=(letters.length*step-2.1*scale*aspect)/2;
  if(align==='end'||align==='right') x-=letters.length*step-2.1*scale*aspect;
  y-=3.5*scale;
  for(const char of letters){
   for(const points of strokes[char]||(char===' '?[]:strokes['?'])){
    draw(points.map(([px,py])=>[x+px*scale*aspect,y+py*scale]));
   }
   x+=step;
  }
 }
 function svg(value,x,y,size,align,aspect){
  let d='';
  visit(value,x,y,size,align,points=>{d+='M'+points.map(([px,py])=>px.toFixed(2)+','+py.toFixed(2)).join('L');},aspect);
  return d;
 }
 function canvas(c,value,x,y,size,color,align,aspect){
  c.beginPath();visit(value,x,y,size,align,points=>points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py)),aspect);
  c.strokeStyle=color;c.lineWidth=Math.max(1,size/11);c.lineJoin='round';c.lineCap='round';c.stroke();
 }
 const colors=Object.freeze({white:'#f0f4ec',green:'#62ee79',magenta:'#ed68df',cyan:'#6adcf4',amber:'#ffca43',red:'#ff504f',black:'#000'});
 const api={svg,canvas,colors};if(typeof module==='object'&&module.exports)module.exports=api;
 root.EFISLabGlyphs=api;
})(globalThis);
