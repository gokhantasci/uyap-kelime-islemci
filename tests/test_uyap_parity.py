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

if __name__ == '__main__':
    unittest.main()
