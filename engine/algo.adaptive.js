// engine/algo.adaptive.js
// Adaptive Perceptual algorithm

import { oklchToOklab, oklabToRgb, rgbToHex, maxChromaForL } from './engine.math.js';
import { getPerceptualCompensation, getHuePathShift } from './engine.curves.js';
import { EngineState } from './engine.core.js';

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

    const profile = EngineState.mode.gamutProfile || 'srgb';

    return steps.map(step => {
        const t = step / 1000;
        let L = lightnessCurve(t, gamma);

        // Perceptual compensation for lightness
        const { chromaScale, lBias } = getPerceptualCompensation({ L, C: baseLch.C, h: baseLch.h });
        L = Math.max(0, Math.min(1, L + lBias));

        // Dynamic Hue Path
        const hShift = getHuePathShift({ L, h: baseLch.h }, baseLch.L);
        const H = (baseLch.h + hShift + 360) % 360;

        const stepMaxC = maxChromaForL(L, H, profile);

        // Preserve brand intensity across the scale
        // We use the same 'relative saturation' as the base color
        // but ensure a floor to prevent "gray-out" in highlights/shadows.
        const floor = 0.1 * intensity;
        let C = stepMaxC * Math.max(floor, intensity) * chromaScale;

        // Ensure we don't exceed technical gamut
        C = Math.min(C, stepMaxC);

        if (isDarkMode) {
            // Nieliniowe tłumienie dla Dark Mode
            C *= (0.65 + 0.3 * (1 - L));
        }

        const lab = oklchToOklab(L, C, H);
        const hex = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));

        return { step, hex, l: L, c: C, h: baseLch.h };
    });
}
