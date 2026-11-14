#!/usr/bin/env python3
"""Exact alpha silhouette measurements for four immutable owner ASP PNGs.
Uses only Python stdlib (PNG RGBA, noninterlaced); output matches in-browser
ASP-CENTER-0002 trimmed-alpha histogram (stride 2, 0.5%-99.5%).
Never alters original files.
"""
import json,struct,zlib,hashlib,pathlib
HERE=pathlib.Path(__file__).resolve().parent
NAMES=["mic-off.png","mic-on.png","volume-glass-off.png","volume-glass-on.png"]
def decode_alpha(path):
    b=path.read_bytes()
    assert b[:8]==b"\x89PNG\r\n\x1a\n"
    p=8;idata=bytearray(); w=h=channels=0; interlace=0
    while p<len(b):
        size=struct.unpack(">I",b[p:p+4])[0]; typ=b[p+4:p+8]
        data=b[p+8:p+8+size]; p+=size+12
        if typ==b"IHDR":
            w,h,depth,mode,comp,filt,interlace=struct.unpack(">IIBBBBB",data)
            assert depth==8 and mode==6 and interlace==0 and comp==0 and filt==0,(path.name,depth,mode,interlace)
            channels=4
        if typ==b"IDAT":idata.extend(data)
        if typ==b"IEND":break
    raw=zlib.decompress(idata); rowlen=w*channels
    assert len(raw)==h*(rowlen+1)
    previous=bytearray(rowlen);alpha=bytearray(w*h);offset=0
    for y in range(h):
        filter_type=raw[offset];line=bytearray(raw[offset+1:offset+1+rowlen]);offset+=rowlen+1
        if filter_type!=0:
            for i in range(rowlen):
                left=line[i-4] if i>=4 else 0
                up=previous[i]
                up_left=previous[i-4] if i>=4 else 0
                if filter_type==1:prediction=left
                elif filter_type==2:prediction=up
                elif filter_type==3:prediction=(left+up)//2
                elif filter_type==4:
                    p_=left+up-up_left
                    a=abs(p_-left);b_=abs(p_-up);c=abs(p_-up_left)
                    prediction=left if a<=b_ and a<=c else up if b_<=c else up_left
                else:raise ValueError("unknown PNG row filter "+str(filter_type))
                line[i]=(line[i]+prediction)&255
        for x in range(w):alpha[y*w+x]=line[x*4+3]
        previous=line
    return w,h,alpha
def bounds(w,h,alpha,stride=2):
    col=[0]*w;row=[0]*h;total=0;count=0
    for y in range(0,h,stride):
        for x in range(0,w,stride):
            a=alpha[y*w+x]
            if a<48:continue
            col[x]+=a;row[y]+=a;total+=a;count+=1
    assert count>=20
    def limit(hist,fromend=False):
        accum=0;indices=range(len(hist)-1,-1,-1) if fromend else range(len(hist))
        for i in indices:
            accum+=hist[i]
            if accum>=total*.005:return i
        return 0
    x0,x1=limit(col),limit(col,True)
    y0,y1=limit(row),limit(row,True)
    return {"x":x0,"y":y0,"w":x1-x0+stride,"h":y1-y0+stride,"cx":(x0+x1)/2,"cy":(y0+y1)/2,"width":w,"height":h,"coverage":round(count*stride*stride/(w*h),6)}
def main():
    result={}
    for name in NAMES:
        path=HERE/"assets"/"asp-controls-v1"/name
        w,h,alpha=decode_alpha(path)
        result[name]={"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),**bounds(w,h,alpha)}
    print("ASP_ALPHA_JSON="+json.dumps(result,separators=(",",":"),sort_keys=True))
if __name__=="__main__":main()
