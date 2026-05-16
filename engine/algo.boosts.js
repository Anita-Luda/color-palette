// engine/algo.boosts.js
// V8 Boost Engine: Correct Masking & Multi-layer Logic

export function applyBoosts(swatch, baseLch, mode) {
    let { l, c, h } = swatch;

    // --- 1. LIGHT MODE BOOST: Correcting "Olive Mud" in Yellow shades ---
    if (mode.palette === 'light') {
        // Shift yellows/greens towards warmer orange in shades to avoid green-shift
        if (h > 60 && h < 140 && l < 0.5) {
            const weight = (0.5 - l) * 2;
            h -= 15 * weight;
        }
    }

    // --- 2. PASTEL: Soft character, full range ---
    if (mode.pastelBoost) {
        // Compression towards 0.08 chroma
        c = 0.04 + (c * 0.12);
        // Soft curve that keeps blacks but lifts shadows slightly
        l = l * 0.2 + 0.8 * Math.pow(l, 0.65);
    }

    // --- 3. NEON: Maximum intensity ---
    if (mode.neonBoost) {
        c = 0.5; // Will be clamped by orchestrator
    }

    // --- 4. GLASSMORPHISM: Legibility Logic (Handled in dedicated Glass View, but also here) ---
    if (mode.glassmorphismBoost) {
        if (l > 0.8) l = 0.8 + (l - 0.8) * 1.6; // Highlight
        else if (l < 0.2) l = l * 0.4;         // Shadow
        if (l > 0.3 && l < 0.75) c *= 1.4;    // Saturation Pump
    }

    // --- 5. INK-SAVE: Quantized CMYK Logic ---
    if (mode.inkSaveMode) {
        // Goal: Prevent 'stippling' by forcing channels to solid thresholds.
        // We simulate CMYK quantization by snapping chroma and lightness.
        const snapL = (val) => {
            if (val > 0.85) return 0.98; // Paper white
            if (val > 0.5) return 0.75;
            if (val > 0.2) return 0.35;
            return 0.1; // Dark ink
        };
        const snapC = (val) => {
            if (val < 0.03) return 0;
            if (val < 0.1) return 0.05;
            return 0.1;
        };
        l = snapL(l);
        c = snapC(c);
    }

    return { ...swatch, l, c, h };
}
