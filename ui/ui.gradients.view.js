// ui/ui.gradients.view.js
// Perceptual Gradient Preview View

import { generateScaleForLCH } from '../engine/engine.scales.js';
import { getColorsForGradient } from '../engine/engine.gradients.js';
import { getState } from '../engine/engine.core.js';
import { oklchToOklab, oklabToRgb, rgbToHex } from '../engine/engine.math.js';

export function renderGradientsView(lch) {
    const state = getState();
    const wrap = document.createElement('div');
    wrap.style.padding = '32px';

    const scale = generateScaleForLCH(lch);

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '40px';

    // 1. Multi-color Gradient (from selected colors)
    const multiColors = getColorsForGradient();
    if (multiColors.length > 1) {
        container.appendChild(createGradientRow('Multi-color Gradient', multiColors));
    }

    // 2. Full Scale Gradient
    container.appendChild(createGradientRow('Tonal Ramp (0-1000)', scale));

    // 3. High-key Gradient
    const highKey = scale.filter(s => s.step <= 300);
    container.appendChild(createGradientRow('High-Key (0-300)', highKey));

    // 4. Shadow Gradient
    const shadows = scale.filter(s => s.step >= 700);
    container.appendChild(createGradientRow('Shadows (700-1000)', shadows));

    // Apply Background Brightness
    const isDark = state.mode.background === 'dark';
    const brightness = isDark ? state.mode.gradientBgBrightness.dark : state.mode.gradientBgBrightness.light;
    const bgL = brightness;
    const bgHex = rgbToHex(oklabToRgb(oklchToOklab(bgL, lch.C * 0.2, lch.h).L, oklchToOklab(bgL, lch.C * 0.2, lch.h).a, oklchToOklab(bgL, lch.C * 0.2, lch.h).b));

    wrap.style.background = bgHex;
    wrap.style.borderRadius = '24px';
    wrap.style.margin = '24px';

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
