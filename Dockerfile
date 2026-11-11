# UYAP Kelime İşlemci & Print to UDF - Resmi Docker İmajı
# Python 3.11 Slim tabanlı, hafif ve tam donanımlı mikroservis ve web sunucusu

FROM python:3.11-slim

LABEL maintainer="UYAP Kelime İşlemci Topluluğu"
LABEL description="UYAP Doküman Editörü Web Arayüzü ve Evrensel Dönüştürücü (UDF, PDF, DOCX, Markdown, OCR)"
LABEL version="1.8"

# Sistem ortam değişkenleri
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    HOST=0.0.0.0

WORKDIR /app

# PyMuPDF kütüphanesini kur
RUN pip install --no-cache-dir --upgrade pip pymupdf

# Proje kaynak kodlarını kopyala
COPY . /app

# Sağlık denetimi (Healthcheck)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health')"

# Web & REST API Portunu Dışa Aç
EXPOSE 8080

# Web sunucusu ve REST API'yi başlat
CMD ["python", "print_to_udf.py", "--serve", "8080", "--host", "0.0.0.0"]

