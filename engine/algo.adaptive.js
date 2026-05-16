// engine/algo.adaptive.js
// V7 Adaptive Scale - Linear Stability

import { maxChromaForL } from './engine.math.js';
import { getPerceptualCompensation, getHuePathShift } from './engine.curves.js';
import { EngineState } from './engine.core.js';

function adaptiveLightness(t, t_base, L_base) {
    const L_max = 0.98;
    const L_min = 0.04;
    // Linear segments are necessary to avoid "steps" in high-boundary colors like Yellow/Cyan
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

    // Technical max for base
    const baseMaxC = maxChromaForL(baseLch.L, baseLch.h, profile);
    const intensity = baseMaxC > 0.001 ? (baseLch.C / baseMaxC) : 0;

    return steps.map(step => {
        const t = step / 1000;
        let L = adaptiveLightness(t, t_base, baseLch.L);

        const { chromaScale, lBias } = getPerceptualCompensation({ L, C: baseLch.C, h: baseLch.h });
        const edgeDamping = Math.sin(t * Math.PI);
        L = Math.max(0.001, Math.min(0.999, L + lBias * edgeDamping * 0.4));

        const hShift = getHuePathShift({ L, h: baseLch.h }, baseLch.L);
        const H = (baseLch.h + hShift + 360) % 360;

        // Adaptive target chroma: find max capacity for this specific tone
        const stepMaxC = maxChromaForL(L, H, profile);

        // Bell falloff to ensure smooth convergence to 0 at extremes
        const falloff = 1 - Math.pow(2 * t - 1, 4);
        let C = stepMaxC * intensity * Math.max(0, falloff) * chromaScale;

        return { step, l: L, c: C, h: H };
    });
}
