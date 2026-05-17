// engine/algo.standard.js
// V9 Standard Tonal Scale - Sigmoidal Continuity

import { oklchToOkluv, okluvToOklch } from './engine.math.js';
import { getPerceptualCompensation } from './engine.curves.js';
import { EngineState } from './engine.core.js';

export function generateStandardScale(baseLch, steps, isDarkMode) {
    const shaping = EngineState.mode.chromaShapingFactor ?? 1.0;

    return steps.map(step => {
        const L = 1 - (step / 1000);

        // V9 Sigmoidal Transition: Smooth entry into sRGB gamut.
        // chromaShapingFactor (0.5 - 1.5) modulates the steepness of the curve.
        const k = 6.0 * shaping;
        const sigmoid = (x) => 1 / (1 + Math.exp(-k * (x - 0.5)));

        const normalizedDist = (L > baseLch.L)
            ? (L - baseLch.L) / (1 - baseLch.L || 0.01)
            : (baseLch.L - L) / (baseLch.L || 0.01);

        // Map sigmoid to ensure falloff is exactly 1.0 at normalizedDist=0 and 0.0 at normalizedDist=1
        const s0 = sigmoid(-0.5);
        const s1 = sigmoid(0.5);
        const t = (sigmoid(normalizedDist - 0.5) - s0) / (s1 - s0);
        const falloff = Math.max(0, 1 - t);

        const { chromaScale, lBias } = getPerceptualCompensation({ L, C: baseLch.C, h: baseLch.h });

        let adjustedL = Math.max(0.0001, Math.min(0.9999, L + lBias * Math.max(0, falloff) * 0.4));
        let C = baseLch.C * Math.max(0, falloff) * chromaScale;
        const H = baseLch.h;

        if (EngineState.mode.interpolation === 'okluv') {
            const uv = oklchToOkluv(baseLch.L, baseLch.C, baseLch.h);
            const luv = okluvToOklch(adjustedL, uv.saturation * Math.max(0, falloff) * chromaScale, H);
            C = luv.C;
        }

        return { step, l: adjustedL, c: C, h: H };
    });
}
