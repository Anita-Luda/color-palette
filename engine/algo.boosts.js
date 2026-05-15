// engine/algo.boosts.js
// Post-processing overlays with refined precision

import { oklchToOklab, oklabToRgb, rgbToHex, maxChromaForL } from './engine.math.js';

export function applyBoosts(swatch, baseLch, mode) {
    let { l, c, h } = swatch;

    // 1. Dark Mode Boost: Perceptual identity correction
    if (mode.darkModeBoost) {
        // Correct warmth shift
        if (h >= 180 && h < 300) h = (h - 15 + 360) % 360;
        else if (h >= 0 && h < 60) h = (h - 10 + 360) % 360;
        else if (h >= 60 && h < 180) h = (h + 10) % 360;

        if (l > 0.75) c *= 1.3;
    }

    // 2. Neon Boost: Technical intensity while preserving tonality
    if (mode.neonBoost) {
        const maxC = maxChromaForL(l, h);
        // We boost chroma towards max but keep a significant part of the original rhythm
        c = c * 0.4 + maxC * 0.6;
        c = Math.min(c, maxC * 0.99);

        if (l < 0.1) l = 0.1;
    }

    // 3. Pastel Boost: Fresh tones with preserved tonal hierarchy
    if (mode.pastelBoost) {
        // Requirement: "pastel boost całkowicie traci barwę i kolory zamiast lekkich... robią się brudne"
        // Freshness comes from high Lightness and pure (not gray) barwa.
        // We shift the scale to 0.7 - 0.98 range to preserve hierarchy.
        l = 0.7 + (l * 0.28);

        // C is fixed to a "fresh" range + small influence of base to keep the family feel.
        c = 0.055 + (c * 0.1);
    }

    // 4. Glassmorphism: Lightness for blur transparency
    if (mode.glassmorphismBoost) {
        l = l + (1.0 - l) * 0.22;
        c *= 1.1;
    }

    // 5. Ink-Save: Print optimization
    if (mode.inkSaveMode && l > 0.45) {
        const t = (l - 0.45) / 0.55;
        c *= (1 - t * 0.8);
    }

    // 6. Spectral Balance: Helmholtz–Kohlrausch correction
    if (mode.spectralBalance) {
        const perceived_boost = c * 0.18;
        l = Math.max(0, l - (perceived_boost * Math.min(1, l * 2)));
    }

    const lab = oklchToOklab(l, c, h);
    const rgb = oklabToRgb(lab.L, lab.a, lab.b);
    const hex = rgbToHex(rgb);

    return { ...swatch, hex, l, c, h };
}
