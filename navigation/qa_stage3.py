#!/usr/bin/env python3
"""Read-only full-coverage, provenance and no-executable-FMC QA for Stage 3."""
import argparse,json,sqlite3
from pathlib import Path
from leg_intent_overlay import sha256,MARKER,VERSION

def run(source,geometry,intents):
    a,b,c=map(lambda x:Path(x).resolve(),(source,geometry,intents))
    digest_a,digest_b=sha256(a),sha256(b)
    with sqlite3.connect(c.as_uri()+'?mode=ro',uri=True) as db:
        db.execute('ATTACH DATABASE ? AS stage1',(a.as_uri()+'?mode=ro',))
        db.execute('ATTACH DATABASE ? AS stage2',(b.as_uri()+'?mode=ro',))
        m=dict(db.execute('SELECT key,value FROM main.meta'))
        assert m['build_id']==VERSION and m['marker']==MARKER
        assert m['source_stage1_sha256']==digest_a and m['source_stage2_sha256']==digest_b
        assert dict(db.execute('SELECT key,value FROM stage2.meta'))['source_sha256']==digest_a
        assert db.execute('SELECT marker FROM stage1.navdata_import_batches').fetchone()[0]==MARKER
        assert db.execute('SELECT source_marker FROM stage1.npe_decoder_runs').fetchone()[0]==MARKER
        assert db.execute('SELECT COUNT(*) FROM stage1.navdata_procedure_files WHERE marker_relative_line<>1').fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM stage1.navdata_procedure_segments WHERE post_marker_line<2').fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM stage1.procedure_legs').fetchone()[0]==0
        assert db.execute("SELECT COUNT(*) FROM main.leg_intents WHERE fmc_status!='NOT_EXECUTABLE'").fetchone()[0]==0
        # Full identity match across stage1 AST source and stage2 event mapping.
        unmatched=db.execute('''SELECT COUNT(*) FROM stage2.geometry_events e
          LEFT JOIN main.leg_intents i ON i.segment_id=e.segment_id AND i.node_seq=e.node_seq
          WHERE i.segment_id IS NULL OR i.kind!=e.node_kind OR i.raw_source!=e.source_raw OR i.procedure_id!=e.procedure_id''').fetchone()[0]
        assert unmatched==0,unmatched
        surplus=db.execute('''SELECT COUNT(*) FROM main.leg_intents i
          LEFT JOIN stage2.geometry_events e ON i.segment_id=e.segment_id AND i.node_seq=e.node_seq
          WHERE e.segment_id IS NULL''').fetchone()[0]
        assert surplus==0,surplus
        count=db.execute('SELECT COUNT(*) FROM main.leg_intents').fetchone()[0]
        assert count==189226
        assert db.execute('PRAGMA main.integrity_check').fetchone()[0]=='ok'
        assert db.execute('PRAGMA stage2.integrity_check').fetchone()[0]=='ok'
        assert db.execute('PRAGMA main.foreign_key_check').fetchall()==[]
        kinds=dict(db.execute('SELECT kind,records FROM main.summary'))
        quarantine=db.execute("SELECT COUNT(*) FROM leg_intents WHERE geometry_readiness='BLOCKED_INCOMPLETE_SOURCE'").fetchone()[0]
        return {'result':'PASS','verified_event_rows':count,'matched_source_event_rows':count,
                'mismatch_count':unmatched,'surplus_count':surplus,'kinds':kinds,'quarantined_events':quarantine,
                'source_marker':MARKER,'stage1_sha256':digest_a,'stage2_sha256':digest_b,
                'fmc_legs_activated':0,'checks':['SQLITE_INTEGRITY','SOURCE_EVENT_IDENTITY','AIRAC_BOUNDARY','ZERO_ACTIVE_LEGS','SOURCE_HASH_CHAIN']}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--geometry',required=True);p.add_argument('--intents',required=True);p.add_argument('--report',required=True)
    a=p.parse_args()
    result=run(a.source,a.geometry,a.intents)
    Path(a.report).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))