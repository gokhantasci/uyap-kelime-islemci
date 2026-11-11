"""Yerel dosyayı internet sunucusuna yüklemeden, tek kullanımlık loopback oturumunda açar."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import secrets
import threading
import time
import urllib.parse
import webbrowser

def create_server(file=None):
    root = Path(__file__).resolve().parent
    source = Path(file).resolve(strict=True) if file else None
    token = secrets.token_urlsafe(32)
    document_path = '/local-document/' + token + '.udf'

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def do_GET(self):
            if self.headers.get('Host') not in (f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'):
                self.send_error(403); return
            path = urllib.parse.urlsplit(self.path).path
            self.server.last_request = time.monotonic()
            if source and path == document_path:
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(source.stat().st_size))
                self.end_headers()
                self.wfile.write(source.read_bytes())
                return
            if path not in ('/', '/index.html', '/favicon.ico') and not path.startswith('/assets/'):
                self.send_error(404); return
            if '..' in urllib.parse.unquote(path).split('/'):
                self.send_error(403); return
            super().do_GET()

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    server.last_request = time.monotonic()
    base = f'http://127.0.0.1:{server.server_port}/'
    if source:
        url = base + '?' + urllib.parse.urlencode({'linkac':base.rstrip('/')+document_path,'title':source.stem})
    else:
        url = base
    return server, url

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('file', nargs='?')
    args = parser.parse_args()
    if args.file and Path(args.file).suffix.lower() != '.udf':
        parser.error('Bu komut .udf dosyaları içindir.')
    server, url = create_server(args.file)
    def idle_close():
        while time.monotonic() - server.last_request < 3600:
            time.sleep(30)
        server.shutdown()
    threading.Thread(target=idle_close, daemon=True).start()
    threading.Timer(.3, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
