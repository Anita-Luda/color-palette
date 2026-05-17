// engine/algo.boosts.js
// V9 Boost Engine: Correct Masking & Multi-layer Logic

export function applyBoosts(swatch, baseLch, mode) {
    let { l, c, h } = swatch;

    // --- 1. LIGHT MODE BOOST: Correcting "Olive Mud" in Yellow shades ---
    if (mode.lightModeBoost) {
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
        l = l * 0.15 + 0.85 * Math.pow(l, 0.7);
    }

    // --- 3. NEON: Maximum intensity ---
    if (mode.neonBoost) {
        c = 0.5; // Will be clamped by orchestrator
    }

    // --- 4. GLASSMORPHISM: Legibility Logic ---
    if (mode.glassmorphismBoost) {
        if (l > 0.8) l = 0.8 + (l - 0.8) * 1.5; // Highlight Boost
        else if (l < 0.25) l = l * 0.5;         // Shadow Drop
        if (l > 0.35 && l < 0.75) c *= 1.4;    // Saturation Pump
    }

    // --- 5. INK-SAVE: Toner conservation (CMYK-like thresholding) ---
    if (mode.inkSaveMode) {
        // Quantize lightness to 5 levels to reduce screen tinting (0, 0.25, 0.5, 0.75, 1)
        l = Math.round(l * 4) / 4;

        // Threshold chroma: if saturation is low, kill it (Pure K).
        // If high, snap to a solid color to avoid "toner dots" (100% C/M/Y mix)
        if (c < 0.04) {
            c = 0;
        } else {
            c = Math.max(c, 0.15); // Solid fill
            // Snap Hue to primary/secondary CMY anchors (0, 60, 120, 180, 240, 300)
            h = Math.round(h / 60) * 60;
        }
    }

    return { ...swatch, l, c, h };
}
