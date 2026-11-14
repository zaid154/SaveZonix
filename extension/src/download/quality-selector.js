// src/download/quality-selector.js — Quality Variant Sorter & UI Selector Builder (Universal)

(function (root) {
    const QualitySelector = {
        populate(selectElement, variants) {
            if (!selectElement) return;
            selectElement.innerHTML = '';

            if (!variants || variants.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Original Quality (Auto)';
                selectElement.appendChild(opt);
                return;
            }

            variants.forEach((v, idx) => {
                const opt = document.createElement('option');
                opt.value = v.url;
                opt.textContent = idx === 0 ? `Max Quality — ${v.label}` : v.label;
                if (idx === 0) {
                    opt.selected = true;
                }
                selectElement.appendChild(opt);
            });
        },

        getSelectedVariant(selectElement, variants) {
            if (!selectElement || !variants || variants.length === 0) return null;
            const val = selectElement.value;
            return variants.find(v => v.url === val) || variants[0];
        }
    };

    root.QualitySelector = QualitySelector;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
