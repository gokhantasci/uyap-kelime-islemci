import io
import json
import threading
import unittest
import urllib.request
import urllib.error
from unittest.mock import patch
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import dictionary_api
from open_in_editor import create_server

class ServicesTest(unittest.TestCase):
    def test_dictionary_normalizes_and_limits_input(self):
        with self.assertRaises(ValueError): dictionary_api.lookup('https://other.test/private')
        with self.assertRaises(ValueError): dictionary_api.lookup('belgenin bütün metni')
        fixture = [{'madde':'test','anlamlarListe':[{'anlam':'Deneme.'}]}]
        with patch('dictionary_api.urllib.request.urlopen', return_value=io.BytesIO(json.dumps(fixture).encode())) as call:
            result=dictionary_api.lookup('test')
            self.assertTrue(result['found']); self.assertEqual(result['entries'][0]['meanings'],['Deneme.'])
            dictionary_api.lookup('test'); self.assertEqual(call.call_count,1)

    def test_local_opener_serves_only_authorized_file_without_cors(self):
        source=Path('examples/örnek karar.udf')
        server,url=create_server(source)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            from urllib.parse import urlsplit,parse_qs
            target=parse_qs(urlsplit(url).query)['linkac'][0]
            with urllib.request.urlopen(target) as r:
                self.assertEqual(r.read(),source.read_bytes())
                self.assertIsNone(r.headers.get('Access-Control-Allow-Origin'))
            base=url.split('?')[0]
            with self.assertRaises(urllib.error.HTTPError) as exc: urllib.request.urlopen(base+'.git/config')
            self.assertEqual(exc.exception.code,404)
            exc.exception.close()
            with urllib.request.urlopen(base+'assets/data/surum-duyurusu.md') as r: self.assertGreater(len(r.read()),10)
        finally:
            server.shutdown();server.server_close();thread.join()

if __name__=='__main__': unittest.main()
