// engine/algo.boosts.js
// V6 Design-Focused Boosts - REFACTORED FOR FRESHNESS & RELIABILITY

export function applyBoosts(swatch, baseLch, mode) {
    let { l, c, h } = swatch;

    // 1. Dark Mode Boost: Readability on dark
    if (mode.darkModeBoost) {
        // Shift warm colors toward red, cool toward cyan
        if (h > 40 && h < 120) h += 10;
        if (h > 200 && h < 280) h -= 10;
        // Boost vibrancy of light tones to pop against black
        if (l > 0.4) c *= 1.35;
    }

    // 2. Neon Boost: High-vibrancy pop
    if (mode.neonBoost) {
        // High constant chroma target for "vibrancy", orchestrator will clamp to gamut.
        c = 0.45;
    }

    // 3. Pastel Boost: Clean, fresh high-key
    if (mode.pastelBoost) {
        // Force high lightness and very clean, fresh low-chroma
        l = 0.85 + (l * 0.13);
        c = 0.05;
    }

    // 4. Glassmorphism Boost: Frosted glass effect
    if (mode.glassmorphismBoost) {
        l = l * 0.15 + 0.85;
        c = 0.04;
    }

    // 5. Ink-Save Mode: Print optimization
    if (mode.inkSaveMode) {
        if (l > 0.4) c = 0.01;
    }

    // 6. Spectral Balance (H-K effect)
    if (mode.spectralBalance) {
        // Physical darkening to equalize perceived brightness
        l = Math.max(0.04, l - c * 0.3);
    }

    return { ...swatch, l, c, h };
}
