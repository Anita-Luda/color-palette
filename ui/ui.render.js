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

  // Badges: always visible, differing brightness
  if (swatch.isBase) {
      const b = el('div', 'swatch-badge base', 'BASE');
      d.appendChild(b);
  } else if (swatch.step % 100 === 0) {
      const b = el('div', 'swatch-badge step100', '100');
      d.appendChild(b);
  } else if (swatch.step % 50 === 0) {
      const b = el('div', 'swatch-badge step50', '50');
      d.appendChild(b);
  }

  // Contrast info for current background
  const bgMode = state.mode.background;
  const info = contrast[bgMode];
  const contrastEl = el('div', 'swatch-contrast', `${info.ratio} ${info.level}`);

  d.append(step, hex, contrastEl);

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

  if (state.mode.view === 'contrast') {
      const btn = el('button', 'bg-source-btn', 'Ustaw jako tło');
      if (state.mode.backgroundSource === 'base') btn.classList.add('active');
      btn.onclick = () => {
          import('../engine/engine.core.js').then(m => {
              m.setBackgroundSource('base');
              window.refreshUI();
          });
      };
      sec.querySelector('.palette-title').appendChild(btn);
  }

  sec.appendChild(renderScale(main.scale));
  return sec;
}

/* ---------- ADDITIONAL ---------- */
function renderAdditional(){
  const list = getAdditionalPalettes();
  const frag = document.createDocumentFragment();
  const state = getState();

  list.forEach(p => {
    const sec = section(`Kolor ${p.index + 1}`, p.role);

    if (state.mode.view === 'contrast') {
        const btn = el('button', 'bg-source-btn', 'Ustaw jako tło');
        if (state.mode.backgroundSource === p.index) btn.classList.add('active');
        btn.onclick = () => {
            import('../engine/engine.core.js').then(m => {
                m.setBackgroundSource(p.index);
                window.refreshUI();
            });
        };
        sec.querySelector('.palette-title').appendChild(btn);
    }

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
        el('div', null, 'Tło'),
        el('div', null, 'L1 (3:1 BG)'),
        el('div', null, '4.5:1 BG'),
        el('div', null, '4.5:1 L1'),
        el('div', null, '7:1 BG'),
        el('div', null, '7:1 L1'),
        el('div', null, 'L2 (3:1 L1)'),
        el('div', null, '4.5:1 L2'),
        el('div', null, '7:1 L2'),
        el('div', null, 'Base (Auto)')
    );
    container.appendChild(header);

    grid.forEach(row => {
        const r = el('div', 'contrast-row');

        r.append(
            createContrastSwatch('Tło', row.bg),
            createContrastSwatch(`L1 (${contrastRatio(row.bg, row.l1).toFixed(1)})`, row.l1),
            createContrastSwatch(`4.5:1 BG`, row.c45_bg),
            createContrastSwatch(`4.5:1 L1`, row.c45_l1),
            createContrastSwatch(`7:1 BG`, row.c7_bg),
            createContrastSwatch(`7:1 L1`, row.c7_l1),
            createContrastSwatch(`L2 (${contrastRatio(row.l1, row.l2).toFixed(1)})`, row.l2),
            createContrastSwatch(`4.5:1 L2`, row.c45_l2),
            createContrastSwatch(`7:1 L2`, row.c7_l2),
            createContrastSwatch(`Base (${row.baseContrast.toFixed(1)})`, null, lch) // null hex means use base
        );
        container.appendChild(r);
    });

    wrap.appendChild(container);
    return wrap;
}

function renderContrastView() {
    const frag = document.createDocumentFragment();

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

function createContrastSwatch(label, hex, forceLch) {
    const d = el('div', 'contrast-swatch');
    let c = hex;
    if (!c && forceLch) {
        // Normalize LCH (handle l/L, c/C)
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

    const l = el('div', null, label);
    const h = el('div', null, c.toUpperCase());
    d.append(l, h);
    return d;
}

/* ---------- PUBLIC API ---------- */
export function renderAllPalettes(differential = false){
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
      root.appendChild(renderMain());
      root.appendChild(renderAdditional());
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
