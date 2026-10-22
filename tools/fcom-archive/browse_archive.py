#!/usr/bin/env python3
"""Private, local-only searchable FCOM viewer. Binds to 127.0.0.1 only."""
import argparse
import json
import re
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, archive, viewer, **kwargs):
        self.archive = Path(archive)
        self.viewer = Path(viewer)
        super().__init__(*args, directory=str(archive), **kwargs)

    def _json(self, content, code=200):
        payload=json.dumps(content, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path in ('/', '/viewer.html'):
            payload=self.viewer.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if parsed.path == '/api/search':
            q=parse_qs(parsed.query).get('q',[''])[0].strip()
            if not q:
                return self._json({'items':[]})
            if len(q)>200:
                return self._json({'error':'query too long'},400)
            try:
                db=sqlite3.connect(str(self.archive/'fcom.sqlite'))
                try:
                    rows=db.execute("SELECT pages.page, snippet(page_fts,0,'[',']',' … ',25) "
                                    "FROM page_fts JOIN pages ON pages.page=page_fts.rowid "
                                    "WHERE page_fts MATCH ? ORDER BY rank LIMIT 100",(q,)).fetchall()
                except sqlite3.OperationalError:
                    rows=db.execute("SELECT page, substr(text,1,250) FROM pages WHERE text LIKE ? LIMIT 100",('%'+q+'%',)).fetchall()
                finally:
                    db.close()
                return self._json({'items':[{'page':p,'snippet':s} for p,s in rows]})
            except Exception as ex:
                return self._json({'error':str(ex)},500)
        if parsed.path == '/api/page':
            n=parse_qs(parsed.query).get('n',[''])[0]
            if not re.fullmatch(r'[0-9]{1,6}',n):
                return self._json({'error':'invalid page'},400)
            path=self.archive/'pages'/f'{int(n):05d}.json'
            if not path.is_file():
                return self._json({'error':'page not extracted'},404)
            obj=json.loads(path.read_text(encoding='utf-8'))
            return self._json({k:v for k,v in obj.items() if k not in ('blocks',)})
        return super().do_GET()


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--archive',default='FCOM_EXTRACTED')
    ap.add_argument('--port',type=int,default=8765)
    args=ap.parse_args()
    root=Path(args.archive).resolve()
    if not (root/'manifest.json').is_file():
        ap.error('Missing manifest.json. First extract PDF using extract_fcom.py')
    from functools import partial
    srv=ThreadingHTTPServer(('127.0.0.1', args.port),partial(Handler,archive=root,viewer=Path(__file__).with_name('viewer.html')))
    print(f'Private FCOM viewer: http://127.0.0.1:{args.port}/  (Ctrl+C to stop)')
    srv.serve_forever()


if __name__=='__main__':
    main()