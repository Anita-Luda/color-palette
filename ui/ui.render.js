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

  d.style.background = swatch.hex;

  // Dynamic contrast for text on swatch
  const contrast = previewContrast(swatch.hex);
  const onWhite = contrast.light.ratio;
  const onBlack = contrast.dark.ratio;
  d.style.color = onWhite > onBlack ? '#fff' : '#000';

  const stepText = typeof swatch.step === 'number' ? Math.round(swatch.step) : swatch.step;
  const step = el('div', 'swatch-step', String(stepText));
  const hex  = el('div', 'swatch-hex', swatch.hex.toUpperCase());

  // Contrast info for current background
  const bgMode = document.getElementById('previewBg')?.value || 'light';
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
  scale.forEach(s => grid.appendChild(renderSwatch(s, opts)));
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

function renderContrastView() {
    const grid = generateContrastGrid();
    const container = el('div', 'contrast-grid');

    // Header
    const header = el('div', 'contrast-row');
    header.style.minHeight = '40px';
    header.style.fontWeight = 'bold';
    header.append(
        el('div', null, 'Tło'),
        el('div', null, '3:1 do Tła'),
        el('div', null, '3:1 do Poprzedniego'),
        el('div', null, '4.5:1 do obu'),
        el('div', null, '7:1 do obu')
    );
    container.appendChild(header);

    grid.forEach((row, i) => {
        const r = el('div', 'contrast-row');

        const b = createContrastSwatch('Tło', row.bg, '#fff'); // will auto-adjust text
        const s1 = createContrastSwatch(`3:1 BG (${contrastRatio(row.bg, row.c3_bg).toFixed(1)}:1)`, row.c3_bg, row.bg);
        const s2 = createContrastSwatch(`3:1 Prev (${contrastRatio(row.c3_bg, row.c3_prev).toFixed(1)}:1)`, row.c3_prev, row.c3_bg);
        const s3 = createContrastSwatch(`4.5:1 (${contrastRatio(row.bg, row.c45_bg).toFixed(1)}:1)`, row.c45_bg, row.bg);
        const s4 = createContrastSwatch(`7:1 (${contrastRatio(row.bg, row.c7_bg).toFixed(1)}:1)`, row.c7_bg, row.bg);

        r.append(b, s1, s2, s3, s4);
        container.appendChild(r);
    });

    return container;
}

function createContrastSwatch(label, hex, bg) {
    const d = el('div', 'contrast-swatch');
    d.style.background = hex;
    d.style.color = previewContrast(hex).light.ratio > previewContrast(hex).dark.ratio ? '#fff' : '#000';

    const l = el('div', null, label);
    const h = el('div', null, hex.toUpperCase());
    d.append(l, h);
    return d;
}

/* ---------- PUBLIC API ---------- */
export function renderAllPalettes(differential = false){
  if (!root) return;
  const state = getState();

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
