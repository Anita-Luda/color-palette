import { EngineState } from './engine.core.js';
import { getBaseLCH, oklchToOklab, oklabToRgb, rgbToHex, oklabToOklch, rgbToOklab, srgbToLinear } from './engine.scales.js';
import { contrastRatio } from './engine.accessibility.js';

function LToStep(L){
    return Math.round((1 - L) * 1000);
}

function rgbToOklab_local(hex) {
    const h = hex.replace('#','');
    const r = parseInt(h.slice(0,2),16);
    const g = parseInt(h.slice(2,4),16);
    const b = parseInt(h.slice(4,6),16);
    return rgbToOklab(r, g, b);
}

/**
 * Finds a color with a specific contrast ratio relative to a base color.
 */
function findColorByContrast(baseHex, targetRatio, direction, hue, chroma) {
    let low = 0;
    let high = 1;
    let bestL = direction === 'lighter' ? 1 : 0;

    // Binary search for Lightness
    for (let i = 0; i < 15; i++) {
        const mid = (low + high) / 2;
        const lab = oklchToOklab(mid, chroma, hue);
        const rgb = oklabToRgb(lab.L, lab.a, lab.b);
        const hex = rgbToHex(rgb);
        const currentRatio = contrastRatio(baseHex, hex);

        if (currentRatio < targetRatio) {
            if (direction === 'lighter') low = mid;
            else high = mid;
        } else {
            bestL = mid;
            if (direction === 'lighter') high = mid;
            else low = mid;
        }
    }

    const lab = oklchToOklab(bestL, chroma, hue);
    return rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));
}

import { generateScaleForLCH } from './engine.scales.js';

function ensureUnique(hex, forbidden, lch, direction) {
    let currentHex = hex;
    let currentL = rgbToOklab_local(hex).L;
    let attempts = 0;
    while (forbidden.includes(currentHex) && attempts < 20) {
        if (direction === 'lighter') currentL += 0.01;
        else currentL -= 0.01;
        currentL = Math.max(0, Math.min(1, currentL));
        const lab = oklchToOklab(currentL, lch.C, lch.h);
        currentHex = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));
        attempts++;
    }
    return currentHex;
}

export function generateContrastGrid(targetLch) {
    let lch = targetLch || getBaseLCH();
    lch = {
        L: lch.L !== undefined ? lch.L : (lch.l !== undefined ? lch.l : 0.5),
        C: lch.C !== undefined ? lch.C : (lch.c !== undefined ? lch.c : 0.1),
        h: lch.h !== undefined ? lch.h : 0
    };

    const { brightness, boost, ignoredThresholds } = EngineState.contrastSettings;
    const isDark = EngineState.mode.palette === 'dark';
    const bgSource = EngineState.mode.backgroundSource;

    // Get background palette
    let bgLch;
    if (bgSource === 'base') {
        bgLch = getBaseLCH();
    } else {
        const color = EngineState.colors[bgSource];
        bgLch = color && color.manualLCH ? color.manualLCH : getBaseLCH();
    }

    // Full tonal scale co-10 (101 steps)
    const fullScale = generateScaleForLCH(bgLch);

    // Window of 10 tones
    // slider 0..1 shifts window start from 1..91 (if light) or 0..90?
    // "biały + pierwsze 10" means steps 10, 20... 100 when slider is 0.
    // Index 0 is White (step 0), Index 100 is Black (step 1000).

    const backgrounds = [];
    if (isDark) {
        backgrounds.push("#000000"); // Black
        let startIdx = Math.round(brightness * 90);
        for (let i = 1; i <= 10; i++) {
            let idx = 100 - (startIdx + i);
            idx = Math.max(0, Math.min(99, idx));
            backgrounds.push(fullScale[idx].hex);
        }
        // "dla maksymalnej jasności tła w dark mode dodawaj biały"
        if (brightness > 0.95) {
            backgrounds.push("#FFFFFF");
        }
    } else {
        backgrounds.push("#FFFFFF"); // White
        let startIdx = Math.round(brightness * 90);
        for (let i = 1; i <= 10; i++) {
            let idx = startIdx + i;
            idx = Math.max(1, Math.min(100, idx));
            backgrounds.push(fullScale[idx].hex);
        }
        // "dla maksymalnej ciemności tła w light mode dodawaj czarny"
        if (brightness > 0.95) {
            backgrounds.push("#000000");
        }
    }

    const grid = [];
    const getTarget = (base) => {
        if (ignoredThresholds.includes(base)) return 1.0;
        return base + boost;
    };

    const t3 = getTarget(3.0);
    const t45 = getTarget(4.5);
    const t7 = getTarget(7.0);

    for (let i = 0; i < backgrounds.length; i++) {
        let bgHex = backgrounds[i];

        // Ensure row uniqueness
        if (i > 0 && bgHex === backgrounds[i-1]) {
            // Tweak it slightly if it's not unique
            let lab = rgbToOklab_local(bgHex);
            let dir = isDark ? 0.005 : -0.005;
            lab.L = Math.max(0, Math.min(1, lab.L + dir));
            bgHex = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));
            backgrounds[i] = bgHex;
        }

        const bgLab = rgbToOklab_local(bgHex);
        const direction = bgLab.L > 0.5 ? 'darker' : 'lighter';

        const row = { bg: bgHex };
        const forbidden = [bgHex];

        const findUnique = (target, base, dir) => {
            let color = findColorByContrast(base, target, dir, lch.h, lch.C);
            color = ensureUnique(color, forbidden, lch, dir);
            forbidden.push(color);
            return color;
        };

        row.l1 = findUnique(t3, bgHex, direction);
        row.c45_bg = findUnique(t45, bgHex, direction);
        row.c45_l1 = findUnique(t45, row.l1, direction);
        row.c7_bg = findUnique(t7, bgHex, direction);
        row.c7_l1 = findUnique(t7, row.l1, direction);
        row.l2 = findUnique(t3, row.l1, direction);
        row.c45_l2 = findUnique(t45, row.l2, direction);
        row.c7_l2 = findUnique(t7, row.l2, direction);

        row.baseContrast = contrastRatio(bgHex, rgbToHex(oklabToRgb(oklchToOklab(lch.L, lch.C, lch.h))));
        grid.push(row);
    }

    return grid;
}
