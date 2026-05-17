// ui/render/ui.render.contrast.js
import { generateContrastGrid } from '../../engine/engine.contrast.js';
import { previewContrast, contrastRatio, apcaContrast } from '../../engine/engine.accessibility.js';
import { getState } from '../../engine/engine.core.js';
import { getMainPalette, getAdditionalPalettes, getFunctionalPalettes, getBadgePalettes } from '../../engine/engine.palettes.js';
import { oklchToOklab, oklabToRgb, rgbToHex } from '../../engine/engine.math.js';

function el(tag, cls, text){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function createContrastSwatch(label, hex, forceLch, actualRatio, isApca = false) {
    const d = el('div', 'contrast-swatch');
    let c = hex;
    if (!c && forceLch) {
        const lab = oklchToOklab(forceLch.L ?? forceLch.l, forceLch.C ?? forceLch.c, forceLch.h);
        c = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));
    }
    if (!c) c = '#000000';
    d.style.background = c;
    const contrast = previewContrast(c);
    d.style.color = (contrast.light.ratio > contrast.dark.ratio) ? '#fff' : '#000';

    const l = el('div', 'contrast-label', label);
    const h = el('div', 'contrast-hex', c.toUpperCase());
    const wb = el('div', 'swatch-wb-contrast', `W: ${contrast.light.ratio} B: ${contrast.dark.ratio}`);
    d.append(l, h, wb);

    if (actualRatio !== undefined) {
        const val = isApca ? Math.abs(actualRatio).toFixed(0) : actualRatio.toFixed(2);
        const r = el('div', 'contrast-ratio', `Real: ${val}${isApca ? '' : ':1'}`);
        d.appendChild(r);
    }
    return d;
}

function renderGridForLCH(lch, title) {
    const grid = generateContrastGrid(lch);
    const wrap = el('div', 'contrast-section');
    wrap.appendChild(el('h2', 'contrast-title', title));
    const container = el('div', 'contrast-grid');
    const header = el('div', 'contrast-row header');
    header.append(el('div',null,'Tło'), el('div',null,'L1'), el('div',null,'AA BG'), el('div',null,'AAA BG'), el('div',null,'L2 L1'), el('div',null,'AA L1'), el('div',null,'Base BG'), el('div',null,'Base L1'));
    container.appendChild(header);

    const state = getState();
    const isApca = state.contrastSettings.algorithm === "apca";

    grid.forEach(row => {
        const r = el('div', 'contrast-row');
        const baseHex = rgbToHex(oklabToRgb(...Object.values(oklchToOklab(lch.L || lch.l, lch.C || lch.c, lch.h))));
        const baseVsL1 = isApca ? Math.abs(apcaContrast(row.l1, baseHex)) : contrastRatio(row.l1, baseHex);

        r.append(
            createContrastSwatch('Tło', row.bg),
            createContrastSwatch(`L1: ${row.l1_target.toFixed(0)}`, row.l1, null, row.l1_actual, isApca),
            createContrastSwatch(`AA BG`, row.c45_bg, null, row.c45_bg_actual, isApca),
            createContrastSwatch(`AAA BG`, row.c7_bg, null, row.c7_bg_actual, isApca),
            createContrastSwatch(`L2 L1`, row.l2, null, row.l2_actual, isApca),
            createContrastSwatch(`AA L1`, row.c45_l1, null, row.c45_l1_actual, isApca),
            createContrastSwatch('Base BG', null, lch, row.baseContrast, isApca),
            createContrastSwatch('Base L1', null, lch, baseVsL1, isApca)
        );
        container.appendChild(r);
    });
    wrap.appendChild(container);
    return wrap;
}

export function renderContrastView() {
    const frag = document.createDocumentFragment();
    const baseLch = getState().base.lch || getMainPalette().scale.find(s=>s.isBase);
    frag.appendChild(renderGridForLCH(baseLch, 'Kontrast: Kolor Bazowy'));

    getAdditionalPalettes().forEach(p => {
        const lch = p.scale.find(s=>s.isBase) || p.scale[50];
        frag.appendChild(renderGridForLCH(lch, `Kontrast: Kolor ${p.index+1}`));
    });

    const functional = getFunctionalPalettes();
    Object.entries(functional).forEach(([name, p]) => {
        const lch = p.scale.find(s => s.isBase) || p.scale[Math.floor(p.scale.length / 2)];
        frag.appendChild(renderGridForLCH(lch, `Kontrast: ${name.toUpperCase()}`));
    });

    getBadgePalettes().forEach(p => {
        const lch = p.scale.find(s => s.isBase) || p.scale[Math.floor(p.scale.length / 2)];
        frag.appendChild(renderGridForLCH(lch, `Kontrast: BADGE ${p.index + 1}`));
    });

    return frag;
}
