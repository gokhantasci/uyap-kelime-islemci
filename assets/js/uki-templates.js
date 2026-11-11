/**
 * UYAP Kelime İşlemci (UKİ) - Paylaşılabilir ve Doldurulabilir Şablon Motoru
 * 
 * 1. Şablondaki değişkenleri (örn: {{MAHKEME}}, {{DAVACI}}, {{TC_NO}}, {{TUTAR}}) otomatik tespit eder.
 * 2. Tek tıkla internet üzerinden paylaşılabilir bağlantı (#template=...) üretir.
 * 3. Bağlantıyı açan kişiye şablon doldurma sihirbazı sunar; doldurulan belgeyi doğrudan UDF olarak açar.
 * 4. Paylaşılan şablonları yerel kütüphaneye "Sisteme Entegre Et" butonuyla kaydeder.
 */
(function (window) {
    'use strict';

    function base64EncodeUnicode(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
    }

    function base64DecodeUnicode(str) {
        return decodeURIComponent(Array.prototype.map.call(atob(str), function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    }

    const UkiTemplates = {
        /**
         * Belgedeki tüm {{DEĞİŞKEN}}, [[DEĞİŞKEN]] ve belirgin [DEĞİŞKEN] kalıplarını bulur
         */
        extractVariables(contentHtml) {
            const regex = /\{\{([^}]+)\}\}|\[\[([^\]]+)\]\]|\[([A-ZÇĞİÖŞÜ0-9_]{3,30})\]/g;
            const vars = new Set();
            let m;
            while ((m = regex.exec(contentHtml)) !== null) {
                const name = (m[1] || m[2] || m[3]).trim();
                if (name && !/^(URL|IMG|REF|DOC|DIV|SPAN|FONT|STYLE|P)$/i.test(name)) {
                    vars.add(name);
                }
            }
            return Array.from(vars);
        },

        cleanLabel(varName) {
            if (!varName) return '';
            // Örn: DAVACI_TC -> Davacı T.C.
            return varName
                .replace(/_/g, ' ')
                .toLowerCase()
                .replace(/(?:^|\s)\S/g, a => a.toLocaleUpperCase('tr-TR'))
                .replace(/\bTc\b/g, 'T.C. No')
                .replace(/\bIban\b/g, 'IBAN')
                .replace(/\bTl\b/g, 'TL');
        },

        /**
         * Mevcut belgeden paylaşılabilir şablon linki üretir
         */
        createShareableLink(title, contentHtml) {
            const variables = UkiTemplates.extractVariables(contentHtml);
            const payload = {
                title: title || 'Doldurulabilir Hukuk Şablonu',
                variables: variables,
                content: contentHtml,
                created: Date.now()
            };
            const jsonStr = JSON.stringify(payload);
            const encoded = base64EncodeUnicode(jsonStr);
            const baseUrl = window.location.origin + window.location.pathname;
            return baseUrl + '#template=' + encoded;
        },

        /**
         * Paylaşılan şablon bağlantısını çözümler (hash veya query param)
         */
        parseHashTemplate() {
            let encoded = '';
            const hash = window.location.hash || '';
            if (hash.startsWith('#template=')) {
                encoded = hash.substring('#template='.length);
            } else {
                try {
                    const search = new URLSearchParams(window.location.search);
                    if (search.get('template')) {
                        encoded = search.get('template');
                    }
                } catch (e) {}
            }
            if (!encoded) return null;
            try {
                const jsonStr = base64DecodeUnicode(encoded);
                return JSON.parse(jsonStr);
            } catch (e) {
                console.error('Şablon çözümlenemedi:', e);
                return null;
            }
        },

        /**
         * Şablon değişkenlerini girilen değerlerle doldurur
         */
        fillTemplate(contentHtml, valuesMap) {
            let res = contentHtml;
            for (const [key, val] of Object.entries(valuesMap)) {
                const cleanVal = String(val !== undefined ? val : '').trim();
                const re1 = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
                const re2 = new RegExp('\\[\\[' + key + '\\]\\]', 'g');
                const re3 = new RegExp('\\[\\b' + key + '\\b\\]', 'g');
                res = res.replace(re1, cleanVal).replace(re2, cleanVal).replace(re3, cleanVal);
            }
            return res;
        },

        /**
         * Şablonu yerel kütüphaneye entegre eder / kaydeder
         */
        saveToLibrary(templateData) {
            try {
                const saved = JSON.parse(localStorage.getItem('uki-user-templates') || '[]');
                const idx = saved.findIndex(t => t.title === templateData.title);
                if (idx >= 0) {
                    saved[idx] = templateData;
                } else {
                    saved.unshift(templateData);
                }
                localStorage.setItem('uki-user-templates', JSON.stringify(saved));
                return true;
            } catch (e) {
                return false;
            }
        },

        removeFromLibrary(title) {
            try {
                const saved = JSON.parse(localStorage.getItem('uki-user-templates') || '[]');
                const filtered = saved.filter(t => t.title !== title);
                localStorage.setItem('uki-user-templates', JSON.stringify(filtered));
                return true;
            } catch (e) {
                return false;
            }
        },

        getLibrary() {
            try {
                return JSON.parse(localStorage.getItem('uki-user-templates') || '[]');
            } catch (e) {
                return [];
            }
        }
    };

    window.UkiTemplates = UkiTemplates;
})(window);

