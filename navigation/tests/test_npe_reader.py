import sys, unittest, os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from npe_reader import list_procedures,get_procedure
TEST_DB=Path(os.environ.get('NPE_FIXTURE_DB',Path(__file__).resolve().parent/'B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite'))

@unittest.skipUnless(TEST_DB.exists(),'Full private NAVDB fixture not available')
class IntegrationTests(unittest.TestCase):
    def test_read_iran_sid(self):
        r=get_procedure(TEST_DB,'OIII','SID','DAXI1A',runway='29R')
        self.assertEqual(r['available_runways'],['29L','29R'])
        self.assertEqual(r['fmc_status'],'NOT_EXECUTABLE_UNTIL_VERIFIED')
        self.assertEqual(r['segments'][0]['ast'][0]['kind'],'RUNWAY_REFERENCE')
    def test_reject_wrong_runway(self):
        with self.assertRaisesRegex(ValueError,'not explicitly supported'):
            get_procedure(TEST_DB,'OIII','SID','DAXI1A',runway='11R')
    def test_read_iran_transition(self):
        r=get_procedure(TEST_DB,'OIII','APP','ILS29LY',transition='KAZ')
        self.assertTrue(any(x['variant']=='TRANSITION' for x in r['segments']))
        self.assertFalse(any(x['variant']=='RUNWAY_CLAUSE' for x in r['segments']))
    def test_read_iran_catalog(self):
        r=list_procedures(TEST_DB,'OIIE','STAR')
        self.assertEqual(len(r),21)
    def test_block_incomplete(self):
        bad=list_procedures(TEST_DB,'ZYYJ',include_incomplete=True)
        self.assertTrue(any(x['parse_status']!='SOURCE_TOKEN_DECODED' for x in bad))
        flagged=next(x for x in bad if x['parse_status']!='SOURCE_TOKEN_DECODED')
        with self.assertRaisesRegex(ValueError,'incomplete'):
            get_procedure(TEST_DB,'ZYYJ',flagged['kind'],flagged['ident'])
if __name__=='__main__':unittest.main()