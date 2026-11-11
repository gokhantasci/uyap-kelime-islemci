/** Baskı için ekranın hesaplanmış stillerini dondurur; file:// CSSOM kısıtına bağımlı değildir. */
(function (window, document) {
    'use strict';
    const OMIT = '#watermark-layer,.a4-watermark-layer,.udf-watermark,.watermark-text,[id*="watermark"],[class*="watermark"],.e-sign-seal-badge,.udf-seal-stamp,.floating-seal-widget,.pb-seal,.pb-gap';
    function snapshot(source) {
        const clone = source.cloneNode(true);
        const originals = [source, ...source.querySelectorAll('*')];
        const copies = [clone, ...clone.querySelectorAll('*')];
        originals.forEach((el, i) => {
            const cs = window.getComputedStyle(el), target = copies[i];
            for (let j = 0; j < cs.length; j++) {
                const prop = cs[j];
                target.style.setProperty(prop, cs.getPropertyValue(prop));
            }
            target.removeAttribute('contenteditable');
            target.removeAttribute('spellcheck');
            target.style.animation = 'none';
            target.style.transition = 'none';
            // Gece okuma renkleri çıktı tercihi değildir; özgün metin rengi korunur.
            if (el.matches('.a4-page,p,span,div,li,td,th,b,strong,i,em,u,a')) {
                let ancestor = el, color = '';
                while (ancestor && source.contains(ancestor)) {
                    if (ancestor.style.color) { color = ancestor.style.color; break; }
                    ancestor = ancestor.parentElement;
                }
                target.style.color = color || '#000000';
            }
        });
        clone.querySelectorAll(OMIT).forEach(el => el.remove());
        clone.style.cssText += ';position:absolute;left:0;margin:0;transform:none;zoom:1;box-shadow:none;border:0;border-radius:0;background-color:white;background-image:none;';
        return clone;
    }
    window.UkiPrintSnapshot = {snapshot, OMIT};
})(window, document);
