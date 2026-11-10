#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Print to UDF - Sanal Yazıcı ve PDF -> UDF Dönüştürücü (Cross-Platform)
Windows, Linux ve macOS için tek dosya (single-file) bağımsız çözüm.

Kullanım:
    python print_to_udf.py belge.pdf [cikti.udf]
    python print_to_udf.py --install     (Sisteme sanal yazıcı / kısayol kurar)
    python print_to_udf.py --watch       (İzlenen klasöre düşen PDF'leri otomatik UDF yapar)
"""

import os
import sys
import argparse
import zipfile
import platform
import shutil
import subprocess

# PDF Ayrıştırıcı Kontrolü
HAVE_FITX = False
try:
    import fitz  # PyMuPDF
    HAVE_FITX = True
except ImportError:
    pass

HAVE_PYPDF = False
if not HAVE_FITX:
    try:
        import pypdf
        HAVE_PYPDF = True
    except ImportError:
        pass


def pdf_to_udf(pdf_input, udf_output_path=None):
    """
    Verilen PDF dosyasını veya bayt akışını standart UYAP UDF formatına dönüştürür.
    """
    if isinstance(pdf_input, (str, bytes, os.PathLike)) and os.path.exists(str(pdf_input)):
        pdf_path = str(pdf_input)
        doc = fitz.open(pdf_path) if HAVE_FITX else None
    else:
        # Bayt akışı (stdin veya bellek)
        doc = fitz.open(stream=pdf_input, filetype="pdf") if HAVE_FITX else None

    if not HAVE_FITX and not HAVE_PYPDF:
        raise RuntimeError("PDF okumak için 'pymupdf' veya 'pypdf' kütüphanesi gereklidir. (pip install pymupdf)")

    full_text = ""
    current_offset = 0
    xml_paragraphs = []

    if HAVE_FITX:
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_w = page.rect.width
            blocks = page.get_text("dict")["blocks"]

            for b in blocks:
                if "lines" not in b:
                    continue

                b_x0, b_y0, b_x1, b_y1 = b["bbox"]
                center_dist = abs(((b_x0 + b_x1) / 2.0) - (page_w / 2.0))

                # Hizalama tespiti
                align = "0"
                if center_dist < 25 and (b_x1 - b_x0) < page_w * 0.75:
                    align = "1"  # Ortala
                elif b_x1 > page_w - 90 and b_x0 > page_w * 0.4:
                    align = "2"  # Sağa yasla
                elif (b_x1 - b_x0) > page_w * 0.65:
                    align = "3"  # İki yana yasla

                # Paragraf içi satırları işle
                for line in b["lines"]:
                    line_contents = []
                    for span in line["spans"]:
                        txt = span["text"]
                        if not txt:
                            continue

                        font_name = span.get("font", "").lower()
                        flags = span.get("flags", 0)
                        bold = ("bold" in font_name) or bool(flags & 16)
                        italic = ("italic" in font_name or "oblique" in font_name) or bool(flags & 2)
                        size = max(8, min(32, int(round(span.get("size", 12)))))

                        start = current_offset
                        length = len(txt)
                        full_text += txt
                        current_offset += length

                        attr = f'startOffset="{start}" length="{length}" size="{size}" family="Times New Roman" foreground="-16777216"'
                        if bold:
                            attr += ' bold="true"'
                        if italic:
                            attr += ' italic="true"'

                        line_contents.append(f'<content {attr} />')

                    if line_contents:
                        full_text += '\n'
                        line_contents.append(f'<content startOffset="{current_offset}" length="1" />')
                        current_offset += 1
                        xml_paragraphs.append(f'<paragraph Alignment="{align}">{" ".join(line_contents)}</paragraph>')
    else:
        # pypdf yedek motoru
        reader = pypdf.PdfReader(pdf_input)
        for page in reader.pages:
            text = page.extract_text() or ""
            for line in text.split("\n"):
                if not line.strip():
                    continue
                start = current_offset
                length = len(line)
                full_text += line + '\n'
                current_offset += length + 1
                xml_paragraphs.append(
                    f'<paragraph Alignment="0">'
                    f'<content startOffset="{start}" length="{length}" size="12" family="Times New Roman" foreground="-16777216" />'
                    f'<content startOffset="{start + length}" length="1" />'
                    f'</paragraph>'
                )

    # UDF XML Şablonu
    xml_content = (
        '<?xml version="1.0" encoding="UTF-8" ?>\n'
        '<template format_id="1.8">\n'
        f'<content><![CDATA[{full_text}]]></content>\n'
        '<properties><pageFormat mediaSizeName="1" leftMargin="56.69" rightMargin="70.86" topMargin="70.86" bottomMargin="70.86" paperOrientation="1" headerFOffset="15.0" footerFOffset="60.0" /></properties>\n'
        '<elements resolver="hvl-default">\n'
        + "\n".join(xml_paragraphs)
        + '\n</elements>\n</template>'
    )

    # Hedef çıktı dosyası yoksa kullanıcıya GUI ile sor
    if not udf_output_path:
        udf_output_path = prompt_save_location(default_name="cikti.udf")

    if not udf_output_path:
        # İptal edilirse Masaüstüne kaydet
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        udf_output_path = os.path.join(desktop, "Print_to_UDF_Belge.udf")

    # ZIP (.udf) Olarak Paketle
    with zipfile.ZipFile(udf_output_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("content.xml", xml_content.encode("utf-8"))

    print(f"[OK] UDF Belgesi Başarıyla Oluşturuldu: {udf_output_path}")
    return udf_output_path


def prompt_save_location(default_name="belge.udf"):
    """Yerel işletim sistemi dosya kaydetme diyaloğu açar."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        path = filedialog.asksaveasfilename(
            title="UDF Belgesini Kaydet",
            defaultextension=".udf",
            initialfile=default_name,
            filetypes=[("UYAP Dokümanı (*.udf)", "*.udf"), ("Tüm Dosyalar", "*.*")]
        )
        root.destroy()
        return path
    except Exception:
        return None


# ==========================================================================
# İŞLETİM SİSTEMİ SANAL YAZICI KURULUMLARI (Windows, Linux, macOS)
# ==========================================================================

def install_system_integration():
    """Çalışılan işletim sistemine göre Print to UDF sanal yazıcı / kısayolunu kurar."""
    current_os = platform.system()
    script_path = os.path.abspath(__file__)
    python_exe = sys.executable

    print(f"[*] İşletim Sistemi Tespit Edildi: {current_os}")

    if current_os == "Windows":
        # 1. SendTo (Gönder) Menüsüne Ekle
        sendto_dir = os.path.join(os.environ.get("APPDATA", ""), r"Microsoft\Windows\SendTo")
        if os.path.exists(sendto_dir):
            bat_path = os.path.join(sendto_dir, "Print to UDF.bat")
            with open(bat_path, "w", encoding="utf-8") as f:
                f.write(f'@echo off\n"{python_exe}" "{script_path}" %*\npause\n')
            print(f"[+] Windows 'Gönder' (SendTo) menüsüne 'Print to UDF' eklendi.")
            print("    -> Artık herhangi bir PDF dosyasına sağ tıklayıp Gönder -> 'Print to UDF' diyebilirsiniz!")

        # 2. İzlenen Yazıcı Klasörü (Hot Folder) Oluştur
        watch_dir = os.path.join(os.path.expanduser("~"), "Documents", "PrintToUDF")
        os.makedirs(watch_dir, exist_ok=True)
        print(f"[+] Sanal Yazıcı Klasörü Oluşturuldu: {watch_dir}")
        print("    -> 'Microsoft Print to PDF' ile bu klasöre yazdırılan belgeler otomatik UDF'e dönüşür.")

    elif current_os == "Darwin":  # macOS
        # macOS Native "PDF Services" Menüsüne Ekle
        pdf_services = os.path.join(os.path.expanduser("~"), "Library", "PDF Services")
        os.makedirs(pdf_services, exist_ok=True)
        workflow_script = os.path.join(pdf_services, "Print to UDF.sh")
        with open(workflow_script, "w", encoding="utf-8") as f:
            f.write(f'#!/bin/bash\n"{python_exe}" "{script_path}" "$@"\n')
        os.chmod(workflow_script, 0o755)
        print(f"[+] macOS 'PDF Services' menüsüne 'Print to UDF' eklendi!")
        print("    -> Artık Mac'te Cmd+P yaptığınızda sol alttaki 'PDF' menüsünde 'Print to UDF' görünecektir.")

    elif current_os == "Linux":
        # Linux CUPS Sanal Yazıcı Backend'i
        cups_backend_dir = "/usr/lib/cups/backend"
        backend_path = os.path.join(cups_backend_dir, "print-to-udf")
        print("[*] Linux CUPS Yazıcı Kurulumu için sudo yetkisi gerekebilir.")
        print(f"    1. sudo cp '{script_path}' '{backend_path}'")
        print(f"    2. sudo chmod 700 '{backend_path}'")
        print("    3. sudo lpadmin -p Print_to_UDF -v print-to-udf:/ -E -m raw")
        print("[+] Talimatlar hazırlandı.")


def watch_folder_mode():
    """Belirtilen klasöre düşen PDF dosyalarını otomatik UDF'e dönüştürür."""
    import time
    watch_dir = os.path.join(os.path.expanduser("~"), "Documents", "PrintToUDF")
    os.makedirs(watch_dir, exist_ok=True)
    print(f"[*] 'Print to UDF' Klasör İzleyici Başlatıldı: {watch_dir}")
    print("[*] Buraya bırakılan veya 'Print to PDF' ile buraya yazdırılan tüm dosyalar otomatik .udf olacaktır.")
    print("    Durdurmak için Ctrl+C tuşlayın.\n")

    processed = set()
    while True:
        try:
            for fname in os.listdir(watch_dir):
                if fname.lower().endswith(".pdf") and fname not in processed:
                    full_p = os.path.join(watch_dir, fname)
                    # Dosya yazımının bitmesini bekle
                    time.sleep(1)
                    udf_name = os.path.splitext(fname)[0] + ".udf"
                    udf_p = os.path.join(watch_dir, udf_name)
                    print(f"[+] Yeni PDF Algılandı: {fname} -> UDF'e dönüştürülüyor...")
                    pdf_to_udf(full_p, udf_p)
                    processed.add(fname)
            time.sleep(2)
        except KeyboardInterrupt:
            print("\nİzleyici durduruldu.")
            break


def main():
    parser = argparse.ArgumentParser(description="Print to UDF - Sanal Yazıcı ve PDF -> UDF Çevirici")
    parser.add_argument("input", nargs="?", help="Girdi PDF dosyası (veya stdin)")
    parser.add_argument("output", nargs="?", help="Çıktı .udf dosya yolu")
    parser.add_argument("--install", action="store_true", help="Sisteme sanal yazıcı entegrasyonu kurar (Windows/Mac/Linux)")
    parser.add_argument("--watch", action="store_true", help="Hot folder izleme modunda çalışır")

    args = parser.parse_args()

    if args.install:
        install_system_integration()
        return

    if args.watch:
        watch_folder_mode()
        return

    # CUPS Backend Taraması (Parametresiz çağrıldığında)
    if not args.input and "CUPS" in os.environ.get("SERVER_SOFTWARE", ""):
        print('direct print-to-udf "Unknown" "Print to UDF Virtual Printer"')
        return

    # Doğrudan girdi veya CUPS argümanları
    if args.input:
        pdf_to_udf(args.input, args.output)
    elif not sys.stdin.isatty():
        # Pipe ile stdin'den akıtılan PDF
        input_bytes = sys.stdin.buffer.read()
        if input_bytes:
            pdf_to_udf(input_bytes, args.output)
        else:
            print("Hata: Girdi akışı boş.")
    else:
        # Parametresiz çalıştırıldıysa dosya seçme diyaloğu aç
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            selected = filedialog.askopenfilename(
                title="Dönüştürülecek PDF Belgesini Seçin",
                filetypes=[("PDF Belgeleri", "*.pdf"), ("Tüm Dosyalar", "*.*")]
            )
            root.destroy()
            if selected:
                pdf_to_udf(selected)
            else:
                parser.print_help()
        except Exception:
            parser.print_help()


if __name__ == "__main__":
    main()

