#!/usr/bin/env python3
"""Extract high-resolution native front-view F/D OFF/ON from approved 5-pose atlas.
No source atlas modification. Uniform crop for both OFF and ON preserves pivot.
A/T uses original 256x260 SVG front drawings, no raster thumbnail.
"""
from PIL import Image
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
src=ROOT/'shared-assets/toggle-switch-small/Small_Silver_5Positions.webp'
out=ROOT/'panel-mosaic-lab/cockpit/assets/mcp-switches/native'
out.mkdir(parents=True,exist_ok=True)
im=Image.open(src).convert('RGBA')
w,h=im.size
assert w%5==0,(w,h)
cell=w//5
assert cell>=512 and h>=512,(w,h)
# The fourth image is the up pose, the fifth image is down.
poses={'ON':3,'OFF':4}
cells={}
for state,index in poses.items():
    image=im.crop((index*cell,0,(index+1)*cell,h))
    alpha=image.getchannel('A')
    box=alpha.point(lambda v:255 if v>22 else 0).getbbox()
    assert box,(state,'no source content')
    cells[state]={'image':image,'bounds':box}
# One common center-crop across states, not a separate bbox per pose.
# This retains identical mechanical axis when toggling.
left=min(v['bounds'][0] for v in cells.values())
top=min(v['bounds'][1] for v in cells.values())
right=max(v['bounds'][2] for v in cells.values())
bottom=max(v['bounds'][3] for v in cells.values())
pad=max(14,round(cell*.025))
left=max(0,left-pad);top=max(0,top-pad)
right=min(cell,right+pad);bottom=min(h,bottom+pad)
cw=right-left;ch=bottom-top
# Keep aspect exactly for BOTH poses, with no stretch and no false background.
dest_size=(max(160,cw),max(160,ch))
for state,c in cells.items():
    cropped=c['image'].crop((left,top,right,bottom))
    cropped.save(out/('FD_'+state+'_NATIVE.png'),optimize=True)
record={'schema':'b737.mcp.fdpair.native.atlas-v1','original':str(src.relative_to(ROOT)),
 'sourceDimensions':[w,h],'cellDimensions':[cell,h],
 'singleCrop':[left,top,right,bottom],'outputSize':list(dest_size),
 'stateIndex':poses,'sourceUntouched':True,
 'note':'F/D front view uses original high-resolution SMALL SILVER 5-poses, original shared crop and mechanical pivot in both states'}
(out/'FD_NATIVE_MANIFEST.json').write_text(json.dumps(record,indent=2)+'\n')
print('MCP_NATIVE_FD_BUILD',json.dumps(record))
