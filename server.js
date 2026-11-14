'use strict';
/* Standalone ATA24 lab gateway. No upstream application routes or cross-app writes. */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const USER = process.env.LAB_USER || 'Ali.m';
const BUILTIN_SCRYPT = 'scrypt:e16e63d5777399754f7b87d6666a7768:575fd8471f434a6e088f38abde8e62ce9a9cec892bd70b69ff07593d0abed044b99e0b5cd93f36bd4c83e340e96fdc9d4ce2bbe2a762d6aa3098d2b1d680ba89';
const PASSWORD_HASH = process.env.LAB_PASSWORD_SCRYPT || BUILTIN_SCRYPT;
const MAX_DEVICES = 3;
const ACTIVE_FOR_MINUTES = 20;
const TOKEN_COOKIE = 'ata24_session';
const DEVICE_COOKIE = 'ata24_device';
const folder = path.join(__dirname, 'public');
const runtimeDir = path.join(__dirname, 'runtime');
const runtimeFiles = new Set(require('./runtime/manifest.json'));

/* The protected guest is a live mirror of the original main-branch cockpit.
 * Railway authenticates and serves the same source URLs under its own origin.
 * No duplicated/stale overhead code or artwork is maintained here. */
const {Readable} = require('node:stream');
const GITHUB_RAW = 'https://raw.githubusercontent.com/mahmet737ng-gif/b737-classic-simulator/main/';
const GITHUB_PAGES = 'https://mahmet737ng-gif.github.io/b737-classic-simulator/';
const UPSTREAM_TIMEOUT_MS = 20000;
const ALLOWED_SOURCE_ROOTS = new Set([
  'acdc-metering-lab','approved-panel-stack','assets','audio','audio-lab',
  'branding','bus-consumer-test-lab','cb-panel-lab','cdu-font-test',
  'cdu-standalone','cdu-standalone-v3','cdu-standalone-v5','cdu-standalone-v6',
  'cpcs-lab','dcpcs-lab','eadi-attitude-lab','eadi-attitude-v5',
  'electrical-lab','electrical-load-lab','engine','fire-handle-lab',
  'fire-protection-lab','flight-controls-panel','fuel-panel','instrument-lab',
  'integration-lab','interactive-panel-test','isn-ecu-start-lab',
  'isn-electrical-pack-lab','isn-start-sequence-lab','main-panel-lab',
  'navigation','overhead-layout','panel-mosaic-lab','panels-stacked',
  'pneumatics-lab','shared-assets','stall-warning-lab','switch-lab',
  'systems-integration-lab','trainer-lab','vector-lab','technical-database',
  'data','navdata','mrg','aircon-lab','anti-ice-lab','apu-lab','hydraulic-lab'
]);
const PROXY_EXTENSIONS = new Set(['.html','.htm','.js','.mjs','.cjs','.css','.json','.svg',
 '.png','.jpg','.jpeg','.webp','.gif','.avif','.ico','.woff','.woff2','.ttf',
 '.webmanifest','.txt','.csv','.xml','.wasm','.bin','.mp3','.mp4','.webm','.pdf']);
const PROXY_MIME = Object.freeze({
 '.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.cjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
 '.gif':'image/gif','.avif':'image/avif','.ico':'image/x-icon',
 '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf',
 '.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8',
 '.csv':'text/csv; charset=utf-8','.xml':'application/xml',
 '.wasm':'application/wasm','.bin':'application/octet-stream',
 '.mp3':'audio/mpeg','.mp4':'video/mp4','.webm':'video/webm','.pdf':'application/pdf'
});
function repoAssetPath(urlPath) {
  // Only fixed source roots; never proxy untrusted network addresses.
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch (_) { return null; }
  if (decoded.includes('\\') || decoded.includes('\0') || decoded.includes('//')) return null;
  const segments=decoded.split('/').filter(Boolean);
  // A few approved photo references live directly in the repository root.
  if(segments.length===1 && /^[A-Za-z0-9_.-]+\.(?:png|webp|svg|jpg|jpeg)$/i.test(segments[0]))
    return segments[0];
  if (!segments.length || !ALLOWED_SOURCE_ROOTS.has(segments[0])) return null;
  if (segments.some(p=>p==='..' || p==='.' || p.startsWith('.'))) return null;
  if (segments.length===1 || decoded.endsWith('/')) segments.push('index.html');
  const rel=segments.join('/');
  if (!PROXY_EXTENSIONS.has(path.posix.extname(rel).toLowerCase())) return null;
  return rel;
}
async function upstreamFetch(relative) {
  // Use source on main, not a second copied cockpit. Pages is a fallback for
  // deployed generated assets absent from the checked-in main branch.
  for (const origin of [GITHUB_RAW,GITHUB_PAGES]) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),UPSTREAM_TIMEOUT_MS);
    try {
      const response=await fetch(origin+relative,{signal:controller.signal,
        headers:{'User-Agent':'ATA24-guest-training-gateway','Accept':'*/*'},
        redirect:'follow',cache:'no-store'});
      clearTimeout(timer);
      if(response.ok)return response;
      await response.body?.cancel();
      if(response.status!==404)throw Error('GitHub upstream returned '+response.status);
    }catch(e){clearTimeout(timer);if(origin===GITHUB_PAGES)throw e;}
  }
  return null;
}
function transformCockpitHTML(content) {
  // Only presentation changes: preserve all original ordered scripts and code.
  const injection = '<base href="/panel-mosaic-lab/cockpit/">'+
    '<link rel="stylesheet" href="/static/guest-cockpit.css">'+
    '<script src="/static/guest-cockpit.js" defer></script>';
  if(!/<head\b[^>]*>/i.test(content))throw Error('Source cockpit document is malformed');
  let result=content.replace(/<head\b[^>]*>/i,m=>m+injection);
  result=result.replace(/<title>[\s\S]*?<\/title>/i,'<title>B737 Classic | Electrical Training Bench</title>');
  result=result.replace(/(<meta\b[^>]*name="(?:application-name|apple-mobile-web-app-title)"[^>]*content=")[^"]*(")/gi,'$1B737 Classic$2');
  result=result.replace(/<body\b[^>]*>/i,m=>m+'<button id="guestSourceOverheadFocus" type="button" data-focus="overhead" hidden aria-hidden="true"></button>');
  return result;
}
async function serveGitHubSource(req,res,relative,{cockpitDocument=false}={}) {
  let response;
  try { response=await upstreamFetch(relative); }
  catch(e) {
    console.error('GitHub source unavailable',relative,e.message);
    res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('Source repository is temporarily unavailable');return;
  }
  if(!response) {
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('File not available in source repository');return;
  }
  const ext=path.posix.extname(relative).toLowerCase();
  const mime=PROXY_MIME[ext]||'application/octet-stream';
  // All original GitHub HTML documents may contain their own inline cockpit
  // and test-lab boot scripts. Preserve those contracts on the Railway origin.
  if(ext==='.html' || ext==='.htm') {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; "+
      "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; "+
      "connect-src 'self' https:; font-src 'self' data:; media-src 'self' blob: https:; "+
      "worker-src 'self' blob:; frame-src 'self'; object-src 'none'; "+
      "base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
  }
  if(cockpitDocument) {
    // The full cockpit runs with the scripts' original same-origin and inline
    // boot contracts; the separately protected static guest files only change
    // visible panels and startup focus.
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; "+
      "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; "+
      "connect-src 'self' https:; font-src 'self' data:; media-src 'self' blob: https:; "+
      "worker-src 'self' blob:; frame-src 'self'; object-src 'none'; "+
      "base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
    const html=transformCockpitHTML(await response.text());
    res.setHeader('Cache-Control','private, no-store');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(html);return;
  }
  res.setHeader('Cache-Control','private, max-age=30');
  res.writeHead(200,{'Content-Type':mime});
  if(req.method==='HEAD') {await response.body?.cancel();res.end();return;}
  if(!response.body){res.end();return;}
  const source=Readable.fromWeb(response.body);
  source.on('error',e=>{console.error('Upstream stream interrupted',relative,e.message);res.destroy(e);});
  source.pipe(res);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000 });
const attemptMap = new Map();
const assets = Object.freeze({
  '/': ['index.html','text/html; charset=utf-8'],
  '/lab/': ['lab.html','text/html; charset=utf-8'],
  '/static/portal.css': ['portal.css','text/css; charset=utf-8'],
  '/static/portal.js': ['portal.js','text/javascript; charset=utf-8'],
  '/static/guest-cockpit.css': ['guest-cockpit.css','text/css; charset=utf-8'],
  '/static/guest-cockpit.js': ['guest-cockpit.js','text/javascript; charset=utf-8'],
  '/static/portal-overhead.css': ['portal-overhead.css','text/css; charset=utf-8'],
  '/static/portal-overhead.js': ['portal-overhead.js','text/javascript; charset=utf-8'],
  '/static/lab-injection.js': ['lab-injection.js','text/javascript; charset=utf-8'],
  '/static/app.js': ['app.js','text/javascript; charset=utf-8'],
  '/static/session.js': ['session.js','text/javascript; charset=utf-8'],
  '/static/style.css': ['style.css','text/css; charset=utf-8'],
  '/static/mrg-electrical-plate-v2.css': ['mrg-electrical-plate-v2.css','text/css; charset=utf-8'],
  '/static/electrical-v7.js': ['electrical-v7.js','text/javascript; charset=utf-8'],
  '/static/classic-multifeed-topology-v1.js': ['classic-multifeed-topology-v1.js','text/javascript; charset=utf-8'],
  '/static/classic-bus-consumer-engine-v1.js': ['classic-bus-consumer-engine-v1.js','text/javascript; charset=utf-8'],
  '/static/classic-bus-consumer-test-lab-v1.js': ['classic-bus-consumer-test-lab-v1.js','text/javascript; charset=utf-8'],
  '/static/mrg-electrical-plate-v2.js': ['mrg-electrical-plate-v2.js','text/javascript; charset=utf-8'],
  '/static/mrg-classic-340-consumer-bus-index-v1.json': ['mrg-classic-340-consumer-bus-index-v1.json','application/json; charset=utf-8']
});
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function random() { return crypto.randomBytes(32).toString('base64url'); }
function cookies(req) {
  const result = Object.create(null);
  for (const chunk of String(req.headers.cookie || '').split(';')) {
    const i = chunk.indexOf('=');
    if (i > 0) {
      try { result[chunk.slice(0,i).trim()] = decodeURIComponent(chunk.slice(i+1).trim()); } catch (_) {}
    }
  }
  return result;
}
function cookie(req, name, value, age) {
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  return name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + age + (secure ? '; Secure' : '');
}
function commonHeaders(req,res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-src 'self'; frame-ancestors 'self'");
  if (req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
}
function redirect(res,location,extraHeaders={}) {
  res.writeHead(303,{Location:location,...extraHeaders});res.end();
}
function verifyPassword(pass) {
  try {
    const bits = PASSWORD_HASH.split(':');
    if (bits.length!==3 || bits[0]!=='scrypt') return false;
    const target = Buffer.from(bits[2],'hex');
    const actual = crypto.scryptSync(String(pass),bits[1],target.length);
    return target.length > 0 && crypto.timingSafeEqual(actual,target);
  } catch (_) { return false; }
}
function loginHTML(error) {
  const errorHTML = error === 'full' ? '<div class="notice" role="alert">All three device slots are currently occupied. Sign out from another device or retry after its session expires.</div>'
    : error === 'invalid' ? '<div class="notice" role="alert">Incorrect username or password.</div>'
    : error === 'rate' ? '<div class="notice" role="alert">Too many attempts. Retry in 15 minutes.</div>' : '';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow"><title>Access | ATA24 Test Bench</title>'
    + '<style>*,*::before,*::after{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0%,#17384d,#09131f 55%,#060c14);color:#f1f6fa;font-family:system-ui,Arial,sans-serif;display:grid;place-items:center;padding:24px}.card{width:min(100%,425px);background:#101f2c;border:1px solid #31556e;border-radius:18px;padding:34px;box-shadow:0 24px 80px #0008}.eyebrow{color:#67c8f8;font:700 11px monospace;letter-spacing:.16em}h1{font-size:27px;line-height:1.2;margin:10px 0 7px}p{color:#9eb6c7;font-size:13px;line-height:1.6;margin:0 0 26px}label{display:block;font-size:12px;font-weight:650;color:#bcd2e2;margin:17px 0 7px}input{width:100%;padding:13px 14px;border-radius:9px;background:#0a1723;color:#fff;border:1px solid #39566b;font:inherit}input:focus{outline:2px solid #63bdf7}button{width:100%;padding:14px;border-radius:10px;background:#2689ba;color:#fff;border:0;font-weight:750;cursor:pointer;margin-top:23px}button:hover{background:#3aa8dd}.foot{font:11px monospace;color:#789aac;text-align:center;margin-top:23px}.notice{color:#ffbfbf;background:#4a2029;border:1px solid #a24b59;border-radius:8px;padding:12px;font-size:12px;margin-bottom:16px}</style></head>'
    + '<body><main class="card"><span class="eyebrow">B737 CLASSIC / ATA 24</span><h1>Electrical Test Bench</h1><p>Authorized device access only. Up to three active browser devices.</p>'
    + errorHTML + '<form method="post" action="/api/login" autocomplete="on"><label for="user">Username</label><input id="user" name="username" autocomplete="username" required maxlength="100" autofocus>'
    + '<label for="pass">Password</label><input id="pass" name="password" type="password" autocomplete="current-password" required maxlength="200">'
    + '<button type="submit">SIGN IN</button></form><div class="foot">SESSION PROTECTED · INDEPENDENT TEST ENVIRONMENT</div></main></body></html>';
}
async function body(req) {
  return await new Promise((resolve,reject) => {
    let s='';
    req.on('data',d=>{ s+=d; if (s.length>4096) { reject(new Error('BODY_TOO_LARGE')); req.destroy(); } });
    req.on('end',()=>resolve(s));
    req.on('error',reject);
  });
}
async function authorized(req) {
  const token = cookies(req)[TOKEN_COOKIE];
  if (!token || token.length < 30 || token.length > 128) return false;
  const result = await pool.query(
    "UPDATE ata24_devices SET last_seen=now() WHERE session_hash=$1 AND last_seen>now()-interval '20 minutes' RETURNING session_hash",
    [hash(token)]
  );
  return result.rowCount===1;
}
async function signIn(req,res) {
  const now=Date.now(), ip=String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim().slice(0,80);
  if (attemptMap.size>5000) attemptMap.clear();
  const bucket=attemptMap.get(ip)||{n:0,until:now+900000};
  if (bucket.until<now) { bucket.n=0; bucket.until=now+900000; }
  if (bucket.n>=8) { redirect(res,'/login?e=rate');return; }
  const payload=new URLSearchParams(await body(req));
  const username=String(payload.get('username')||'');
  const password=String(payload.get('password')||'');
  const valid=verifyPassword(password) && username===USER;
  if (!valid) {
    bucket.n++;attemptMap.set(ip,bucket);
    redirect(res,'/login?e=invalid');return;
  }
  attemptMap.delete(ip);
  const existing=cookies(req)[DEVICE_COOKIE];
  const device=typeof existing==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(existing)?existing:random();
  const token=random();
  const client=await pool.connect();
  let allowed=false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(73724003)');
    await client.query("DELETE FROM ata24_devices WHERE last_seen <= now() - interval '20 minutes'");
    const same=await client.query('SELECT device_hash FROM ata24_devices WHERE device_hash=$1',[hash(device)]);
    const count=await client.query('SELECT count(*)::int AS total FROM ata24_devices');
    if (same.rowCount>0 || count.rows[0].total<MAX_DEVICES) {
      await client.query('DELETE FROM ata24_devices WHERE device_hash=$1',[hash(device)]);
      await client.query('INSERT INTO ata24_devices(device_hash,session_hash,last_seen) VALUES($1,$2,now())',[hash(device),hash(token)]);
      allowed=true;
    }
    await client.query('COMMIT');
  } catch(e) {
    await client.query('ROLLBACK').catch(()=>{});
    throw e;
  } finally { client.release(); }
  if (!allowed) { redirect(res,'/login?e=full');return; }
  redirect(res,'/',{'Set-Cookie':[
    cookie(req,DEVICE_COOKIE,device,60*60*24*30),
    cookie(req,TOKEN_COOKIE,token,60*60*24*7)
  ]});
}
async function handle(req,res) {
  commonHeaders(req,res);
  const url=new URL(req.url,'http://localhost');
  if (url.pathname==='/healthz') { res.writeHead(200,{'Content-Type':'text/plain'});res.end('ok');return; }
  if (req.method==='GET' && url.pathname==='/login') {
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(loginHTML(url.searchParams.get('e')));return;
  }
  if (req.method==='POST' && url.pathname==='/api/login') { await signIn(req,res);return; }
  const ok=await authorized(req);
  if (!ok) {
    if (req.method==='GET') redirect(res,'/login');
    else {res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"unauthorized"}');}
    return;
  }
  if (req.method==='POST' && url.pathname==='/api/pulse') {
    res.writeHead(204);res.end();return;
  }
  if (req.method==='POST' && url.pathname==='/api/logout') {
    const token=cookies(req)[TOKEN_COOKIE];
    if (token) await pool.query('DELETE FROM ata24_devices WHERE session_hash=$1',[hash(token)]);
    redirect(res,'/login',{'Set-Cookie':cookie(req,TOKEN_COOKIE,'',0)});return;
  }
  if ((req.method==='GET' || req.method==='HEAD') && url.pathname==='/') {
    // Keep the original cockpit's relative location.href resolution unchanged.
    // The full GitHub cockpit is served under the Railway origin.
    redirect(res,'/panel-mosaic-lab/cockpit/');return;
  }
  if (req.method==='GET' || req.method==='HEAD') {
    const sourcePath=repoAssetPath(url.pathname);
    if(sourcePath) {
      await serveGitHubSource(req,res,sourcePath,{
        cockpitDocument:sourcePath==='panel-mosaic-lab/cockpit/index.html'
      });
      return;
    }
  }
  if (req.method==='GET' && Object.hasOwn(assets,url.pathname)) {
    const [filename,type]=assets[url.pathname];
    const contents=await fs.readFile(path.join(folder,filename));
    res.writeHead(200,{'Content-Type':type});
    res.end(contents);return;
  }
  // Authenticated, explicit manifest only. No fallback to the upstream project.
  // Preserve original folder structure for the photo-based overhead and CB engines.
  const rawRuntimePath = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
  // Asset names may contain spaces and Unicode. Decode only after URL parsing;
  // an exact manifest match is required before reading a filesystem path.
  let runtimePath;
  try { runtimePath = decodeURIComponent(rawRuntimePath); }
  catch (_) {res.writeHead(400);res.end('Bad path');return;}
  if (req.method==='GET' && runtimeFiles.has(runtimePath)) {
    const rel = runtimePath.slice(1);
    const ext = path.extname(rel).toLowerCase();
    const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
      '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
      '.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp',
      '.jpg':'image/jpeg','.jpeg':'image/jpeg'}[ext];
    if (!mime) {res.writeHead(404);res.end();return;}
    const contents = await fs.readFile(path.join(runtimeDir,rel));
    res.writeHead(200,{'Content-Type':mime});
    res.end(contents);return;
  }
  res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');
}
async function start() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required: attach a Postgres service.');
  await pool.query('CREATE TABLE IF NOT EXISTS ata24_devices(device_hash text PRIMARY KEY,session_hash text UNIQUE NOT NULL,last_seen timestamptz NOT NULL DEFAULT now())');
  http.createServer((req,res)=>handle(req,res).catch(e=>{
    console.error('Gateway request failed:',e.message);
    if (!res.headersSent) {res.writeHead(503,{'Content-Type':'text/plain'});res.end('Service temporarily unavailable');}
    else res.end();
  })).listen(PORT,'0.0.0.0',()=>console.log('ATA24 gateway listening on '+PORT));
}
start().catch(e=>{console.error('Gateway startup failed:',e.message);process.exit(1);});
