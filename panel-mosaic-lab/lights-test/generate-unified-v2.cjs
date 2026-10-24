/**
 * B737 Classic LIGHTS unified visual asset compiler.
 * Generates one reusable face per legend/state; no physical coordinates or
 * switching logic is inferred. The existing registries remain authoritative.
 * Run: node unified_lights_build.cjs
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'assets/locked/2026-10-23/LIGHTS');
const out = path.join(folder, 'unified-v2');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const write = (p, content) => { fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, content); };
const digest = s => crypto.createHash('sha256').update(s).digest('hex');
const esc = text => String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const unique = a => [...new Set(a)];
const pngLines = {
 AFT_CARGO:['AFT','CARGO'], AFT_ENTRY:['AFT','ENTRY'], AFT_SERVICE:['AFT','SERVICE'],
 AIR_STAIR:['AIR','STAIR'], AUTO_FAIL:['AUTO','FAIL'], BLEED_TRIP_OFF:['BLEED','TRIP OFF'],
 CAPT_STATIC_1_AUX_PS:['CAPT STATIC','1 AUX P/S'], COWL_ANTI_ICE:['COWL','ANTI ICE'],
 DUAL_BLEED:['DUAL','BLEED'], DUCT_OVERHEAT:['DUCT','OVERHEAT'], EQUIP:['EQUIP'],
 FO_PS_2_AUX_STATIC:['F/O P/S','2 AUX STATIC'], FWD_CARGO:['FWD','CARGO'],
 FWD_ENTRY:['FWD','ENTRY'], FWD_SERVICE:['FWD','SERVICE'],
 OFF_SCHED_DESCENT:['OFF SCHED','DESCENT'], PACK_TRIP_OFF:['PACK','TRIP OFF'],
 R_ALPHA_VANE:['R ALPHA','VANE'], TEMP_PROBE:['TEMP','PROBE'],
 WING_BODY_OVERHEAT:['WING-BODY','OVERHEAT']
};
const palettes = {
 amber:{name:'AMBER',main:'#ffda68',mid:'#ff990f',glow:'#ff5b09',bezel:'#c26b3c',glass:'#260f09',dim:'#291a15'},
 yellow:{name:'YELLOW',main:'#ffe52b',mid:'#ffd318',glow:'#ff9b00',bezel:'#b68b23',glass:'#221b08',dim:'#28210d'},
 white:{name:'WHITE',main:'#f7faff',mid:'#e0f2ff',glow:'#b3d7ff',bezel:'#687681',glass:'#101217',dim:'#1e2529'},
 red:{name:'RED',main:'#ff7077',mid:'#ff333f',glow:'#f00b27',bezel:'#9e3b42',glass:'#20080d',dim:'#311519'},
 green:{name:'GREEN',main:'#7cff91',mid:'#35f467',glow:'#07d339',bezel:'#367a46',glass:'#071b0e',dim:'#13291b'},
 blue:{name:'BLUE',main:'#f0fbff',mid:'#afdfff',glow:'#3b97ff',bezel:'#31598b',glass:'#154e96',dim:'#19232f'}
};
function paletteFor(l) {
 if (l.states.includes('BRIGHT_BLUE') || l.states.includes('DIM_BLUE')) return 'blue';
 if (l.id==='STAB_OUT_OF_TRIM') return 'yellow';
 if (l.id.endsWith('_GREEN')) return 'green';
 if (l.id.endsWith('_RED')) return 'red';
 if (l.id.endsWith('_WHITE')) return 'white';
 return 'amber';
}
function linesFor(l) {
 const p=pngLines[l.id]; if(p)return p;
 const name=l.assets.ON || l.assets.BRIGHT_BLUE || l.assets.DIM_BLUE;
 const xml=fs.readFileSync(path.join(folder,name),'utf8');
 const all=[...xml.matchAll(/<text\b[^>]*>([^<]+)<\/text>/gi)].map(m=>m[1].replaceAll('&amp;','&').trim());
 const texts=unique(all);
 if(l.id==='NOT_ARMED_VERTICAL')return ['NOT','ARMED'];
 return texts.length?texts:(l.lines||[l.id.replaceAll('_',' ')]);
}
function lampFace(l,state,texts,pal) {
 const [w,h]=[l.face.width,l.face.height];
 const vertical = h>w, square = h===w;
 const lit = state!=='OFF';
 const blue = pal.name==='BLUE';
 const dim = state==='DIM_BLUE';
 const label=esc(texts.join(' '));
 const font='Arial, Liberation Sans, Helvetica, sans-serif';
 const scaleX=w/600,scaleY=h/300;
 let textNodes='';
 if(l.id==='NOT_ARMED_VERTICAL'){
   // Preserve the unusual two-column vertical legend and all letter locations.
   const items=[['A',210,123],['N',90,225],['R',210,225],['O',90,327],['M',210,327],['T',90,429],['E',210,429],['D',210,531]];
   textNodes=items.map(([t,x,y])=>`<text x="${x}" y="${y}" font-size="90">${t}</text>`).join('');
 } else {
   const count=texts.length;
   const sizes = count===1 ? (square?128:vertical?105:156) : (square ? (count===3?78:104) : (count>=3?76:110));
   const ys=count===1?[h*.688]:count===2?[h*.455,h*.84]:count===3?[h*.325,h*.605,h*.875]:texts.map((_,i)=>h*(i+0.85)/(count+.2));
   textNodes=texts.map((t,i)=>{
      // Measure glyphs rather than relying on SVG textLength: libRSVG and
      // some embedded web views ignore textLength and clip long legends.
      const trueWidth = measuredText[t] || t.length*62;
      const s = Math.max(20,Math.min(sizes,Math.floor(w*.78*100/trueWidth)));
      return `<text x="${w/2}" y="${ys[i].toFixed(1)}" font-size="${s}">${esc(t)}</text>`;
   }).join('');
 }
 const center=`font-family="${font}" font-weight="700" text-anchor="middle"`;
 const fontFills=lit?{
  glow: dim?'#0b58a4':pal.glow, mid:dim?'#4899d9':pal.mid, main:dim?'#c6e5ff':pal.main
 }:{glow:pal.dim,mid:pal.dim,main:pal.dim};
 const background=blue&&lit?(dim?'#112f55':'#18569e'):lit?pal.glass:'#0c0b0c';
 const stroke=lit?pal.bezel:'#473a39';
 const id='b737-'+l.id.toLowerCase().replaceAll('_','-');
 // STAB has a bare glass-only socket in its approved background. No drawn bezel.
 const lensOnly = l.id==='STAB_OUT_OF_TRIM';
 const radius=square?8:vertical?14:18;
 const glass = lensOnly
  ? `<rect width="${w}" height="${h}" fill="${background}"/>`
  : `<rect x="2" y="2" width="${w-4}" height="${h-4}" rx="${radius}" fill="#080909" stroke="#1c1f20" stroke-width="4"/>
     <rect x="${4*scaleX}" y="${4*scaleY}" width="${w-8*scaleX}" height="${h-8*scaleY}" rx="${Math.max(6,radius-3)}" fill="url(#metal)" stroke="#07090a" stroke-width="${Math.max(1,3*scaleX)}"/>
     <rect x="${12*scaleX}" y="${11*scaleY}" width="${w-24*scaleX}" height="${h-22*scaleY}" rx="${Math.max(4,radius-8)}" fill="${stroke}" stroke="#0b0b0c" stroke-width="${Math.max(2,4*scaleX)}"/>
     <rect x="${19*scaleX}" y="${17*scaleY}" width="${w-38*scaleX}" height="${h-34*scaleY}" rx="${Math.max(3,radius-12)}" fill="${background}" stroke="${lit?pal.mid:'#4a3934'}" stroke-width="${Math.max(1.5,2.6*scaleX)}"/>
     <path d="M${23*scaleX} ${24*scaleY}H${w-23*scaleX}" stroke="${lit?pal.main:'#715a4f'}" stroke-width="${2.5*scaleY}" opacity="${lit?.38:.23}"/>`;
 const g=lit
  ? `<g ${center} fill="${fontFills.glow}" opacity="${dim?.57:.92}" filter="url(#textGlow)">${textNodes}</g>
     <g ${center} fill="${fontFills.mid}" opacity="${dim?.56:.82}" filter="url(#textSoft)">${textNodes}</g>
     <g ${center} fill="${fontFills.main}">${textNodes}</g>`
  : `<g ${center} fill="${fontFills.main}" opacity=".47">${textNodes}</g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label} ${esc(pal.name.toLowerCase())} annunciator ${state}">
 <defs>
  <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#41454a"/><stop offset=".17" stop-color="#14181a"/><stop offset=".83" stop-color="#0b0d0e"/><stop offset="1" stop-color="#34383c"/></linearGradient>
  <filter id="textGlow" x="-45%" y="-80%" width="190%" height="260%"><feGaussianBlur stdDeviation="${square?5:vertical?6:8.5}"/></filter>
  <filter id="textSoft" x="-25%" y="-35%" width="150%" height="170%"><feGaussianBlur stdDeviation="${square?1.65:2.1}"/></filter>
 </defs>
 ${glass}
 ${g}
 </svg>\n`;
}
const registry = read('lights-test/registry.json');
const measuredText = JSON.parse(execFileSync('python3',['-c',
 `import sys,json\nfrom PIL import ImageFont\nfont=ImageFont.truetype('/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf',100)\narr=json.load(sys.stdin)\nprint(json.dumps({t:font.getlength(t) for t in arr}))`
],{input:JSON.stringify(unique(registry.lights.flatMap(linesFor)))}).toString());
const overhead = read('interactive-overhead/lights.json');
const main = read('cockpit/lights.json');
const manifest = {schema:'B737-LIGHTS-UNIFIED-V2',version:'LGT-0013',source:'LIGHTS unique active legend registry',reference:['LOW_PRESSURE_AMBER_REF','R_ELEV_PITOT_AMBER_REF'],palette:palettes,lamps:[]};
let counts={},errors=[];
for(const l of registry.lights) {
 const color=paletteFor(l);const texts=linesFor(l);
 const lampInfo={id:l.id,legend:texts,palette:color,face:l.face,states:[...l.states],instances:overhead.lights.filter(x=>x.asset===l.id).length+main.lights.filter(x=>x.asset===l.id).length};
 for(const state of l.states){
  const newName=`unified-v2/${l.id}_${state}.svg`;
  // Preserve both user-approved faces byte-for-byte, including their approved glow/font.
  const trusted=(l.id==='LOW_PRESSURE'||l.id==='R_ELEV_PITOT') ? fs.readFileSync(path.join(folder,l.assets[state]),'utf8') : null;
  const svg=trusted||lampFace(l,state,texts,palettes[color]);
  write(path.join(folder,newName),svg);
  l.assets[state]=newName;
  const url=`../assets/locked/2026-10-23/LIGHTS/${newName}`;
  for(const parent of [overhead,main]){
   if(parent.assets[l.id]?.[state])parent.assets[l.id][state]={url,sha256:digest(svg)};
  }
  counts[state]=(counts[state]||0)+1;
 }
 manifest.lamps.push(lampInfo);
}
registry.version='LGT-0013';if(overhead.version!=='LGT-0004')overhead.previousVersion=overhead.version;overhead.version='LGT-0004';main.version='LGT-0008';
write(path.join(root,'lights-test/registry.json'),JSON.stringify(registry,null,2)+'\n');
write(path.join(root,'interactive-overhead/lights.json'),JSON.stringify(overhead,null,2)+'\n');
write(path.join(root,'cockpit/lights.json'),JSON.stringify(main,null,2)+'\n');
write(path.join(root,'lights-test/unified-v2-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const unknown=Object.entries(overhead.assets).concat(Object.entries(main.assets)).flatMap(([id,states])=>Object.entries(states).filter(([state,asset])=>!fs.existsSync(path.resolve(path.join(root,'interactive-overhead'),asset.url))).map(([state])=>id+':'+state));
console.log(JSON.stringify({types:registry.lights.length,states:counts,assets:Object.values(counts).reduce((a,b)=>a+b,0),overheadInstances:overhead.lights.length,mainInstances:main.lights.length,missingAssetReferences:unknown.slice(0,20),manifest:path.relative(__dirname,path.join(root,'lights-test/unified-v2-manifest.json'))},null,2));


