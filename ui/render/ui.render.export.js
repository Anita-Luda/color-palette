// ui/render/ui.render.export.js
import { getState } from '../../engine/engine.core.js';
import { getMainPalette, getAdditionalPalettes, getFunctionalPalettes, getBadgePalettes } from '../../engine/engine.palettes.js';
import { previewContrast, apcaContrast, contrastRatio } from '../../engine/engine.accessibility.js';
import { generateContrastGrid } from '../../engine/engine.contrast.js';
import { oklchToOklab, oklabToRgb, rgbToHex } from '../../engine/engine.math.js';

export function getAllVisibleHexes() {
    const state = getState();
    const hexes = [];
    const collect = (scale) => {
        scale.forEach(s => {
            const displayVal = Math.round(s.displayStep ?? s.step);
            const is100 = Math.abs(displayVal % 100) < 0.1;
            const is50  = Math.abs(displayVal % 50) < 0.1;
            if (state.mode.granularity === 50 && !is50 && !s.isBase) return;
            if (state.mode.granularity === 100 && !is100 && !s.isBase) return;
            hexes.push(s.hex.toUpperCase());
        });
    };
    collect(getMainPalette().scale);
    getAdditionalPalettes().forEach(p => collect(p.scale));
    return hexes;
}

export function generateExportSVG(type) {
    // Simplified SVG generator logic for refactor
    return `<svg>...</svg>`;
}
