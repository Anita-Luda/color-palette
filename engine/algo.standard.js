// engine/algo.standard.js
// V7 Standard Scale - Pure Ideal Logic

import { oklchToOkluv, okluvToOklch } from './engine.math.js';
import { getPerceptualCompensation } from './engine.curves.js';
import { EngineState } from './engine.core.js';

export function generateStandardScale(baseLch, steps, isDarkMode) {
    return steps.map(step => {
        const L = 1 - (step / 1000);

        const normalizedDist = (L > baseLch.L)
            ? (L - baseLch.L) / (1 - baseLch.L || 0.01)
            : (baseLch.L - L) / (baseLch.L || 0.01);

        // Smooth parabolic falloff for ideal chroma
        const falloff = Math.max(0, 1 - Math.pow(normalizedDist, 2.0));

        const { chromaScale, lBias } = getPerceptualCompensation({ L, C: baseLch.C, h: baseLch.h });

        // Ideal adjusted L and C
        let adjustedL = Math.max(0.001, Math.min(0.999, L + lBias * falloff * 0.4));
        let C = baseLch.C * falloff * chromaScale;
        const H = baseLch.h;

        if (EngineState.mode.interpolation === 'okluv') {
            const uv = oklchToOkluv(baseLch.L, baseLch.C, baseLch.h);
            const luv = okluvToOklch(adjustedL, uv.saturation * falloff * chromaScale, H);
            C = luv.C;
        }

        return { step, l: adjustedL, c: C, h: H };
    });
}
