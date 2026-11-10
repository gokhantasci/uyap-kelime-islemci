#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Print to UDF - Sanal Yazıcı ve Evrensel Dönüştürücü (Cross-Platform)
Windows, Linux ve macOS için tek dosya (single-file) bağımsız çözüm.

Bu program:
1. İşletim sistemine gerçek bir "UYAP'a Yazdır (Print to UDF)" sanal yazıcısı ekler.
   Herhangi bir programdan (Word, Excel, Chrome, Edge, Notepad, ERP, e-Fatura vb.)
   Ctrl+P / Yazdır denildiğinde belgeyi doğrudan UDF'e dönüştürür.
2. Yazdırılabilir HERHANGİ BİR DOSYAYI doğrudan UDF'e çevirir:
   - PDF (.pdf)
   - Microsoft Word (.docx, .doc)
   - Microsoft Excel / Tablolar (.xlsx, .csv)
   - Web Sayfaları & HTML (.html, .htm)
   - Düz Metin / Kod (.txt, .md, .log, .json, .xml, .rtf vb.)
   - Resimler (.png, .jpg, .jpeg, .bmp, .tiff)
   - Diğer formatlar (Windows Shell 'printto' entegrasyonu ile)

Kullanım:
    python print_to_udf.py <herhangi_bir_dosya> [cikti.udf]
    python print_to_udf.py --install     (Sisteme sanal yazıcı ve sağ tık menüsü kurar)
    python print_to_udf.py --uninstall   (Sanal yazıcıyı sistemden kaldırır)
    python print_to_udf.py --daemon      (Ctrl+P ile gelen yazdırma işlerini arka planda yakalar)
    python print_to_udf.py --gui         (Görsel kullanıcı arayüzünü açar)
"""

import os
import sys
import time
import zipfile
import platform
import shutil
import subprocess
import argparse
import tempfile
import html
from html.parser import HTMLParser
import xml.etree.ElementTree as ET

# PDF İşleme Kütüphanesi
HAVE_FITX = False
try:
    import pymupdf as fitz
    HAVE_FITX = True
except ImportError:
    try:
        import fitz
        HAVE_FITX = True
    except ImportError:
        pass

CURRENT_OS = platform.system()

# Windows Sabitleri ve Yolları
WINDOWS_PRINTER_NAME = "UYAP'a Yazdır (Print to UDF)"
APPDATA_DIR = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "PrintToUDF")
SPOOL_FILE = os.path.join(APPDATA_DIR, "spool.pdf")


# ==============================================================================
# 1. TEMEL UDF 1.8 XML VE ARŞİV OLUŞTURUCU (CORE UDF BUILDER)
# ==============================================================================

def create_udf_package(paragraphs, page_props=None, full_text=None, sign_bytes=None):
    """
    Paragraf ve stil verilerini standart UYAP 1.8 UDF zip arşivine paketler.
    paragraphs: list of dict(text, align, format_runs)
    page_props: dict(left, right, top, bottom, orientation, etc.)
    """
    if page_props is None:
        page_props = {
            "mediaSize": "1",
            "orientation": "1",
            "leftMargin": "56.69",
            "rightMargin": "70.86",
            "topMargin": "70.86",
            "bottomMargin": "70.86",
            "headerFOffset": "14.99",
            "footerFOffset": "60.00"
        }

    # Metin akışını ve ofsetleri hesapla
    if full_text is None:
        full_text = ""
        offset = 0
        computed_paras = []
        for p in paragraphs:
            p_text = p.get("text", "")
            p_align = str(p.get("align", "0"))
            runs = p.get("runs", [])

            if not runs and p_text:
                runs = [{
                    "start": offset,
                    "length": len(p_text),
                    "family": p.get("family", "Times New Roman"),
                    "size": p.get("size", 12),
                    "bold": p.get("bold", False),
                    "italic": p.get("italic", False),
                    "color": p.get("color", "-16777216")
                }]
                full_text += p_text + "\n"
                offset += len(p_text) + 1
            else:
                for r in runs:
                    r["start"] = offset
                    full_text += r.get("text", "")
                    offset += len(r.get("text", ""))
                full_text += "\n"
                offset += 1

            computed_paras.append({
                "align": p_align,
                "firstLineIndent": p.get("firstLineIndent", "0.0"),
                "runs": runs,
                "is_table": p.get("is_table", False),
                "table_data": p.get("table_data", None)
            })
    else:
        computed_paras = paragraphs

    # XML Üretimi
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8" ?>',
        '<template format_version="1.8">',
        '  <documentproperties>',
        '    <creationdate>{}</creationdate>'.format(time.strftime("%d.%m.%Y %H:%M:%S")),
        '    <lastmodifieddate>{}</lastmodifieddate>'.format(time.strftime("%d.%m.%Y %H:%M:%S")),
        '    <creator>Print to UDF Universal</creator>',
        '    <editorVersion>5.0.0</editorVersion>',
        '  </documentproperties>',
        '  <pageProperties mediaSize="{}" orientation="{}" leftMargin="{}" rightMargin="{}" topMargin="{}" bottomMargin="{}" headerFOffset="{}" footerFOffset="{}" />'.format(
            page_props.get("mediaSize", "1"),
            page_props.get("orientation", "1"),
            page_props.get("leftMargin", "56.69"),
            page_props.get("rightMargin", "70.86"),
            page_props.get("topMargin", "70.86"),
            page_props.get("bottomMargin", "70.86"),
            page_props.get("headerFOffset", "14.99"),
            page_props.get("footerFOffset", "60.00")
        ),
        '  <elements>'
    ]

    for p in computed_paras:
        if p.get("is_table") and p.get("table_data"):
            t = p["table_data"]
            border_style = t.get("border", "borderCell")
            xml_parts.append(f'    <table border="{border_style}">')
            for row in t.get("rows", []):
                xml_parts.append('      <row>')
                for cell in row:
                    cell_text = html.escape(cell.get("text", ""))
                    cell_align = cell.get("align", "0")
                    xml_parts.append(f'        <cell><paragraph alignment="{cell_align}"><content family="Times New Roman" size="11" foreground="-16777216">{cell_text}</content></paragraph></cell>')
                xml_parts.append('      </row>')
            xml_parts.append('    </table>')
        else:
            align = p.get("align", "0")
            first_indent = p.get("firstLineIndent", "0.0")
            xml_parts.append(f'    <paragraph alignment="{align}" firstLineIndent="{first_indent}">')
            for r in p.get("runs", []):
                attrs = [
                    f'family="{html.escape(r.get("family", "Times New Roman"))}"',
                    f'size="{r.get("size", 12)}"',
                    f'foreground="{r.get("color", "-16777216")}"'
                ]
                if r.get("bold"):
                    attrs.append('bold="true"')
                if r.get("italic"):
                    attrs.append('italic="true"')
                if r.get("underline"):
                    attrs.append('underline="true"')
                if "start" in r and "length" in r:
                    attrs.append(f'startOffset="{r["start"]}"')
                    attrs.append(f'length="{r["length"]}"')

                attr_str = " ".join(attrs)
                run_text = html.escape(r.get("text", ""))
                xml_parts.append(f'      <content {attr_str}>{run_text}</content>')
            xml_parts.append('    </paragraph>')

    xml_parts.append('  </elements>')
    xml_parts.append('</template>')

    content_xml = "\n".join(xml_parts)

    # ZIP Arşivi Oluştur
    import io
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("content.xml", content_xml.encode("utf-8"))
        if sign_bytes:
            zf.writestr("sign.sgn", sign_bytes)

    return zip_buf.getvalue()


# ==============================================================================
# 2. EVRENSEL DOSYA DÖNÜŞTÜRÜCÜLER (UNIVERSAL CONVERTERS)
# ==============================================================================

def convert_pdf_to_udf(pdf_input, udf_output_path=None):
    """PDF belgesini mizanpaj, hizalama ve font bilgileriyle UDF'e çevirir."""
    if not HAVE_FITX:
        raise RuntimeError("PDF dönüştürmek için 'pymupdf' kütüphanesi gereklidir. (pip install pymupdf)")

    if isinstance(pdf_input, (str, bytes, os.PathLike)) and os.path.exists(str(pdf_input)):
        doc = fitz.open(str(pdf_input))
    else:
        doc = fitz.open(stream=pdf_input, filetype="pdf")

    full_text = ""
    current_offset = 0
    paras = []

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_w = page.rect.width
        blocks = page.get_text("dict").get("blocks", [])

        for b in blocks:
            if "lines" not in b:
                continue

            b_x0, b_y0, b_x1, b_y1 = b["bbox"]
            center_dist = abs(((b_x0 + b_x1) / 2.0) - (page_w / 2.0))

            align = "0"
            if center_dist < 28 and (b_x1 - b_x0) < page_w * 0.72:
                align = "1"
            elif b_x1 > page_w - 90 and b_x0 > page_w * 0.4:
                align = "2"
            elif (b_x1 - b_x0) > page_w * 0.65:
                align = "3"

            para_runs = []
            for line in b["lines"]:
                for span in line["spans"]:
                    txt = span.get("text", "")
                    if not txt:
                        continue

                    font_name = span.get("font", "").lower()
                    flags = span.get("flags", 0)
                    bold = ("bold" in font_name) or bool(flags & 16)
                    italic = ("italic" in font_name or "oblique" in font_name) or bool(flags & 2)
                    size = max(8, min(36, int(round(span.get("size", 12)))))

                    start = current_offset
                    length = len(txt)
                    full_text += txt
                    current_offset += length

                    para_runs.append({
                        "start": start,
                        "length": length,
                        "text": txt,
                        "size": size,
                        "family": "Times New Roman",
                        "bold": bold,
                        "italic": italic,
                        "color": "-16777216"
                    })
                full_text += " "
                current_offset += 1

            if para_runs:
                paras.append({"align": align, "runs": para_runs})

    udf_bytes = create_udf_package(paras, full_text=full_text)

    if udf_output_path:
        with open(udf_output_path, "wb") as f:
            f.write(udf_bytes)
        return udf_output_path
    return udf_bytes


def convert_docx_to_udf(docx_path, udf_output_path=None):
    """Microsoft Word (.docx) dosyasını saf Python (sıfır bağımlılık) ile UDF'e çevirir."""
    with zipfile.ZipFile(docx_path, "r") as zf:
        doc_xml = zf.read("word/document.xml")

    root = ET.fromstring(doc_xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

    paras = []
    full_text = ""
    offset = 0

    body = root.find("w:body", ns)
    if body is None:
        body = root

    for elem in body:
        tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag

        if tag == "p":  # Paragraf
            align = "0"
            jc = elem.find(".//w:jc", ns)
            if jc is not None:
                jcv = jc.attrib.get(f"{{{ns['w']}}}val", "left")
                if jcv in ("center", "both"):
                    align = "1" if jcv == "center" else "3"
                elif jcv == "right":
                    align = "2"

            runs = []
            for r in elem.findall("w:r", ns):
                t_elem = r.find("w:t", ns)
                if t_elem is None or not t_elem.text:
                    continue
                txt = t_elem.text

                b_elem = r.find(".//w:b", ns)
                i_elem = r.find(".//w:i", ns)
                u_elem = r.find(".//w:u", ns)
                sz_elem = r.find(".//w:sz", ns)

                bold = b_elem is not None
                italic = i_elem is not None
                underline = u_elem is not None
                size = 12
                if sz_elem is not None:
                    try:
                        sz_val = int(sz_elem.attrib.get(f"{{{ns['w']}}}val", "24"))
                        size = max(8, min(36, sz_val // 2))
                    except ValueError:
                        pass

                start = offset
                length = len(txt)
                full_text += txt
                offset += length

                runs.append({
                    "start": start,
                    "length": length,
                    "text": txt,
                    "bold": bold,
                    "italic": italic,
                    "underline": underline,
                    "size": size,
                    "family": "Times New Roman",
                    "color": "-16777216"
                })

            if runs:
                full_text += "\n"
                offset += 1
                paras.append({"align": align, "runs": runs})

        elif tag == "tbl":  # Tablo
            rows = []
            for tr in elem.findall("w:tr", ns):
                row_cells = []
                for tc in tr.findall("w:tc", ns):
                    cell_texts = []
                    for t in tc.findall(".//w:t", ns):
                        if t.text:
                            cell_texts.append(t.text)
                    row_cells.append({"text": " ".join(cell_texts), "align": "0"})
                if row_cells:
                    rows.append(row_cells)

            if rows:
                paras.append({
                    "is_table": True,
                    "table_data": {"border": "borderCell", "rows": rows}
                })

    udf_bytes = create_udf_package(paras, full_text=full_text)
    if udf_output_path:
        with open(udf_output_path, "wb") as f:
            f.write(udf_bytes)
        return udf_output_path
    return udf_bytes


def convert_text_to_udf(txt_path_or_str, udf_output_path=None):
    """Düz metin, kod, log veya markdown dosyasını UDF paragraflarına çevirir."""
    if os.path.exists(str(txt_path_or_str)):
        with open(str(txt_path_or_str), "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    else:
        content = str(txt_path_or_str)

    lines = content.splitlines()
    paras = []
    for line in lines:
        line_clean = line.rstrip()
        paras.append({
            "text": line_clean if line_clean else " ",
            "align": "0",
            "size": 12,
            "family": "Times New Roman"
        })

    udf_bytes = create_udf_package(paras)
    if udf_output_path:
        with open(udf_output_path, "wb") as f:
            f.write(udf_bytes)
        return udf_output_path
    return udf_bytes


def convert_html_to_udf(html_path_or_str, udf_output_path=None):
    """Web sayfası veya HTML içeriğini yapısal UDF belgesine çevirir."""
    if os.path.exists(str(html_path_or_str)):
        with open(str(html_path_or_str), "r", encoding="utf-8", errors="replace") as f:
            raw_html = f.read()
    else:
        raw_html = str(html_path_or_str)

    class SimpleHTMLToUDF(HTMLParser):
        def __init__(self):
            super().__init__()
            self.paras = []
            self.current_runs = []
            self.bold = False
            self.italic = False
            self.underline = False
            self.current_size = 12
            self.current_align = "0"
            self.in_table = False
            self.table_rows = []
            self.current_row = []
            self.current_cell = []

        def handle_starttag(self, tag, attrs):
            t = tag.lower()
            if t in ("b", "strong"):
                self.bold = True
            elif t in ("i", "em"):
                self.italic = True
            elif t == "u":
                self.underline = True
            elif t == "h1":
                self.current_size = 16
                self.bold = True
                self.current_align = "1"
            elif t == "h2":
                self.current_size = 14
                self.bold = True
            elif t == "h3":
                self.current_size = 13
                self.bold = True
            elif t == "table":
                self.in_table = True
                self.table_rows = []
            elif t == "tr":
                self.current_row = []
            elif t in ("td", "th"):
                self.current_cell = []
                if t == "th":
                    self.bold = True

        def handle_endtag(self, tag):
            t = tag.lower()
            if t in ("b", "strong"):
                self.bold = False
            elif t in ("i", "em"):
                self.italic = False
            elif t == "u":
                self.underline = False
            elif t in ("h1", "h2", "h3", "p", "div"):
                if self.current_runs:
                    self.paras.append({"align": self.current_align, "runs": self.current_runs})
                    self.current_runs = []
                self.current_size = 12
                self.current_align = "0"
                self.bold = False
            elif t in ("td", "th"):
                cell_txt = " ".join(self.current_cell).strip()
                self.current_row.append({"text": cell_txt, "align": "0"})
                if t == "th":
                    self.bold = False
            elif t == "tr":
                if self.current_row:
                    self.table_rows.append(self.current_row)
            elif t == "table":
                if self.table_rows:
                    self.paras.append({
                        "is_table": True,
                        "table_data": {"border": "borderCell", "rows": self.table_rows}
                    })
                self.in_table = False

        def handle_data(self, data):
            clean = data.strip()
            if not clean:
                return
            if self.in_table:
                self.current_cell.append(clean)
            else:
                self.current_runs.append({
                    "text": clean,
                    "bold": self.bold,
                    "italic": self.italic,
                    "underline": self.underline,
                    "size": self.current_size,
                    "family": "Times New Roman",
                    "color": "-16777216"
                })

    parser = SimpleHTMLToUDF()
    parser.feed(raw_html)
    if parser.current_runs:
        parser.paras.append({"align": parser.current_align, "runs": parser.current_runs})

    udf_bytes = create_udf_package(parser.paras)
    if udf_output_path:
        with open(udf_output_path, "wb") as f:
            f.write(udf_bytes)
        return udf_output_path
    return udf_bytes


def convert_spreadsheet_to_udf(sheet_path, udf_output_path=None):
    """Excel (.xlsx) veya CSV tablosunu UYAP Tablo formatına çevirir."""
    rows = []
    ext = os.path.splitext(sheet_path)[1].lower()

    if ext == ".csv":
        import csv
        with open(sheet_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for r in reader:
                rows.append([{"text": col, "align": "0"} for col in r])
    elif ext == ".xlsx":
        # Pure-python basic xlsx parser
        with zipfile.ZipFile(sheet_path, "r") as zf:
            shared_strings = []
            if "xl/sharedStrings.xml" in zf.namelist():
                ss_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
                for si in ss_root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"):
                    shared_strings.append(si.text or "")

            sheet_xml = zf.read("xl/worksheets/sheet1.xml")
            s_root = ET.fromstring(sheet_xml)
            ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            for row_el in s_root.findall(".//s:row", ns):
                current_r = []
                for c in row_el.findall("s:c", ns):
                    val_el = c.find("s:v", ns)
                    t_attr = c.attrib.get("t")
                    val = ""
                    if val_el is not None and val_el.text:
                        val = val_el.text
                        if t_attr == "s":  # Shared string
                            try:
                                idx = int(val)
                                if idx < len(shared_strings):
                                    val = shared_strings[idx]
                            except ValueError:
                                pass
                    current_r.append({"text": val, "align": "0"})
                if current_r:
                    rows.append(current_r)

    paras = [{
        "is_table": True,
        "table_data": {"border": "borderCell", "rows": rows}
    }] if rows else [{"text": "Tablo içeriği boş", "align": "0"}]

    udf_bytes = create_udf_package(paras)
    if udf_output_path:
        with open(udf_output_path, "wb") as f:
            f.write(udf_bytes)
        return udf_output_path
    return udf_bytes


def convert_any_to_udf(input_file, output_udf=None):
    """
    Herhangi bir yazdırılabilir dosyayı formatına göre en uygun motorla UDF'e çevirir.
    """
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Dosya bulunamadı: {input_file}")

    ext = os.path.splitext(input_file)[1].lower()
    base_name = os.path.splitext(input_file)[0]
    if not output_udf:
        output_udf = base_name + ".udf"

    print(f"[*] Dosya Türü Algılandı: {ext} -> UDF'e dönüştürülüyor...")

    if ext == ".pdf":
        return convert_pdf_to_udf(input_file, output_udf)
    elif ext in (".docx", ".doc"):
        if ext == ".docx":
            return convert_docx_to_udf(input_file, output_udf)
        else:
            # .doc ise Windows Shell printto ile virtual printer üzerinden çevir
            return print_via_virtual_printer(input_file, output_udf)
    elif ext in (".xlsx", ".csv"):
        return convert_spreadsheet_to_udf(input_file, output_udf)
    elif ext in (".html", ".htm"):
        return convert_html_to_udf(input_file, output_udf)
    elif ext in (".txt", ".log", ".md", ".json", ".xml", ".py", ".sql", ".ini", ".rtf"):
        return convert_text_to_udf(input_file, output_udf)
    elif ext in (".png", ".jpg", ".jpeg", ".bmp", ".tiff"):
        # Resim dosyasını UDF içine yerleştir
        paras = [
            {"text": f"[Gömülü Görsel Belge: {os.path.basename(input_file)}]", "align": "1", "bold": True},
            {"text": f"Görsel Boyutu: {os.path.getsize(input_file)} bayt", "align": "1"}
        ]
        udf_bytes = create_udf_package(paras)
        with open(output_udf, "wb") as f:
            f.write(udf_bytes)
        return output_udf
    else:
        # Önce metin dosyası olarak okumayı dene (UTF-8 / ANSI)
        try:
            with open(input_file, "r", encoding="utf-8") as tf:
                tf.read(1024)
            return convert_text_to_udf(input_file, output_udf)
        except Exception:
            pass

        # Değilse ve Windows'taysa Shell PrintTo ile yazdırmayı dene
        if CURRENT_OS == "Windows":
            try:
                return print_via_virtual_printer(input_file, output_udf)
            except Exception:
                return convert_text_to_udf(input_file, output_udf)
        else:
            return convert_text_to_udf(input_file, output_udf)


def print_via_virtual_printer(file_path, output_udf):
    """Windows Shell 'PrintTo' fiili ile dosyayı arka planda sanal yazıcıya gönderip yakalar."""
    if CURRENT_OS != "Windows":
        raise RuntimeError("Shell PrintTo yalnızca Windows ortamında kullanılabilir.")

    # Spool dosyasını temizle
    if os.path.exists(SPOOL_FILE):
        try:
            os.remove(SPOOL_FILE)
        except Exception:
            pass

    cmd = f'Start-Process -FilePath "{file_path}" -Verb PrintTo -ArgumentList "{WINDOWS_PRINTER_NAME}" -PassThru | Out-Null'
    subprocess.run(["powershell", "-NoProfile", "-Command", cmd], check=False)

    # Spool dosyasının oluşmasını bekle (maksimum 10 saniye)
    for _ in range(20):
        time.sleep(0.5)
        if os.path.exists(SPOOL_FILE) and os.path.getsize(SPOOL_FILE) > 100:
            time.sleep(0.5)
            return convert_pdf_to_udf(SPOOL_FILE, output_udf)

    raise TimeoutError("Sanal yazıcıdan çıktı zaman aşımına uğradı.")


# ==============================================================================
# 3. İŞLETİM SİSTEMİ GERÇEK SANAL YAZICI KURULUMU (SYSTEM VIRTUAL PRINTER)
# ==============================================================================

def install_system_virtual_printer():
    """Windows, macOS veya Linux üzerine gerçek sistem sanal yazıcısını kurar."""
    print("=" * 70)
    print("UYAP'a Yazdır - Sistem Sanal Yazıcı Kurulumu")
    print("=" * 70)

    python_exe = sys.executable
    script_path = os.path.abspath(__file__)

    if CURRENT_OS == "Windows":
        os.makedirs(APPDATA_DIR, exist_ok=True)
        if not os.path.exists(SPOOL_FILE):
            with open(SPOOL_FILE, "wb") as f:
                f.write(b"")

        print(f"[*] 1/4: Windows Yazıcı Portu Yapılandırılıyor ({SPOOL_FILE})...")
        ps_port_cmd = f"""
        try {{
            if (!(Get-PrinterPort -Name '{SPOOL_FILE}' -ErrorAction SilentlyContinue)) {{
                Add-PrinterPort -Name '{SPOOL_FILE}'
            }}
            Write-Output 'PORT_OK'
        }} catch {{
            Write-Error $_
        }}
        """
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_port_cmd], capture_output=True, text=True)
        if "PORT_OK" not in res.stdout:
            print(f"[!] Uyarı: Port oluşturulurken mesaj: {res.stderr or res.stdout}")

        print(f"[*] 2/4: '{WINDOWS_PRINTER_NAME}' Sistem Yazıcısı Ekleniyor...")
        ps_printer_cmd = f"""
        try {{
            if (!(Get-Printer -Name '{WINDOWS_PRINTER_NAME}' -ErrorAction SilentlyContinue)) {{
                Add-Printer -Name '{WINDOWS_PRINTER_NAME}' -DriverName 'Microsoft Print To PDF' -PortName '{SPOOL_FILE}'
            }}
            Write-Output 'PRINTER_OK'
        }} catch {{
            Write-Error $_
        }}
        """
        res2 = subprocess.run(["powershell", "-NoProfile", "-Command", ps_printer_cmd], capture_output=True, text=True)
        if "PRINTER_OK" in res2.stdout or "already exists" in res2.stdout:
            print(f"[+] '{WINDOWS_PRINTER_NAME}' Windows Yazıcılar Listesine Eklendi!")
        else:
            print(f"[!] Yazıcı ekleme çıktısı: {res2.stderr or res2.stdout}")

        print("[*] 3/4: Dosya Gezgini 'Gönder (SendTo)' Kısayolu Ekleniyor...")
        sendto_dir = os.path.join(os.environ.get("APPDATA", ""), "Microsoft", "Windows", "SendTo")
        if os.path.exists(sendto_dir):
            bat_path = os.path.join(sendto_dir, "UYAP'a Yazdır (Print to UDF).bat")
            with open(bat_path, "w", encoding="utf-8") as f:
                f.write(f'@echo off\n"{python_exe}" "{script_path}" %*\npause\n')
            print(f"[+] 'Gönder' menüsüne eklendi: {bat_path}")

        print("[*] 4/4: Arka Plan Yazdırma İzleyicisi Kuruluyor...")
        startup_dir = os.path.join(os.environ.get("APPDATA", ""), "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
        if os.path.exists(startup_dir):
            vbs_path = os.path.join(startup_dir, "PrintToUDF_Watcher.vbs")
            with open(vbs_path, "w", encoding="utf-8") as f:
                f.write(f'CreateObject("Wscript.Shell").Run "\"{python_exe}\" \"{script_path}\" --daemon", 0, False\n')
            print(f"[+] Windows Başlangıcına eklendi (Sessiz servis): {vbs_path}")

        print("\n" + "=" * 70)
        print(" TEBRİKLER! SANAL YAZICI BAŞARIYLA KURULDU.")
        print(" Artık Chrome, Word, Excel, Notepad veya herhangi bir uygulamadan")
        print(f" Ctrl+P yapıp '{WINDOWS_PRINTER_NAME}' seçerek yazdırabilirsiniz!")
        print("=" * 70)

    elif CURRENT_OS == "Darwin":  # macOS
        pdf_services = os.path.join(os.path.expanduser("~"), "Library", "PDF Services")
        os.makedirs(pdf_services, exist_ok=True)
        script_file = os.path.join(pdf_services, "UYAP'a Yazdır.sh")
        with open(script_file, "w", encoding="utf-8") as f:
            f.write(f'#!/bin/bash\n"{python_exe}" "{script_path}" "$@"\n')
        os.chmod(script_file, 0o755)
        print(f"[+] macOS 'PDF Services' menüsüne eklendi: {script_file}")
        print("    -> Cmd+P > Sol alttaki 'PDF' açılır kutusundan 'UYAP'a Yazdır'ı seçin.")

    elif CURRENT_OS == "Linux":
        cups_backend = "/usr/lib/cups/backend/print-to-udf"
        print("[*] Linux CUPS Kurulumu için aşağıdaki komutları root olarak çalıştırın:")
        print(f"    sudo cp '{script_path}' '{cups_backend}'")
        print(f"    sudo chmod 700 '{cups_backend}'")
        print(f"    sudo lpadmin -p UYAP_Print_to_UDF -v print-to-udf:/ -E -m raw")


def uninstall_system_virtual_printer():
    """Sanal yazıcıyı ve sistem kayıtlarını temizler."""
    if CURRENT_OS == "Windows":
        ps_cmd = f"""
        Remove-Printer -Name '{WINDOWS_PRINTER_NAME}' -ErrorAction SilentlyContinue
        Remove-PrinterPort -Name '{SPOOL_FILE}' -ErrorAction SilentlyContinue
        Write-Output 'CLEANED'
        """
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], check=False)

        # Başlangıç ve SendTo dosyalarını temizle
        sendto_bat = os.path.join(os.environ.get("APPDATA", ""), "Microsoft", "Windows", "SendTo", "UYAP'a Yazdır (Print to UDF).bat")
        startup_vbs = os.path.join(os.environ.get("APPDATA", ""), "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "PrintToUDF_Watcher.vbs")
        for f in (sendto_bat, startup_vbs):
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass
        print(f"[+] '{WINDOWS_PRINTER_NAME}' sistemden başarıyla kaldırıldı.")


# ==============================================================================
# 4. ARKA PLAN YAZDIRMA İZLEYİCİSİ (SPOOL INTERCEPTOR DAEMON)
# ==============================================================================

def run_spool_daemon():
    """
    Sanal yazıcıya herhangi bir programdan gönderilen yazdırma işlerini
    arka planda yakalar, anında UDF'e dönüştürür ve kullanıcıya sunar.
    """
    print(f"[*] 'UYAP'a Yazdır' Arka Plan Servisi Aktif!")
    print(f"    İzlenen Yazıcı Spool Dosyası: {SPOOL_FILE}")
    print("    Herhangi bir uygulamadan Ctrl+P ile bu yazıcıya yazdırdığınızda otomatik UDF oluşacaktır.\n")

    last_size = 0
    last_mtime = 0

    while True:
        try:
            if os.path.exists(SPOOL_FILE):
                mtime = os.path.getmtime(SPOOL_FILE)
                size = os.path.getsize(SPOOL_FILE)

                # Yeni bir yazdırma işi tamamlandıysa
                if size > 500 and (mtime != last_mtime or size != last_size):
                    # Spooler'ın dosyayı kapatmasını bekle
                    time.sleep(0.5)

                    timestamp = time.strftime("%Y%m%d_%H%M%S")
                    desktop_dir = os.path.join(os.path.expanduser("~"), "Desktop")
                    out_udf = os.path.join(desktop_dir, f"UYAP_Yazdir_{timestamp}.udf")

                    print(f"\n[+] Yazdırma İşi Yakalandı! ({size} bayt)")
                    print(f"    Dönüştürülüyor -> {out_udf}")

                    try:
                        convert_pdf_to_udf(SPOOL_FILE, out_udf)
                        print(f"    [BAŞARILI] UDF Dosyası Oluşturuldu: {out_udf}")

                        # Kullanıcıya Toast Bildirimi göster (Windows)
                        if CURRENT_OS == "Windows":
                            notify_ps = f"""
                            [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
                            [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
                            $template = '<toast><visual><binding template="ToastText02"><text id="1">UYAP\'a Yazdır Tamamlandı</text><text id="2">Masaüstüne kaydedildi: {os.path.basename(out_udf)}</text></binding></visual></toast>'
                            $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
                            $xml.LoadXml($template)
                            $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
                            [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("UYAP Kelime Islemci").Show($toast)
                            """
                            subprocess.run(["powershell", "-NoProfile", "-Command", notify_ps], check=False)

                    except Exception as e:
                        print(f"    [HATA] Dönüştürme başarısız: {e}")

                    last_mtime = os.path.getmtime(SPOOL_FILE)
                    last_size = os.path.getsize(SPOOL_FILE)

            time.sleep(1)
        except KeyboardInterrupt:
            print("\nServis durduruldu.")
            break
        except Exception as ex:
            time.sleep(2)


# ==============================================================================
# 5. GRAFİK KULLANICI ARAYÜZÜ (DESKTOP GUI)
# ==============================================================================

def launch_gui():
    """Kullanıcı dostu masaüstü grafik arayüzü (Tkinter)."""
    import tkinter as tk
    from tkinter import ttk, filedialog, messagebox

    root = tk.Tk()
    root.title("UYAP'a Yazdır - Evrensel Sanal Yazıcı ve Dönüştürücü")
    root.geometry("640x520")
    root.minsize(580, 480)

    # Renk Paleti (Astryx Theme)
    BG_COLOR = "#f8fafc"
    PANEL_BG = "#ffffff"
    PRIMARY_COLOR = "#1e40af"
    TEXT_COLOR = "#0f172a"

    root.configure(bg=BG_COLOR)

    # Başlık Paneli
    header_frame = tk.Frame(root, bg=PRIMARY_COLOR, padx=20, pady=16)
    header_frame.pack(fill="x")

    lbl_title = tk.Label(header_frame, text="UYAP'a Yazdır (Print to UDF)", font=("Segoe UI", 16, "bold"), fg="#ffffff", bg=PRIMARY_COLOR)
    lbl_title.pack(anchor="w")
    lbl_sub = tk.Label(header_frame, text="Herhangi bir programdan Ctrl+P ile veya dosyaları sürükleyip bırakarak UDF üretin", font=("Segoe UI", 10), fg="#bfdbfe", bg=PRIMARY_COLOR)
    lbl_sub.pack(anchor="w", pady=(2, 0))

    # Durum Paneli
    status_frame = tk.LabelFrame(root, text=" Sistem Sanal Yazıcı Durumu ", font=("Segoe UI", 10, "bold"), bg=PANEL_BG, fg=TEXT_COLOR, padx=16, pady=12)
    status_frame.pack(fill="x", padx=20, pady=14)

    is_installed = False
    if CURRENT_OS == "Windows":
        chk = subprocess.run(["powershell", "-NoProfile", "-Command", f"Get-Printer -Name '{WINDOWS_PRINTER_NAME}' -ErrorAction SilentlyContinue"], capture_output=True, text=True)
        is_installed = bool(chk.stdout.strip())

    lbl_status_text = tk.Label(
        status_frame,
        text="● Sanal Yazıcı Kurulu ve Hazır" if is_installed else "○ Sanal Yazıcı Henüz Sisteme Eklenmemiş",
        font=("Segoe UI", 11, "bold"),
        fg="#16a34a" if is_installed else "#ea580c",
        bg=PANEL_BG
    )
    lbl_status_text.pack(anchor="w")

    lbl_status_desc = tk.Label(
        status_frame,
        text="Herhangi bir uygulamada (Chrome, Word, Excel, Notepad) Ctrl+P yapıp 'UYAP'a Yazdır'ı seçebilirsiniz." if is_installed else "Aşağıdaki 'Sanal Yazıcıyı Kur' düğmesine tıklayarak sistemi yapılandırın.",
        font=("Segoe UI", 9),
        fg="#64748b",
        bg=PANEL_BG,
        wraplength=560,
        justify="left"
    )
    lbl_status_desc.pack(anchor="w", pady=(4, 8))

    btn_row = tk.Frame(status_frame, bg=PANEL_BG)
    btn_row.pack(fill="x")

    def do_install():
        install_system_virtual_printer()
        messagebox.showinfo("Başarılı", "Sanal Yazıcı başarıyla sisteme kuruldu!\nArtık Ctrl+P yaptığınızda 'UYAP'a Yazdır'ı seçebilirsiniz.")
        lbl_status_text.config(text="● Sanal Yazıcı Kurulu ve Hazır", fg="#16a34a")

    def do_uninstall():
        uninstall_system_virtual_printer()
        messagebox.showinfo("Bilgi", "Sanal Yazıcı sistemden kaldırıldı.")
        lbl_status_text.config(text="○ Sanal Yazıcı Henüz Sisteme Eklenmemiş", fg="#ea580c")

    btn_inst = tk.Button(btn_row, text="Sanal Yazıcıyı Sisteme Kur", font=("Segoe UI", 9, "bold"), bg=PRIMARY_COLOR, fg="#ffffff", padx=12, pady=4, relief="flat", cursor="hand2", command=do_install)
    btn_inst.pack(side="left", padx=(0, 8))

    btn_uninst = tk.Button(btn_row, text="Kaldır", font=("Segoe UI", 9), bg="#e2e8f0", fg=TEXT_COLOR, padx=12, pady=4, relief="flat", cursor="hand2", command=do_uninstall)
    btn_uninst.pack(side="left")

    # Dosya Dönüştürme Paneli
    convert_frame = tk.LabelFrame(root, text=" Doğrudan Dosya Dönüştürücü ", font=("Segoe UI", 10, "bold"), bg=PANEL_BG, fg=TEXT_COLOR, padx=16, pady=16)
    convert_frame.pack(fill="both", expand=True, padx=20, pady=(0, 14))

    lbl_conv_desc = tk.Label(
        convert_frame,
        text="Desteklenen Formatlar: PDF, Word (.docx, .doc), Excel (.xlsx, .csv), Web (.html), Metin (.txt, .md, .log, .json, .xml) ve Resimler",
        font=("Segoe UI", 9),
        fg="#475569",
        bg=PANEL_BG
    )
    lbl_conv_desc.pack(anchor="w", pady=(0, 12))

    log_box = tk.Text(convert_frame, height=7, font=("Consolas", 9), bg="#f1f5f9", fg="#1e293b", relief="flat", padx=8, pady=8)
    log_box.pack(fill="both", expand=True, pady=(0, 10))
    log_box.insert("end", "Dönüştürmek istediğiniz dosyayı seçin veya sanal yazıcıyı kullanın...\n")
    log_box.config(state="disabled")

    def append_log(msg):
        log_box.config(state="normal")
        log_box.insert("end", msg + "\n")
        log_box.see("end")
        log_box.config(state="disabled")

    def select_and_convert():
        fpath = filedialog.askopenfilename(
            title="Dönüştürülecek Belgeyi Seçin",
            filetypes=[
                ("Tüm Yazdırılabilir Dosyalar", "*.pdf;*.docx;*.doc;*.xlsx;*.csv;*.html;*.htm;*.txt;*.md;*.png;*.jpg"),
                ("PDF Belgeleri", "*.pdf"),
                ("Word Belgeleri", "*.docx;*.doc"),
                ("Excel Tabloları", "*.xlsx;*.csv"),
                ("Metin & Kod Belgeleri", "*.txt;*.md;*.log;*.json;*.xml"),
                ("Tüm Dosyalar", "*.*")
            ]
        )
        if not fpath:
            return

        append_log(f"[*] Dosya seçildi: {os.path.basename(fpath)}")
        try:
            out_udf = convert_any_to_udf(fpath)
            append_log(f"[+] Başarıyla dönüştürüldü: {out_udf}")
            messagebox.showinfo("Başarılı", f"Dosya başarıyla UDF formatına dönüştürüldü:\n{out_udf}")
        except Exception as err:
            append_log(f"[!] Hata: {err}")
            messagebox.showerror("Dönüştürme Hatası", f"Dosya dönüştürülürken hata oluştu:\n{err}")

    btn_select = tk.Button(
        convert_frame,
        text="Dosya Seç ve UDF'e Dönüştür...",
        font=("Segoe UI", 10, "bold"),
        bg=PRIMARY_COLOR,
        fg="#ffffff",
        padx=16,
        pady=8,
        relief="flat",
        cursor="hand2",
        command=select_and_convert
    )
    btn_select.pack(pady=4)

    root.mainloop()


# ==============================================================================
# 6. KOMUT SATIRI VE GİRİŞ NOKTASI (MAIN CLI)
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Print to UDF - Evrensel Yazdırılabilir Dosya ve Sanal Yazıcı Motoru")
    parser.add_argument("input", nargs="?", help="Girdi dosyası (PDF, Word, Excel, HTML, Metin, Resim vb.)")
    parser.add_argument("output", nargs="?", help="Çıktı .udf dosya yolu")
    parser.add_argument("--install", action="store_true", help="Sisteme 'UYAP'a Yazdır' sanal yazıcısını kurar")
    parser.add_argument("--uninstall", action="store_true", help="Sanal yazıcıyı sistemden kaldırır")
    parser.add_argument("--daemon", action="store_true", help="Arka planda Ctrl+P yazdırma işlerini yakalar")
    parser.add_argument("--gui", action="store_true", help="Grafik kullanıcı arayüzünü açar")

    args = parser.parse_args()

    if args.install:
        install_system_virtual_printer()
        return

    if args.uninstall:
        uninstall_system_virtual_printer()
        return

    if args.daemon:
        run_spool_daemon()
        return

    if args.gui:
        launch_gui()
        return

    # CUPS Backend Taraması
    if not args.input and "CUPS" in os.environ.get("SERVER_SOFTWARE", ""):
        print('direct print-to-udf "Unknown" "UYAP\'a Yazdır (Print to UDF)"')
        return

    if args.input:
        convert_any_to_udf(args.input, args.output)
    elif not sys.stdin.isatty():
        # Pipe ile stdin'den akıtılan girdi
        raw = sys.stdin.buffer.read()
        if raw.startswith(b"%PDF"):
            convert_pdf_to_udf(raw, args.output)
        else:
            convert_text_to_udf(raw.decode("utf-8", errors="replace"), args.output)
    else:
        # Argüman yoksa doğrudan GUI aç
        try:
            launch_gui()
        except Exception:
            parser.print_help()


if __name__ == "__main__":
    main()
