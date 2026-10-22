"""HTTP viewer smoke test (synthetic content; zero Boeing data)."""
import json
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

import fitz

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as t:
    base=Path(t)
    pdf=base/'sample.pdf'
    doc=fitz.open()
    p=doc.new_page()
    p.insert_text((72,72),'B737 ELECTRICAL SYSTEM TEST 6.10.2')
    doc.save(pdf)
    corpus=base/'archive'
    e=subprocess.run([sys.executable,str(root/'extract_fcom.py'),str(pdf),'--out',str(corpus),'--tables','off','--render-dpi','75'],capture_output=True,text=True)
    assert e.returncode==0,e.stderr
    with socket.socket() as s:
        s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    proc=subprocess.Popen([sys.executable,str(root/'browse_archive.py'),'--archive',str(corpus),'--port',str(port)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(40):
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/page?n=1',timeout=1) as r:
                    page=json.loads(r.read())
                break
            except Exception:
                time.sleep(0.1)
        else:raise AssertionError('Viewer not ready')
        assert 'ELECTRICAL' in page['text']
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/search?q=ELECTRICAL') as r:
            found=json.loads(r.read())
        assert found['items'][0]['page']==1,found
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/') as r:
            html=r.read().decode()
        assert 'B737 Classic' in html
        print('LOCAL BROWSER SEARCH TEST PASSED')
    finally:
        proc.terminate();proc.wait(timeout=10)