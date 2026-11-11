/**
 * UYAP Kelime İşlemci (UKİ) - Tasarıma uygun iletişim kutuları (tarayıcının yerel confirm/prompt/alert yerine)
 *
 *   await UkiDialog.confirm('Mesaj', { title, okText, cancelText, danger })   -> true | false
 *   await UkiDialog.prompt('Mesaj', 'varsayılan', { title, placeholder })     -> string | null
 *   await UkiDialog.form({ title, message, fields:[{id,label,value,type,min,max}] }) -> {id: değer} | null
 *   await UkiDialog.alert('Mesaj', { title })                                 -> true
 *
 * Tüm metinler textContent ile yazılır (HTML enjeksiyonu yok). Enter = Tamam, Esc = İptal.
 */
(function (window, document) {
    'use strict';

    let seq = 0;

    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    function open(opts) {
        return new Promise((resolve) => {
            const previouslyFocused = document.activeElement;
            const id = 'uki-dlg-' + (++seq);

            const backdrop = el('div', 'ax-modal-backdrop uki-dialog-backdrop');
            backdrop.style.display = 'flex';
            const dialog = el('div', 'ax-modal-dialog uki-dialog');
            dialog.setAttribute('role', opts.kind === 'alert' ? 'alertdialog' : 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', id + '-t');

            const header = el('div', 'ax-modal-header');
            const title = el('h3', null, opts.title || 'UYAP Web');
            title.id = id + '-t';
            header.appendChild(title);
            const body = el('div', 'ax-modal-body uki-dialog-body');
            if (opts.message) body.appendChild(el('p', 'uki-dialog-msg', opts.message));

            const inputs = [];
            (opts.fields || []).forEach((f, i) => {
                const row = el('label', 'uki-dialog-field');
                row.appendChild(el('span', 'uki-dialog-label', f.label || ''));
                const input = document.createElement('input');
                input.className = 'ax-input uki-dialog-input';
                input.type = f.type || 'text';
                input.value = f.value != null ? String(f.value) : '';
                if (f.placeholder) input.placeholder = f.placeholder;
                if (f.min != null) input.min = f.min;
                if (f.max != null) input.max = f.max;
                input.setAttribute('data-field', f.id || ('f' + i));
                row.appendChild(input);
                body.appendChild(row);
                inputs.push(input);
            });

            const footer = el('div', 'ax-modal-footer uki-dialog-footer');
            const cancel = el('button', 'tool-btn-secondary', opts.cancelText || 'İptal');
            cancel.type = 'button';
            const ok = el('button', opts.danger ? 'tool-btn-primary uki-danger' : 'tool-btn-primary', opts.okText || 'Tamam');
            ok.type = 'button';
            if (opts.kind !== 'alert') footer.appendChild(cancel);
            footer.appendChild(ok);

            dialog.appendChild(header);
            dialog.appendChild(body);
            dialog.appendChild(footer);
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);

            let done = false;
            function close(result) {
                if (done) return;
                done = true;
                document.removeEventListener('keydown', onKey, true);
                backdrop.remove();
                if (previouslyFocused && previouslyFocused.focus) { try { previouslyFocused.focus(); } catch (e) { /* odak taşınamadı */ } }
                resolve(result);
            }
            function collect() {
                if (!inputs.length) return true;
                if (opts.kind === 'prompt') return inputs[0].value;
                const out = {};
                inputs.forEach((i) => { out[i.getAttribute('data-field')] = i.value; });
                return out;
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(opts.kind === 'alert' ? true : null); }
                else if (e.key === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); e.stopPropagation(); ok.click(); }
                else if (e.key === 'Tab') {
                    // odak iletişim kutusu içinde kalır
                    const f = Array.from(dialog.querySelectorAll('input, button')).filter((x) => !x.disabled);
                    if (!f.length) return;
                    const first = f[0], last = f[f.length - 1];
                    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            }
            document.addEventListener('keydown', onKey, true);

            ok.addEventListener('click', () => {
                const v = collect();
                if (opts.kind === 'confirm') close(true);
                else close(v);
            });
            cancel.addEventListener('click', () => close(opts.kind === 'confirm' ? false : null));
            backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop && opts.kind !== 'alert') close(opts.kind === 'confirm' ? false : null); });

            setTimeout(() => {
                if (inputs[0]) { inputs[0].focus(); inputs[0].select(); } else { ok.focus(); }
            }, 30);
        });
    }

    window.UkiDialog = {
        confirm: (message, o) => open(Object.assign({ kind: 'confirm', title: 'Onay', message }, o || {})),
        prompt: (message, def, o) => open(Object.assign({ kind: 'prompt', title: 'Bilgi girin', message, fields: [{ id: 'value', label: '', value: def == null ? '' : def, placeholder: (o && o.placeholder) || '' }] }, o || {})),
        form: (o) => open(Object.assign({ kind: 'form' }, o || {})),
        alert: (message, o) => open(Object.assign({ kind: 'alert', title: 'Bilgi', message }, o || {}))
    };
})(window, document);
