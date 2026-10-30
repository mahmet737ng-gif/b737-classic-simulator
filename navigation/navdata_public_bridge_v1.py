#!/usr/bin/env python3
"""Owner-operated localhost NAVDATA bridge for public GitHub Pages CDU.

READ-ONLY. Only the exact owner's HTTPS Pages origin, with a per-startup
random capability token, may query this server. No bulk source download,
no POST, no licensed SQLite in public assets. Training reference only.
"""
import argparse
import hmac
import json
from pathlib import Path
import re
import secrets
import shutil
import tempfile
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
import zipfile

from navdata_catalog_v1 import NavCatalog, CatalogError

PAGES_ORIGIN = 'https://mahmet737ng-gif.github.io'
STAGE1_ARCHIVE_MEMBER = 'B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite'
TOKEN_HEADER = 'X-B737-Nav-Token'
ALLOWED_ENDPOINTS = frozenset((
    '/api/navdata/status', '/api/stage6/navdata', '/api/stage6/catalog'
))


class BridgeError(ValueError):
    pass


def extract_private_stage1(archive, folder):
    """Extract exactly one known member to a temporary file outside the webroot."""
    with zipfile.ZipFile(archive) as z:
        member = z.getinfo(STAGE1_ARCHIVE_MEMBER)
        if member.file_size < 1 or member.file_size > 700_000_000:
            raise BridgeError('Unexpected Stage1 source size')
        target = folder / 'stage1.sqlite'
        with z.open(member) as source, target.open('wb') as output:
            shutil.copyfileobj(source, output, 1024 * 1024)
        return target


def single_params(query, allowed):
    params = parse_qs(query, keep_blank_values=True, strict_parsing=True)
    if set(params) - set(allowed) or any(len(x) != 1 for x in params.values()):
        raise BridgeError('INVALID_NAVDATA_QUERY')
    return {key: value[0] for key, value in params.items()}


class PrivateCatalogService:
    def __init__(self, db):
        self.db = Path(db).resolve(strict=True)
        with NavCatalog(self.db) as c:
            self.cycle = c.summary()['source_cycle']

    def lookup(self, kind, ident=None, airport=None):
        with NavCatalog(self.db) as c:
            if kind == 'airport' and ident and airport is None:
                lookup = c.airport(ident)
            elif kind == 'runways' and airport and ident is None:
                lookup = c.runways(airport, 100)
            elif kind == 'waypoints' and ident and airport is None:
                lookup = c.fix(ident, 'waypoints', 100)
            elif kind == 'navaids' and ident and airport is None:
                lookup = c.fix(ident, 'navaids', 100)
            elif kind == 'airways' and ident and airport is None:
                lookup = c.airway(ident, 100)
            else:
                raise BridgeError('INVALID_NAVDATA_LOOKUP')
        return {'airac': self.cycle, 'kind': kind,
                'mode': 'SOURCE_REFERENCE_ONLY', 'fmc_executable': False,
                'lookup': lookup}

    def catalog(self, airport, kind):
        if not isinstance(airport, str) or not re.fullmatch('[A-Za-z]{4}', airport):
            raise BridgeError('INVALID_AIRPORT')
        if kind not in ('SID', 'STAR', 'APP'):
            raise BridgeError('INVALID_PROCEDURE_KIND')
        with NavCatalog(self.db) as c:
            found = c.procedures(airport.upper(), kind, 100)
        if found['has_more']:
            raise BridgeError('PROCEDURE_CATALOG_REQUIRES_PAGINATION')
        items = []
        for row in found['rows']:
            if row['parse_status'] != 'SOURCE_TOKEN_DECODED':
                continue  # incomplete source is not selectable
            try:
                rwys = json.loads(row['runway_reference_json'])
                transitions = json.loads(row['transition_labels_json'])
            except (TypeError, ValueError) as exc:
                raise BridgeError('UNVERIFIED_PROCEDURE_VARIANT') from exc
            if not isinstance(rwys, list) or not isinstance(transitions, list):
                raise BridgeError('UNVERIFIED_PROCEDURE_VARIANT')
            items.append({'ident': row['ident'], 'runways': rwys,
                          'transitions': transitions,
                          'status': 'SOURCE_ONLY_NOT_FMC_EXECUTABLE'})
        return {'airac': self.cycle, 'airport': airport.upper(),
                'kind': kind, 'items': items, 'fmc_executable': False}


class PrivateBridgeHandler(BaseHTTPRequestHandler):
    server_version = 'B737PrivateNavBridge/1'
    def log_message(self, fmt, *args):
        # Never log the sensitive capability token.
        super().log_message(fmt, *args)

    def _host_allowed(self):
        return self.headers.get('Host') in (
            '127.0.0.1:' + str(self.server.server_port),
            'localhost:' + str(self.server.server_port)
        )

    def _origin_allowed(self):
        return self.headers.get('Origin') == self.server.allowed_origin

    def _path_allowed(self):
        return urlsplit(self.path).path in ALLOWED_ENDPOINTS

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', self.server.allowed_origin)
        self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', TOKEN_HEADER)
        self.send_header('Access-Control-Max-Age', '0')
        if self.headers.get('Access-Control-Request-Private-Network') == 'true':
            self.send_header('Access-Control-Allow-Private-Network', 'true')

    def _finish(self, value, status=200, cors=False):
        encoded = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        if cors:
            self._cors_headers()
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self):
        if (not self._host_allowed() or not self._origin_allowed()
            or not self._path_allowed()
            or self.headers.get('Access-Control-Request-Method') != 'GET'
            or any(h.strip().lower() != TOKEN_HEADER.lower()
                   for h in self.headers.get('Access-Control-Request-Headers','').split(',')
                   if h.strip())):
            return self._finish({'error': 'DENIED'}, 403)
        self.send_response(204)
        self.send_header('Cache-Control', 'no-store')
        self._cors_headers()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        if not self._host_allowed() or not self._origin_allowed() or not self._path_allowed():
            return self._finish({'error': 'DENIED'}, 403)
        token = self.headers.get(TOKEN_HEADER, '')
        if not hmac.compare_digest(token.encode('utf-8'), self.server.nav_token.encode('utf-8')):
            return self._finish({'error': 'NOT_AUTHORIZED'}, 401, cors=True)
        path = urlsplit(self.path)
        try:
            if path.path == '/api/navdata/status':
                if path.query:
                    raise BridgeError('STATUS_DOES_NOT_ACCEPT_QUERY')
                response = {'status': 'CONNECTED_READ_ONLY', 'airac': self.server.service.cycle,
                            'mode': 'SOURCE_REFERENCE_ONLY', 'fmc_executable': False,
                            'public_source_hosted': False}
            elif path.path == '/api/stage6/navdata':
                p = single_params(path.query, ('kind', 'ident', 'airport'))
                response = self.server.service.lookup(p.get('kind'), p.get('ident'), p.get('airport'))
            else:
                p = single_params(path.query, ('airport', 'kind'))
                if set(p) != {'airport', 'kind'}:
                    raise BridgeError('INVALID_PROCEDURE_QUERY')
                response = self.server.service.catalog(p['airport'], p['kind'])
            self._finish(response, cors=True)
        except (BridgeError, CatalogError, LookupError, ValueError) as exc:
            self._finish({'error': 'NAVDATA_REJECTED', 'message': str(exc)}, 422, cors=True)

    def do_POST(self):
        self._finish({'error': 'READ_ONLY_BRIDGE'}, 405)


def create_server(db, token, port=8767):
    service = PrivateCatalogService(db)
    class Local(PrivateBridgeHandler):
        pass
    server = ThreadingHTTPServer(('127.0.0.1', port), Local)
    server.daemon_threads = True
    server.service = service
    server.nav_token = token
    server.allowed_origin = PAGES_ORIGIN
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--stage1-zip', help='Owner-provided private Stage1 ZIP')
    group.add_argument('--stage1-db', help='Owner-provided private Stage1 SQLite')
    parser.add_argument('--port', type=int, default=8767)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('Port must be in 1024..65535')
    token = secrets.token_urlsafe(32)
    with tempfile.TemporaryDirectory(prefix='b737-private-navbridge-') as folder:
        db = extract_private_stage1(args.stage1_zip, Path(folder)) if args.stage1_zip else Path(args.stage1_db)
        server = create_server(db, token, args.port)
        print('B737 PRIVATE NAVDATA LOCAL BRIDGE', flush=True)
        print('PUBLIC APP: ' + PAGES_ORIGIN + '/b737-classic-simulator/', flush=True)
        print('LOCAL BRIDGE: http://127.0.0.1:' + str(args.port), flush=True)
        print('ONE-TIME CONNECTION TOKEN: ' + token, flush=True)
        print('READ ONLY / NO LNAV VNAV AFDS / press Ctrl+C to disconnect', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()


if __name__ == '__main__':
    main()
