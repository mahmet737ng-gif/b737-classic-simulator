#!/usr/bin/env python3
"""Lossless AST reconstitution check for an already-decoded private DB."""
import sqlite3,json,hashlib,sys
from collections import Counter
path=sys.argv[1]
c=sqlite3.connect(path)
assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert c.execute('PRAGMA foreign_key_check').fetchall()==[]
assert c.execute('SELECT COUNT(*) FROM procedure_legs').fetchone()[0]==0
n=0; errors=[]
for segid,expr,ast_json,digest,uncount in c.execute('''SELECT s.id,s.expression,d.ast_json,d.raw_expression_sha256,d.unresolved_node_count FROM navdata_procedure_segments s JOIN npe_decoded_segments d ON d.segment_id=s.id'''):
    ast=json.loads(ast_json)
    recon=' '.join(node['raw'] for node in ast)
    if recon!= ' '.join(expr.split()) or hashlib.sha256(expr.encode()).hexdigest()!=digest:
        errors.append(segid)
    if uncount != sum(x['kind']=='UNRESOLVED' for x in ast):errors.append(segid)
    n+=1
assert n==236879,(n,errors[:10])
assert not errors,errors[:20]
print(f'AST_SOURCE_ROUNDTRIP_OK: {n:,} segments; SHA256 verified; zero lost tokens; 0 executable FMC legs')
print('INCOMPLETE:',c.execute("SELECT airport_code,count(*) FROM navdata_procedure_files WHERE status!='SOURCE_STRUCTURE_OK' GROUP BY airport_code").fetchall())
print('DECODE ERRORS:',c.execute('SELECT COUNT(*) FROM npe_decoder_issues').fetchone()[0])