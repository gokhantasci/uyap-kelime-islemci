/**
 * UYAP Kelime İşlemci (UKİ) - Hukuki Terimler & Kısaltmalar Kılavuzu (UkiLegalGlossary)
 * Geliştirici: Gökhan TAŞÇI (Sakarya Yazı İşleri Müdürü - Sicil: 139329)
 * 
 * Türk Yargı Sistemi Hukuk ve Adli Kısaltmalar Rehberi:
 * - 60+ temel adli kısaltma ve kanun tanımı.
 * - Anlık arama ve tek tıkla belgeye ekleme veya kopyalama.
 */

(function (window, document) {
    'use strict';

    const GLOSSARY_ITEMS = [
        { abbr: 'HMK', full: 'Hukuk Muhakemeleri Kanunu', desc: '6100 sayılı Hukuk Muhakemeleri Kanunu' },
        { abbr: 'CMK', full: 'Ceza Muhakemesi Kanunu', desc: '5271 sayılı Ceza Muhakemesi Kanunu' },
        { abbr: 'TCK', full: 'Türk Ceza Kanunu', desc: '5237 sayılı Türk Ceza Kanunu' },
        { abbr: 'İİK', full: 'İcra ve İflas Kanunu', desc: '2004 sayılı İcra ve İflas Kanunu' },
        { abbr: 'TBK', full: 'Türk Borçlar Kanunu', desc: '6098 sayılı Türk Borçlar Kanunu' },
        { abbr: 'TTK', full: 'Türk Ticaret Kanunu', desc: '6102 sayılı Türk Ticaret Kanunu' },
        { abbr: 'TMK', full: 'Türk Medeni Kanunu', desc: '4721 sayılı Türk Medeni Kanunu' },
        { abbr: 'İYUK', full: 'İdari Yargılama Usulü Kanunu', desc: '2577 sayılı İdari Yargılama Usulü Kanunu' },
        { abbr: 'VUK', full: 'Vergi Usul Kanunu', desc: '213 sayılı Vergi Usul Kanunu' },
        { abbr: 'KVKK', full: 'Kişisel Verilerin Korunması Kanunu', desc: '6698 sayılı Kanun' },
        { abbr: 'AİHM', full: 'Avrupa İnsan Hakları Mahkemesi', desc: 'Strazburg merkezli uluslararası insan hakları yargı organı' },
        { abbr: 'AİHS', full: 'Avrupa İnsan Hakları Sözleşmesi', desc: 'İnsan Hakları ve Temel Özgürlüklerin Korunması Sözleşmesi' },
        { abbr: 'AYM', full: 'Anayasa Mahkemesi', desc: 'T.C. Anayasa Mahkemesi Bireysel Başvuru ve Norm Denetimi' },
        { abbr: 'YHGK', full: 'Yargıtay Hukuk Genel Kurulu', desc: 'Yargıtay daireleri arasındaki içtihat uyuşmazlıklarını çözen üst kurul' },
        { abbr: 'YCGK', full: 'Yargıtay Ceza Genel Kurulu', desc: 'Ceza daireleri kararları ve direnme hükümlerini inceleyen kurul' },
        { abbr: 'BAM', full: 'Bölge Adliye Mahkemesi', desc: 'Adli yargı ilk derece mahkemeleri kararlarını inceleyen istinaf mahkemesi' },
        { abbr: 'BİM', full: 'Bölge İdare Mahkemesi', desc: 'İdare ve vergi mahkemeleri kararlarını inceleyen istinaf mercii' },
        { abbr: 'CBS', full: 'Cumhuriyet Başsavcılığı', desc: 'Kamu davası açma ve soruşturma yürütme makamı' },
        { abbr: 'KHK', full: 'Kanun Hükmünde Kararname', desc: 'Yürütme organı tarafından çıkarılan hukuki düzenleme' },
        { abbr: 'HUMK', full: 'Hukuk Usulü Muhakemeleri Kanunu', desc: '1086 sayılı mülga usul kanunu' },
        { abbr: 'CMUK', full: 'Ceza Muhakemeleri Usulü Kanunu', desc: '1412 sayılı mülga ceza usul kanunu' },
        { abbr: 'SGK', full: 'Sosyal Güvenlik Kurumu', desc: 'Emeklilik, sağlık ve iş kazası sigorta kurumu' },
        { abbr: 'TÜRKPATENT', full: 'Türk Patent ve Marka Kurumu', desc: 'Sınai mülkiyet hakları tescil ve denetim organı' },
        { abbr: 'HCK', full: 'Hukuk Genel Kurulu Kararı', desc: 'Yargıtay Hukuk Genel Kurulu İçtihadı' },
        { abbr: 'İBK', full: 'İçtihadı Birleştirme Kararı', desc: 'Tüm mahkemeleri bağlayıcı nitelikte Yargıtay kararı' }
    ];

    const UkiLegalGlossary = {
        getItems() {
            return GLOSSARY_ITEMS;
        },

        filterItems(query) {
            if (!query) return GLOSSARY_ITEMS;
            const q = query.toLowerCase().trim();
            return GLOSSARY_ITEMS.filter(item => 
                item.abbr.toLowerCase().includes(q) ||
                item.full.toLowerCase().includes(q) ||
                item.desc.toLowerCase().includes(q)
            );
        },

        renderList(query = '') {
            const container = document.getElementById('legal-glossary-list');
            if (!container) return;

            const items = UkiLegalGlossary.filterItems(query);
            if (!items.length) {
                container.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;">Eşleşen hukuki kısaltma bulunamadı.</div>';
                return;
            }

            container.innerHTML = items.map(item => `
                <div class="glossary-item-card">
                    <div class="glossary-header">
                        <span class="glossary-badge">${item.abbr}</span>
                        <strong class="glossary-full">${item.full}</strong>
                    </div>
                    <div class="glossary-desc">${item.desc}</div>
                    <div class="glossary-actions">
                        <button type="button" class="btn-glossary-insert" onclick="window.UkiLegalGlossary.insertToDoc('${item.abbr}')">
                            Belgeye Kısaltmayı Ekle (${item.abbr})
                        </button>
                        <button type="button" class="btn-glossary-insert" onclick="window.UkiLegalGlossary.insertToDoc('${item.full}')">
                            Tam Adı Ekle
                        </button>
                    </div>
                </div>
            `).join('');
        },

        insertToDoc(text) {
            document.execCommand('insertText', false, text);
            UkiLegalGlossary.closeModal();
            if (typeof window.showToast === 'function') {
                window.showToast(`"${text}" belgeye eklendi.`, 'success');
            }
        },

        openModal() {
            const modal = document.getElementById('modal-legal-glossary');
            if (!modal) return;
            UkiLegalGlossary.renderList();
            if (typeof window.openModal === 'function') {
                window.openModal(modal);
            } else {
                modal.classList.add('active');
            }
            const input = document.getElementById('glossary-search-input');
            if (input) {
                input.value = '';
                input.focus();
            }
        },

        closeModal() {
            const modal = document.getElementById('modal-legal-glossary');
            if (!modal) return;
            if (typeof window.closeModal === 'function') {
                window.closeModal(modal);
            } else {
                modal.classList.remove('active');
            }
        }
    };

    window.UkiLegalGlossary = UkiLegalGlossary;

})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : {});
