// engine/engine.curves.js
// Hue-dependent compensation curves for Yellow, Blue, Cyan, Purple

/**
 * Standard hue ranges (approximate center):
 * Yellow: 100
 * Blue: 264
 * Cyan: 195
 * Purple: 300
 * Red: 30
 */

const CURVES = {
    yellow: {
        hue: 100,
        range: 40,
        chromaMultiplier: 0.75, // Yellow is naturally high-chroma, needs damping
        lightnessBias: 0.05,    // Shift white-point earlier
    },
    blue: {
        hue: 264,
        range: 50,
        chromaMultiplier: 1.25, // Blue loses perceived chroma quickly, needs boost
        lightnessBias: -0.05,
    },
    cyan: {
        hue: 195,
        range: 30,
        chromaMultiplier: 1.1,
        lightnessBias: 0.0,
    },
    purple: {
        hue: 300,
        range: 40,
        chromaMultiplier: 1.15,
        lightnessBias: -0.02,
    }
};

function getHueWeight(hue, targetHue, range) {
    const diff = Math.min(Math.abs(hue - targetHue), 360 - Math.abs(hue - targetHue));
    if (diff > range) return 0;
    // Cosine falloff
    return 0.5 * (1 + Math.cos(Math.PI * diff / range));
}

export function getPerceptualCompensation(lch) {
    let chromaScale = 1.0;
    let lBias = 0.0;

    for (const key in CURVES) {
        const c = CURVES[key];
        const weight = getHueWeight(lch.h, c.hue, c.range);
        chromaScale += (c.chromaMultiplier - 1) * weight;
        lBias += c.lightnessBias * weight;
    }

    return { chromaScale, lBias };
}

// --- Hue Path (Dynamic Hue-Shift) ---

const HUE_PATHS = {
    yellow: { hue: 100, range: 30, shadeShift: -4, tintShift: 2 },
    blue: { hue: 264, range: 40, shadeShift: 2, tintShift: -2 },
    red: { hue: 30, range: 30, shadeShift: -3, tintShift: 3 },
    cyan: { hue: 195, range: 30, shadeShift: 3, tintShift: -3 }
};

export function getHuePathShift(lch, baseL) {
    let totalShift = 0;
    const isShade = lch.L < baseL;
    const intensity = Math.abs(lch.L - baseL);

    for (const key in HUE_PATHS) {
        const p = HUE_PATHS[key];
        const weight = getHueWeight(lch.h, p.hue, p.range);
        const shift = isShade ? p.shadeShift : p.tintShift;
        totalShift += shift * weight * intensity;
    }

    return totalShift;
}
