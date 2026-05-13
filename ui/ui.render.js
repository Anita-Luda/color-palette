// ui/ui.render.js
// Pure renderer: main / additional / functional / badge. No state mutations.

import {
  getMainPalette,
  getAdditionalPalettes,
  getFunctionalPalettes,
  getBadgePalettes
} from '../engine/engine.palettes.js';

import { previewContrast, contrastRatio } from '../engine/engine.accessibility.js';
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

  // Requirement: "Kolor bazowy ma mieć badge widzony zawsze w każdej palecie i granulacji"
  if (gran === 50 && swatch.step % 50 !== 0 && !swatch.isBase) return null;
  if (gran === 100 && swatch.step % 100 !== 0 && !swatch.isBase) return null;

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
      d.appendChild(el('div', 'swatch-badge base visible', 'BASE'));
  }

  if (gran === 10) {
      if (swatch.step % 100 === 0) {
          d.appendChild(el('div', 'swatch-badge step100 visible', '100'));
      } else if (swatch.step % 50 === 0) {
          d.appendChild(el('div', 'swatch-badge step50 visible', '50'));
      }
  } else if (gran === 50) {
      if (swatch.step % 100 === 0) {
          d.appendChild(el('div', 'swatch-badge step100 visible', '100'));
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
function renderAdditional(){
  const list = getAdditionalPalettes();
  const frag = document.createDocumentFragment();

  list.forEach(p => {
    const sec = section(`Kolor ${p.index + 1}`, p.role);
    sec.appendChild(renderScale(p.scale));

    // Update mini-preview in sidebar
    const mini = document.getElementById(`preview-${p.index}`);
    const hexLabel = document.getElementById(`hex-val-${p.index}`);
    if (mini) {
        const anchor = p.scale.find(s => s.isBase) || p.scale[Math.floor(p.scale.length/2)];
        mini.style.background = anchor.hex;
        if (hexLabel) hexLabel.textContent = anchor.hex.toUpperCase();
    }

    frag.appendChild(sec);
  });

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
    header.append(
        el('div', null, 'Tło (Background)'),
        el('div', null, 'Lvl 1 (3:1) vs BG'),
        el('div', null, 'AA (4.5:1) vs BG'),
        el('div', null, 'AA (4.5:1) vs L1'),
        el('div', null, 'AAA (7:1) vs BG'),
        el('div', null, 'Lvl 2 (3:1) vs L1'),
        el('div', null, 'Brand vs BG')
    );
    container.appendChild(header);

    grid.forEach(row => {
        const r = el('div', 'contrast-row');

        r.append(
            createContrastSwatch('Tło', row.bg),
            createContrastSwatch(`Min: ${row.l1_target.toFixed(1)}`, row.l1, null, row.l1_actual),
            createContrastSwatch(`Min: ${row.c45_bg_target.toFixed(1)}`, row.c45_bg, null, row.c45_bg_actual),
            createContrastSwatch(`Min: ${row.c45_l1_target.toFixed(1)}`, row.c45_l1, null, row.c45_l1_actual),
            createContrastSwatch(`Min: ${row.c7_bg_target.toFixed(1)}`, row.c7_bg, null, row.c7_bg_actual),
            createContrastSwatch(`Min: ${row.l2_target.toFixed(1)}`, row.l2, null, row.l2_actual),
            createContrastSwatch('Base', null, lch, row.baseContrast)
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

function createContrastSwatch(label, hex, forceLch, actualRatio) {
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
        const r = el('div', 'contrast-ratio', `Real: ${actualRatio.toFixed(2)}:1`);
        d.appendChild(r);
    }

    return d;
}

/* ---------- PUBLIC API ---------- */
/**
 * Renders all components of the output view.
 * @param {boolean} preserveFocus - If true, indicates we should attempt to keep current UI state (e.g. scroll)
 */
export function renderAllPalettes(preserveFocus = false){
  if (!root) return;
  const state = getState();

  // Update Background source label
  const bgSourceLabel = document.getElementById('active-bg-source');
  if (bgSourceLabel) {
      const source = state.mode.backgroundSource;
      if (source === 'base') {
          bgSourceLabel.textContent = 'Tło z: Paleta Główna';
      } else {
          bgSourceLabel.textContent = `Tło z: Kolor ${source + 1}`;
      }
  }

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
}
