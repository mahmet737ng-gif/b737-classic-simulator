import json, subprocess, sys, tempfile
from pathlib import Path
import fitz
from PIL import Image

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    tmp=Path(tmp)
    pdf=tmp/'test-manual.pdf'
    d=fitz.open()
    p=d.new_page(width=595,height=842)
    p.insert_text((50,60),'B737 Flight Crew Operations Manual 4.20.11 AUTOTHROTTLE ARM',fontsize=12)
    for x in [60,180,300]:p.draw_line((x,130),(x,210),color=(0,0,0),width=2)
    for y in [130,170,210]:p.draw_line((60,y),(300,y),color=(0,0,0),width=2)
    p.insert_text((70,153),'OFF',fontsize=12)
    p.insert_text((200,153),'ARM',fontsize=12)
    p.insert_text((70,193),'0',fontsize=12)
    p.insert_text((200,193),'1',fontsize=12)
    p.draw_rect(fitz.Rect(100,270,300,340),color=(0,0,0),fill=(0.8,0.8,0.8))
    fig=tmp/'figure.png'
    Image.new('RGB',(12,14),(120,220,130)).save(fig)
    p.insert_image(fitz.Rect(350,300,400,370),filename=str(fig))
    p.insert_text((110,295),'VECTOR SCHEMATIC',fontsize=12)
    p2=d.new_page();p2.insert_text((40,100),'ENGINE START panel reference 7.10.5')
    p3=d.new_page();p3.insert_text((40,100),'AIR SYSTEMS 2.10.11')
    d.save(pdf)
    cmd=[sys.executable,str(root/'extract_fcom.py'),str(pdf),'--out',str(tmp/'output'),'--render-dpi','80']
    run=subprocess.run(cmd,capture_output=True,text=True)
    print(run.stdout, run.stderr)
    assert run.returncode==0
    check=subprocess.run([sys.executable,str(root/'verify_archive.py'),str(tmp/'output'),'--require-images'],capture_output=True,text=True)
    print(check.stdout,check.stderr)
    assert check.returncode==0
    man=json.loads((tmp/'output'/'manifest.json').read_text())
    assert man['full_document_complete']
    page=json.loads((tmp/'output'/'pages'/'00001.json').read_text())
    assert 'AUTOTHROTTLE ARM' in page['text']
    assert page['page_image']
    assert page['blocks']
    assert page['tables'] and (tmp/'output'/page['tables'][0]['csv']).is_file()
    assert page['figures'] and page['figures'][0]['filename']
    assert (tmp/'output'/page['figures'][0]['filename']).is_file()
    found=subprocess.run([sys.executable,str(root/'search_archive.py'),'AUTOTHROTTLE','--db',str(tmp/'output'/'fcom.sqlite')],capture_output=True,text=True)
    assert 'PDF PAGE 1' in found.stdout,found.stdout
    # Resume must neither duplicate nor erase a page.
    run2=subprocess.run(cmd+['--resume'],capture_output=True,text=True)
    assert run2.returncode==0,run2.stderr
    print('ALL SMOKE TESTS PASSED')