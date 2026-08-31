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

            const best = variants[0];
            const bestOpt = document.createElement('option');
            bestOpt.value = best.url;
            bestOpt.textContent = `⭐ Best Quality — ${best.label}`;
            bestOpt.selected = true;
            selectElement.appendChild(bestOpt);

            variants.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.url;
                opt.textContent = v.label;
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
