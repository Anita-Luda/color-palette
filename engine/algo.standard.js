// engine/algo.standard.js
// Rebuilt: Purest tonal scale logic for consistent UI palettes.

import { oklchToOklab, oklabToRgb, rgbToHex } from './engine.math.js';

/**
 * Standard tonal algorithm: focuses on smooth, predictable blending.
 * High fidelity to the base color's LCH while tapering chroma at extremes.
 */
export function generateStandardScale(baseLch, steps, isDarkMode) {
    const stepToL = s => 1 - (s / 1000);

    return steps.map(step => {
        const L = stepToL(step);

        // Intensity handling for Dark Mode
        let chromaMult = 1.0;
        if (isDarkMode) {
            // Nonlinear damping: strong in lights, soft in shadows.
            // This ensures colors blend into dark backgrounds without "glowing".
            chromaMult = 0.55 + 0.35 * Math.pow(1 - L, 1.5);
        }

        // Simplest possible falloff:
        // Chroma must converge to zero at absolute white and black.
        // We use a simple linear distance-based falloff centered on base L.
        const dist = Math.abs(L - baseLch.L);
        const maxDist = L > baseLch.L ? (1 - baseLch.L) : baseLch.L;

        let falloff = 1.0;
        if (maxDist > 0) {
            falloff = 1 - (dist / maxDist);
        }

        // We use a slight power to make the transition more "tonal" and less "grey-ish" in the middle.
        falloff = Math.pow(Math.max(0, falloff), 0.7);

        const C = baseLch.C * chromaMult * falloff;
        const H = baseLch.h;

        const lab = oklchToOklab(L, C, H);
        const hex = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));

        return { step, hex, l: L, c: C, h: H };
    });
}
