import os
import unittest
import pymupdf
import zipfile
import xml.etree.ElementTree as ET

class TestUyapParity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pdf_path = os.path.join(os.path.dirname(__file__), '..', 'examples', 'örnek karar.pdf')
        cls.udf_path = os.path.join(os.path.dirname(__file__), '..', 'examples', 'örnek karar.udf')
        cls.doc = pymupdf.open(cls.pdf_path)

    def test_page_count(self):
        self.assertEqual(len(self.doc), 3, "PDF tam 3 sayfa olmalıdır")

    def test_page_break_boundaries(self):
        # 1. Sayfa sonu: '" aç' ile bitmeli
        p0_text = self.doc[0].get_text()
        self.assertIn('" aç', p0_text, "1. sayfa '\" aç' ile bitmeli")
        
        # 2. Sayfa gövde metni başı: 'köpek"' ile başlamalı
        # (Üstbilgi ve altbilgi hariç gövde metni)
        p1_blocks = [b[4].strip() for b in self.doc[1].get_text('blocks') if 'vatandas.uyap' not in b[4] and 'SAKARYA 11.' not in b[4] and '2/3' not in b[4]]
        self.assertTrue(p1_blocks[0].startswith('köpek"'), f"2. sayfa 'köpek\"' ile başlamalı, bulunan: {p1_blocks[0][:40]}")
        
        # 2. Sayfa sonu: 'BERAATİNE,' ile bitmeli
        self.assertTrue(p1_blocks[-1].endswith('BERAATİNE,'), f"2. sayfa 'BERAATİNE,' ile bitmeli, bulunan: {p1_blocks[-1][-40:]}")
        
        # 3. Sayfa başı: '2-Müşteki' ile başlamalı
        p2_blocks = [b[4].strip() for b in self.doc[2].get_text('blocks') if 'vatandas.uyap' not in b[4] and 'SAKARYA 11.' not in b[4] and '3/3' not in b[4]]
        self.assertTrue(p2_blocks[0].startswith('2-Müşteki'), f"3. sayfa '2-Müşteki' ile başlamalı, bulunan: {p2_blocks[0][:40]}")

    def test_font_scale_metrics(self):
        page0 = self.doc[0]
        page_dict = page0.get_text('dict')
        sizes = set()
        for block in page_dict['blocks']:
            for line in block.get('lines', []):
                for span in line.get('spans', []):
                    sizes.add(round(span['size'], 2))
        
        # UYAP PDF 0.98 ölçekli font boyutları: 12pt -> 11.76, 11pt -> 10.8, 10pt -> 9.84, 7pt -> 6.84
        self.assertIn(11.76, sizes, "12pt metin 11.76pt olarak ölçeklenmeli")
        self.assertIn(10.8, sizes, "11pt metin 10.8pt olarak ölçeklenmeli")

    def test_qr_and_page_number_coordinates(self):
        page0 = self.doc[0]
        words = page0.get_text('words')
        # Sayfa numarası '1/3'
        pno_words = [w for w in words if w[4] == '1/3']
        self.assertTrue(len(pno_words) > 0, "1/3 sayfa numarası bulunmalı")
        pno = pno_words[0]
        self.assertAlmostEqual(pno[1], 753.43, delta=2.0, msg="Sayfa numarası y=753.43 civarında olmalı")
        self.assertAlmostEqual(pno[2], 524.89, delta=2.0, msg="Sayfa numarası sağ kenara hizalı olmalı")

    def test_body_margin_boundaries(self):
        # Sol marjin fiziksel 67.92pt, sağ metin sınırı 522.50pt
        page0 = self.doc[0]
        words = [w for w in page0.get_text('words') if 200 < w[1] < 740]
        min_x0 = min(w[0] for w in words)
        self.assertAlmostEqual(min_x0, 67.92, delta=1.5, msg="Metin başlangıcı sol marjini 67.92pt olmalı")

    def test_underline_dots_coordinates(self):
        # P#10 ve P#13 ortalanmış boş altı çizili paragraflar (GEREKÇELİ KARAR üstü ve TÜRK MİLLETİ ADINA altı)
        page0 = self.doc[0]
        drawings = page0.get_drawings()
        dots = [d for d in drawings if d['lineCap'] == (1, 1, 1) and len(d['items']) == 1 and d['items'][0][0] == 'l' and d['items'][0][1] == d['items'][0][2]]
        self.assertEqual(len(dots), 2, "GEREKÇELİ KARAR üstü ve TÜRK MİLLETİ ADINA altında 2 adet alt çizgi noktası olmalı")
        # İlk nokta: x=296.28, y=225.24
        d1 = dots[0]['items'][0][1]
        self.assertAlmostEqual(d1.x, 296.28, delta=2.0)
        self.assertAlmostEqual(d1.y, 225.24, delta=2.0)
        # İkinci nokta: x=296.28, y=272.28
        d2 = dots[1]['items'][0][1]
        self.assertAlmostEqual(d2.x, 296.28, delta=2.0)
        self.assertAlmostEqual(d2.y, 272.28, delta=2.0)

    def test_colon_and_continuation_lines_alignment(self):
        page0 = self.doc[0]
        words = page0.get_text('words')
        # Bilgi alanlarının iki noktaları (HAKİM, KATİP, DAVACI, SUÇ, vb.)
        colons = [w for w in words if w[4] == ':' and 280 < w[1] < 530]
        for c in colons:
            self.assertAlmostEqual(c[0], 247.22, delta=1.5, msg=f"İki nokta x0 koordinatı 247.22 olmalı: {c}")
            self.assertAlmostEqual(c[2], 251.14, delta=1.5, msg=f"İki nokta x1 koordinatı 251.14 olmalı: {c}")

        # Sanık kimlik devam satırları ilk kelimeleri (20/02/2002, (Inc), MUĞLA, BİTLİS, TC)
        cont_words = [w for w in words if w[4] in ['20/02/2002', '(Inc)', 'MUĞLA', 'BİTLİS', 'TC'] and 360 < w[1] < 460 and w[0] < 260]
        self.assertEqual(len(cont_words), 5, "5 adet devam satırı ilk kelimesi bulunmalı")
        for cw in cont_words:
            self.assertAlmostEqual(cw[0], 254.04, delta=1.0, msg=f"Devam satırı başlangıç koordinatı 254.04 olmalı: {cw}")

    def test_actual_print_geometry_and_parity(self):
        actual_pdf_path = os.path.join(os.path.dirname(__file__), '..', 'scratch', 'actual_print.pdf')
        if not os.path.exists(actual_pdf_path):
            self.skipTest("scratch/actual_print.pdf henüz oluşturulmamış, atlanıyor")

        actual_doc = pymupdf.open(actual_pdf_path)
        self.assertEqual(len(actual_doc), 3, "Web baskı PDF çıktısı tam 3 sayfa olmalıdır")

        # 1. Sayfa sonu ve 2. sayfa başı/sonu kelime eşleşmesi
        p0_text = actual_doc[0].get_text()
        self.assertIn('" aç', p0_text, "Baskı 1. sayfa '\" aç' ile bitmeli")

        p1_body_lines = [l.strip() for l in actual_doc[1].get_text().splitlines() if l.strip() and 'vatandas' not in l and '2/3' not in l and 'SAKARYA 11.' not in l and 'Dosya-Karar' not in l]
        self.assertTrue(p1_body_lines[0].startswith('köpek"'), f"Baskı 2. sayfa 'köpek\"' ile başlamalı: {p1_body_lines[0]}")
        self.assertEqual(p1_body_lines[-1], 'BERAATİNE,', "Baskı 2. sayfa gövde metni 'BERAATİNE,' ile bitmeli")

        # 2. Sayfa üstbilgisi tek satırda ve 9.84pt olmalı
        p1 = actual_doc[1]
        p1_spans = []
        for b in p1.get_text('dict')['blocks']:
            for line in b.get('lines', []):
                for s in line.get('spans', []):
                    if 'SAKARYA 11.' in s['text']:
                        p1_spans.append(s)
        self.assertTrue(len(p1_spans) > 0, "2. sayfada mahkeme başlığı bulunmalı")
        for s in p1_spans:
            self.assertAlmostEqual(s['size'], 9.84, delta=0.5, msg="Üstbilgi fontu ~9.84pt olmalıdır")
            self.assertAlmostEqual(s['bbox'][0], 67.91, delta=1.0, msg="Üstbilgi x0 konumu ~67.92pt olmalıdır")

        # Altbilgi doğrulama metni tek satırda ve x0=65.88pt olmalı
        for p_idx in range(3):
            p = actual_doc[p_idx]
            notice_blocks = [b for b in p.get_text('blocks') if 'vatandas.uyap' in b[4]]
            self.assertEqual(len(notice_blocks), 1, f"Sayfa {p_idx+1}'de tam 1 doğrulama metni olmalıdır")
            nb = notice_blocks[0]
            self.assertAlmostEqual(nb[0], 65.88, delta=1.5, msg="Doğrulama metni x0 ~65.88pt olmalıdır")
            self.assertNotIn('\n', nb[4].strip(), "Doğrulama metni tek satır olmalıdır")

        # QR kodu fiziksel ölçüleri: 50.04pt x 50.04pt, sağ kenara 9pt, alt kenara 17.88pt
        for p_idx in range(3):
            p = actual_doc[p_idx]
            qr_drawings = [d['rect'] for d in p.get_drawings() if d['rect'].x0 > 500 and d['rect'].y0 > 750]
            self.assertTrue(len(qr_drawings) > 0, f"Sayfa {p_idx+1}'de QR kodu çizimi bulunmalıdır")
            outer_qr = min(qr_drawings, key=lambda r: (r.x0, r.y0))
            self.assertAlmostEqual(outer_qr.width, 50.04, delta=1.0, msg="QR genişliği ~50.04pt (17.65mm) olmalı")
            self.assertAlmostEqual(outer_qr.height, 50.04, delta=1.0, msg="QR yüksekliği ~50.04pt (17.65mm) olmalı")
            self.assertAlmostEqual(p.rect.width - outer_qr.x1, 9.00, delta=1.5, msg="QR sağ kenar mesafesi ~9.00pt olmalı")
            self.assertAlmostEqual(p.rect.height - outer_qr.y1, 17.88, delta=1.5, msg="QR alt kenar mesafesi ~17.88pt olmalı")

if __name__ == '__main__':
    unittest.main()
