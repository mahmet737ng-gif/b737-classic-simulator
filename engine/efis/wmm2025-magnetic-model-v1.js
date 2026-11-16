/* NOAA NCEI / BGS World Magnetic Model WMM2025; public domain.
 * WGS84 spherical harmonic degree 12, annual secular variation 2025-2029.
 * Test against NOAA WMM2025_TEST_VALUES.txt; not a physical aircraft sensor.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737WMM2025V1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_WMM2025_0001',EPOCH=2025,UNTIL=2030;
 const COF=[[1,0,-29351.8,0,12,0],[1,1,-1410.8,4545.4,9.7,-21.5],[2,0,-2556.6,0,-11.6,0],[2,1,2951.1,-3133.6,-5.2,-27.7],[2,2,1649.3,-815.1,-8,-12.1],[3,0,1361,0,-1.3,0],[3,1,-2404.1,-56.6,-4.2,4],[3,2,1243.8,237.5,0.4,-0.3],[3,3,453.6,-549.5,-15.6,-4.1],[4,0,895,0,-1.6,0],[4,1,799.5,278.6,-2.4,-1.1],[4,2,55.7,-133.9,-6,4.1],[4,3,-281.1,212,5.6,1.6],[4,4,12.1,-375.6,-7,-4.4],[5,0,-233.2,0,0.6,0],[5,1,368.9,45.4,1.4,-0.5],[5,2,187.2,220.2,0,2.2],[5,3,-138.7,-122.9,0.6,0.4],[5,4,-142,43,2.2,1.7],[5,5,20.9,106.1,0.9,1.9],[6,0,64.4,0,-0.2,0],[6,1,63.8,-18.4,-0.4,0.3],[6,2,76.9,16.8,0.9,-1.6],[6,3,-115.7,48.8,1.2,-0.4],[6,4,-40.9,-59.8,-0.9,0.9],[6,5,14.9,10.9,0.3,0.7],[6,6,-60.7,72.7,0.9,0.9],[7,0,79.5,0,0,0],[7,1,-77,-48.9,-0.1,0.6],[7,2,-8.8,-14.4,-0.1,0.5],[7,3,59.3,-1,0.5,-0.8],[7,4,15.8,23.4,-0.1,0],[7,5,2.5,-7.4,-0.8,-1],[7,6,-11.1,-25.1,-0.8,0.6],[7,7,14.2,-2.3,0.8,-0.2],[8,0,23.2,0,-0.1,0],[8,1,10.8,7.1,0.2,-0.2],[8,2,-17.5,-12.6,0,0.5],[8,3,2,11.4,0.5,-0.4],[8,4,-21.7,-9.7,-0.1,0.4],[8,5,16.9,12.7,0.3,-0.5],[8,6,15,0.7,0.2,-0.6],[8,7,-16.8,-5.2,0,0.3],[8,8,0.9,3.9,0.2,0.2],[9,0,4.6,0,0,0],[9,1,7.8,-24.8,-0.1,-0.3],[9,2,3,12.2,0.1,0.3],[9,3,-0.2,8.3,0.3,-0.3],[9,4,-2.5,-3.3,-0.3,0.3],[9,5,-13.1,-5.2,0,0.2],[9,6,2.4,7.2,0.3,-0.1],[9,7,8.6,-0.6,-0.1,-0.2],[9,8,-8.7,0.8,0.1,0.4],[9,9,-12.9,10,-0.1,0.1],[10,0,-1.3,0,0.1,0],[10,1,-6.4,3.3,0,0],[10,2,0.2,0,0.1,0],[10,3,2,2.4,0.1,-0.2],[10,4,-1,5.3,0,0.1],[10,5,-0.6,-9.1,-0.3,-0.1],[10,6,-0.9,0.4,0,0.1],[10,7,1.5,-4.2,-0.1,0],[10,8,0.9,-3.8,-0.1,-0.1],[10,9,-2.7,0.9,0,0.2],[10,10,-3.9,-9.1,0,0],[11,0,2.9,0,0,0],[11,1,-1.5,0,0,0],[11,2,-2.5,2.9,0,0.1],[11,3,2.4,-0.6,0,0],[11,4,-0.6,0.2,0,0.1],[11,5,-0.1,0.5,-0.1,0],[11,6,-0.6,-0.3,0,0],[11,7,-0.1,-1.2,0,0.1],[11,8,1.1,-1.7,-0.1,0],[11,9,-1,-2.9,-0.1,0],[11,10,-0.2,-1.8,-0.1,0],[11,11,2.6,-2.3,-0.1,0],[12,0,-2,0,0,0],[12,1,-0.2,-1.3,0,0],[12,2,0.3,0.7,0,0],[12,3,1.2,1,0,-0.1],[12,4,-1.3,-1.4,0,0.1],[12,5,0.6,0,0,0],[12,6,0.6,0.6,0.1,0],[12,7,0.5,-0.1,0,0],[12,8,-0.1,0.8,0,0],[12,9,-0.4,0.1,0,0],[12,10,-0.2,-1,-0.1,0],[12,11,-1.3,0.1,0,0],[12,12,-0.7,0.2,-0.1,-0.1]];
 const N=12,A=6378.137,B=6356.7523142,R=6371.2,RAD=Math.PI/180;
 const valid=x=>typeof x==='number'&&Number.isFinite(x);
 const norm=x=>((x%360)+360)%360;
 const c=Array.from({length:13},()=>Array(13).fill(0));
 const cd=Array.from({length:13},()=>Array(13).fill(0));
 const k=Array.from({length:13},()=>Array(13).fill(0));
 const sn=Array.from({length:13},()=>Array(13).fill(0));sn[0][0]=1;
 for(const [n,m,g,h,dg,dh] of COF){c[m][n]=g;cd[m][n]=dg;if(m){c[n][m-1]=h;cd[n][m-1]=dh;}}
 for(let n=1;n<=N;n++){
  sn[0][n]=sn[0][n-1]*(2*n-1)/n;let j=2;
  for(let m=0;m<=n;m++){
   k[m][n]=n===1?0:((n-1)*(n-1)-m*m)/((2*n-1)*(2*n-3));
   if(m){
    sn[m][n]=sn[m-1][n]*Math.sqrt((n-m+1)*j/(n+m));j=1;
    c[n][m-1]*=sn[m][n];cd[n][m-1]*=sn[m][n];
   }
   c[m][n]*=sn[m][n];cd[m][n]*=sn[m][n];
  }
 }
 function decimalYear(date){
  if(valid(date))return date;
  const d=date instanceof Date?date:date===undefined?new Date():new Date(date);
  if(!Number.isFinite(d.getTime()))return NaN;
  const y=d.getUTCFullYear(),start=Date.UTC(y,0,1),end=Date.UTC(y+1,0,1);
  return y+(d.getTime()-start)/(end-start);
 }
 function evaluate({lat,lon,altitudeFt=0,date}={}){
  const year=decimalYear(date);
  if(!valid(lat)||Math.abs(lat)>90||!valid(lon)||Math.abs(lon)>360||
     !valid(altitudeFt)||altitudeFt< -3280||altitudeFt>2788000||
     !valid(year)||year<EPOCH||year>=UNTIL)
   return {valid:false,source:VERSION,reason:'INVALID_WMM2025_LOCATION_ALTITUDE_OR_EPOCH',declinationDeg:null};
  const h=altitudeFt*.0003048;
  const a2=A*A,b2=B*B,c2=a2-b2,a4=a2*a2,b4=b2*b2;
  const phi=lat*RAD,lambda=lon*RAD,sl=Math.sin(phi),cl=Math.cos(phi);
  const q=Math.sqrt(a2-c2*sl*sl),q1=h*q,q2=((q1+a2)/(q1+b2))**2;
  const ct=sl/Math.sqrt(q2*cl*cl+sl*sl),st=Math.sqrt(Math.max(0,1-ct*ct));
  const radius=Math.sqrt(h*h+2*q1+(a4-(a4-b4)*sl*sl)/(q*q));
  const d=Math.sqrt(a2*cl*cl+b2*sl*sl),ca=(h+d)/radius,sa=c2*cl*sl/(radius*d);
  const sp=Array(13).fill(0),cp=Array(13).fill(0);cp[0]=1;
  sp[1]=Math.sin(lambda);cp[1]=Math.cos(lambda);
  for(let m=2;m<=N;m++){
   sp[m]=sp[1]*cp[m-1]+cp[1]*sp[m-1];
   cp[m]=cp[1]*cp[m-1]-sp[1]*sp[m-1];
  }
  const pp=Array(13).fill(0);pp[0]=1;
  const p=Array.from({length:13},()=>Array(13).fill(0));
  const dp=Array.from({length:13},()=>Array(13).fill(0));p[0][0]=1;
  const dt=year-EPOCH,aor=R/radius;let ar=aor*aor,bt=0,bp=0,br=0,bpp=0;
  for(let n=1;n<=N;n++){
   ar*=aor;
   for(let m=0;m<=n;m++){
    if(n===m){
     p[m][n]=st*p[m-1][n-1];
     dp[m][n]=st*dp[m-1][n-1]+ct*p[m-1][n-1];
    }else if(n===1&&m===0){
     p[m][n]=ct*p[m][n-1];
     dp[m][n]=ct*dp[m][n-1]-st*p[m][n-1];
    }else{
     p[m][n]=ct*p[m][n-1]-k[m][n]*p[m][n-2];
     dp[m][n]=ct*dp[m][n-1]-st*p[m][n-1]-k[m][n]*dp[m][n-2];
    }
    const g=c[m][n]+dt*cd[m][n],hg=m?c[n][m-1]+dt*cd[n][m-1]:0;
    const t1=g*cp[m]+hg*sp[m],t2=g*sp[m]-hg*cp[m];
    const par=ar*p[m][n];
    bt-=ar*t1*dp[m][n];bp+=m*t2*par;br+=(n+1)*t1*par;
    if(st<1e-9&&m===1){
     if(n===1)pp[n]=pp[n-1];else pp[n]=ct*pp[n-1]-k[m][n]*pp[n-2];
     bpp+=m*t2*ar*pp[n];
    }
   }
  }
  bp=st<1e-9?bpp:bp/st;
  const north=-bt*ca-br*sa,east=bp,down=bt*sa-br*ca,horizontal=Math.hypot(north,east);
  if(!valid(horizontal)||horizontal<2000)
   return {valid:false,source:VERSION,reason:'MAGNETIC_POLAR_BLACKOUT_UNRELIABLE',declinationDeg:null};
  return {valid:true,source:'NOAA_NCEI_BGS_WMM2025',quality:'MODELED_NOT_MEASURED',
   declinationDeg:Math.atan2(east,north)/RAD,northNt:north,eastNt:east,downNt:down,
   horizontalNt:horizontal,decimalYear:year,lat,lon,altitudeFt};
 }
 return Object.freeze({VERSION,EPOCH,UNTIL,COEFFICIENT_COUNT:COF.length,decimalYear,evaluate,
  trueToMag:(x,variation)=>valid(x)&&valid(variation)?norm(x-variation):null,
  magToTrue:(x,variation)=>valid(x)&&valid(variation)?norm(x+variation):null});
});
