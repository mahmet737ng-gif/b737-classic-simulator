'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.mjs':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.gif':'image/gif','.webp':'image/webp','.bmp':'image/bmp','.ico':'image/x-icon',
 '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf',
 '.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.mp4':'video/mp4',
 '.webm':'video/webm','.pdf':'application/pdf','.wasm':'application/wasm',
 '.xml':'application/xml','.txt':'text/plain; charset=utf-8','.map':'application/json'};
function createLocalServer({root,entry,version}) {
 const absolute=path.resolve(root),catalog=new Map();
 const inside=file=>{const r=path.relative(absolute,file);return r!==''&&!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r);};
 async function locate(url) {
  const pathname=decodeURIComponent(new URL(url,'http://localhost').pathname);
  if(pathname.includes('\0')||pathname.includes('\\'))return null;
  const parts=pathname.split('/');if(parts.some(s=>s.startsWith('.')))return null;
  let file=path.resolve(absolute,'.'+(pathname==='/'?'/'+entry:pathname));
  if(!inside(file))return null;
  if(catalog.has(file))return catalog.get(file);
  const pending=(async()=>{let stat=await fs.promises.stat(file);if(stat.isDirectory()){file=path.join(file,'index.html');stat=await fs.promises.stat(file);}
   if(!stat.isFile())return null;
   return {file,size:stat.size,etag:'"'+version+'-'+stat.size+'-'+Math.trunc(stat.mtimeMs)+'"'};
  })();
  catalog.set(file,pending);
  try{return await pending;}catch(error){catalog.delete(file);throw error;}
 }
 function reply(res,status,message) {res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(message);}
 return http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method))return reply(res,405,'Method not allowed');
  let item;try{item=await locate(req.url);}catch(error){return reply(res,error instanceof URIError?400:404,'Not found');}
  if(!item)return reply(res,403,'Not permitted');
  const {file,size,etag}=item;
  const headers={'Content-Type':TYPES[path.extname(file).toLowerCase()]||'application/octet-stream',
   'Content-Length':size,'Cache-Control':'no-cache','ETag':etag,
   'X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
  if(req.headers['if-none-match']===etag&&!req.headers.range){delete headers['Content-Length'];res.writeHead(304,headers);return res.end();}
  let start=0,end=size-1,status=200;
  if(req.headers.range){
   const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
   if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end();}
   if(!m[1])start=Math.max(0,size-Number(m[2]));
   else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>size-1||end<start){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end();}
   status=206;headers['Content-Range']='bytes '+start+'-'+end+'/'+size;headers['Content-Length']=end-start+1;
  }
  res.writeHead(status,headers);
  if(req.method==='HEAD'||!size)return res.end();
  const stream=fs.createReadStream(file,{start,end});
  stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 });
}
async function listenLocal(server,preferredPort=0) {
 function listen(port){return new Promise((resolve,reject)=>{const error=e=>{server.off('listening',ready);reject(e);};const ready=()=>{server.off('error',error);resolve(server.address().port);};server.once('error',error);server.once('listening',ready);server.listen(port,'127.0.0.1');});}
 try{return await listen(preferredPort);}catch(error){if(preferredPort&&error.code==='EADDRINUSE')return listen(0);throw error;}
}
module.exports={createLocalServer,listenLocal};
