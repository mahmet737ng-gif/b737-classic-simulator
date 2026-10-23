#!/usr/bin/env python3
"""Publish exactly eight approved guarded switch PNGs, atomically and without overwrites.

Run with GITHUB_TOKEN (Contents: write) and an extracted ZIP containing assets_manifest.json
and an assets/ subdirectory. Example:
  GITHUB_TOKEN=... python upload_guarded_v1.py assets
"""
import base64, hashlib, json, os, sys, urllib.request
from pathlib import Path
REPO='mahmet737ng-gif/b737-classic-simulator'
API='https://api.github.com/repos/'+REPO
ROOT='switch-lab/assets/guarded-v1/'
MANIFEST=Path(__file__).with_name('assets_manifest.json')
def request(method,path,token,obj=None):
    data=json.dumps(obj).encode() if obj is not None else None
    r=urllib.request.Request(API+path,data=data,method=method,headers={
      'Accept':'application/vnd.github+json','Content-Type':'application/json',
      'Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'})
    with urllib.request.urlopen(r, timeout=60) as f:return json.load(f)
def main():
    token=os.getenv('GITHUB_TOKEN')
    if not token:raise SystemExit('GITHUB_TOKEN required (Contents: write).')
    folder=Path(sys.argv[1] if len(sys.argv)>1 else 'assets')
    root=MANIFEST.parent
    manifest=json.loads(MANIFEST.read_text('utf8'))
    entries=manifest['assets']
    if len(entries)!=8:raise SystemExit('Expected exactly eight images.')
    source=[]
    for e in entries:
        p=folder/e['file_png']
        if not p.exists():raise SystemExit('Missing '+str(p))
        b=p.read_bytes()
        if hashlib.sha256(b).hexdigest()!=e['sha256_png']:
            raise SystemExit('Checksum mismatch: '+str(p))
        source.append((ROOT+e['file_png'],b))
    head=request('GET','/git/ref/heads/main',token)['object']['sha']
    tree=request('GET','/git/commits/'+head,token)['tree']['sha']
    oldpaths={x['path'] for x in request('GET','/git/trees/'+tree+'?recursive=1',token)['tree']}
    for p,_ in source:
        if p in oldpaths:raise SystemExit('Refusing overwrite: '+p)
    items=[]
    for p,b in source:
        sha=request('POST','/git/blobs',token,{'encoding':'base64','content':base64.b64encode(b).decode('ascii')})['sha']
        items.append({'path':p,'mode':'100644','type':'blob','sha':sha})
    tree=request('POST','/git/trees',token,{'base_tree':tree,'tree':items})['sha']
    sha=request('POST','/git/commits',token,{'message':'assets: add 8 approved guarded switch PNG crops','tree':tree,'parents':[head]})['sha']
    request('PATCH','/git/refs/heads/main',token,{'sha':sha,'force':False})
    print('Uploaded 8 approved images in',sha)
if __name__=='__main__':main()
