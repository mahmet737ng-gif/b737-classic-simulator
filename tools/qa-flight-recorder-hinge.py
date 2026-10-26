#!/usr/bin/env python3
"""Non-destructive annotation of OH06 FLIGHT RECORDER switch, hinge and lamp source pixels.
Output base64 jpeg previews for expert inspection. Does NOT change locked imagery.
"""
import base64,io,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
reg=json.loads((ROOT/"panel-mosaic-lab/interactive-overhead/lights.json").read_text())
item=next(x for x in reg["lights"] if x["id"]=="flight-recorder-off")
photo=ROOT/"panel-mosaic-lab/assets/locked/2026-10-23/OH01-06-source-9d8ac0ac86bd.png"
with Image.open(photo) as im:src=im.convert("RGB")
assert src.size==(1731,909),src.size
x,y,w,h=item["sourceRect"]
def emit(name,extent,magnify):
 left,top,right,bottom=extent
 target=src.crop(extent)
 d=ImageDraw.Draw(target)
 def rect(c,outline,width=2):d.rectangle((c[0]-left,c[1]-top,c[2]-left,c[3]-top),outline=outline,width=width)
 rect([x,y,x+w,y+h],"#ff2525",2)
 d.line((x+w/2-left-6,y+h/2-top,x+w/2-left+6,y+h/2-top),fill="#16ffae",width=2)
 d.line((x+w/2-left,y+h/2-top-6,x+w/2-left,y+h/2-top+6),fill="#16ffae",width=2)
 # Original pixel coordinate grid every 20 pixels with subtler 10px subdivisions.
 for i in range((left//20+1)*20,right,20):
  d.line((i-left,0,i-left,bottom-top),fill="#8b884a",width=1)
  d.text((i-left+2,3),str(i),fill="#ffffff")
 for i in range((top//20+1)*20,bottom,20):
  d.line((0,i-top,right-left,i-top),fill="#8b884a",width=1)
  d.text((2,i-top+2),str(i),fill="#ffffff")
 if magnify>1:target=target.resize(((right-left)*magnify,(bottom-top)*magnify),Image.Resampling.NEAREST)
 out=io.BytesIO();target.save(out,format="JPEG",quality=88)
 print("FLIGHT_HINGE_IMAGE",name,base64.b64encode(out.getvalue()).decode("ascii"))
emit("OH06-context-1x",(1330,310,1725,625),1)
emit("hinge-pocket-2x",(1390,395,1600,530),2)
emit("original-photo-1x",(1330,50,1725,715),1)
print("FLIGHT_HINGE_META",json.dumps({"originalSize":src.size,"currentRect":item["sourceRect"],"photo":str(photo.relative_to(ROOT))}))
