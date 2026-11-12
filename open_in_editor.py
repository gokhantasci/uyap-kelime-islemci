"""Yerel UDF dosyasını internete yüklemeden, tek kullanımlık loopback oturumunda açar."""
import argparse
import ctypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import secrets
import sys
import threading
import time
import urllib.parse
import webbrowser

def show_error(message, title="UYAP Kelime İşlemci"):
    """Windows üzerinde GUI modunda çalışırken kullanıcıya hata kutusu gösterir."""
    try:
        ctypes.windll.user32.MessageBoxW(0, str(message), str(title), 0x10)
    except Exception:
        print(f"[{title}] {message}", file=sys.stderr)

def create_server(file=None):
    root = Path(__file__).resolve().parent
    source = Path(file).resolve() if file else None
    token = secrets.token_urlsafe(32)
    document_path = '/local-document/' + token + '.udf'

    class Handler(SimpleHTTPRequestHandler):
        # Windows kayıt defterindeki bozuk MIME türü eşleşmelerini geçersiz kıl
        extensions_map = SimpleHTTPRequestHandler.extensions_map.copy()
        extensions_map.update({
            '.js': 'application/javascript',
            '.mjs': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.svg': 'image/svg+xml',
            '.udf': 'application/octet-stream',
            '.wasm': 'application/wasm',
            '.aff': 'text/plain',
            '.dic': 'text/plain',
            '.html': 'text/html; charset=utf-8',
        })

        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def do_GET(self):
            # Yalnızca yerel loopback çağrılarına izin ver (DNS rebinding koruması)
            host_part = (self.headers.get('Host') or '').split(':')[0].strip().lower()
            if host_part not in ('127.0.0.1', 'localhost', '::1', '[::1]'):
                self.send_error(403)
                return

            path = urllib.parse.urlsplit(self.path).path
            self.server.last_request = time.monotonic()

            # Tek kullanımlık güvenli belge servis rotası
            if source and path == document_path:
                try:
                    data = source.read_bytes()
                except Exception as e:
                    self.send_error(500, f"Dosya okunamadı: {e}")
                    return
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return

            # Dizin geçişi (Path traversal) koruması
            if '..' in urllib.parse.unquote(path).split('/'):
                self.send_error(403)
                return

            # İzin verilen statik dosyalar ve klasörler
            allowed_prefixes = ('/assets/', '/data/', '/examples/')
            allowed_files = ('/', '/index.html', '/favicon.ico', '/llms.txt', '/manifest.json')
            if path not in allowed_files and not any(path.startswith(p) for p in allowed_prefixes):
                self.send_error(404)
                return

            super().do_GET()

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    server.last_request = time.monotonic()
    base = f'http://127.0.0.1:{server.server_port}/'
    if source:
        query = urllib.parse.urlencode({
            'linkac': base.rstrip('/') + document_path,
            'title': source.stem
        })
        url = base + '?' + query
    else:
        url = base
    return server, url

def main():
    parser = argparse.ArgumentParser(description="UYAP Kelime İşlemci Yerel Başlatıcı")
    parser.add_argument('file', nargs='?', help=".udf uzantılı dosya yolu")
    args = parser.parse_args()

    target_file = None
    if args.file:
        clean_path = args.file.strip('"\'')
        p = Path(clean_path)
        if not p.is_file():
            show_error(f"Seçilen dosya bulunamadı:\n{clean_path}")
            return 1
        if p.suffix.lower() != '.udf':
            show_error(f"Bu işlem yalnızca .udf uzantılı UYAP dosyaları içindir:\n{clean_path}")
            return 1
        target_file = str(p.resolve())

    try:
        server, url = create_server(target_file)
    except Exception as exc:
        show_error(f"Yerel sunucu başlatılamadı:\n{exc}")
        return 1

    def idle_close():
        while time.monotonic() - server.last_request < 3600:
            time.sleep(30)
        server.shutdown()

    threading.Thread(target=idle_close, daemon=True).start()
    threading.Timer(0.2, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except Exception:
        pass
    finally:
        server.server_close()
    return 0

if __name__ == '__main__':
    sys.exit(main() or 0)
