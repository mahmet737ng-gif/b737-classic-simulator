#!/usr/bin/env python3
"""Build display derivatives outside the locked artwork; lossless full-size pixel parity."""
import hashlib,json,re
from pathlib import Path
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'panel-mosaic-lab/cockpit/performance'
OUT.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
a=json.loads((ROOT/'panel-mosaic-lab/cockpit/assembly.json').read_text())
spec=json.loads((ROOT/'panel-mosaic-lab/all-overhead/spec.json').read_text())
paths={x['path'] for x in a['assets'].values()}
for x in spec['images']:
 paths.add(str((ROOT/'panel-mosaic-lab/all-overhead'/x['url']).resolve().relative_to(ROOT)))
paths.add('assets/overhead.webp')
paths.update(['cdu-standalone-v6/assets/cdu-approved-unlit.png','panel-mosaic-lab/assets/locked/2026-10-23/B737_FLAP_9_ORIGINAL_BMP_EXTRACTED.png'])
manifest={'schema':'b737.unified-performance.v1','images':{},'patches':{},'policy':'Originals and frozen renderer untouched; display previews use Lanczos/WebP quality 96; highest level is the byte-identical original for detailed zoom.'}
for path in sorted(paths):
 source=ROOT/path;raw=source.read_bytes();im=Image.open(source).convert('RGBA');digest=sha(raw);w,h=im.size;levels=[]
 # Original already-efficient WebPs still get viewport-sized derivatives.
 for extent in sorted(set(e for e in [384,768,1536] if e<max(w,h))):
  size=(max(1,round(w*extent/max(w,h))),max(1,round(h*extent/max(w,h))))
  pic=im.resize(size,Image.Resampling.LANCZOS)
  name=f'{digest[:20]}-q96-{extent}.webp';dest=OUT/name
  if not dest.exists() or not dest.stat().st_size:
   tmp=dest.with_suffix('.tmp');pic.save(tmp,'WEBP',quality=96,method=6,exact=True);tmp.replace(dest)
  decoded=Image.open(dest).convert('RGBA')
  assert decoded.size==pic.size,name
  levels.append({'width':size[0],'height':size[1],'extent':extent,'url':'panel-mosaic-lab/cockpit/performance/'+name,'bytes':dest.stat().st_size,'sha256':sha(dest.read_bytes())})
 levels.append({'width':w,'height':h,'extent':max(w,h),'url':path,'bytes':len(raw),'sha256':digest,'original':True})
 manifest['images'][path]={'width':w,'height':h,'sourceBytes':len(raw),'sourceSha256':digest,'levels':levels}
 print(path, 'preview',levels[0]['bytes'],'full',levels[-1]['bytes'],flush=True)
# One exact tiny texture patch replaces a forced download of the full throttle PNG.
flap=json.loads((ROOT/'panel-mosaic-lab/cockpit/flap-lever-test.json').read_text())
for path,cal in flap['backgroundCalibrations'].items():
 for c in cal.get('cosmeticCorrections',[]):
  r=c['sourceRect'];im=Image.open(ROOT/path).convert('RGBA').crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
  name='patch-'+sha(im.tobytes())[:20]+'.webp';im.save(OUT/name,'WEBP',lossless=True,method=6,exact=True)
  manifest['patches'][path+':'+','.join(str(r[k]) for k in ['x','y','w','h'])]='panel-mosaic-lab/cockpit/performance/'+name
# Only the two already-approved FLT correction sampling windows are visible in SVG.
source=Image.open(ROOT/'panel-mosaic-lab/assets/locked/2026-10-23/OH23-25-LOWER-CONTROLS-fad696c845df.png').convert('RGBA')
patch=Image.new('RGBA',source.size,(0,0,0,0))
for x,y,w,h in [(1052,332,46,28),(1405,333,47,29)]:patch.paste(source.crop((x,y,x+w,y+h)),(x,y))
name='label-patch-'+sha(patch.tobytes())[:20]+'.webp';patch.save(OUT/name,'WEBP',lossless=True,method=6,exact=True)
manifest['patches']['engine-start-label']='panel-mosaic-lab/cockpit/performance/'+name
manifest['version']='PERF-'+sha(json.dumps(manifest,sort_keys=True).encode())[:12]
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'manifest.js').write_text('globalThis.B737PerformanceAssets='+json.dumps(manifest,separators=(',',':'))+';\n')
# The embed-specific renderer is mechanically derived; frozen standalone code is unchanged.
source=(ROOT/'panel-mosaic-lab/all-overhead/stage.js').read_text()
changes={"img.src=asset.url;":"window.B737ImageLoader.assign(img,asset.url);", "img.src=assetById('UPPER').url;":"window.B737ImageLoader.assign(img,assetById('UPPER').url);", "photo.src=asset.url;":"window.B737ImageLoader.assign(photo,asset.url);", "photo.cloneNode(false)":"window.B737ImageLoader.clone(photo)","'./spec.json?ts='+Date.now()":"'./spec.json?v=UPD-0012'","'../upper-oh/geometry.json?ts='+Date.now()":"'../upper-oh/geometry.json?v=UPD-0012'","'./atlas-layout.json?ts='+Date.now()":"'./atlas-layout.json?v=UPD-0012'","{cache:'no-store'}":"{cache:'default'}"}
for old,new in changes.items():
 assert old in source,old
 source=source.replace(old,new)
(OUT/'overhead-renderer.js').write_text('/* Generated from frozen stage.js SHA256 '+sha((ROOT/'panel-mosaic-lab/all-overhead/stage.js').read_bytes())+'; geometry and controls unchanged. */\n'+source)
print('Total original bytes',sum(x['sourceBytes'] for x in manifest['images'].values()))
print('Total smallest levels',sum(x['levels'][0]['bytes'] for x in manifest['images'].values()))
keep={level['url'].split('/')[-1] for image in manifest['images'].values() for level in image['levels'] if not level.get('original')}
keep.update(path.split('/')[-1] for path in manifest['patches'].values())
for file in OUT.glob('*.webp'):
 if file.name not in keep:file.unlink()
print('Total full levels',sum(x['levels'][-1]['bytes'] for x in manifest['images'].values()))
