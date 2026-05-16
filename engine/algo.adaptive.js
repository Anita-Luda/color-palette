// engine/algo.adaptive.js
// V8 Adaptive Scale - Character Preservation

import { maxChromaForL } from './engine.math.js';
import { getPerceptualCompensation, getHuePathShift } from './engine.curves.js';
import { EngineState } from './engine.core.js';

function adaptiveLightness(t, t_base, L_base) {
    const L_max = 0.98;
    const L_min = 0.04;
    // Piece-wise linear ensures the anchor is always hit perfectly.
    if (t <= t_base) {
        if (t_base < 0.001) return L_base;
        return L_max + (L_base - L_max) * (t / t_base);
    } else {
        if (t_base > 0.999) return L_base;
        return L_base + (L_min - L_base) * ((t - t_base) / (1 - t_base));
    }
}

export function generateAdaptiveScale(baseLch, steps, isDarkMode) {
    const anchorStep = Math.round((1 - baseLch.L) * 1000);
    const t_base = anchorStep / 1000;
    const profile = EngineState.mode.gamutProfile || 'srgb';

    // Intensity is the relative position of the base color within its current gamut limit.
    const baseMaxC = maxChromaForL(baseLch.L, baseLch.h, profile);
    const intensity = baseMaxC > 0.005 ? (baseLch.C / baseMaxC) : 0;

    return steps.map(step => {
        const t = step / 1000;
        let L = adaptiveLightness(t, t_base, baseLch.L);

        const { chromaScale, lBias } = getPerceptualCompensation({ L, C: baseLch.C, h: baseLch.h });
        const edgeDamping = Math.sin(t * Math.PI);
        L = Math.max(0.0001, Math.min(0.9999, L + lBias * edgeDamping * 0.4));

        const hShift = getHuePathShift({ L, h: baseLch.h }, baseLch.L);
        const H = (baseLch.h + hShift + 360) % 360;

        // In Adaptive mode, we maintain character by aiming for the same RELATIVE saturation
        // throughout the scale. This prevents the "graying out" in highlights.
        const stepMaxC = maxChromaForL(L, H, profile);

        // Bell-shaped falloff to prevent spikes at extremes, but keep it high in mids/lights
        const falloff = Math.pow(Math.sin(t * Math.PI), 0.5);
        let C = stepMaxC * intensity * falloff * chromaScale;

        return { step, l: L, c: C, h: H };
    });
}
