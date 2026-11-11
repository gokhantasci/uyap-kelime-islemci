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
import re
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

# PDF İşleme Kütüphanesi (Modern PyMuPDF API)

HAVE_PYMUPDF = False
try:
    import pymupdf
    HAVE_PYMUPDF = True
except ImportError:
    pymupdf = None

HAVE_FITX = HAVE_PYMUPDF

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
    Paragraf listesini gercek UYAP Dokuman Editoru (format_id 1.8) UDF arsivine paketler.
    Tum ofsetler burada yeniden hesaplanir (full_text parametresi geriye uyumluluk icindir).
    paragraphs: [{align, runs:[{text,...}]} | {text,...} | {is_table, table_data:{rows:[[{text}]]}}]
    """
    pp = {"mediaSize": "1", "orientation": "1", "leftMargin": "56.69", "rightMargin": "70.86",
          "topMargin": "70.86", "bottomMargin": "70.86", "headerFOffset": "14.99", "footerFOffset": "60.00"}
    pp.update(page_props or {})

    NL = "\n"
    text_parts = []
    state = {"off": 0}
    # UYAP Standart TabSet: 184.25 pt (6.5 cm) İki Nokta Hizalama Pozisyonu
    P_OPEN = ('<paragraph LineSpacing="0.0" LeftIndent="0.0" SpaceAbove="1.0" TabSet="184.25196838378906:0:0" '
              'RightIndent="0.0" Alignment="{al}" resolver="hvl-default" Hanging="0.0" SpaceBelow="1.0"{ind}>')

    def run_xml(r, txt):
        start = state["off"]
        state["off"] += len(txt)
        text_parts.append(txt)
        a = ['resolver="hvl-default"', 'startOffset="%d"' % start, 'length="%d"' % len(txt),
             'family="%s"' % html.escape(str(r.get("family", "Times New Roman"))),
             'size="%s"' % r.get("size", 12), 'foreground="%s"' % r.get("color", "-16777216")]
        for k in ("bold", "italic", "underline"):
            if r.get(k):
                a.append('%s="true"' % k)
        return "<content %s />" % " ".join(a)

    def para_xml(align, runs, indent=0):
        ind = ' FirstLineIndent="%s"' % indent if indent and float(indent) > 0 else ""
        out = [P_OPEN.format(al=align, ind=ind)]
        for r in runs:
            txt = str(r.get("text", "")).replace(chr(13), "").replace(chr(10), " ")
            if txt:
                out.append(run_xml(r, txt))
        start = state["off"]
        state["off"] += 1
        text_parts.append(NL)
        out.append('<content resolver="hvl-default" startOffset="%d" length="1" />' % start)
        out.append("</paragraph>")
        return "".join(out)

    elements = []
    for p in paragraphs:
        if p.get("is_table") and p.get("table_data"):
            t = p["table_data"]
            rows = t.get("rows", [])
            cols = max((len(r) for r in rows), default=1)
            rx = []
            for ri, row in enumerate(rows):
                cells = []
                for cell in row:
                    cells.append("<cell>%s</cell>" % para_xml("0", [{"size": 11, "text": cell.get("text", "")}]))
                for _ in range(cols - len(row)):
                    cells.append("<cell>%s</cell>" % para_xml("0", []))
                rx.append('<row rowName="row%d" rowType="dataRow">%s</row>' % (ri + 1, "".join(cells)))
            elements.append('<table tableName="Sabit" columnCount="%d" columnSpans="%s" border="%s">%s</table>' % (
                cols, ",".join(["100"] * cols), t.get("border", "borderCell"), "".join(rx)))
        else:
            runs = p.get("runs")
            if not runs:
                base = {k: p[k] for k in ("family", "size", "bold", "italic", "underline", "color") if k in p}
                base["text"] = p.get("text", "")
                runs = [base]
            elements.append(para_xml(str(p.get("align", "0")), runs, p.get("firstLineIndent", 0)))

    full = "".join(text_parts)
    content_xml = (
        '<?xml version="1.0" encoding="UTF-8" ?>' + NL + NL + '<template format_id="1.8" >' + NL +
        '<content><![CDATA[' + full + ']]></content><properties><pageFormat mediaSizeName="' + str(pp["mediaSize"]) +
        '" leftMargin="' + str(pp["leftMargin"]) + '" rightMargin="' + str(pp["rightMargin"]) +
        '" topMargin="' + str(pp["topMargin"]) + '" bottomMargin="' + str(pp["bottomMargin"]) +
        '" paperOrientation="' + str(pp["orientation"]) + '" headerFOffset="' + str(pp["headerFOffset"]) +
        '" footerFOffset="' + str(pp["footerFOffset"]) + '" /></properties>' + NL + '<elements >' + NL +
        NL.join(elements) + NL + '</elements>' + NL +
        '<styles><style name="default" description="Geçerli" family="Dialog" size="12" bold="false" italic="false" '
        'FONT_ATTRIBUTE_KEY="javax.swing.plaf.FontUIResource[family=Dialog,name=Dialog,style=plain,size=12]" '
        'foreground="-13421773" /><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>'
        + NL + '</template>')

    doc_props = ('<?xml version="1.0" encoding="UTF-8"?>' + NL +
                 '<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">' + NL +
                 '<properties>' + NL + '<entry key="uyapdogrulamakodu"></entry>' + NL +
                 '<entry key="uyapsicil"></entry>' + NL + '</properties>' + NL)

    import io
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("content.xml", content_xml.encode("utf-8"))
        zf.writestr("documentproperties.xml", doc_props.encode("utf-8"))
        if sign_bytes:
            zf.writestr("sign.sgn", sign_bytes)
    return zip_buf.getvalue()


# ==============================================================================
# 2. EVRENSEL DOSYA DÖNÜŞTÜRÜCÜLER (UNIVERSAL CONVERTERS)
# ==============================================================================

def convert_pdf_to_udf(pdf_input, udf_output_path=None):
    """PDF belgesini mizanpaj, hizalama ve font bilgileriyle UDF'e çevirir."""
    if not HAVE_PYMUPDF or pymupdf is None:
        raise RuntimeError("PDF dönüştürmek için 'pymupdf' kütüphanesi gereklidir. (pip install pymupdf)")

    if isinstance(pdf_input, (str, bytes, os.PathLike)) and os.path.exists(str(pdf_input)):
        doc = pymupdf.open(str(pdf_input))
    else:
        doc = pymupdf.open(stream=pdf_input, filetype="pdf")

    full_text = ""
    current_offset = 0
    paras = []

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_w = page.rect.width
        page_h = page.rect.height
        blocks = page.get_text("dict").get("blocks", [])

        for b in blocks:
            if "lines" not in b:
                continue

            b_x0, b_y0, b_x1, b_y1 = b["bbox"]

            # Sayfa 2+ Üst Bilgi Başlıklarını Gövdeden Ayıkla (UYAP'ta üst bilgi ayrıdır)
            if page_idx > 0 and b_y0 < 65:
                block_txt = " ".join("".join(s.get("text", "") for s in l["spans"]) for l in b["lines"]).strip()
                if "MAHKEMESİ" in block_txt or "Dosya-Karar" in block_txt:
                    continue

            # Alt Bilgi ve Sayfa Numaralarını Gövdeden Ayıkla
            if b_y1 > page_h - 65:
                block_txt = " ".join("".join(s.get("text", "") for s in l["spans"]) for l in b["lines"]).strip()
                if "vatandas.uyap.gov.tr" in block_txt or re.match(r'^\d+\s*/\s*\d+$', block_txt):
                    continue

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
                # Satır metnini birleştir
                line_text = "".join(s.get("text", "") for s in line["spans"])
                # UYAP İki Nokta (Colon) Tab Hizalaması Tespiti
                is_meta_colon = bool(":" in line_text and re.search(
                    r'^(DOSYA NO|KARAR NO|\[?C\.SAVCILIĞI ESAS NO\]?|HAKİM|KATİP|DAVACI|MÜŞTEKİ SANIK|SANIK|MAĞDUR|SUÇ|SUÇ TARİHİ|SUÇ YERİ|KARAR TARİHİ)\b',
                    line_text.strip()
                ))

                for span_idx, span in enumerate(line["spans"]):
                    txt = span.get("text", "")
                    if not txt:
                        continue

                    # Stray cedilla (¸) temizle
                    txt = txt.replace("\u00b8", "")

                    # Eğer metadata satırıysa ve bu span iki nokta içeriyorsa, önüne sekme (\t) koy
                    if is_meta_colon and ":" in txt:
                        # Eğer iki noktanın solunda boşluklar varsa veya bitiştirilmişse
                        parts = txt.split(":", 1)
                        if parts[0].strip() and parts[0].strip() in ("DOSYA NO", "KARAR NO", "HAKİM", "KATİP", "DAVACI", "SUÇ", "SUÇ YERİ", "KARAR TARİHİ", "[C.SAVCILIĞI ESAS NO]"):
                            txt = parts[0].strip() + "\t: " + parts[1].lstrip()
                        elif not parts[0].strip() and span_idx > 0:
                            txt = "\t: " + parts[1].lstrip()

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


def convert_markdown_to_udf(md_path_or_str, udf_output_path=None):
    """Markdown (.md) belgesini yapısal, zengin ve formatlı UDF dokümanına çevirir."""
    if os.path.exists(str(md_path_or_str)):
        with open(str(md_path_or_str), "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    else:
        content = str(md_path_or_str)

    lines = content.replace("\r\n", "\n").split("\n")
    paras = []
    table_rows = []
    in_table = False

    def flush_table():
        nonlocal in_table, table_rows
        if in_table and table_rows:
            paras.append({
                "is_table": True,
                "table_data": {"rows": table_rows, "border": "borderCell"}
            })
            table_rows = []
            in_table = False

    for line in lines:
        stripped = line.strip()

        # Tablo satırları (| col1 | col2 |)
        if stripped.startswith("|") and stripped.endswith("|"):
            if re.match(r"^\|[\s\-:]+(\|[\s\-:]+)+\|$", stripped):
                continue
            cells = [c.strip() for c in stripped[1:-1].split("|")]
            table_rows.append([{"text": c} for c in cells])
            in_table = True
            continue
        elif in_table:
            flush_table()

        # Başlıklar (# H1, ## H2, ### H3)
        m_head = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if m_head:
            level = len(m_head.group(1))
            txt = m_head.group(2).strip()
            if level == 1:
                paras.append({"text": txt, "bold": True, "size": 15, "align": "1"})
            elif level == 2:
                paras.append({"text": txt, "bold": True, "size": 13.5, "align": "0"})
            else:
                paras.append({"text": txt, "bold": True, "size": 12, "align": "0"})
            continue

        # Alıntılar (> ...)
        if stripped.startswith(">"):
            txt = stripped.lstrip(">").strip()
            paras.append({"text": txt, "italic": True, "firstLineIndent": "28.34", "align": "0"})
            continue

        # Yatay çizgi (---, ***)
        if stripped in ("---", "***", "___"):
            paras.append({"text": "―" * 40, "align": "1", "size": 10})
            continue

        # Sırasız Liste (- veya *)
        m_ul = re.match(r"^[\*\-\+]\s+(.+)$", stripped)
        if m_ul:
            paras.append({"text": "• " + m_ul.group(1), "firstLineIndent": "14.17", "align": "0"})
            continue

        # Sıralı Liste (1. 2.)
        m_ol = re.match(r"^(\d+\.)\s+(.+)$", stripped)
        if m_ol:
            paras.append({"text": f"{m_ol.group(1)} {m_ol.group(2)}", "firstLineIndent": "14.17", "align": "0"})
            continue

        # Boş satır
        if not stripped:
            paras.append({"text": " ", "align": "0"})
            continue

        # Standart UYAP Paragrafı
        paras.append({"text": stripped, "align": "3", "firstLineIndent": "28.34", "size": 12})

    flush_table()

    udf_bytes = create_udf_package(paras)
    if udf_output_path:
        with open(udf_output_path, "wb") as f:
            f.write(udf_bytes)
        return udf_output_path
    return udf_bytes


def convert_udf_to_markdown(udf_path_or_bytes, md_output_path=None):
    """UDF arşivini açarak içeriğini standart GitHub Flavored Markdown (.md) formatına dönüştürür."""
    if isinstance(udf_path_or_bytes, (str, os.PathLike)) and os.path.exists(str(udf_path_or_bytes)):
        zf = zipfile.ZipFile(str(udf_path_or_bytes), "r")
    else:
        import io
        zf = zipfile.ZipFile(io.BytesIO(udf_path_or_bytes), "r")

    with zf:
        xml_content = zf.read("content.xml").decode("utf-8", errors="replace")
        if "content.txt" in zf.namelist():
            txt_content = zf.read("content.txt").decode("utf-8", errors="replace")
        else:
            root_match = re.search(r"<content><!\[CDATA\[(.*?)\]\]></content>", xml_content, re.DOTALL)
            txt_content = root_match.group(1) if root_match else ""

    root = ET.fromstring(xml_content)
    md_lines = []

    elements_node = root.find("elements")
    if elements_node is None:
        elements_node = root

    for elem in elements_node:
        tag = elem.tag.lower()
        if tag == "paragraph":
            p_text = ""
            is_bold = False
            is_italic = False
            size = 12.0
            align = elem.get("Alignment", "0")

            for content_tag in elem.findall("content"):
                start = int(content_tag.get("startOffset", 0))
                length = int(content_tag.get("length", 0))
                chunk = txt_content[start:start + length]
                if content_tag.get("bold") == "true":
                    is_bold = True
                if content_tag.get("italic") == "true":
                    is_italic = True
                try:
                    s_val = float(content_tag.get("size", 12))
                    if s_val > size:
                        size = s_val
                except (ValueError, TypeError):
                    pass
                p_text += chunk

            p_clean = p_text.rstrip("\r\n").strip()
            if not p_clean:
                md_lines.append("")
                continue

            # Başlık tespiti
            if size >= 14 and (is_bold or align == "1"):
                md_lines.append(f"# {p_clean}\n")
            elif size >= 13 and is_bold:
                md_lines.append(f"## {p_clean}\n")
            elif p_clean.startswith("• ") or p_clean.startswith("- "):
                md_lines.append(f"- {p_clean[2:]}")
            elif is_bold and not is_italic:
                md_lines.append(f"**{p_clean}**\n")
            elif is_italic and not is_bold:
                md_lines.append(f"*{p_clean}*\n")
            else:
                md_lines.append(f"{p_clean}\n")

        elif tag == "table":
            rows = elem.findall("row")
            table_md = []
            for r_idx, row in enumerate(rows):
                cells = row.findall("cell")
                cell_texts = []
                for cell in cells:
                    c_txt = ""
                    for p in cell.findall("paragraph"):
                        for c in p.findall("content"):
                            st = int(c.get("startOffset", 0))
                            ln = int(c.get("length", 0))
                            c_txt += txt_content[st:st + ln]
                    cell_texts.append(c_txt.strip().replace("|", "\\|").replace("\n", " "))
                table_md.append("| " + " | ".join(cell_texts) + " |")
                if r_idx == 0:
                    table_md.append("| " + " | ".join(["---"] * len(cells)) + " |")

            if table_md:
                md_lines.append("\n".join(table_md) + "\n")

    result_md = "\n".join(md_lines).replace("\n\n\n+", "\n\n").strip() + "\n"

    if md_output_path:
        with open(md_output_path, "w", encoding="utf-8") as f:
            f.write(result_md)
        return md_output_path

    return result_md


def convert_image_ocr_to_udf(image_path, output_udf=None, lang="tur"):
    """Taranmış görseli (PNG, JPG, TIFF, BMP) veya taranmış sayfayı OCR ile metne döküp UDF yapar."""
    extracted_text = ""
    try:
        img_doc = pymupdf.open(image_path)
        pdf_bytes = img_doc.convert_to_pdf()
        pdf_doc = pymupdf.open("pdf", pdf_bytes)
        for page in pdf_doc:
            try:
                tp = page.get_textpage_ocr(language=lang)
                extracted_text += page.get_text(textpage=tp) + "\n"
            except Exception:
                extracted_text += page.get_text() + "\n"
        if extracted_text.strip():
            return convert_text_to_udf(extracted_text, output_udf)
    except Exception as e:
        print(f"[!] Görsel OCR uyarısı: {e}")

    # Fallback
    paras = [
        {"text": f"[Taranmış Belge: {os.path.basename(image_path)}]", "align": "1", "bold": True, "size": 14},
        {"text": f"Görsel Boyutu: {os.path.getsize(image_path)} bayt", "align": "1"}
    ]
    udf_bytes = create_udf_package(paras)
    if output_udf:
        with open(output_udf, "wb") as f:
            f.write(udf_bytes)
        return output_udf
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

    if ext in (".md", ".markdown"):
        return convert_markdown_to_udf(input_file, output_udf)
    elif ext == ".pdf":
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
    elif ext in (".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp"):
        return convert_image_ocr_to_udf(input_file, output_udf)
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

# ==============================================================================
# 4a. "NEREYE KAYDEDİLSİN?" PENCERESİ (Print to PDF gibi) VE YARDIMCILAR
# ==============================================================================

CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".uyap_print_to_udf.json")


def _load_config():
    try:
        import json
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_config(cfg):
    try:
        import json
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False)
    except Exception:
        pass


def default_save_dir():
    """Son kullanılan klasör; yoksa Belgeler; o da yoksa kullanıcı klasörü."""
    cfg = _load_config()
    last = cfg.get("last_dir")
    if last and os.path.isdir(last):
        return last
    home = os.path.expanduser("~")
    for name in ("Documents", "Belgeler", "Desktop", "Masaüstü"):
        cand = os.path.join(home, name)
        if os.path.isdir(cand):
            return cand
    return home


def suggest_file_name(pdf_path=None):
    """Yazdırılan belgenin başlığından (yoksa tarih-saatten) önerilen .udf adı."""
    stamp = time.strftime("%Y%m%d_%H%M%S")
    name = ""
    try:
        if pdf_path and HAVE_PYMUPDF and pymupdf is not None:
            doc = pymupdf.open(str(pdf_path))
            name = (doc.metadata or {}).get("title") or ""
            if not name.strip() and len(doc):
                name = (doc[0].get_text("text") or "").strip().split("\n")[0]
            doc.close()
    except Exception:
        name = ""
    keep = []
    for ch in name.strip():
        keep.append(ch if (ch.isalnum() or ch in " -_.()") else "_")
    name = "".join(keep).strip(" ._")[:60]
    return (name or "Yazdirma_" + stamp) + ".udf"


def ask_save_path(default_name):
    """
    'Farklı Kaydet' penceresini açar (Print to PDF gibi). İptal edilirse None döner.
    Pencere açılamazsa (ör. ekransız ortam) Belgeler klasörüne kaydeder ve yolu bildirir.
    """
    start_dir = default_save_dir()
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        try:
            root.attributes("-topmost", True)
        except Exception:
            pass
        path = filedialog.asksaveasfilename(
            parent=root,
            title="UYAP'a Yazdır - UDF olarak kaydet",
            defaultextension=".udf",
            filetypes=[("UYAP Doküman (*.udf)", "*.udf")],
            initialdir=start_dir,
            initialfile=default_name,
        )
        root.destroy()
        if not path:
            return None
    except Exception:
        path = os.path.join(start_dir, default_name)
    if not path.lower().endswith(".udf"):
        path += ".udf"
    cfg = _load_config()
    cfg["last_dir"] = os.path.dirname(path)
    _save_config(cfg)
    return path


def reveal_in_folder(path):
    """Kaydedilen dosyayı dosya yöneticisinde gösterir (Windows: seçili olarak)."""
    try:
        if CURRENT_OS == "Windows":
            subprocess.Popen(["explorer", "/select," + os.path.normpath(path)])
        elif CURRENT_OS == "Darwin":
            subprocess.Popen(["open", "-R", path])
        else:
            subprocess.Popen(["xdg-open", os.path.dirname(path)])
    except Exception:
        pass


def notify_saved(path):
    """Kullanıcıya kaydedilen yeri açıkça bildirir."""
    print("    [BAŞARILI] UDF kaydedildi: " + path)
    if CURRENT_OS == "Windows":
        try:
            from tkinter import messagebox
            import tkinter as tk
            root = tk.Tk()
            root.withdraw()
            try:
                root.attributes("-topmost", True)
            except Exception:
                pass
            if messagebox.askyesno("UYAP'a Yazdır", "UDF kaydedildi:\n" + path + "\n\nKlasörde gösterilsin mi?", parent=root):
                reveal_in_folder(path)
            root.destroy()
            return
        except Exception:
            pass
    reveal_in_folder(path)


def handle_print_job(spool_path):
    """Yakalanan yazdırma işini kullanıcıya sorarak UDF'e çevirir. Başarılıysa yolu döndürür."""
    name = suggest_file_name(spool_path)
    out_udf = ask_save_path(name)
    if not out_udf:
        print("    Kaydetme iptal edildi; yazdırma işi atlandı.")
        return None
    convert_pdf_to_udf(spool_path, out_udf)
    notify_saved(out_udf)
    return out_udf


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

                    print(f"[+] Yazdırma İşi Yakalandı! ({size} bayt)")
                    try:
                        handle_print_job(SPOOL_FILE)
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
# 5b. YERLEŞİK HTTP WEB VE REST API SUNUCUSU (DOCKER & LOCAL SERVER)
# ==============================================================================

def run_http_server(port=8080, host="0.0.0.0"):
    """
    Yerleşik HTTP Sunucusu ve REST API Motoru (Docker & Yerel Web Çalıştırma).
    Hem modern web editörünü (index.html ve tüm statik varlıkları) sunar,
    hem de /api/convert ve /api/health REST uç noktalarını sağlar.
    """
    import json
    import urllib.parse
    from http.server import SimpleHTTPRequestHandler, HTTPServer
    from email.parser import BytesParser
    from email.policy import default as default_policy

    root_dir = os.path.dirname(os.path.abspath(__file__))

    class UdfRequestHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=root_dir, **kwargs)

        def end_headers(self):
            # CORS & Güvenlik Başlıkları
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Filename")
            super().end_headers()

        def do_OPTIONS(self):
            self.send_response(204)
            self.end_headers()

        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path == "/api/sozluk" or parsed.path.startswith("/api/sozluk/kelime/"):
                from dictionary_api import lookup
                word = urllib.parse.parse_qs(parsed.query).get('kelime', [''])[0]
                if parsed.path.startswith('/api/sozluk/kelime/'):
                    word = urllib.parse.unquote(parsed.path.rsplit('/', 1)[-1])
                try:
                    result = lookup(word)
                    status = 200
                except ValueError as exc:
                    result, status = {'error': str(exc)}, 400
                except Exception:
                    result, status = {'error': 'TDK kaynağına ulaşılamadı. Daha sonra deneyin.'}, 502
                self.send_response(status)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Cache-Control', 'public, max-age=3600' if status == 200 else 'no-store')
                self.end_headers()
                self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
                return
            if parsed.path == "/api/health":
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                res = {
                    "status": "ok",
                    "app": "UYAP Kelime İşlemci & Print to UDF",
                    "version": "1.8",
                    "features": {
                        "pdf": HAVE_PYMUPDF,
                        "docx": True,
                        "table": True,
                        "markdown": True,
                        "ocr": True,
                        "virtual_printer": CURRENT_OS == "Windows"
                    }
                }
                self.wfile.write(json.dumps(res, ensure_ascii=False, indent=2).encode("utf-8"))
                return
            if parsed.path.startswith("/linkac="):
                self.path = "/index.html"
            super().do_GET()

        def do_POST(self):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path == "/api/convert":
                try:
                    qparams = urllib.parse.parse_qs(parsed.query)
                    target_fmt = qparams.get("format", ["udf"])[0].lower()
                    in_name = qparams.get("filename", ["document.pdf"])[0]

                    length = int(self.headers.get("Content-Length", 0))
                    if length <= 0:
                        self.send_error(400, "Boş istek gövdesi (Content-Length missing or 0)")
                        return

                    body = self.rfile.read(length)
                    content_type = self.headers.get("Content-Type", "")

                    file_bytes = None
                    file_name = self.headers.get("X-Filename", in_name)

                    if "multipart/form-data" in content_type:
                        msg_headers = f"Content-Type: {content_type}\r\n\r\n".encode("utf-8")
                        msg = BytesParser(policy=default_policy).parsebytes(msg_headers + body)
                        for part in msg.iter_parts():
                            p_disp = part.get("Content-Disposition", "")
                            if "filename=" in p_disp:
                                file_name = part.get_filename() or file_name
                                file_bytes = part.get_payload(decode=True)
                                break
                        if not file_bytes:
                            for part in msg.iter_parts():
                                file_bytes = part.get_payload(decode=True)
                                if file_bytes:
                                    break
                    else:
                        file_bytes = body

                    if not file_bytes:
                        self.send_error(400, "Dönüştürülecek dosya içeriği bulunamadı.")
                        return

                    ext = os.path.splitext(file_name)[1].lower() or ".pdf"
                    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_in:
                        tmp_in.write(file_bytes)
                        tmp_in_path = tmp_in.name

                    try:
                        base = os.path.splitext(os.path.basename(file_name))[0]
                        if target_fmt in ("md", "markdown") or ext == ".udf":
                            out_ext = ".md"
                            out_mime = "text/markdown; charset=utf-8"
                            with tempfile.NamedTemporaryFile(suffix=out_ext, delete=False) as tmp_out:
                                tmp_out_path = tmp_out.name
                            convert_udf_to_markdown(tmp_in_path, tmp_out_path)
                            download_name = f"{base}.md"
                        else:
                            out_ext = ".udf"
                            out_mime = "application/octet-stream"
                            with tempfile.NamedTemporaryFile(suffix=out_ext, delete=False) as tmp_out:
                                tmp_out_path = tmp_out.name
                            convert_any_to_udf(tmp_in_path, tmp_out_path)
                            download_name = f"{base}.udf"

                        with open(tmp_out_path, "rb") as out_f:
                            result_data = out_f.read()

                        try:
                            os.remove(tmp_out_path)
                        except Exception:
                            pass

                        self.send_response(200)
                        self.send_header("Content-Type", out_mime)
                        self.send_header("Content-Length", str(len(result_data)))
                        self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
                        self.end_headers()
                        self.wfile.write(result_data)
                    finally:
                        try:
                            os.remove(tmp_in_path)
                        except Exception:
                            pass

                except Exception as err:
                    err_msg = json.dumps({"error": str(err)}, ensure_ascii=False)
                    self.send_response(500)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err_msg.encode("utf-8"))))
                    self.end_headers()
                    self.wfile.write(err_msg.encode("utf-8"))
                return

            super().do_POST()

    server_address = (host, port)
    httpd = HTTPServer(server_address, UdfRequestHandler)
    display_host = "localhost" if host in ("0.0.0.0", "") else host
    print("=" * 70)
    print(f" UYAP Kelime İşlemci & REST API Sunucusu Çalışıyor!")
    print(f" -> Web Arayüzü: http://{display_host}:{port}")
    print(f" -> REST API:    http://{display_host}:{port}/api/convert")
    print(f" -> Sağlık Testi:http://{display_host}:{port}/api/health")
    print(" Durdurmak için Ctrl+C tuşlarına basın.")
    print("=" * 70)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu kapatıldı.")
        httpd.server_close()


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
    parser.add_argument("--to-md", action="store_true", help="UDF belgesini Markdown (.md) formatına dönüştürür")
    parser.add_argument("--serve", nargs="?", const=8080, type=int, help="Web editörü ve REST API sunucusunu başlatır (varsayılan port: 8080)")
    parser.add_argument("--host", default="0.0.0.0", help="Sunucu dinleme IP adresi (varsayılan: 0.0.0.0)")

    args = parser.parse_args()

    if args.serve is not None:
        run_http_server(port=args.serve, host=args.host)
        return

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
        in_path = args.input
        in_ext = os.path.splitext(in_path)[1].lower()
        out_path = args.output
        out_ext = os.path.splitext(out_path)[1].lower() if out_path else ""

        # UDF -> Markdown Dönüşümü
        if args.to_md or (in_ext == ".udf" and out_ext in (".md", ".markdown")):
            if not out_path:
                out_path = os.path.splitext(in_path)[0] + ".md"
            print(f"[*] UDF -> Markdown Dönüştürülüyor: {in_path} -> {out_path}")
            convert_udf_to_markdown(in_path, out_path)
            print(f"[✓] Başarıyla Markdown formatına dönüştürüldü: {out_path}")
            return

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
