"""Resumable per-page inventory. Rendering/OCR never counts as visual review."""
from pathlib import Path
import hashlib,json,re,sqlite3
from ..technical_reader_v1.store import TechnicalStore,canonical
from ..technical_reader_v1.numeric import ReaderError,parse_number

SCHEMA='''
CREATE TABLE IF NOT EXISTS cr2_documents(id TEXT PRIMARY KEY,path TEXT NOT NULL,sha256 TEXT NOT NULL,pages INTEGER NOT NULL,metadata_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cr2_pages(document_id TEXT NOT NULL,page INTEGER NOT NULL,metadata_json TEXT NOT NULL,text TEXT NOT NULL,review_state TEXT NOT NULL DEFAULT 'PENDING_VISUAL_REVIEW',PRIMARY KEY(document_id,page),FOREIGN KEY(document_id) REFERENCES cr2_documents(id));
CREATE TABLE IF NOT EXISTS cr2_regions(id TEXT PRIMARY KEY,document_id TEXT NOT NULL,page INTEGER NOT NULL,kind TEXT NOT NULL,payload_json TEXT NOT NULL,model_id TEXT,model_revision INTEGER,state TEXT NOT NULL DEFAULT 'MAPPED',FOREIGN KEY(document_id,page) REFERENCES cr2_pages(document_id,page));
CREATE TABLE IF NOT EXISTS cr2_reviews(id INTEGER PRIMARY KEY,document_id TEXT NOT NULL,page INTEGER NOT NULL,reviewer TEXT NOT NULL,evidence_json TEXT NOT NULL,notes TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(document_id,page) REFERENCES cr2_pages(document_id,page));
CREATE TABLE IF NOT EXISTS cr2_numeric_candidates(id INTEGER PRIMARY KEY,document_id TEXT NOT NULL,page INTEGER NOT NULL,line INTEGER NOT NULL,raw_text TEXT NOT NULL,value REAL,context TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'UNREVIEWED_TOKEN_NOT_EXECUTABLE');
CREATE INDEX IF NOT EXISTS cr2_candidate_page ON cr2_numeric_candidates(document_id,page);
'''


def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()


class ReviewWorkspace:
    def __init__(self,path):
        self.path=Path(path);self.store=TechnicalStore(path);self.conn=self.store.conn
        self.conn.executescript(SCHEMA);self.conn.commit()
    def close(self):self.store.close()
    def index_pdf(self,pdf,document_id,*,metadata=None,existing_index=None):
        import fitz
        pdf=Path(pdf).resolve();sha=digest(pdf)
        old=self.conn.execute('SELECT sha256 FROM cr2_documents WHERE id=?',(document_id,)).fetchone()
        if old and old[0]!=sha:raise ReaderError('DOCUMENT_CHANGED: use a revision-specific identity')
        doc=fitz.open(pdf);toc=doc.get_toc();prior={};ocr={}
        if existing_index:
            c=sqlite3.connect(existing_index);c.row_factory=sqlite3.Row
            prior={r['pdf_page']:dict(r) for r in c.execute('SELECT * FROM pages')}
            ocr={r['pdf_page']:r['ocr_text'] for r in c.execute('SELECT * FROM ocr_page_text')};c.close()
        with self.conn:
            self.conn.execute('INSERT OR REPLACE INTO cr2_documents VALUES(?,?,?,?,?)',(document_id,str(pdf),sha,len(doc),canonical(metadata or {})))
            for n,page in enumerate(doc,1):
                if self.conn.execute('SELECT 1 FROM cr2_pages WHERE document_id=? AND page=?',(document_id,n)).fetchone():continue
                p=prior.get(n,{})
                native=page.get_text();text=p.get('native_text') or native
                if len(text.strip())<30:text=ocr.get(n,text)
                section=p.get('section') or ''
                group=p.get('toc_group') or ''
                if not section:
                    marks=[r for r in toc if 0<r[2]<=n]
                    section=marks[-1][1] if marks else ''
                hints=[]
                if re.search(r'power setting|nomogram|takeoff|landing|climb|obstacle|gradient|crosswind|limit|brake|runway|distance',text,re.I):hints.append('NUMERIC_OR_CHART_CONTENT_CANDIDATE')
                if re.search(r'table|weight|temperature|altitude|dimension|speed|correction|adjustment',text,re.I):hints.append('TABLE_OR_NUMERIC_CONTENT_CANDIDATE')
                dims=[{'width':i[2],'height':i[3]} for i in page.get_images()]
                meta={'section':section,'toc_group':group,'printed_page':p.get('printed_page'),'pdf_width_pt':page.rect.width,'pdf_height_pt':page.rect.height,'embedded_images':dims,'text_method':'prior_ocr_unverified' if n in ocr and len(native.strip())<30 else 'native_or_prior_index','machine_hints':hints,'hints_are_visual_classification':False}
                self.conn.execute('INSERT INTO cr2_pages(document_id,page,metadata_json,text) VALUES(?,?,?,?)',(document_id,n,canonical(meta),text))
                for line,context in enumerate(text.splitlines(),1):
                    for match in re.finditer(r'(?<![\w.])[+−-]?\d+(?:[.,]\d+)?(?:\s*%)?(?![\w.])',context):
                        raw=match.group();parsed=parse_number(raw.replace('%','').replace('−','-'))
                        self.conn.execute('INSERT INTO cr2_numeric_candidates(document_id,page,line,raw_text,value,context) VALUES(?,?,?,?,?,?)',(document_id,n,line,raw,parsed['value'],context))
        doc.close();return self.summary(document_id)
    def document(self,document_id):
        r=self.conn.execute('SELECT * FROM cr2_documents WHERE id=?',(document_id,)).fetchone()
        if not r:raise ReaderError('DOCUMENT_NOT_FOUND')
        return dict(r)
    def render(self,document_id,page,out,*,dpi=216):
        import fitz
        if not 150<=dpi<=600:raise ReaderError('REVIEW_RENDER_DPI_150_TO_600')
        info=self.document(document_id)
        if type(page)is not int or not 1<=page<=info['pages']:raise ReaderError('PAGE_OUT_OF_RANGE')
        if digest(info['path'])!=info['sha256']:raise ReaderError('SOURCE_FILE_CHANGED')
        doc=fitz.open(info['path']);pix=doc[page-1].get_pixmap(dpi=dpi,alpha=False)
        out=Path(out);out.parent.mkdir(parents=True,exist_ok=True);pix.save(out);doc.close()
        return {'image_sha256':digest(out),'dpi':dpi,'width':pix.width,'height':pix.height,'source_sha256':info['sha256'],'physical_pdf_page':page}
    def add_region(self,document_id,page,ident,kind,payload,model=None):
        if kind not in ('curve','family','table','lookup','formula','nomogram','polar','diagram_values','text_rule','metadata_table','administrative','no_numeric_content'):raise ReaderError('UNKNOWN_REGION_KIND')
        model_id=revision=None
        if model:
            self.store.add_model(model);model_id,revision=model['id'],model['revision']
        with self.conn:
            self.conn.execute('INSERT INTO cr2_regions VALUES(?,?,?,?,?,?,?,?)',(ident,document_id,page,kind,canonical(payload),model_id,revision,'CONVERTED' if model else ('DOCUMENTED' if kind in ('text_rule','administrative','no_numeric_content') else 'MAPPED')))
        return ident
    def review(self,document_id,page,reviewer,evidence,notes,*,numeric_complete=False):
        doc=self.document(document_id)
        if not reviewer.strip() or not notes.strip():raise ReaderError('REVIEWER_AND_NOTES_REQUIRED')
        if evidence.get('source_sha256')!=doc['sha256'] or evidence.get('physical_pdf_page')!=page:raise ReaderError('REVIEW_SOURCE_MISMATCH')
        if evidence.get('dpi',0)<150 or min(evidence.get('width',0),evidence.get('height',0))<1200:raise ReaderError('LARGE_VISUAL_EVIDENCE_REQUIRED')
        h=evidence.get('image_sha256','')
        if len(h)!=64 or any(c not in '0123456789abcdef' for c in h):raise ReaderError('RENDER_HASH_REQUIRED')
        regions=self.conn.execute('SELECT * FROM cr2_regions WHERE document_id=? AND page=?',(document_id,page)).fetchall()
        if not regions:raise ReaderError('REGION_INVENTORY_REQUIRED_BEFORE_REVIEW')
        if numeric_complete and any(r['state']=='MAPPED' for r in regions):raise ReaderError('UNCONVERTED_REGIONS_REMAIN')
        evidence={**evidence,'attestation':'reviewer explicitly reports visual inspection; renderer alone cannot attest','numeric_complete':bool(numeric_complete)}
        with self.conn:
            self.conn.execute('INSERT INTO cr2_reviews(document_id,page,reviewer,evidence_json,notes) VALUES(?,?,?,?,?)',(document_id,page,reviewer,canonical(evidence),notes))
            self.conn.execute('UPDATE cr2_pages SET review_state=? WHERE document_id=? AND page=?',('VISUALLY_REVIEWED_NUMERIC_COMPLETE' if numeric_complete else 'VISUALLY_REVIEWED_CONVERSION_OPEN',document_id,page))
        return self.summary(document_id)
    def pages(self,document_id):
        return [{'page':r['page'],'review_state':r['review_state'],**json.loads(r['metadata_json'])} for r in self.conn.execute('SELECT * FROM cr2_pages WHERE document_id=? ORDER BY page',(document_id,))]
    def summary(self,document_id):
        doc=self.document(document_id)
        states={r[0]:r[1] for r in self.conn.execute('SELECT review_state,count(*) FROM cr2_pages WHERE document_id=? GROUP BY review_state',(document_id,))}
        count=self.conn.execute('SELECT count(*) FROM cr2_numeric_candidates WHERE document_id=?',(document_id,)).fetchone()[0]
        regions=self.conn.execute('SELECT count(*) FROM cr2_regions WHERE document_id=?',(document_id,)).fetchone()[0]
        complete=states.get('VISUALLY_REVIEWED_NUMERIC_COMPLETE',0)
        return {'document_id':document_id,'total_pdf_pages':doc['pages'],'indexed_pages':sum(states.values()),'page_states':states,'numeric_tokens_unreviewed':count,'regions_mapped':regions,'all_pages_visually_reviewed':complete+states.get('VISUALLY_REVIEWED_CONVERSION_OPEN',0)==doc['pages'],'all_pages_numerically_complete':complete==doc['pages'],'source_sha256':doc['sha256']}
    def export(self,document_id):
        self.conn.execute('CREATE TABLE IF NOT EXISTS cr2_geometry_models(id TEXT NOT NULL,revision INTEGER NOT NULL,payload_json TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(id,revision))')
        models=[dict(r) for r in self.conn.execute('SELECT DISTINCT m.* FROM ctr_models m JOIN ctr_model_sources s ON m.model_id=s.model_id AND m.revision=s.model_revision WHERE s.source_id=?',(document_id,))]
        geometry=[dict(r) for r in self.conn.execute("SELECT * FROM cr2_geometry_models WHERE json_extract(payload_json,'$.document_id')=?",(document_id,))]
        return {'summary':self.summary(document_id),'pages':self.pages(document_id),'geometry_models':geometry,'regions':[dict(r) for r in self.conn.execute('SELECT * FROM cr2_regions WHERE document_id=?',(document_id,))],'models':models}
