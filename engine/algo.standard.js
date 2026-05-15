// engine/algo.standard.js
// Rebuilt: simplest possible tonal scale with smooth visual blending.

import { oklchToOklab, oklabToRgb, rgbToHex, oklchToOkluv, okluvToOklch } from './engine.math.js';
import { getPerceptualCompensation } from './engine.curves.js';
import { EngineState } from './engine.core.js';

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

        // Cubic Easing for Chroma Falloff (Non-linear Chroma Curve)
        const shaping = EngineState.mode.chromaShapingFactor || 1.0;
        const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic

        // We use easeInCubic for tints (L > base) and easeOutCubic for shades (L < base)
        const t = normalizedDist;
        const curve = (L > baseLch.L)
            ? 1 - Math.pow(t, 3 * shaping) // easeIn-like
            : Math.pow(1 - t, 3 / shaping); // easeOut-like

        const falloff = Math.max(0, curve);

        // Perceptual hue-dependent adjustments
        const { chromaScale, lBias } = getPerceptualCompensation({ L, C: baseLch.C, h: baseLch.h });

        let adjustedL = Math.max(0, Math.min(1, L + lBias * falloff));
        let C = baseLch.C * chromaMult * falloff * chromaScale;
        const H = baseLch.h;

        // OKLUV Interpolation Support
        if (EngineState.mode.interpolation === 'okluv') {
            const uv = oklchToOkluv(baseLch.L, baseLch.C, baseLch.h);
            const luv = okluvToOklch(adjustedL, uv.saturation * falloff * chromaMult * chromaScale, H);
            C = luv.C;
        }

        const lab = oklchToOklab(adjustedL, C, H);
        const hex = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));

        return { step, hex, l: L, c: C, h: H };
    });
}
