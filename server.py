import os
os.chdir('/Users/federicomarci/Desktop/MarciFit')
from http.server import HTTPServer, SimpleHTTPRequestHandler
port = int(os.environ.get('PORT', 8788))
HTTPServer(('', port), SimpleHTTPRequestHandler).serve_forever()
