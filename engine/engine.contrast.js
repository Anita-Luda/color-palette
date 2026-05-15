import { EngineState } from './engine.core.js';
import { getBaseLCH, generateScaleForLCH } from './engine.scales.js';
import {
    oklchToOklab, oklabToRgb, rgbToHex,
    oklabToOklch, rgbToOklab, srgbToLinear
} from './engine.math.js';
import { contrastRatio, apcaContrast } from './engine.accessibility.js';
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
function findColorByContrast(baseHex, targetRatio, direction, hue, chroma, algo = 'wcag') {
    let low = 0;
    let high = 1;
    let bestL = direction === 'lighter' ? 1 : 0;

    const getRatio = (hex) => {
        if (algo === 'apca') return Math.abs(apcaContrast(hex, baseHex));
        return contrastRatio(baseHex, hex);
    };

    // Binary search for Lightness
    for (let i = 0; i < 15; i++) {
        const mid = (low + high) / 2;
        const lab = oklchToOklab(mid, chroma, hue);
        const rgb = oklabToRgb(lab.L, lab.a, lab.b);
        const hex = rgbToHex(rgb);
        const currentRatio = getRatio(hex);

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

    const { algorithm, brightness, boost, ignoredThresholds } = EngineState.contrastSettings;
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

        const getRawRatio = (a, b) => algorithm === 'apca' ? Math.abs(apcaContrast(a, b)) : contrastRatio(a, b);

        const maxRatio = getRawRatio(bgHex, extremeHex);

        // Thresholds mapping WCAG vs APCA
        // Lvl1: 3:1 vs Lc 30
        // AA: 4.5:1 vs Lc 60
        // AAA: 7:1 vs Lc 90
        const thBaseL1 = algorithm === 'apca' ? 30 : 3.0;
        const thBaseAA = algorithm === 'apca' ? 60 : 4.5;
        const thBaseAAA = algorithm === 'apca' ? 90 : 7.0;

        // Roughly find achievable boost for APCA too.
        // For WCAG: B^2 + 7.5B + 13.5 - maxRatio = 0
        // For APCA: Simple linear scaling for now as Lc is linear-ish perceptually
        let achievableBoost = boost;
        if (algorithm === 'wcag') {
            const delta = 7.5 * 7.5 - 4 * (13.5 - maxRatio);
            if (delta >= 0) {
                const maxB = (-7.5 + Math.sqrt(delta)) / 2;
                achievableBoost = Math.max(0, Math.min(boost, maxB));
            } else achievableBoost = 0;
        } else {
            // APCA Boost: try to keep sum of Lc (BG->L1 + L1->AA) <= maxRatio
            // Lc(BG, L1) = 30 + B
            // Lc(L1, AA) = 60 + B
            // Approx Lc(BG, AA) = Lc(BG, L1) + Lc(L1, AA) = 90 + 2B
            // So 90 + 2B <= maxRatio => B = (maxRatio - 90)/2
            const maxB = (maxRatio - 90) / 2;
            achievableBoost = Math.max(0, Math.min(boost * 15, maxB)); // Boost is 0..5, map to Lc scale
        }

        const getAchievableTarget = (base, id) => {
            if (ignoredThresholds.includes(id)) return algorithm === 'apca' ? 0 : 1.0;
            return base + achievableBoost;
        };

        const row = { bg: bgHex };
        const forbidden = [bgHex];

        const findUnique = (target, base, dir) => {
            let color = findColorByContrast(base, target, dir, lch.h, lch.C, algorithm);
            color = ensureUnique(color, forbidden, lch, dir);
            forbidden.push(color);
            return color;
        };

        const tL1 = getAchievableTarget(thBaseL1, 'L1_BG');
        row.l1 = findUnique(tL1, bgHex, direction);
        row.l1_target = tL1;
        row.l1_actual = getRawRatio(bgHex, row.l1);

        const t45bg = getAchievableTarget(thBaseAA, 'C45_BG');
        row.c45_bg = findUnique(t45bg, bgHex, direction);
        row.c45_bg_target = t45bg;
        row.c45_bg_actual = getRawRatio(bgHex, row.c45_bg);

        const t45l1 = getAchievableTarget(thBaseAA, 'C45_L1');
        row.c45_l1 = findUnique(t45l1, row.l1, direction);
        row.c45_l1_target = t45l1;
        row.c45_l1_actual = getRawRatio(row.l1, row.c45_l1);

        const t7bg = getAchievableTarget(thBaseAAA, 'C7_BG');
        row.c7_bg = findUnique(t7bg, bgHex, direction);
        row.c7_bg_target = t7bg;
        row.c7_bg_actual = getRawRatio(bgHex, row.c7_bg);

        const tL2 = getAchievableTarget(thBaseL1, 'L2_L1');
        row.l2 = findUnique(tL2, row.l1, direction);
        row.l2_target = tL2;
        row.l2_actual = getRawRatio(row.l1, row.l2);

        const baseLab = oklchToOklab(lch.L, lch.C, lch.h);
        row.baseContrast = getRawRatio(bgHex, rgbToHex(oklabToRgb(baseLab.L, baseLab.a, baseLab.b)));
        grid.push(row);
    }

    return grid;
}
