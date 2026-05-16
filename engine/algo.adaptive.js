// engine/algo.adaptive.js
// Adaptive Perceptual algorithm - V5 Design-Focused Rebuild

import { oklchToOklab, oklabToRgb, rgbToHex, maxChromaForL } from './engine.math.js';
import { getPerceptualCompensation, getHuePathShift } from './engine.curves.js';
import { EngineState } from './engine.core.js';

/**
 * Robust piece-wise power curve to ensure smoothness while hitting the anchor point.
 * Maps t [0..1] to L [L_max..L_min] passing through (t_base, L_base).
 */
function adaptiveLightness(t, t_base, L_base) {
    const L_max = 0.98;
    const L_min = 0.04;

    if (t <= t_base) {
        if (t_base < 0.001) return L_base;
        // Ease from L_max to L_base
        const p = Math.log((L_base - L_max) / (L_min - L_max) || 0.001) / Math.log(t_base || 0.001); // fallback
        // Simple linear interpolation for the upper half is often safer for UI
        const ratio = t / t_base;
        return L_max + (L_base - L_max) * Math.pow(ratio, 1.2);
    } else {
        if (t_base > 0.999) return L_base;
        // Ease from L_base to L_min
        const ratio = (t - t_base) / (1 - t_base);
        return L_base + (L_min - L_base) * Math.pow(ratio, 1.2);
    }
}

export function generateAdaptiveScale(baseLch, steps, isDarkMode) {
    const anchorStep = Math.round((1 - baseLch.L) * 1000);
    const t_base = anchorStep / 1000;

    const profile = EngineState.mode.gamutProfile || 'srgb';

    // Base intensity: how saturated is the color relative to its potential?
    const baseMaxC = maxChromaForL(baseLch.L, baseLch.h, profile);
    const intensity = baseMaxC > 0.01 ? (baseLch.C / baseMaxC) : 0;

    return steps.map(step => {
        const t = step / 1000;
        let L = adaptiveLightness(t, t_base, baseLch.L);

        // Perceptual hue-dependent adjustments for lightness
        const { chromaScale, lBias } = getPerceptualCompensation({ L, C: baseLch.C, h: baseLch.h });

        // Apply bias but damp it near extremes to prevent clamping artifacts
        const edgeDamping = Math.sin(t * Math.PI);
        L = Math.max(0, Math.min(1, L + lBias * edgeDamping));

        // Dynamic Hue Path
        const hShift = getHuePathShift({ L, h: baseLch.h }, baseLch.L);
        const H = (baseLch.h + hShift + 360) % 360;

        const stepMaxC = maxChromaForL(L, H, profile);

        // Adaptive Chroma logic:
        // We want to preserve the "character" (intensity) of the base color.
        // But we damp it toward 0 at the extremes and
        // prevent "vibrating" jumps by using a smooth falloff.
        const falloff = Math.pow(Math.sin(t * Math.PI), 0.8);

        // Target chroma based on base intensity
        let C = stepMaxC * intensity * falloff * chromaScale;

        // Guard against "broken" extremes
        if (t < 0.02 || t > 0.98) C = 0;

        if (isDarkMode) {
            // Dark mode comfort damping
            C *= (0.7 + 0.3 * (1 - L));
        }

        const lab = oklchToOklab(L, C, H);
        const hex = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));

        return { step, hex, l: L, c: C, h: H };
    });
}
