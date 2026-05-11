// ui/ui.controls.js
// UI controls only: inputs, sliders, batch, relations. No palette rendering.

import {
  setBaseRGB,
  setColorCount,
  addColor,
  removeColor,
  reorderColors,
  setRelation,
  setColorSlider,
  setPaletteMode,
  setScaleMode,
  setLock,
  getState,
  getWarnings
} from '../engine/engine.core.js';

import { clearGradientCache } from '../engine/engine.gradients.js';
import { renderAllPalettes } from './ui.render.js';

/* ---------- HELPERS ---------- */
const $ = id => document.getElementById(id);

function parseHexOrRgb(value){
  if (!value) return null;

  const v = value.trim();
  if (/^#([0-9a-fA-F]{6})$/.test(v)) {
    return {
      r: parseInt(v.slice(1,3),16),
      g: parseInt(v.slice(3,5),16),
      b: parseInt(v.slice(5,7),16)
    };
  }

  const m = v.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (m) {
    return { r:+m[1], g:+m[2], b:+m[3] };
  }

  return null;
}

function updateBasePreview(rgb){
  const el = $('basePreview');
  if (!el) return;
  el.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function renderWarnings(){
  let box = $('warnings');
  if (!box) {
    box = document.createElement('div');
    box.id = 'warnings';
    box.className = 'group';
    $('sidebar').appendChild(box);
  }
  const warnings = getWarnings();
  box.innerHTML = warnings.length
    ? `<strong>Uwaga:</strong><ul>${warnings.map(w=>`<li>${w}</li>`).join('')}</ul>`
    : '';
}

/* ---------- BASE COLOR ---------- */
function onBaseChange(){
  const txt = $('textColor')?.value || '';
  const pick = $('baseColor')?.value || '';

  const rgb =
    parseHexOrRgb(txt) ||
    parseHexOrRgb(pick);

  if (!rgb) return;

  updateBasePreview(rgb);
  setBaseRGB(rgb, null, null); // LCH/step computed downstream
  clearGradientCache();
  renderAllPalettes();
  renderWarnings();
}

/* ---------- BATCH ---------- */
function setupBatch(){
  const wrap = document.createElement('div');
  wrap.className = 'group';
  wrap.innerHTML = `
    <label>Liczba kolorów</label>
    <input id="colorCount" type="number" min="1" value="3">
    <button id="applyCount">Generuj</button>
  `;
  $('sidebar').appendChild(wrap);

  wrap.querySelector('#applyCount').addEventListener('click', () => {
    const n = Math.max(1, Number(wrap.querySelector('#colorCount').value) || 1);
    setColorCount(n);
    clearGradientCache();
    renderAllPalettes();
    renderWarnings();
  });
}

/* ---------- RELATIONS ---------- */
function setupRelations(){
  const sel = $('harmony');
  if (!sel) return;

  sel.addEventListener('change', () => {
    setRelation(sel.value);
    clearGradientCache();
    renderAllPalettes();
    renderWarnings();
  });
}

/* ---------- ADD COLOR ---------- */
function setupAddColor(){
  const btn = $('addColor');
  if (!btn) return;

  btn.addEventListener('click', () => {
    addColor();
    clearGradientCache();
    renderAllPalettes();
    renderWarnings();
  });
}

/* ---------- SLIDERS ---------- */
function setupSliders(){
  const list = $('colorList');
  if (!list) return;

  function renderSliders(){
    list.innerHTML = '';
    const state = getState();

    state.colors.forEach(c => {
      const card = document.createElement('div');
      card.className = 'color-card';

      const title = document.createElement('strong');
      title.textContent = `Kolor ${c.index + 1}`;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = 0;
      slider.max = 1;
      slider.step = 0.001;
      slider.value = c.slider;

      slider.addEventListener('input', e => {
        setColorSlider(c.index, Number(e.target.value));
        renderAllPalettes(); // tylko palety, nie przebudowa UI
      });

      const del = document.createElement('button');
      del.textContent = 'Usuń';
      del.addEventListener('click', () => {
        removeColor(c.index);
        clearGradientCache();
        renderSliders();
        renderAllPalettes();
        renderWarnings();
      });

      card.append(title, slider, del);
      list.appendChild(card);
    });
  }

  // initial render
  renderSliders();

  // re-render sliders when palettes change count/order
  const observer = new MutationObserver(() => renderSliders());
  observer.observe($('output'), { childList: true });
}

/* ---------- MODES ---------- */
function setupModes(){
  $('mode')?.addEventListener('change', e => {
    setPaletteMode(e.target.value);
    clearGradientCache();
    renderAllPalettes();
  });

  document
    .querySelectorAll('input[name="scaleMode"]')
    .forEach(r => r.addEventListener('change', e => {
      setScaleMode(e.target.value);
      clearGradientCache();
      renderAllPalettes();
    }));
}

/* ---------- LOCKS ---------- */
function setupLocks(){
  const wrap = document.createElement('div');
  wrap.className = 'group';
  wrap.innerHTML = `
    <label><input type="checkbox" id="lockL"> Lock L</label>
    <label><input type="checkbox" id="lockC"> Lock C</label>
  `;
  $('sidebar').appendChild(wrap);

  wrap.querySelector('#lockL').addEventListener('change', e => {
    setLock('L', e.target.checked);
    clearGradientCache();
    renderAllPalettes();
  });
  wrap.querySelector('#lockC').addEventListener('change', e => {
    setLock('C', e.target.checked);
    clearGradientCache();
    renderAllPalettes();
  });
}

/* ---------- INIT ---------- */
export function initControls(){
  $('textColor')?.addEventListener('input', onBaseChange);
  $('baseColor')?.addEventListener('input', onBaseChange);

  setupBatch();
  setupRelations();
  setupAddColor();
  setupSliders();
  setupModes();
  setupLocks();

  onBaseChange();
}
