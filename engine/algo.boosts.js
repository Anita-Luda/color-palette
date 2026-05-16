// engine/algo.boosts.js
// V7 Design-First Boosts: Fully operational in Light & Dark modes.

export function applyBoosts(swatch, baseLch, mode) {
    let { l, c, h } = swatch;

    // --- 1. PASTEL: Fresh tones, full range (0-1000) ---
    // User: "zachowana pełna skala tonalna od białego do czarnego."
    if (mode.pastelBoost) {
        // Desaturate and slightly shift towards light, but keep shadows dark.
        // We use a non-linear compression to keep the high-key feel in lights.
        c = 0.05 + (c * 0.15); // Fresh target chroma
        l = 0.1 * l + 0.9 * Math.pow(l, 0.7); // Lighten highlights more than shadows
    }

    // --- 2. GLASSMORPHISM: Depth & Legibility ---
    if (mode.glassmorphismBoost) {
        // Highlight Boost for lights (900-1000)
        if (l > 0.85) {
            l = 0.85 + (l - 0.85) * 1.5;
        }
        // Shadow Drop for darks (50-200)
        else if (l < 0.25) {
            l = l * 0.5;
        }
        // Saturation Pump for mids (400-700)
        if (l > 0.35 && l < 0.75) {
            c *= 1.35;
        }
    }

    // --- 3. NEON: Vibrancy pop ---
    if (mode.neonBoost) {
        c = 0.45; // Orchestrator will clamp this to technical max
    }

    // --- 4. INK-SAVE: Agresive print optimization ---
    if (mode.inkSaveMode) {
        // Save toner by desaturating all non-essential ink
        if (l > 0.1) c *= 0.1;
        if (l > 0.5) l = 0.5 + (l - 0.5) * 1.3; // Lighten paper-areas
    }

    // --- 5. SPECTRAL BALANCE (H-K effect) ---
    if (mode.spectralBalance) {
        l = Math.max(0.01, l - c * 0.22);
    }

    // --- 6. DARK MODE BOOST: Contrast on black ---
    // This shift helps legibility specifically on OLED/Perfect blacks
    if (mode.darkModeBoost) {
        if (h > 200 && h < 280) h -= 12; // Cyan-ish blues
        if (h > 40 && h < 120) h += 12;  // Orange-ish yellows
        if (l > 0.4) c *= 1.4;
    }

    return { ...swatch, l, c, h };
}
