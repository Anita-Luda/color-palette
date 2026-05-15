// engine/algo.standard.js
// Rebuilt: simplest possible tonal scale with smooth visual blending.

import { oklchToOklab, oklabToRgb, rgbToHex } from './engine.math.js';

export function generateStandardScale(baseLch, steps, isDarkMode) {
    const stepToL = s => 1 - (s / 1000);

    return steps.map(step => {
        const L = stepToL(step);

        // Dark Mode: non-linear intensity reduction
        let chromaMult = 1.0;
        if (isDarkMode) {
            // Stronger reduction in lights, subtle in darks
            chromaMult = 0.6 + 0.3 * (1 - L);
        }

        // Tonal falloff: smooth curve that peaks at baseLch.L and hits 0 at L=0, L=1.
        // We use a simple parabolic curve to ensure the transition is "velvety".
        const normalizedDist = (L > baseLch.L)
            ? (L - baseLch.L) / (1 - baseLch.L || 0.01)
            : (baseLch.L - L) / (baseLch.L || 0.01);

        // Power 1.5 for a "tonal" (slightly muted) look away from the base
        const falloff = Math.pow(Math.max(0, 1 - Math.pow(normalizedDist, 2)), 1.5);

        const C = baseLch.C * chromaMult * falloff;
        const H = baseLch.h;

        const lab = oklchToOklab(L, C, H);
        const hex = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));

        return { step, hex, l: L, c: C, h: H };
    });
}
