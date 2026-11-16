/* Geometry rectified to active glass, from the supplied B733 images (2026-11-16).
 * EADI uses 640×640 logical units; EHSI uses 512×512. The socket controls
 * the final physical aspect. Never use the source photo as a texture. */
(function(root){
 const eadi=Object.freeze({
  center:[320,332],
  attitude:{left:171,right:469,top:112,bottom:552,shoulder:221,heel:445,pitchPerDeg:9.65},
  attitudeTicks:{major:54,intermediate:33,minor:17,labelSize:25},
  fixedBank:{x:320,top:86,tip:110,width:22},
  movingBank:{radius:218,width:23,height:22},
  director:{halfHorizontal:81,halfVertical:104,stroke:4.4},
  tape:{axis:140,centerY:332,scaleX:.60,scaleY:.875},
  fma:{centers:[135,269,402,516],dividers:[203,337,470],dividerTop:44,dividerBottom:82,
   primaryY:56,cwsY:131,cwsWidth:93,cwsHeight:34},
  dh:{x:463,y:485,size:35},radioAltitude:{x:463,y:525,size:42},
  mach:{x:97,y:579,size:39}
 });
 const ehsi=Object.freeze({
  expanded:{roseCenter:[256,418],radius:333,radiusX:372,degrees:70},
  centerMap:{roseCenter:[256,302],radius:150,radiusX:178,degrees:360},
  full:{roseCenter:[256,280],radius:115,radiusX:134,degrees:360},
  header:{left:76,right:437,top:52,second:76,heading:59,radioFullHeading:120},
  wind:{expanded:[70,440],center:[69,441],full:[75,439]},
  labels:{waypoint:20,detail:18,expanded:23,center:20,full:23},
  palette:{white:'#e3e9e6',green:'#26ed36',magenta:'#e649e7',cyan:'#63dff5'}
 });
 const api=Object.freeze({eadi,ehsi});root.B737EfisReferenceGeometry=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
