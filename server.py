import json
import os
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from urllib.parse import parse_qsl
from urllib.parse import urlencode
from urllib.parse import quote

ROOT = Path('/Users/federicomarci/Desktop/MarciFit')
os.chdir(ROOT)

PORT = int(os.environ.get('PORT', 8788))
SUPABASE_URL = os.environ.get('MARCI_SUPABASE_URL', 'https://rlwwzdfcvdouytelqxdf.supabase.co').rstrip('/')
SUPABASE_ANON_KEY = os.environ.get('MARCI_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsd3d6ZGZjdmRvdXl0ZWxxeGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDExNTgsImV4cCI6MjA4OTc3NzE1OH0.0iguqJgjBHp34OnthGTJnaFX-T4xfd5a3eSEJDmm5UM')
WATCH_EXTENSIONS = {'.html', '.css', '.js', '.json', '.mjs'}
WATCH_NAMES = {
    'index.html',
    'live-preview.html',
    'style.css',
    'app.js',
    'uiComponents.js',
    'nutritionLogic.js',
    'storage.js',
    'preview-state.json',
}


def latest_project_mtime():
    latest = 0.0
    changed = []
    for path in ROOT.rglob('*'):
        if not path.is_file():
            continue
        if path.name.startswith('.'):
            continue
        if path.name not in WATCH_NAMES and path.suffix not in WATCH_EXTENSIONS:
            continue
        try:
            mtime = path.stat().st_mtime
        except OSError:
            continue
        if mtime >= latest:
            latest = mtime
            changed = [path.relative_to(ROOT).as_posix()]
    return latest, changed


class PreviewHandler(SimpleHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get('Content-Length', '0') or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        try:
            return json.loads(raw.decode('utf-8'))
        except json.JSONDecodeError:
            return {}

    def _proxy_request(self, url, *, method='GET', body=None, headers=None):
        req_headers = {'apikey': SUPABASE_ANON_KEY, 'Accept': 'application/json'}
        if headers:
            req_headers.update(headers)
        command = [
            'curl',
            '-sS',
            '--max-time',
            '10',
            '-X',
            method,
            url,
            '-w',
            '\n__CURL_STATUS__:%{http_code}',
        ]
        for name, value in req_headers.items():
            command.extend(['-H', f'{name}: {value}'])
        if body is not None:
            command.extend(['--data-binary', json.dumps(body)])
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=12,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return 504, {'error': 'proxy upstream timeout'}
        except Exception as err:
            return 504, {'error': str(err)}

        output = result.stdout or ''
        marker = '\n__CURL_STATUS__:'
        if marker in output:
            body_text, status_text = output.rsplit(marker, 1)
        else:
            body_text, status_text = output, '000'
        try:
            status = int(status_text.strip() or '0')
        except ValueError:
            status = 0
        if result.returncode != 0 and status == 0:
            return 504, {'error': (result.stderr or 'curl proxy failed').strip()}
        try:
            payload = json.loads((body_text or '').strip() or '{}')
        except json.JSONDecodeError:
            payload = {'error': (body_text or result.stderr or '').strip()}
        return status or 500, payload

    def do_OPTIONS(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith('/__auth_proxy') or parsed.path.startswith('/__supabase_proxy'):
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.end_headers()
            return
        super().do_OPTIONS()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/__preview_status':
            latest, changed = latest_project_mtime()
            payload = {
                'version': str(latest),
                'changed': changed,
            }
            body = json.dumps(payload).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == '/__auth_proxy/settings':
            status, payload = self._proxy_request(f'{SUPABASE_URL}/auth/v1/settings')
            self._send_json(status, payload)
            return
        if parsed.path == '/__supabase_proxy/app_state':
            query = dict(parse_qsl(parsed.query))
            user_id = query.get('user_id', '').strip()
            access_token = self.headers.get('Authorization', '').replace('Bearer ', '').strip()
            if not user_id or not access_token:
                self._send_json(400, {'error': 'user_id and Authorization required'})
                return
            rest_query = urlencode({
                'select': 'state_json,updated_at,state_version',
                'user_id': f'eq.{user_id}',
            }, quote_via=quote)
            status, payload = self._proxy_request(
                f'{SUPABASE_URL}/rest/v1/app_state?{rest_query}',
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Accept': 'application/json',
                },
            )
            if status == 200 and isinstance(payload, list):
                self._send_json(200, payload[0] if payload else None)
                return
            self._send_json(status, payload)
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/__auth_proxy/token':
            query = parsed.query or 'grant_type=password'
            status, payload = self._proxy_request(
                f'{SUPABASE_URL}/auth/v1/token?{query}',
                method='POST',
                body=self._read_json_body(),
            )
            self._send_json(status, payload)
            return
        if parsed.path == '/__supabase_proxy/profiles':
            access_token = self.headers.get('Authorization', '').replace('Bearer ', '').strip()
            if not access_token:
                self._send_json(400, {'error': 'Authorization required'})
                return
            status, payload = self._proxy_request(
                f'{SUPABASE_URL}/rest/v1/profiles',
                method='POST',
                body=self._read_json_body(),
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Prefer': 'resolution=merge-duplicates,return=representation',
                },
            )
            self._send_json(status, payload)
            return
        if parsed.path == '/__supabase_proxy/app_state':
            access_token = self.headers.get('Authorization', '').replace('Bearer ', '').strip()
            if not access_token:
                self._send_json(400, {'error': 'Authorization required'})
                return
            status, payload = self._proxy_request(
                f'{SUPABASE_URL}/rest/v1/app_state',
                method='POST',
                body=self._read_json_body(),
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Prefer': 'resolution=merge-duplicates,return=representation',
                },
            )
            self._send_json(status, payload)
            return
        self.send_error(404, 'Not found')


ThreadingHTTPServer(('', PORT), PreviewHandler).serve_forever()
