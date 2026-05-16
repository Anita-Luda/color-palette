// engine/algo.standard.js
// Standard Tonal Engine - V6 Absolute Stability

import { oklchToOkluv, okluvToOklch } from './engine.math.js';
import { getPerceptualCompensation } from './engine.curves.js';
import { EngineState } from './engine.core.js';

export function generateStandardScale(baseLch, steps, isDarkMode) {
    return steps.map(step => {
        const L = 1 - (step / 1000);

        let chromaMult = 1.0;
        if (isDarkMode) chromaMult = 0.65 + 0.35 * (1 - L);

        const normalizedDist = (L > baseLch.L)
            ? (L - baseLch.L) / (1 - baseLch.L || 0.01)
            : (baseLch.L - L) / (baseLch.L || 0.01);

        // Smooth parabolic falloff
        const falloff = Math.max(0, 1 - Math.pow(normalizedDist, 2.2));

        const { chromaScale, lBias } = getPerceptualCompensation({ L, C: baseLch.C, h: baseLch.h });

        let adjustedL = Math.max(0.001, Math.min(0.999, L + lBias * falloff * 0.5));
        let C = baseLch.C * chromaMult * falloff * chromaScale;
        const H = baseLch.h;

        if (EngineState.mode.interpolation === 'okluv') {
            const uv = oklchToOkluv(baseLch.L, baseLch.C, baseLch.h);
            const luv = okluvToOklch(adjustedL, uv.saturation * falloff * chromaMult * chromaScale, H);
            C = luv.C;
        }

        return { step, l: adjustedL, c: C, h: H };
    });
}
