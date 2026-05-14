import { EngineState } from './engine.core.js';
import {
    getBaseLCH, oklchToOklab, oklabToRgb, rgbToHex,
    oklabToOklch, rgbToOklab, srgbToLinear, generateScaleForLCH
} from './engine.scales.js';
import { contrastRatio } from './engine.accessibility.js';
import { getAdditionalPalettes } from './engine.palettes.js';

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
        const additional = getAdditionalPalettes();
        const p = additional.find(p => p.index === bgSource);
        if (p) {
            const anchor = p.scale.find(s => s.isBase) || p.scale[Math.floor(p.scale.length / 2)];
            bgLch = { L: anchor.l, C: anchor.c, h: anchor.h };
        } else {
            bgLch = getBaseLCH();
        }
    }

    // Full tonal scale co-10 (101 steps).
    // If scale mode is fixed, we MUST use fixed for background generation too to keep consistency.
    const fullScale = generateScaleForLCH(bgLch);

    // Window of 10 tones
    // slider 0..1 shifts window start from 1..91 (if light) or 0..90?
    // "biały + pierwsze 10" means steps 10, 20... 100 when slider is 0.
    // Index 0 is White (step 0), Index 100 is Black (step 1000).

    const backgrounds = [];
    if (isDark) {
        backgrounds.push("#000000"); // Black

        let startIdx = Math.round(brightness * (fullScale.length - 11));
        for (let i = 1; i <= 10; i++) {
            let idx = (fullScale.length - 1) - (startIdx + i);
            idx = Math.max(0, Math.min(fullScale.length - 1, idx));
            backgrounds.push(fullScale[idx].hex);
        }

        if (brightness > 0.95) backgrounds.push("#FFFFFF");
    } else {
        backgrounds.push("#FFFFFF"); // White

        let startIdx = Math.round(brightness * (fullScale.length - 11));
        for (let i = 1; i <= 10; i++) {
            let idx = startIdx + i;
            idx = Math.max(0, Math.min(fullScale.length - 1, idx));
            backgrounds.push(fullScale[idx].hex);
        }

        if (brightness > 0.95) backgrounds.push("#000000");
    }

    const grid = [];
    const getTarget = (base, id) => {
        if (ignoredThresholds.includes(id)) return 1.0;
        return base + boost;
    };

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

        // Calculate maximum possible contrast boost for this row
        const extremeHex = direction === 'darker' ? '#000000' : '#FFFFFF';
        const maxRatio = contrastRatio(bgHex, extremeHex);

        // Boost can only go up to what's achievable for ALL required thresholds in the row
        // Lvl1, AA (4.5), AAA (7) relative to BG
        // Lvl2 (3), AA (4.5) relative to Lvl1
        // The most restrictive is AA (4.5) relative to Lvl1, but Lvl1 itself is pushed by boost.
        // If boost is B, Lvl1 target is 3+B. Then Lvl2 target is 4.5+B relative to Lvl1.
        // Rough estimate of required total ratio to background: (3+B) * (4.5+B)
        // Let's find B such that (3+B)*(4.5+B) <= maxRatio
        // B^2 + 7.5B + 13.5 - maxRatio = 0
        // Quadratic formula: B = (-7.5 + sqrt(7.5^2 - 4 * (13.5 - maxRatio))) / 2

        let achievableBoost = boost;
        const delta = 7.5 * 7.5 - 4 * (13.5 - maxRatio);
        if (delta >= 0) {
            const maxB = (-7.5 + Math.sqrt(delta)) / 2;
            achievableBoost = Math.max(0, Math.min(boost, maxB));
        } else {
            achievableBoost = 0;
        }

        const getAchievableTarget = (base, id) => {
            if (ignoredThresholds.includes(id)) return 1.0;
            return base + achievableBoost;
        };

        const row = { bg: bgHex };
        const forbidden = [bgHex];

        const findUnique = (target, base, dir) => {
            let color = findColorByContrast(base, target, dir, lch.h, lch.C);
            color = ensureUnique(color, forbidden, lch, dir);
            forbidden.push(color);
            return color;
        };

        const tL1 = getAchievableTarget(3.0, 'L1_BG');
        row.l1 = findUnique(tL1, bgHex, direction);
        row.l1_target = tL1;
        row.l1_actual = contrastRatio(bgHex, row.l1);

        const t45bg = getAchievableTarget(4.5, 'C45_BG');
        row.c45_bg = findUnique(t45bg, bgHex, direction);
        row.c45_bg_target = t45bg;
        row.c45_bg_actual = contrastRatio(bgHex, row.c45_bg);

        const t45l1 = getAchievableTarget(4.5, 'C45_L1');
        row.c45_l1 = findUnique(t45l1, row.l1, direction);
        row.c45_l1_target = t45l1;
        row.c45_l1_actual = contrastRatio(row.l1, row.c45_l1);

        const t7bg = getAchievableTarget(7.0, 'C7_BG');
        row.c7_bg = findUnique(t7bg, bgHex, direction);
        row.c7_bg_target = t7bg;
        row.c7_bg_actual = contrastRatio(bgHex, row.c7_bg);

        const tL2 = getAchievableTarget(3.0, 'L2_L1');
        row.l2 = findUnique(tL2, row.l1, direction);
        row.l2_target = tL2;
        row.l2_actual = contrastRatio(row.l1, row.l2);

        const baseLab = oklchToOklab(lch.L, lch.C, lch.h);
        row.baseContrast = contrastRatio(bgHex, rgbToHex(oklabToRgb(baseLab.L, baseLab.a, baseLab.b)));
        grid.push(row);
    }

    return grid;
}
