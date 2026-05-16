// ui/render/ui.render.palettes.js
import { getMainPalette, getAdditionalPalettes, getFunctionalPalettes, getBadgePalettes } from '../../engine/engine.palettes.js';
import { getState } from '../../engine/engine.core.js';
import { renderScale } from './ui.render.swatch.js';

function el(tag, cls, text){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function section(title, subtitle){
  const wrap = el('section', 'palette');
  const head = el('div', 'palette-title');
  head.appendChild(el('strong', null, title));
  if (subtitle) head.appendChild(el('span', 'palette-subtitle', subtitle));
  wrap.appendChild(head);
  return wrap;
}

export function renderMain(){
  const main = getMainPalette();
  const state = getState();
  const sec = section('Paleta główna', state.mode.scale.toUpperCase());
  sec.appendChild(renderScale(main.scale));
  return sec;
}

export function renderAdditional(){
  const list = getAdditionalPalettes();
  const frag = document.createDocumentFragment();
  list.forEach(p => {
    const sec = section(`Kolor ${p.index + 1}`, p.role);
    sec.appendChild(renderScale(p.scale));
    frag.appendChild(sec);
  });
  return frag;
}

export function renderFunctional(){
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

export function renderBadge(){
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
