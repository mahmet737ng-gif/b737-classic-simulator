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
