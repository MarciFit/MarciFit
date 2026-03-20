import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path('/Users/federicomarci/Desktop/MarciFit')
os.chdir(ROOT)

PORT = int(os.environ.get('PORT', 8788))
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
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
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
        return super().do_GET()


HTTPServer(('', PORT), PreviewHandler).serve_forever()
