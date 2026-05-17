// engine/engine.glass.js
// Logic for Glassmorphism View: BG, Glass, Border layers.

import { EngineState } from './engine.core.js';
import { getBaseLCH, generateScaleForLCH } from './engine.scales.js';
import { getAdditionalPalettes } from './engine.palettes.js';
import { oklchToOklab, oklabToRgb, rgbToHex } from './engine.math.js';

export function generateGlassData(targetLch) {
    const bubbleSource = EngineState.mode.glassBubbleSource;
    let lch;

    if (bubbleSource === 'base') {
        lch = targetLch || getBaseLCH();
    } else {
        const additional = getAdditionalPalettes();
        const p = additional.find(p => p.index === bubbleSource);
        if (p) {
            const anchor = p.scale.find(s => s.isBase) || p.scale[Math.floor(p.scale.length/2)];
            lch = { L: anchor.l, C: anchor.c, h: anchor.h };
        } else {
            lch = targetLch || getBaseLCH();
        }
    }

    const bgSource = EngineState.mode.glassBackgroundSource;

    let bgLch;
    if (bgSource === 'base') {
        bgLch = getBaseLCH();
    } else {
        const additional = getAdditionalPalettes();
        const p = additional.find(p => p.index === bgSource);
        if (p) {
            const anchor = p.scale.find(s => s.isBase) || p.scale[Math.floor(p.scale.length / 2)];
            bgLch = { L: anchor.l, C: anchor.c, h: anchor.h };
        } else {
            bgLch = getBaseLCH();
        }
    }

    // Tonal scale for background
    const bgScale = generateScaleForLCH(bgLch);

    // Logic for 4 states:
    // 1. Light BG, Light Glass
    // 2. Light BG, Dark Glass
    // 3. Dark BG, Light Glass
    // 4. Dark BG, Dark Glass

    const combinations = [
        { name: 'Light BG, Light Glass', bgIdx: 0, glassL: 0.95, glassOpacity: 0.15, borderOpacity: 0.35 },
        { name: 'Light BG, Dark Glass',  bgIdx: 20, glassL: 0.15, glassOpacity: 0.25, borderOpacity: 0.45 },
        { name: 'Dark BG, Light Glass',   bgIdx: 80, glassL: 0.98, glassOpacity: 0.1,  borderOpacity: 0.25 },
        { name: 'Dark BG, Dark Glass',    bgIdx: 100, glassL: 0.05, glassOpacity: 0.3,  borderOpacity: 0.5 }
    ];

    return combinations.map(c => {
        const bgHex = bgScale[c.bgIdx]?.hex || '#ffffff';

        // Generate "Glass UI" tones (modified from target lch)
        const glassFillL = c.glassL;
        const glassBorderL = Math.max(0, Math.min(1, glassFillL + (glassFillL > 0.5 ? 0.05 : -0.05)));

        return {
            ...c,
            bgHex,
            glassFillHex: rgbToHex(oklabToRgb(oklchToOklab(glassFillL, lch.C * 0.5, lch.h).L, oklchToOklab(glassFillL, lch.C * 0.5, lch.h).a, oklchToOklab(glassFillL, lch.C * 0.5, lch.h).b)),
            glassBorderHex: rgbToHex(oklabToRgb(oklchToOklab(glassBorderL, lch.C * 0.8, lch.h).L, oklchToOklab(glassBorderL, lch.C * 0.8, lch.h).a, oklchToOklab(glassBorderL, lch.C * 0.8, lch.h).b))
        };
    });
}
