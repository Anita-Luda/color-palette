// engine/engine.glass.js
// Logic for Glassmorphism View: BG, Glass, Border layers.

import { EngineState } from './engine.core.js';
import { getBaseLCH, generateScaleForLCH } from './engine.scales.js';
import { getAdditionalPalettes } from './engine.palettes.js';

export function generateGlassData(targetLch) {
    const lch = targetLch || getBaseLCH();
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
            glassFillHex: lchToHex_local(glassFillL, lch.C * 0.5, lch.h), // Softened
            glassBorderHex: lchToHex_local(glassBorderL, lch.C * 0.8, lch.h)
        };
    });
}

function lchToHex_local(L, C, H) {
    // Simplified conversion for fast preview
    const hr = H * Math.PI / 180;
    const a = Math.cos(hr) * C;
    const b = Math.sin(hr) * C;

    const l_ = L + 0.3963377774*a + 0.2158037573*b;
    const m_ = L - 0.1055613458*a - 0.0638541728*b;
    const s_ = L - 0.0894841775*a - 1.2914855480*b;
    const l = Math.max(0, l_**3), m = Math.max(0, m_**3), s = Math.max(0, s_**3);
    let r =  4.0767416621*l - 3.3077115913*m + 0.2309699292*s;
    let g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s;
    let b2= -0.0041960863*l - 0.7034186147*m + 1.7076147010*s;

    const f = (c) => Math.round(Math.max(0, Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)) * 255);
    return `#${((1<<24)+(f(r)<<16)+(f(g)<<8)+f(b2)).toString(16).slice(1)}`;
}
