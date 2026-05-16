// ui/ui.gradients.view.js
// Perceptual Gradient Preview View

import { generateScaleForLCH } from '../engine/engine.scales.js';

export function renderGradientsView(lch) {
    const wrap = document.createElement('div');
    wrap.style.padding = '32px';

    const scale = generateScaleForLCH(lch);

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '40px';

    // 1. Full Scale Gradient
    container.appendChild(createGradientRow('Tonal Ramp (0-1000)', scale));

    // 2. High-key Gradient
    const highKey = scale.filter(s => s.step <= 300);
    container.appendChild(createGradientRow('High-Key (0-300)', highKey));

    // 3. Shadow Gradient
    const shadows = scale.filter(s => s.step >= 700);
    container.appendChild(createGradientRow('Shadows (700-1000)', shadows));

    wrap.appendChild(container);
    return wrap;
}

function createGradientRow(title, scale) {
    const row = document.createElement('div');

    const h3 = document.createElement('h3');
    h3.textContent = title;
    h3.style.marginBottom = '12px';

    const bar = document.createElement('div');
    bar.style.height = '120px';
    bar.style.borderRadius = '16px';
    bar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';

    const cssG = `linear-gradient(to right, ${scale.map(s => s.hex).join(', ')})`;
    bar.style.background = cssG;

    row.append(h3, bar);
    return row;
}
