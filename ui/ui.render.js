// ui/ui.render.js
// Pure renderer: main / additional / functional / badge. No state mutations.

import {
  getMainPalette,
  getAdditionalPalettes,
  getFunctionalPalettes,
  getBadgePalettes
} from '../engine/engine.palettes.js';

import { previewContrast, contrastRatio, apcaContrast } from '../engine/engine.accessibility.js';
import { getState } from '../engine/engine.core.js';
import { generateContrastGrid } from '../engine/engine.contrast.js';

/* ---------- ROOT ---------- */
const root = document.getElementById('output');

/* ---------- HELPERS ---------- */
function el(tag, cls, text){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function showCopyToast(text) {
  let toast = document.querySelector('.copy-toast');
  if (!toast) {
    toast = el('div', 'copy-toast');
    document.body.appendChild(toast);
  }
  toast.textContent = `Skopiowano: ${text}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function renderSwatch(swatch, opts = {}){
  const d = el('div', 'swatch');
  if (swatch.step % 50 === 0) d.classList.add('major');
  if (swatch.step === 500) d.classList.add('ref');
  if (swatch.isBase) d.classList.add('base-color');
  if (opts.compact) d.classList.add('compact');

  const state = getState();
  const gran = state.mode.granularity;

  // Account for Fixed scale offset in granularity filtering
  // Requirement: "Na paletach w rozkładzie 'fixed' brakuje badgy z progami. Logika badgy powinna być taka sama jak przy rozkłądzie absolute."
  // Logic: treat the shifted steps as if they were clean steps for the purpose of badges and filtering.
  const offset = state.mode.scale === 'fixed' ? (Math.round(swatch.step) % 10) : 0;
  const gridStep = Math.round(swatch.step - offset);

  // Requirement: "Kolor bazowy ma mieć badge widzony zawsze w każdej palecie i granulacji"
  if (gran === 50 && gridStep % 50 !== 0 && !swatch.isBase) return null;
  if (gran === 100 && gridStep % 100 !== 0 && !swatch.isBase) return null;

  d.style.background = swatch.hex;

  // Dynamic contrast for text on swatch
  const contrast = previewContrast(swatch.hex);
  const onWhite = contrast.light.ratio;
  const onBlack = contrast.dark.ratio;
  d.style.color = onWhite > onBlack ? '#fff' : '#000';

  const stepText = typeof swatch.step === 'number' ? Math.round(swatch.step) : swatch.step;
  const step = el('div', 'swatch-step', String(stepText));
  const hex  = el('div', 'swatch-hex', swatch.hex.toUpperCase());

  // Badges logic:
  // co 10: show 50 and 100 (100 priority)
  // co 50: show 100
  // co 100: handled by renderer not showing non-100s

  // Badges rules:
  // - BASE always visible.
  // - Granularity 10: 100 and 50 visible (100 priority if same).
  // - Granularity 50: 100 visible.

  if (swatch.isBase) {
      const badge = el('div', 'swatch-badge base visible', 'BASE');
      badge.style.zIndex = "10";
      d.appendChild(badge);
  }

  if (gran === 10) {
      if (gridStep % 100 === 0) {
          const badge = el('div', 'swatch-badge step100 visible', '100');
          if (swatch.isBase) badge.style.display = 'none';
          d.appendChild(badge);
      } else if (gridStep % 50 === 0) {
          const badge = el('div', 'swatch-badge step50 visible', '50');
          if (swatch.isBase) badge.style.display = 'none';
          d.appendChild(badge);
      }
  } else if (gran === 50) {
      if (gridStep % 100 === 0) {
          const badge = el('div', 'swatch-badge step100 visible', '100');
          if (swatch.isBase) badge.style.display = 'none';
          d.appendChild(badge);
      }
  }

  // Contrast info for current background
  const bgMode = state.mode.background;
  const info = contrast[bgMode];
  const contrastEl = el('div', 'swatch-contrast', `${info.ratio} ${info.level}`);

  const whiteBlackContrast = el('div', 'swatch-wb-contrast');
  whiteBlackContrast.innerHTML = `
    <span class="c-w">W: ${contrast.light.ratio}</span>
    <span class="c-b">B: ${contrast.dark.ratio}</span>
  `;
  whiteBlackContrast.style.fontSize = '0.65rem';
  whiteBlackContrast.style.opacity = '0.8';
  whiteBlackContrast.style.marginTop = '2px';

  d.append(step, hex, contrastEl, whiteBlackContrast);

  // Click to copy
  d.addEventListener('click', () => {
    navigator.clipboard.writeText(swatch.hex.toUpperCase()).then(() => {
      showCopyToast(swatch.hex.toUpperCase());
    });
  });

  return d;
}

function renderScale(scale, opts = {}){
  const grid = el('div', 'swatches');
  scale.forEach(s => {
      const node = renderSwatch(s, opts);
      if (node) grid.appendChild(node);
  });
  return grid;
}

function section(title, subtitle){
  const wrap = el('section', 'palette');
  const head = el('div', 'palette-title');
  head.appendChild(el('strong', null, title));
  if (subtitle) head.appendChild(el('span', 'palette-subtitle', subtitle));
  wrap.appendChild(head);
  return wrap;
}

/* ---------- MAIN ---------- */
function renderMain(){
  const main = getMainPalette();
  const state = getState();
  const sec = section('Paleta główna', state.mode.scale.toUpperCase());
  sec.appendChild(renderScale(main.scale));
  return sec;
}

/* ---------- ADDITIONAL ---------- */
export function updateSidebarPreviews() {
  const list = getAdditionalPalettes();
  list.forEach(p => {
    const mini = document.getElementById(`preview-${p.index}`);
    const hexLabel = document.getElementById(`hex-val-${p.index}`);
    if (mini) {
      const anchor = p.scale.find(s => s.isBase) || p.scale[Math.floor(p.scale.length / 2)];
      mini.style.background = anchor.hex;
      if (hexLabel) hexLabel.textContent = anchor.hex.toUpperCase();
    }
  });

  const state = getState();
  const basePreview = document.getElementById('basePreview');
  if (basePreview) {
      basePreview.style.background = `rgb(${state.base.rgb.r}, ${state.base.rgb.g}, ${state.base.rgb.b})`;
  }
}

function renderAdditional(){
  const list = getAdditionalPalettes();
  const frag = document.createDocumentFragment();

  list.forEach(p => {
    const sec = section(`Kolor ${p.index + 1}`, p.role);
    sec.appendChild(renderScale(p.scale));
    frag.appendChild(sec);
  });

  updateSidebarPreviews();
  return frag;
}

/* ---------- FUNCTIONAL ---------- */
function renderFunctional(){
  const palettes = getFunctionalPalettes();
  const sec = section('Paleta funkcjonalna', 'Semantyczna • Progi co 200');

  Object.entries(palettes).forEach(([name, p]) => {
    const row = el('div', 'functional-row');
    row.appendChild(el('span', 'role-tag', name));
    row.appendChild(renderScale(p.scale, { compact: true }));
    sec.appendChild(row);
  });

  return sec;
}

/* ---------- BADGE ---------- */
function renderBadge(){
  const list = getBadgePalettes();
  const sec = section('Paleta badge', 'Zróżnicowane Hue • Progi co 200');

  list.forEach(p => {
    const row = el('div', 'badge-row');
    row.appendChild(el('span', 'role-tag', `Badge ${p.index + 1}`));
    row.appendChild(renderScale(p.scale, { compact: true }));
    sec.appendChild(row);
  });

  return sec;
}

function renderContrastGridForLCH(lch, title) {
    const grid = generateContrastGrid(lch);
    const wrap = el('div', 'contrast-section');
    wrap.appendChild(el('h2', 'contrast-title', title));

    const container = el('div', 'contrast-grid');

    // Header
    const header = el('div', 'contrast-row header');
    header.style.gridTemplateColumns = '100px repeat(8, 1fr)';
    header.append(
        el('div', null, 'Tło (Background)'),
        el('div', null, 'Lvl 1 (3:1) vs BG'),
        el('div', null, 'AA (4.5:1) vs BG'),
        el('div', null, 'AAA (7:1) vs BG'),
        el('div', null, 'Lvl 2 (3:1) vs L1'),
        el('div', null, 'AA (4.5:1) vs L1'),
        el('div', null, 'Base vs BG'),
        el('div', null, 'Base vs L1')
    );
    container.appendChild(header);

    const state = getState();
    const isApca = state.contrastSettings.algorithm === "apca";

    grid.forEach(row => {
        const r = el('div', 'contrast-row');
        r.style.gridTemplateColumns = '100px repeat(8, 1fr)';

        // Calculate Base vs L1 ratio
        const baseHex = rgbToHex(oklabToRgb(...Object.values(oklchToOklab(lch.L || lch.l, lch.C || lch.c, lch.h))));
        const baseVsL1 = isApca ? Math.abs(apcaContrast(row.l1, baseHex)) : contrastRatio(row.l1, baseHex);

        r.append(
            createContrastSwatch('Tło', row.bg),
            createContrastSwatch(`${isApca ? 'Lc' : 'Min'}: ${row.l1_target.toFixed(isApca ? 0 : 1)}`, row.l1, null, row.l1_actual, isApca),
            createContrastSwatch(`${isApca ? 'Lc' : 'Min'}: ${row.c45_bg_target.toFixed(isApca ? 0 : 1)}`, row.c45_bg, null, row.c45_bg_actual, isApca),
            createContrastSwatch(`${isApca ? 'Lc' : 'Min'}: ${row.c7_bg_target.toFixed(isApca ? 0 : 1)}`, row.c7_bg, null, row.c7_bg_actual, isApca),
            createContrastSwatch(`${isApca ? 'Lc' : 'Min'}: ${row.l2_target.toFixed(isApca ? 0 : 1)}`, row.l2, null, row.l2_actual, isApca),
            createContrastSwatch(`${isApca ? 'Lc' : 'Min'}: ${row.c45_l1_target.toFixed(isApca ? 0 : 1)}`, row.c45_l1, null, row.c45_l1_actual, isApca),
            createContrastSwatch('Base', null, lch, row.baseContrast, isApca),
            createContrastSwatch('Base', null, lch, baseVsL1, isApca)
        );
        container.appendChild(r);
    });

    wrap.appendChild(container);
    return wrap;
}

function renderContrastView() {
    const frag = document.createDocumentFragment();

    // Legend
    const legend = el('div', 'contrast-legend');
    legend.innerHTML = `
        <div class="legend-item"><strong>Lvl 1</strong>: Powierzchnia / Element na tle (np. karta).</div>
        <div class="legend-item"><strong>AA / AAA</strong>: Wymogi WCAG dla tekstu względem wskazanej warstwy.</div>
        <div class="legend-item"><strong>Lvl 2</strong>: Element zagnieżdżony na Level 1 (np. przycisk na karcie).</div>
        <div class="legend-item"><strong>Brand</strong>: Twój kolor bazowy (anchor) wyświetlony na danym tle.</div>
    `;
    legend.style.padding = '20px 32px';
    legend.style.margin = '0 32px 32px 32px';
    legend.style.background = 'rgba(255,255,255,0.05)';
    legend.style.borderRadius = '12px';
    legend.style.fontSize = '0.85rem';
    legend.style.lineHeight = '1.6';
    frag.appendChild(legend);

    // Base
    const baseLch = getState().base.lch || getMainPalette().scale.find(s=>s.isBase);
    frag.appendChild(renderContrastGridForLCH(baseLch, 'Kontrast: Kolor Bazowy'));

    // Additional
    getAdditionalPalettes().forEach(p => {
        const lch = p.scale.find(s=>s.isBase) || p.scale[Math.floor(p.scale.length/2)];
        frag.appendChild(renderContrastGridForLCH(lch, `Kontrast: Kolor ${p.index+1} (${p.role})`));
    });

    // Functional
    const func = getFunctionalPalettes();
    Object.entries(func).forEach(([name, p]) => {
        const lch = p.scale[Math.floor(p.scale.length/2)];
        frag.appendChild(renderContrastGridForLCH(lch, `Kontrast: ${name}`));
    });

    // Badges
    getBadgePalettes().forEach(p => {
        const lch = p.scale[Math.floor(p.scale.length/2)];
        frag.appendChild(renderContrastGridForLCH(lch, `Kontrast: Badge ${p.index+1}`));
    });

    return frag;
}

import { oklchToOklab, oklabToRgb, rgbToHex } from '../engine/engine.scales.js';

function createContrastSwatch(label, hex, forceLch, actualRatio, isApca = false) {
    const d = el('div', 'contrast-swatch');
    let c = hex;
    if (!c && forceLch) {
        const L = forceLch.L !== undefined ? forceLch.L : forceLch.l;
        const C = forceLch.C !== undefined ? forceLch.C : forceLch.c;
        const H = forceLch.h;
        const lab = oklchToOklab(L, C, H);
        c = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));
    }

    if (!c) c = '#000000';

    d.style.background = c;
    const contrast = previewContrast(c);
    d.style.color = (contrast.light.ratio > contrast.dark.ratio) ? '#fff' : '#000';

    const l = el('div', 'contrast-label', label);
    const h = el('div', 'contrast-hex', c.toUpperCase());

    const wb = el('div', 'swatch-wb-contrast');
    wb.innerHTML = `W: ${contrast.light.ratio} B: ${contrast.dark.ratio}`;
    wb.style.fontSize = '0.55rem';
    wb.style.opacity = '0.8';
    wb.style.marginTop = '2px';

    d.append(l, h, wb);

    if (actualRatio !== undefined) {
        const val = isApca ? Math.abs(actualRatio).toFixed(0) : actualRatio.toFixed(2);
        const suffix = isApca ? '' : ':1';
        const r = el('div', 'contrast-ratio', `Real: ${val}${suffix}`);
        d.appendChild(r);
    }

    return d;
}

export function getAllVisibleHexes() {
    const state = getState();
    const hexes = [];
    const collect = (scale) => {
        scale.forEach(s => {
            const offset = state.mode.scale === 'fixed' ? (Math.round(s.step) % 10) : 0;
            const gridStep = Math.round(s.step - offset);

            if (state.mode.granularity === 50 && gridStep % 50 !== 0 && !s.isBase) return;
            if (state.mode.granularity === 100 && gridStep % 100 !== 0 && !s.isBase) return;
            hexes.push(s.hex.toUpperCase());
        });
    };

    collect(getMainPalette().scale);
    getAdditionalPalettes().forEach(p => collect(p.scale));
    // Functional and badges usually fixed granularity, but we follow same logic
    Object.values(getFunctionalPalettes()).forEach(p => collect(p.scale));
    getBadgePalettes().forEach(p => collect(p.scale));

    return hexes;
}

function createSVGSwatch(swatch, x, y, width, height) {
    const state = getState();
    const contrast = previewContrast(swatch.hex);
    const textColor = contrast.light.ratio > contrast.dark.ratio ? '#FFFFFF' : '#000000';
    const bgMode = state.mode.background;
    const info = contrast[bgMode];

    let badges = '';
    if (swatch.isBase) {
        badges += `<rect x="${x+width/2-25}" y="${y-10}" width="50" height="18" rx="9" fill="#6366f1" />
                   <text x="${x+width/2}" y="${y+2}" font-family="Inter, sans-serif" font-size="9" font-weight="900" text-anchor="middle" fill="#FFFFFF">BASE</text>`;
    } else {
        const gran = state.mode.granularity;
        const offset = state.mode.scale === 'fixed' ? (Math.round(swatch.step) % 10) : 0;
        const gridStep = Math.round(swatch.step - offset);

        if (gran === 10) {
            if (gridStep % 100 === 0) {
                badges += `<rect x="${x+width/2-15}" y="${y-10}" width="30" height="18" rx="9" fill="#334155" />
                           <text x="${x+width/2}" y="${y+2}" font-family="Inter, sans-serif" font-size="9" font-weight="900" text-anchor="middle" fill="#FFFFFF">100</text>`;
            } else if (gridStep % 50 === 0) {
                badges += `<rect x="${x+width/2-15}" y="${y-10}" width="30" height="18" rx="9" fill="#94a3b8" />
                           <text x="${x+width/2}" y="${y+2}" font-family="Inter, sans-serif" font-size="9" font-weight="900" text-anchor="middle" fill="#000000">50</text>`;
            }
        } else if (gran === 50 && gridStep % 100 === 0) {
            badges += `<rect x="${x+width/2-15}" y="${y-10}" width="30" height="18" rx="9" fill="#334155" />
                       <text x="${x+width/2}" y="${y+2}" font-family="Inter, sans-serif" font-size="9" font-weight="900" text-anchor="middle" fill="#FFFFFF">100</text>`;
        }
    }

    return `
    <g>
        <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${swatch.hex}" rx="12" />
        <text x="${x+12}" y="${y+22}" font-family="Inter, sans-serif" font-size="10" font-weight="800" fill="${textColor}" opacity="0.7">${Math.round(swatch.step)}</text>
        <text x="${x+12}" y="${y+height-12}" font-family="Inter, sans-serif" font-size="11" font-weight="700" fill="${textColor}">${swatch.hex.toUpperCase()}</text>
        <text x="${x+12}" y="${y+height-28}" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="${textColor}" opacity="0.6">${info.ratio} ${info.level}</text>
        ${badges}
    </g>`;
}

function createSVGContrastSwatch(x, y, width, height, label, hex, forceLch, actualRatio, bgIsDark, isApca = false) {
    let c = hex;
    if (!c && forceLch) {
        const L = forceLch.L !== undefined ? forceLch.L : forceLch.l;
        const C = forceLch.C !== undefined ? forceLch.C : forceLch.c;
        const H = forceLch.h;
        const lab = oklchToOklab(L, C, H);
        c = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));
    }
    if (!c) c = '#000000';

    const contrast = previewContrast(c);
    const textColor = contrast.light.ratio > contrast.dark.ratio ? '#FFFFFF' : '#000000';

    return `
    <g>
        <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${c}" rx="12" />
        <text x="${x+12}" y="${y+22}" font-family="Inter, sans-serif" font-size="10" font-weight="800" fill="${textColor}" opacity="0.7">${label}</text>
        <text x="${x+12}" y="${y+height-12}" font-family="Inter, sans-serif" font-size="11" font-weight="700" fill="${textColor}">${c.toUpperCase()}</text>
        ${actualRatio !== undefined ? `<text x="${x+12}" y="${y+height-28}" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="${textColor}">Real: ${isApca ? Math.abs(actualRatio).toFixed(0) : actualRatio.toFixed(2)}${isApca ? '' : ':1'}</text>` : ''}
    </g>`;
}

export function generateExportSVG(type = 'main') {
    const state = getState();
    const isDark = state.mode.background === 'dark';
    const bgFill = isDark ? '#000000' : '#FFFFFF';
    const textFill = isDark ? '#FFFFFF' : '#000000';

    const swatchWidth = 110;
    const swatchHeight = 110;
    const gap = 16;
    const sectionGap = 64;

    let currentY = 40;
    let maxW = 0;
    let svgContent = '';

    if (type === 'contrast') {
        const renderContrastToSVG = (lch, title) => {
            const grid = generateContrastGrid(lch);
            svgContent += `<text x="0" y="${currentY - 10}" font-family="Inter, sans-serif" font-size="18" font-weight="900" fill="${textFill}">${title}</text>`;

            const isApca = state.contrastSettings.algorithm === "apca";
            grid.forEach((row, rowIndex) => {
                const baseHex = rgbToHex(oklabToRgb(...Object.values(oklchToOklab(lch.L || lch.l, lch.C || lch.c, lch.h))));
                const baseVsL1 = isApca ? Math.abs(apcaContrast(row.l1, baseHex)) : contrastRatio(row.l1, baseHex);

                const swatches = [
                    { label: 'Tło', hex: row.bg },
                    { label: 'L1', hex: row.l1, ratio: row.l1_actual },
                    { label: 'AA vs BG', hex: row.c45_bg, ratio: row.c45_bg_actual },
                    { label: 'AAA vs BG', hex: row.c7_bg, ratio: row.c7_bg_actual },
                    { label: 'L2 vs L1', hex: row.l2, ratio: row.l2_actual },
                    { label: 'AA vs L1', hex: row.c45_l1, ratio: row.c45_l1_actual },
                    { label: 'Base vs BG', lch: lch, ratio: row.baseContrast },
                    { label: 'Base vs L1', lch: lch, ratio: baseVsL1 }
                ];

                swatches.forEach((s, i) => {
                    svgContent += createSVGContrastSwatch(i * (swatchWidth + gap), currentY + rowIndex * (swatchHeight + gap), swatchWidth, swatchHeight, s.label, s.hex, s.lch, s.ratio, isDark, isApca);
                });
                maxW = Math.max(maxW, swatches.length * (swatchWidth + gap));
            });
            currentY += grid.length * (swatchHeight + gap) + sectionGap;
        };

        const baseLch = state.base.lch || getMainPalette().scale.find(s=>s.isBase);
        renderContrastToSVG(baseLch, 'Kontrast: Kolor Bazowy');
        getAdditionalPalettes().forEach(p => {
            const lch = p.scale.find(s=>s.isBase) || p.scale[Math.floor(p.scale.length/2)];
            renderContrastToSVG(lch, `Kontrast: Kolor ${p.index+1}`);
        });

    } else {
        const collections = [];
        if (type === 'main') {
            collections.push({ name: 'Paleta główna', scale: getMainPalette().scale });
            getAdditionalPalettes().forEach(p => collections.push({ name: `Kolor ${p.index + 1}`, scale: p.scale }));
        } else if (type === 'functional') {
            Object.entries(getFunctionalPalettes()).forEach(([name, p]) => collections.push({ name: `Functional: ${name}`, scale: p.scale }));
        } else if (type === 'badge') {
            getBadgePalettes().forEach(p => collections.push({ name: `Badge ${p.index + 1}`, scale: p.scale }));
        }

        const gran = state.mode.granularity;
        collections.forEach(p => {
            svgContent += `<text x="0" y="${currentY - 10}" font-family="Inter, sans-serif" font-size="18" font-weight="900" fill="${textFill}">${p.name}</text>`;
            const filteredScale = p.scale.filter(s => {
                const offset = state.mode.scale === 'fixed' ? (Math.round(s.step) % 10) : 0;
                const gridStep = Math.round(s.step - offset);

                if (gran === 50 && gridStep % 50 !== 0 && !s.isBase) return false;
                if (gran === 100 && gridStep % 100 !== 0 && !s.isBase) return false;
                return true;
            });
            filteredScale.forEach((s, i) => {
                svgContent += createSVGSwatch(s, i * (swatchWidth + gap), currentY, swatchWidth, swatchHeight);
            });
            maxW = Math.max(maxW, filteredScale.length * (swatchWidth + gap));
            currentY += swatchHeight + sectionGap;
        });
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxW}" height="${currentY}" viewBox="-20 -20 ${maxW + 40} ${currentY + 40}">
        <rect x="-20" y="-20" width="${maxW + 40}" height="${currentY + 40}" fill="${bgFill}" />
        ${svgContent}
    </svg>`;
}

/* ---------- PUBLIC API ---------- */
/**
 * Renders all components of the output view.
 * @param {boolean} preserveFocus - If true, indicates we should attempt to keep current UI state (e.g. scroll)
 */
export function renderAllPalettes(preserveFocus = false){
  if (!root) return;
  const state = getState();

  updateSidebarPreviews();

  root.innerHTML = '';
  if (state.mode.view === 'contrast') {
      root.appendChild(renderContrastView());
  } else {
      const frag = document.createDocumentFragment();
      frag.appendChild(renderMain());
      frag.appendChild(renderAdditional());
      frag.appendChild(renderFunctional());
      frag.appendChild(renderBadge());
      root.appendChild(frag);
  }

  // Update contrast grid background for Dark UI Preview requirement
  const isDarkPreview = state.mode.background === 'dark';
  document.querySelectorAll('.contrast-grid').forEach(g => {
      if (isDarkPreview) g.style.backgroundColor = '#000000';
      else g.style.backgroundColor = '#ffffff';
  });

  // Ensure headers are visible
  const textColor = isDarkPreview ? '#ffffff' : '#000000';
  document.querySelectorAll('.palette-title strong, .contrast-title, .role-tag').forEach(el => {
      el.style.color = textColor;
  });
}
