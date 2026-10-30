"""Source-staging tests use small synthetic ZIPs; no licensed NAVDATA is included."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "navigation" / "stage_airac2611_private_v1.py"
spec = importlib.util.spec_from_file_location("airac_stage", MODULE)
stage_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage_module)

class StageAIRAC2611Tests(unittest.TestCase):
    def zip_file(self, folder, name, marker=None):
        target = Path(folder) / name
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            text = marker if marker is not None else "fix X"
            zf.writestr("SidStars/OIII.txt", text)
        return target

    def test_stage_2611_only_to_private_directory_and_not_fmc(self):
        marker = "//AIRAC Cycle : 2611 (29/OCT/2026 - 26/NOV/2026) - Ver.1"
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            nav = self.zip_file(p, "NAVDATA.zip")
            sid = self.zip_file(p, "SidStars.zip", marker)
            output = p / "private" / "stage.json"
            result = stage_module.stage(nav, sid, output)
            self.assertEqual(result["airac"], "2611")
            self.assertEqual(result["phase"], "SOURCE_HASHED_AND_MARKER_CHECKED_ONLY")
            self.assertFalse(result["fmcInstalled"])
            self.assertFalse(result["fmcExecutable"])
            self.assertTrue(result["old_airac2610_preserved"])
            self.assertTrue(output.is_file())

    def test_reject_cycle_2610_instead_of_silently_relabeling_it_2611(self):
        marker = "//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1"
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            nav = self.zip_file(p, "NAVDATA.zip")
            sid = self.zip_file(p, "SidStars.zip", marker)
            with self.assertRaisesRegex(ValueError, "WRONG"):
                stage_module.stage(nav, sid, p / "private" / "stage.json")

    def test_reject_archives_with_no_airac_source_marker(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            nav = self.zip_file(p, "NAVDATA.zip")
            sid = self.zip_file(p, "SidStars.zip")
            with self.assertRaisesRegex(ValueError, "MISSING"):
                stage_module.stage(nav, sid, p / "private" / "stage.json")

    def test_reject_writing_to_public_repo(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            nav = self.zip_file(p, "NAVDATA.zip")
            sid = self.zip_file(p, "SidStars.zip")
            with self.assertRaisesRegex(ValueError, "PUBLIC_REPO"):
                stage_module.stage(nav, sid, ROOT / "navigation" / "do-not-create-private-manifest.json")

    def test_reject_overwriting_private_archive_or_manifest(self):
        marker = "//AIRAC Cycle : 2611 (29/OCT/2026 - 26/NOV/2026) - Ver.1"
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            nav = self.zip_file(p, "NAVDATA.zip")
            sid = self.zip_file(p, "SidStars.zip", marker)
            with self.assertRaisesRegex(ValueError, "OVERWRITE"):
                stage_module.stage(nav, sid, sid)
            stage_module.stage(nav, sid, p / "private" / "stage.json")
            with self.assertRaises(FileExistsError):
                stage_module.stage(nav, sid, p / "private" / "stage.json")

if __name__ == "__main__":
    unittest.main()
