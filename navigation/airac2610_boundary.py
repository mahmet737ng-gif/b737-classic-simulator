"""Mandatory strict per-file AIRAC 2610 Rev.1 boundary for simulator navdata.

The preceding bytes must NEVER be parsed or used for flight-data computations.
If the exact marker is missing, reject the file rather than reading older data.
"""
MARKER = b'//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1'


def post_airac_payload(content: bytes) -> bytes:
    if not isinstance(content, bytes):
        raise TypeError('Input must be raw file bytes')
    index = content.find(MARKER)
    if index < 0:
        raise ValueError('AIRAC 2610 Rev.1 marker missing; reject source')
    payload = content[index:]
    # Strict file-start-of-payload check protects against accidental partial match.
    if payload.splitlines()[0] != MARKER:
        raise ValueError('Invalid AIRAC marker')
    return payload


def post_airac_lines(content: bytes) -> list[str]:
    return post_airac_payload(content).decode('utf-8-sig').splitlines()
