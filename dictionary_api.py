"""TDK yanıtını küçük ve kararlı bir API'ye çevirir. Yalnız tek kelime kabul eder."""
import json
import re
import time
import threading
import urllib.parse
import urllib.request

_cache = {}
_lock = threading.Lock()

def lookup(word):
    word = str(word).strip()
    if not re.fullmatch(r"[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû’'-]{1,64}", word):
        raise ValueError('Bir kelime girin (en fazla 64 harf).')
    key = word.replace('I', 'ı').replace('İ', 'i').lower()
    with _lock:
        cached = _cache.get(key)
        if cached and time.monotonic() - cached[0] < 86400:
            return cached[1]
    request = urllib.request.Request('https://sozluk.gov.tr/gts?ara=' + urllib.parse.quote(key),
                                     headers={'User-Agent': 'UYAP-Web-Editor/2.6', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=8) as response:
        data = json.loads(response.read(512_000).decode('utf-8'))
    entries = []
    for entry in data if isinstance(data, list) else []:
        entries.append({'word': entry.get('madde', key),
                        'meanings': [m.get('anlam', '') for m in entry.get('anlamlarListe', [])][:12]})
    result = {'word': word, 'found': bool(entries), 'entries': entries, 'source': 'Türk Dil Kurumu',
              'sourceUrl': 'https://sozluk.gov.tr/kelime/' + urllib.parse.quote(key)}
    with _lock:
        if len(_cache) >= 2000:
            _cache.pop(next(iter(_cache)))
        _cache[key] = (time.monotonic(), result)
    return result
