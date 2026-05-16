// engine/algo.boosts.js
// V5 Design-Focused Boosts - Rewritten for predictability and combinability

import { oklchToOklab, oklabToRgb, rgbToHex, maxChromaForL } from './engine.math.js';

export function applyBoosts(swatch, baseLch, mode) {
    let { l, c, h } = swatch;
    const profile = mode.gamutProfile || 'srgb';

    // 1. Dark Mode Boost: Perceptual identity correction
    // Focus: Counter-acting the desaturation of light colors on dark backgrounds
    if (mode.darkModeBoost) {
        // Shift hues away from "dirty" zones on black
        if (h > 60 && h < 160) h += 5; // Greener
        if (h > 240 && h < 300) h -= 5; // Deeper blue

        // Boost light tones chroma to keep them "vibrant" against black
        if (l > 0.6) c *= 1.15;
    }

    // 2. Neon Boost: Technical intensity
    if (mode.neonBoost) {
        const technicalMax = maxChromaForL(l, h, profile);
        // Push toward 90% of gamut capacity to leave some headroom for smoothness
        c = c * 0.4 + (technicalMax * 0.9) * 0.6;
    }

    // 3. Pastel Boost: High-key, fresh tones
    if (mode.pastelBoost) {
        // Compression: move everything to the top 30% of lightness
        l = 0.7 + (l * 0.28);
        // Normalize chroma to a "fresh" low-but-not-gray value
        c = 0.03 + (c * 0.1);
    }

    // 4. Glassmorphism: Legibility behind blur
    if (mode.glassmorphismBoost) {
        // Lighten significantly to compensate for backdrop-filter: blur() darkening
        l = l + (1.0 - l) * 0.3;
        c *= 0.9; // Desaturate slightly for that "frosted" look
    }

    // 5. Ink-Save: Print optimization
    if (mode.inkSaveMode) {
        if (l > 0.5) {
            c *= (1 - (l - 0.5) * 1.5); // Drastic desaturation in highlights
        }
    }

    // 6. Spectral Balance (H-K effect)
    if (mode.spectralBalance) {
        // High chroma colors look brighter than they are. Lower physical L to compensate.
        const correction = c * 0.15;
        l = Math.max(0.02, l - correction);
    }

    // Final safety clamp
    const mC = maxChromaForL(l, h, profile);
    c = Math.min(c, mC);

    const lab = oklchToOklab(l, c, h);
    const rgb = oklabToRgb(lab.L, lab.a, lab.b);
    const hex = rgbToHex(rgb);

    return { ...swatch, hex, l, c, h };
}
