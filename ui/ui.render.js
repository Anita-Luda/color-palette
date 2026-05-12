// ui/ui.render.js
// Pure renderer: main / additional / functional / badge. No state mutations.

import {
  getMainPalette,
  getAdditionalPalettes,
  getFunctionalPalettes,
  getBadgePalettes
} from '../engine/engine.palettes.js';

import { previewContrast } from '../engine/engine.accessibility.js';
import { getState } from '../engine/engine.core.js';

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
    if (mini) {
        // Find the swatch closest to 500 or just use the anchor
        const anchor = p.scale.find(s => s.isBase) || p.scale[Math.floor(p.scale.length/2)];
        mini.style.background = anchor.hex;
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

/* ---------- PUBLIC API ---------- */
export function renderAllPalettes(){
  if (!root) return;
  root.innerHTML = '';
  root.appendChild(renderMain());
  root.appendChild(renderAdditional());
  root.appendChild(renderFunctional());
  root.appendChild(renderBadge());
}
