// ui/render/ui.render.export.js
import { getState } from '../../engine/engine.core.js';
import { getMainPalette, getAdditionalPalettes, getFunctionalPalettes, getBadgePalettes } from '../../engine/engine.palettes.js';

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
    let palettes = [];
    if (type === 'main') {
        palettes.push({ name: 'Glowna', scale: getMainPalette().scale });
        getAdditionalPalettes().forEach(p => {
            palettes.push({ name: `Kolor ${p.index + 1}`, scale: p.scale });
        });
    } else if (type === 'functional') {
        const func = getFunctionalPalettes();
        Object.entries(func).forEach(([name, p]) => {
            palettes.push({ name, scale: p.scale });
        });
    } else if (type === 'badge') {
        getBadgePalettes().forEach(p => {
            palettes.push({ name: `Badge ${p.index + 1}`, scale: p.scale });
        });
    } else if (type === 'contrast') {
        palettes.push({ name: 'Contrast Base', scale: getMainPalette().scale });
    }

    const itemSize = 60;
    const padding = 20;
    const textHeight = 30;
    const rowHeight = itemSize + textHeight + padding;

    // Filter scales based on granularity
    const state = getState();
    palettes.forEach(pal => {
        pal.scale = pal.scale.filter(s => {
            const displayVal = Math.round(s.displayStep ?? s.step);
            const is100 = Math.abs(displayVal % 100) < 0.1;
            const is50  = Math.abs(displayVal % 50) < 0.1;
            if (state.mode.granularity === 50 && !is50 && !s.isBase) return false;
            if (state.mode.granularity === 100 && !is100 && !s.isBase) return false;
            return true;
        });
    });

    const maxItems = Math.max(...palettes.map(p => p.scale.length), 1);
    const width = maxItems * itemSize + padding * 2;
    const height = palettes.length * rowHeight + padding * 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svg += `<rect width="100%" height="100%" fill="#ffffff" />`;
    svg += `<style>text { font-family: 'Inter', sans-serif; font-size: 10px; fill: #666; }</style>`;

    palettes.forEach((pal, pIdx) => {
        const y = padding + pIdx * rowHeight;
        svg += `<text x="${padding}" y="${y + 10}" font-weight="bold" fill="#000">${pal.name.toUpperCase()}</text>`;

        pal.scale.forEach((swatch, sIdx) => {
            const x = padding + sIdx * itemSize;
            const sy = y + 20;
            svg += `<rect x="${x}" y="${sy}" width="${itemSize - 4}" height="${itemSize - 4}" fill="${swatch.hex}" rx="4" />`;
            svg += `<text x="${x}" y="${sy + itemSize + 5}">${swatch.displayStep ?? swatch.step}</text>`;
            svg += `<text x="${x}" y="${sy + itemSize + 15}">${swatch.hex.toUpperCase()}</text>`;
        });
    });

    svg += `</svg>`;
    return svg;
}
