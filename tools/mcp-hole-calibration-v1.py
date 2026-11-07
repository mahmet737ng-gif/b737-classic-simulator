#!/usr/bin/env python3
"""Detect native MCP photo's real numeric glass; no image modifications.
Print source pixel profiles for window center calibration. Original 2172x433.
"""
from PIL import Image
import hashlib
from pathlib import Path
src=Path('panel-mosaic-lab/assets/locked/2026-10-23/B737_MCP_Blank_Panel.png')
im=Image.open(src).convert('RGB')
print('MCP SOURCE',im.size,'SHA256',hashlib.sha256(src.read_bytes()).hexdigest())
assert im.size==(2172,433)
windows={'courseL':(85,112,112,59),'speed':(485,115,147,56),
'heading':(826,113,119,58),'altitude':(1127,114,171,56),
'verticalSpeed':(1376,118,171,56),'courseR':(1932,120,121,55)}
def intervals(bits):
    a=[];start=None
    for i,b in enumerate(bits+[False]):
        if b and start is None:start=i
        if not b and start is not None:
            a.append((start,i-1));start=None
    return a
for id,(x,y,w,h) in windows.items():
    cx=x+w//2;cy=y+h//2
    print('\nWINDOW',id,'current',(x,y,w,h),'center',(cx,cy),'pixel',im.getpixel((cx,cy)))
    for yy in sorted(set([y+5,y+13,y+h//2,y+h-12,y+h-4])):
        for threshold in (25,40,60):
            low=max(0,x-38);high=min(2172,x+w+38)
            vals=[max(im.getpixel((xx,yy)))<=threshold for xx in range(low,high)]
            parts=[(a+low,b+low) for a,b in intervals(vals) if b-a>=12 and a+low<cx+80 and b+low>cx-80]
            print('row',yy,'T',threshold,parts)
    # show around center vertical intensity for four x locations
    for xx in [cx,cx-25,cx+25]:
        low=max(0,y-28);high=min(433,y+h+28)
        parts=[(a+low,b+low) for a,b in intervals([max(im.getpixel((xx,yy)))<=40 for yy in range(low,high)]) if b-a>=8]
        print('column',xx,'T40',parts)

# MCP-KNOB-0001: read ONLY immutable native photo. Estimate circular
# dark-hole boundaries and radial mean brightness. The scan is diagnostic:
# geometry is committed only after the measured centers/diameters are checked.
from math import sin,cos,pi
from statistics import mean,median
from PIL import ImageStat
spots={
 'courseL':(88,252,40,85),
 'speed':(565,274,35,83),
 'courseR':(2021,249,35,80)
}
def lum(px):
 return (px[0]*0.299+px[1]*0.587+px[2]*0.114)
def circle_summary(cx,cy,r,N=64):
 pts=[(round(cx+r*cos(2*pi*i/N)),round(cy+r*sin(2*pi*i/N))) for i in range(N)]
 vals=[lum(im.getpixel((x,y))) for x,y in pts if 0<=x<2172 and 0<=y<433]
 return mean(vals),median(vals)
for knob,(cx0,cy0,rmin,rmax) in spots.items():
 print('\\nNATIVE KNOB',knob,'previous center',cx0,cy0,'candidate rad',rmin,rmax)
 candidates=[]
 for cx in range(cx0-19,cx0+20,2):
  for cy in range(cy0-20,cy0+21,2):
   for rad in range(rmin,rmax,2):
    before,_=circle_summary(cx,cy,rad-4,N=32)
    after,_=circle_summary(cx,cy,rad+4,N=32)
    contrast=after-before # dark hole interior => brighter outside
    if contrast>0:
     candidates.append((round(contrast,3),cx,cy,rad,round(before,1),round(after,1)))
 candidates.sort(reverse=True)
 for x in candidates[:12]:print('RADIAL EDGE',knob,x)
 for cy in [cy0-15,cy0,cy0+15]:
  for cx in [cx0-15,cx0,cx0+15]:
   center=im.getpixel((cx,cy))
   print('GRID',knob,cx,cy,tuple(center))
# Asset intrinsic alpha/occupied bounding boxes; e.g. inset around photo
# makes a 100% CSS element appear materially smaller than its bounding box.
assets=[
 'panel-mosaic-lab/cockpit/assets/mcp-switches/COURSE_PHOTO_80.webp',
 'panel-mosaic-lab/cockpit/assets/mcp-ias-mach-knob.webp',
 'panel-mosaic-lab/cockpit/assets/mcp-switches/retina/course-480.webp',
 'panel-mosaic-lab/cockpit/assets/mcp-switches/retina/ias-480.webp'
]
for name in assets:
 try:
  img=Image.open(name).convert('RGBA')
  alpha=img.getchannel('A')
  print('KNOB ASSET',name,'size',img.size,'alpha bounds',alpha.point(lambda v:255 if v>=32 else 0).getbbox(),
        'alpha range',alpha.getextrema(),'area alpha>=32',(sum(int(v>=32) for v in alpha.getdata())))
 except Exception as e:print('ASSET ERROR',name,str(e))
