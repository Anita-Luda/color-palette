// engine/algo.adaptive.js
// Adaptive Perceptual algorithm

import { oklchToOklab, oklabToRgb, rgbToHex, maxChromaForL } from './engine.math.js';

function getAdaptiveGamma(baseL, baseT) {
  const L_max = 0.98;
  const L_min = 0.05;
  if (baseT <= 0.001) return 1.3;
  if (baseT >= 0.999) return 1.3;
  const ratio = (L_max - baseL) / (L_max - L_min);
  const safeRatio = Math.max(0.01, Math.min(0.99, ratio));
  return Math.log(safeRatio) / Math.log(baseT);
}

function lightnessCurve(t, gamma = 1.3) {
  const L_max = 0.98;
  const L_min = 0.05;
  return L_max - (L_max - L_min) * Math.pow(t, gamma);
}

export function generateAdaptiveScale(baseLch, steps, isDarkMode) {
    const baseT = (1000 - Math.round((1 - baseLch.L) * 1000)) / 1000;
    const gamma = getAdaptiveGamma(baseLch.L, baseT);

    // Calculate the 'intensity' of the base color relative to its own gamut limit
    const baseMaxC = maxChromaForL(baseLch.L, baseLch.h);
    const intensity = baseMaxC > 0 ? (baseLch.C / baseMaxC) : 0;

    return steps.map(step => {
        const t = step / 1000;
        const L = lightnessCurve(t, gamma);
        const stepMaxC = maxChromaForL(L, baseLch.h);

        // Preserve brand intensity across the scale
        // We use the same 'relative saturation' as the base color
        // with a slight boost for mid-tones to keep it "vibrant"
        const dist = Math.abs(L - baseLch.L);
        const boost = 1 + 0.2 * (1 - dist); // Mid-tone vibrancy

        let C = stepMaxC * intensity * boost;

        // Ensure we don't exceed step boundaries
        C = Math.min(C, stepMaxC);

        if (isDarkMode) {
            C *= (0.7 + 0.3 * (1 - L));
        }

        const lab = oklchToOklab(L, C, baseLch.h);
        const hex = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));

        return { step, hex, l: L, c: C, h: baseLch.h };
    });
}
