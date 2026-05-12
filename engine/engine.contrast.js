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

export function generateContrastGrid() {
    const baseLch = getBaseLCH();
    const { brightness, boost } = EngineState.contrastSettings;
    const isDark = EngineState.mode.palette === 'dark';

    const levels = 10;
    const grid = [];

    // 10 levels of background
    for (let i = 0; i < levels; i++) {
        const t = i / (levels - 1);

        let L;
        if (isDark) {
            // Requirement: "najjaśniejszy wariant dla tła był biały" -> let's make i=0 light
            // In Dark Mode, backgrounds are usually dark, but if we want white as lightest...
            L = (1 - t) * brightness;
            // If brightness=1, i=0 is L=1 (white). If brightness=0.2, i=0 is L=0.2 (dark).
        } else {
            // Light Mode: i=0 is white (1), i=9 is darker
            L = 1 - (t * brightness);
            // If brightness=1, i=9 is L=0 (black). If brightness=0.5, i=9 is L=0.5.
        }

        const lab = oklchToOklab(L, baseLch.C * 0.2, baseLch.h);
        const bgHex = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));

        // Targets
        const t3_1 = 3.0 + boost;
        const t4_5 = 4.5 + boost;
        const t7_1 = 7.0 + boost;

        // Direction of contrast layers relative to BG
        // If BG is light, we go darker. If BG is dark, we go lighter.
        const direction = L > 0.5 ? 'darker' : 'lighter';

        // Layer 1: 3:1 to BG
        const c3_bg = findColorByContrast(bgHex, t3_1, direction, baseLch.h, baseLch.C);

        // Layer 2: 3:1 to Layer 1 (c3_bg)
        const c3_prev = findColorByContrast(c3_bg, t3_1, direction, baseLch.h, baseLch.C);

        // Layer 3: 4.5:1 to BG AND 3:1 to Layer 1
        const c45_bg_only = findColorByContrast(bgHex, t4_5, direction, baseLch.h, baseLch.C);
        const c3_from_l1 = findColorByContrast(c3_bg, t3_1, direction, baseLch.h, baseLch.C);

        const c45_bg = direction === 'darker'
            ? (LToStep(rgbToOklab_local(c45_bg_only).L) > LToStep(rgbToOklab_local(c3_from_l1).L) ? c45_bg_only : c3_from_l1)
            : (LToStep(rgbToOklab_local(c45_bg_only).L) < LToStep(rgbToOklab_local(c3_from_l1).L) ? c45_bg_only : c3_from_l1);

        // Layer 4: 7:1 to BG AND 3:1 to Layer 2
        const c7_bg_only = findColorByContrast(bgHex, t7_1, direction, baseLch.h, baseLch.C);
        const c3_from_l2 = findColorByContrast(c3_prev, t3_1, direction, baseLch.h, baseLch.C);

        const c7_bg = direction === 'darker'
            ? (LToStep(rgbToOklab_local(c7_bg_only).L) > LToStep(rgbToOklab_local(c3_from_l2).L) ? c7_bg_only : c3_from_l2)
            : (LToStep(rgbToOklab_local(c7_bg_only).L) < LToStep(rgbToOklab_local(c3_from_l2).L) ? c7_bg_only : c3_from_l2);

        grid.push({
            bg: bgHex,
            c3_bg,
            c3_prev,
            c45_bg,
            c7_bg
        });
    }

    return grid;
}
