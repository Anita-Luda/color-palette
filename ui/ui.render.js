// ui/ui.render.js
// Pure renderer: main / additional / functional / badge. No state mutations.

import {
  getMainPalette,
  getAdditionalPalettes,
  getFunctionalPalettes,
  getBadgePalettes
} from '../engine/engine.palettes.js';

/* ---------- ROOT ---------- */
const root = document.getElementById('output');

/* ---------- HELPERS ---------- */
function el(tag, cls, text){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function renderSwatch(swatch, opts = {}){
  const d = el('div', 'swatch');
  if (swatch.step % 50 === 0) d.classList.add('major');
  if (swatch.step === 500) d.classList.add('ref');
  if (swatch.isBase) d.classList.add('base-color');
  if (opts.compact) d.classList.add('compact');

  d.style.background = swatch.hex;

  const step = el('div', 'swatch-step', String(swatch.step));
  const hex  = el('div', 'swatch-hex', swatch.hex);

  d.append(step, hex);
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
  const sec = section('Paleta główna', main.mode === 'symmetric' ? 'Symmetric (from base)' : 'Absolute');
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
    frag.appendChild(sec);
  });

  return frag;
}

/* ---------- FUNCTIONAL ---------- */
function renderFunctional(){
  const palettes = getFunctionalPalettes();
  const sec = section('Paleta funkcjonalna', '0 / 200 / 400 / 600 / 800');

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
  const sec = section('Paleta badge', 'stałe hue • 0 / 200 / 400 / 600 / 800');

  list.forEach(p => {
    const row = el('div', 'badge-row');
    row.appendChild(el('span', 'role-tag', `Hue ${p.index + 1}`));
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
