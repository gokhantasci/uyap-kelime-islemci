/* E-İmza ile imzalama (yerel "Adalet E-İmza" istemcisi üzerinden).
 * Tarayıcı kart/token'a doğrudan erişemez; resmî UDE ile aynı yöntemle bilgisayarda kurulu
 * Adalet E-İmza uygulamasına http://localhost:5975/ üzerinden bağlanılır. Belge ve PIN yalnızca
 * bu yerel uygulamaya gider; hiçbir sunucuya gönderilmez, PIN saklanmaz. */
(function (window, document) {
    'use strict';
    var BASE = 'http://localhost:5975/';
    var URLS = {
        certs: BASE + 'api/v1/signature/getCertificates',
        signUdf: BASE + 'api/v1/docsignature/signUdf'
    };

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    function clientActive(timeout) {
        var c = new AbortController();
        var t = setTimeout(function () { c.abort(); }, timeout || 3000);
        return fetch(BASE, { method: 'HEAD', mode: 'no-cors', signal: c.signal })
            .then(function () { return true; }, function () { return false; })
            .then(function (v) { clearTimeout(t); return v; });
    }

    function request(url, opts) {
        return fetch(url, opts).then(function (r) { return r.json(); }).then(function (j) {
            if (j && j.metadata && j.metadata.STATUS === 'ERROR') {
                throw new Error(j.metadata.MESSAGE || 'Adalet E-İmza uygulamasında bilinmeyen bir hata oluştu.');
            }
            return j && j.data;
        });
    }

    function toBase64(blob) {
        return new Promise(function (res, rej) {
            var fr = new FileReader();
            fr.onload = function () { res(String(fr.result).split(',')[1] || ''); };
            fr.onerror = rej;
            fr.readAsDataURL(blob);
        });
    }

    function b64ToBlob(b64) {
        var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
        for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
        return new Blob([u], { type: 'application/octet-stream' });
    }

    function maskCert(c) {
        var serial = c.subjectSerial || '', subj = c.subject || '';
        return serial.slice(0, 2) + ' ***** ' + serial.slice(9, 11) + ' ' + subj.slice(0, 2) + ' ***** ' + subj.slice(-2);
    }

    var backdrop = null;

    function close() { if (backdrop) { backdrop.remove(); backdrop = null; } }

    function open() {
        close();
        backdrop = el('div', 'ax-modal-backdrop');
        backdrop.style.display = 'flex';
        var dlg = el('div', 'ax-modal-dialog');
        dlg.setAttribute('role', 'dialog');
        dlg.setAttribute('aria-modal', 'true');
        dlg.style.maxWidth = '520px';
        var head = el('div', 'ax-modal-header');
        head.appendChild(el('h3', null, 'Evrak İmzalama'));
        var x = el('button', 'tool-btn-secondary', '✕');
        x.type = 'button';
        x.setAttribute('aria-label', 'Kapat');
        x.addEventListener('click', close);
        head.appendChild(x);
        var body = el('div', 'ax-modal-body');
        var foot = el('div', 'ax-modal-footer');
        var closeBtn = el('button', 'tool-btn-secondary', 'Kapat');
        closeBtn.type = 'button';
        closeBtn.addEventListener('click', close);
        foot.appendChild(closeBtn);
        dlg.appendChild(head);
        dlg.appendChild(body);
        dlg.appendChild(foot);
        backdrop.appendChild(dlg);
        backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop) close(); });
        document.body.appendChild(backdrop);
        check(body, foot);
    }

    function message(body, kind, title, text) {
        body.textContent = '';
        var box = el('div');
        box.style.cssText = 'text-align:center;padding:8px 4px;';
        var icon = el('div', null, kind === 'error' ? '⚠️' : kind === 'ok' ? '✅' : '⏳');
        icon.style.fontSize = '30px';
        var h = el('div', null, title);
        h.style.cssText = 'font-weight:700;margin:8px 0 4px;';
        var p = el('div', null, text);
        p.style.cssText = 'font-size:13px;color:#475569;line-height:1.5;';
        box.appendChild(icon);
        box.appendChild(h);
        box.appendChild(p);
        body.appendChild(box);
    }

    function check(body, foot) {
        var retry = foot.querySelector('.uki-esign-retry');
        if (retry) retry.remove();
        message(body, 'wait', 'Adalet E-İmza uygulaması aranıyor…', 'Kartınızın/token’ınızın takılı olduğundan emin olun.');
        clientActive().then(function (ok) {
            if (!ok) return notFound(body, foot);
            return request(URLS.certs, { method: 'GET' }).then(function (certs) {
                if (!Array.isArray(certs) || !certs.length) {
                    return fail(body, foot, 'Takılı kart bulunamadı', 'E-imza kartınızı/token’ınızı takıp tekrar deneyin.');
                }
                form(body, foot, certs);
            }, function (err) { fail(body, foot, 'Sertifikalar okunamadı', err.message); });
        });
    }

    var DOWNLOAD_URL = 'https://eimza.adalet.gov.tr/';

    function notFound(body, foot) {
        fail(body, foot, 'Adalet E-İmza Uygulaması Bulunamadı',
            'İmzalama yapabilmek için Adalet E-İmza client uygulamasının bilgisayarınızda kurulu ve çalışıyor olması gerekir.');
        var guide = el('div');
        guide.style.cssText = 'margin-top:12px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;line-height:1.55;color:#334155;text-align:left;';
        var h = el('div', null, 'Nasıl kurulur?');
        h.style.cssText = 'font-weight:700;margin-bottom:4px;';
        guide.appendChild(h);
        var ol = el('ol');
        ol.style.cssText = 'margin:0;padding-left:18px;';
        [
            'Aşağıdaki bağlantıdan Adalet E-İmza uygulamasını indirip kurun.',
            'E-imza kartınızı/token\u2019ınızı bilgisayara takın ve kart okuyucu sürücüsünün kurulu olduğundan emin olun.',
            'Uygulamayı başlatın ve çalışır durumda bırakın (arka planda açık olmalı).',
            'Bu pencerede \u201cTekrar Dene\u201d düğmesine basın.'
        ].forEach(function (t) { ol.appendChild(el('li', null, t)); });
        guide.appendChild(ol);
        var a = el('a', null, '\u2B07 Adalet E-İmza Uygulamasını İndir');
        a.href = DOWNLOAD_URL;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.cssText = 'display:inline-block;margin-top:8px;font-weight:600;color:#2563eb;text-decoration:none;';
        guide.appendChild(a);
        var note = el('div', null, 'Uygulama kurulu ama bağlantı kurulamıyorsa tarayıcının \u201cyerel ağa erişim\u201d iznini isteyip istemediğine bakın ve izin verin.');
        note.style.cssText = 'margin-top:6px;font-size:11.5px;color:#64748b;';
        guide.appendChild(note);
        body.appendChild(guide);
    }

    function fail(body, foot, title, text) {
        message(body, 'error', title, text);
        var old = foot.querySelector('.uki-esign-retry');
        if (old) old.remove();
        var b = el('button', 'tool-btn-secondary uki-esign-retry', '↻ Tekrar Dene');
        b.type = 'button';
        b.addEventListener('click', function () { check(body, foot); });
        foot.insertBefore(b, foot.firstChild);
    }

    function form(body, foot, certs) {
        body.textContent = '';
        var wrap = el('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
        var l1 = el('label', null, 'Sertifika');
        l1.style.cssText = 'font-size:12px;font-weight:600;';
        var sel = el('select', 'ax-input');
        certs.forEach(function (c) {
            var o = el('option', null, maskCert(c));
            o.value = c.certificateId;
            sel.appendChild(o);
        });
        var l2 = el('label', null, 'PIN');
        l2.style.cssText = 'font-size:12px;font-weight:600;';
        var pin = el('input', 'ax-input');
        pin.type = 'password';
        pin.autocomplete = 'off';
        pin.placeholder = 'Kart PIN’i';
        var note = el('div', null, 'Belge ve PIN yalnızca bilgisayarınızdaki e-imza uygulamasına iletilir; sunucuya gönderilmez.');
        note.style.cssText = 'font-size:11.5px;color:#64748b;';
        var go = el('button', 'tool-btn-primary', 'İmzala');
        go.type = 'button';
        [l1, sel, l2, pin, note, go].forEach(function (n) { wrap.appendChild(n); });
        body.appendChild(wrap);
        pin.focus();
        go.addEventListener('click', function () {
            if (!pin.value) { pin.focus(); return; }
            go.disabled = true;
            go.textContent = 'İmzalanıyor…';
            var certId = sel.value, pinVal = pin.value;
            pin.value = '';
            Promise.resolve(window.__ukiBuildUdfBlob()).then(toBase64).then(function (content) {
                return request(URLS.signUdf, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ certificateId: certId, pin: pinVal, content: content })
                });
            }).then(function (data) {
                var signed = data && (data.signedData || data.signedUdf || data.content);
                if (!signed) throw new Error('E-imza uygulamasından geçersiz yanıt alındı.');
                var name = (window.__ukiDocTitle ? window.__ukiDocTitle() : 'belge').replace(/\.udf$/i, '') + '-imzali.udf';
                var url = URL.createObjectURL(b64ToBlob(signed));
                var a = document.createElement('a');
                a.href = url;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
                message(body, 'ok', 'Belge imzalandı', '"' + name + '" indirildi.');
                if (window.showToast) window.showToast('Belge e-imza ile imzalandı.', 'success');
            }).catch(function (err) {
                fail(body, foot, 'İmzalama başarısız', (err && err.message) || 'Bilinmeyen hata');
            });
        });
    }

    window.UkiEsign = { open: open, isClientActive: clientActive };
})(window, document);
