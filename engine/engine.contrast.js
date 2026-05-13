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

export function generateContrastGrid(targetLch) {
    let lch = targetLch || getBaseLCH();
    // Normalize LCH: support both lowercase and uppercase keys
    lch = {
        L: lch.L !== undefined ? lch.L : (lch.l !== undefined ? lch.l : 0.5),
        C: lch.C !== undefined ? lch.C : (lch.c !== undefined ? lch.c : 0.1),
        h: lch.h !== undefined ? lch.h : 0
    };

    const { brightness, boost, ignoredThresholds } = EngineState.contrastSettings;
    const isDark = EngineState.mode.palette === 'dark';

    const levels = 10;
    const grid = [];

    // Progi z uwzględnieniem boostu
    const getTarget = (base) => {
        if (ignoredThresholds.includes(base)) return 1.0;
        return base + boost;
    };

    const t3 = getTarget(3.0);
    const t45 = getTarget(4.5);
    const t7 = getTarget(7.0);

    // 10 levels of background
    for (let i = 0; i < levels; i++) {
        const t = i / (levels - 1);

        let L;
        // W palecie kontrastów Ustawienie jasności tła do najmniejszej i do największej powinny nadal generować 10 tonów.
        // brightness 0..1 mapuje zakres jasności od którego startujemy/kończymy
        if (isDark) {
            // Dark mode background: darker tones
            L = (1 - brightness) * (1 - t);
        } else {
            // Light mode background: lighter tones
            L = 1 - (brightness * t);
        }

        // Dodatkowe białe/czarne tło
        if (i === 0 && brightness > 0.9) L = 1.0; // Force white
        if (i === levels - 1 && brightness > 0.9) L = 0.0; // Force black

        const lab = oklchToOklab(L, lch.C * 0.15, lch.h);
        const bgHex = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));

        const direction = L > 0.5 ? 'darker' : 'lighter';

        // Nowe progi:
        // - 3:1 level 1 do tła
        const L1 = findColorByContrast(bgHex, t3, direction, lch.h, lch.C);

        // - 4.5:1 do tła
        const C45_BG = findColorByContrast(bgHex, t45, direction, lch.h, lch.C);

        // - 4.5:1 do 3:1 level 1
        const C45_L1 = findColorByContrast(L1, t45, direction, lch.h, lch.C);

        // - 7:1 do tła
        const C7_BG = findColorByContrast(bgHex, t7, direction, lch.h, lch.C);

        // - 7:1 do 3:1 level 1
        const C7_L1 = findColorByContrast(L1, t7, direction, lch.h, lch.C);

        // - 3:1 level 2 do 3:1 level 1
        const L2 = findColorByContrast(L1, t3, direction, lch.h, lch.C);

        // - 4.5:1 do 3:1 level 2
        const C45_L2 = findColorByContrast(L2, t45, direction, lch.h, lch.C);

        // - 7:1 do 3:1 level 2
        const C7_L2 = findColorByContrast(L2, t7, direction, lch.h, lch.C);

        grid.push({
            bg: bgHex,
            l1: L1,
            c45_bg: C45_BG,
            c45_l1: C45_L1,
            c7_bg: C7_BG,
            c7_l1: C7_L1,
            l2: L2,
            c45_l2: C45_L2,
            c7_l2: C7_L2,
            baseContrast: contrastRatio(bgHex, rgbToHex(oklabToRgb(oklchToOklab(lch.L, lch.C, lch.h))))
        });
    }

    return grid;
}
