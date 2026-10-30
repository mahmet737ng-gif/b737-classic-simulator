"""Private AIRAC 2611 ZIP staging for a B737 Classic training simulator.

This tool does NOT import procedures into FMC, activate banks, create
ARINC-424 legs, or publish licensed data. It records an integrity gate
outside this public repository so the existing 2610 archive stays intact.
Usage:
 python navigation/stage_airac2611_private_v1.py \
   --navdata /private/2611/NAVDATA.zip \
   --sidstars /private/2611/SidStars.zip \
   --output /private/2611/source_stage_manifest.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile
from datetime import date, datetime, timezone

CYCLE = "2611"
START = date(2026, 10, 29)
END_EXCLUSIVE = date(2026, 11, 26)
MARKER = re.compile(
    rb"//\s*AIRAC\s+Cycle\s*:\s*(\d{4})\s*\(([^\r\n]{12,90})\)\s*-\s*Ver\.\s*(\d+)",
    re.IGNORECASE,
)
REPO = Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(4 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def check_zip(path: Path, scan_headers: bool) -> dict:
    if not path.is_file():
        raise ValueError(f"MISSING_PRIVATE_SOURCE: {path.name}")
    if not zipfile.is_zipfile(path):
        raise ValueError("PRIVATE_SOURCE_IS_NOT_ZIP")
    markers: set[str] = set()
    total = 0
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        if not members:
            raise ValueError("EMPTY_PRIVATE_SOURCE")
        for member in members:
            p = Path(member.filename.replace("\\", "/"))
            if p.is_absolute() or ".." in p.parts:
                raise ValueError("UNSAFE_ARCHIVE_MEMBER_PATH")
            if member.flag_bits & 1:
                raise ValueError("ENCRYPTED_ARCHIVE_NEEDS_PRIVATE_DECODER")
            if member.is_dir():
                continue
            total += 1
            if scan_headers and member.filename.lower().endswith(".txt"):
                with archive.open(member) as content:
                    header = content.read(8192)
                found = MARKER.search(header)
                if found:
                    marker_cycle = found.group(1).decode("ascii")
                    markers.add(marker_cycle)
        if total == 0:
            raise ValueError("NO_DATABASE_FILES")
    return {
        "file": path.name,
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
        "members": total,
        "header_cycles_found": sorted(markers),
    }


def stage(navdata: Path, sidstars: Path, output: Path) -> dict:
    if navdata.resolve() == sidstars.resolve():
        raise ValueError("NAVDATA_AND_SIDSTAR_SOURCE_MUST_DIFFER")
    if output.resolve().is_relative_to(REPO):
        raise ValueError("DO_NOT_WRITE_LICENSED_SOURCE_MANIFEST_IN_PUBLIC_REPO")
    if output.resolve() in {navdata.resolve(), sidstars.resolve()}:
        raise ValueError("CANNOT_OVERWRITE_SOURCE_ARCHIVE")

    nav = check_zip(navdata, scan_headers=True)
    sid = check_zip(sidstars, scan_headers=True)
    detected = set(sid["header_cycles_found"])
    if detected != {CYCLE}:
        raise ValueError(
            "SIDSTAR_AIRAC_MARKERS_MISSING_OR_WRONG: "
            + ", ".join(sorted(detected)) if detected
            else "SIDSTAR_AIRAC_MARKERS_MISSING"
        )
    if nav["header_cycles_found"] and nav["header_cycles_found"] != [CYCLE]:
        raise ValueError("NAVDATA_AIRAC_MARKER_CONFLICT")
    report = {
        "schema": "B737_PRIVATE_AIRAC2611_SOURCE_STAGE_V1",
        "airac": CYCLE,
        "effective_start": START.isoformat(),
        "effective_end_exclusive": END_EXCLUSIVE.isoformat(),
        "staged_at_utc": datetime.now(timezone.utc).isoformat(),
        "navdata_archive": nav,
        "sidstars_archive": sid,
        "phase": "SOURCE_HASHED_AND_MARKER_CHECKED_ONLY",
        "full_procedure_qa": "PENDING",
        "fmcInstalled": False,
        "fmcExecutable": False,
        "activeBank": None,
        "license": "PRIVATE_RESTRICTED_DO_NOT_PUBLISH",
        "old_airac2610_preserved": True,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise FileExistsError("PRIVATE_SOURCE_MANIFEST_ALREADY_EXISTS")
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--navdata", required=True, type=Path)
    parser.add_argument("--sidstars", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    options = parser.parse_args()
    result = stage(options.navdata, options.sidstars, options.output)
    print(json.dumps({
        "airac": result["airac"],
        "stage": result["phase"],
        "fmcInstalled": False,
        "source": "PRIVATE",
        "manifest": str(options.output.resolve()),
    }, indent=2))


if __name__ == "__main__":
    main()
