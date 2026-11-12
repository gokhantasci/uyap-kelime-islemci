#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UYAP Kelime İşlemci - Release Paketleme Betiği
Tüm release varlıklarını (WordPress eklentisi, Offline Web Editor, Windows Desktop Suite)
'releases/' dizinine ZIP formatında paketler.
"""

import os
import zipfile
import shutil

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RELEASES_DIR = os.path.join(ROOT_DIR, "releases")

def make_zip(source_items, zip_dest, base_dir=ROOT_DIR):
    os.makedirs(os.path.dirname(zip_dest), exist_ok=True)
    with zipfile.ZipFile(zip_dest, "w", zipfile.ZIP_DEFLATED) as z:
        for item in source_items:
            src_path = os.path.join(base_dir, item)
            if os.path.isfile(src_path):
                z.write(src_path, arcname=item)
            elif os.path.isdir(src_path):
                for root, dirs, files in os.walk(src_path):
                    # Exclude unwanted directories
                    dirs[:] = [d for d in dirs if d not in [".git", "__pycache__", "node_modules", ".playwright-mcp", "scratch"]]
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, base_dir)
                        z.write(file_path, arcname=arcname)
    print(f"[+] Paket oluşturuldu: {zip_dest} ({os.path.getsize(zip_dest):,} bayt)")

def main():
    os.makedirs(RELEASES_DIR, exist_ok=True)
    
    # 1. WordPress Plugin ZIP
    wp_source_dir = os.path.join(ROOT_DIR, "wordpress-plugin")
    wp_zip = os.path.join(RELEASES_DIR, "uyap-kelime-islemci-wordpress-plugin.zip")
    make_zip(["uyap-kelime-islemci"], wp_zip, base_dir=wp_source_dir)
    
    # 2. Standalone Offline Web Editor ZIP
    offline_items = ["index.html", "embed.html", "embed.js", "robots.txt", "sitemap.xml", "llms.txt", "README.md", "LICENSE", "assets"]
    offline_zip = os.path.join(RELEASES_DIR, "uyap-web-editor-v2.6.0.zip")
    make_zip(offline_items, offline_zip, base_dir=ROOT_DIR)

    # 3. Windows Print & Desktop Suite ZIP
    suite_items = ["install.ps1", "uninstall.ps1", "PrintToUDF_Watcher.ps1", "open_in_editor.py", "print_to_udf.py", "index.html", "embed.html", "embed.js", "assets", "README.md", "LICENSE"]
    suite_zip = os.path.join(RELEASES_DIR, "print-to-udf-windows-suite.zip")
    make_zip(suite_items, suite_zip, base_dir=ROOT_DIR)

    print("\n[✓] Tüm release paketleri başarıyla hazırlandı!")

if __name__ == "__main__":
    main()
