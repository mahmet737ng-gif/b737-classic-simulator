import unittest
from airac2610_boundary import MARKER, post_airac_lines, post_airac_payload

class HeaderBoundaryTests(unittest.TestCase):
    def test_discards_arbitrary_before_header(self):
        before = b'FIX OLD LATLON N 99 0 E 99 0\nSID WRONG FIX OLD\n'
        payload = MARKER + b'\nSIDS\nSID REAL FIX NEW\nENDSIDS\n'
        self.assertEqual(post_airac_payload(before + payload), payload)
        lines = post_airac_lines(before + payload)
        self.assertEqual(lines[0], MARKER.decode())
        self.assertNotIn('OLD', '\n'.join(lines))
    def test_missing_exact_header_rejected(self):
        with self.assertRaises(ValueError):
            post_airac_payload(b'//AIRAC Cycle : 2609 (old)\nSID OLD')
    def test_same_header_when_first_line(self):
        self.assertEqual(post_airac_lines(MARKER+b'\nSTARS\n'), [MARKER.decode(),'STARS'])

if __name__ == '__main__': unittest.main()
