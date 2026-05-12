// ui/ui.controls.js
// UI controls only: inputs, sliders, batch, relations. No palette rendering.

import {
  setBaseRGB,
  setColorCount,
  addColor,
  removeColor,
  reorderColors,
  setRelation,
  setRelationDistance,
  setColorSlider,
  setPaletteMode,
  setScaleMode,
  setLock,
  getState,
  getWarnings,
  updateColorRole
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

/* ---------- REFRESH UI ---------- */
function refreshUI() {
  renderAllPalettes();
  renderSliders();
  renderWarnings();

  import('./ui.gradients.js').then(m => m.renderAllGradients());
  import('./ui.messages.js').then(m => m.renderMessages());
}

window.refreshUI = refreshUI;

/* ---------- BASE COLOR ---------- */
function onBaseChange(){
  const txtInput = $('textColor');
  const pickInput = $('baseColor');
  const txt = txtInput?.value || '';
  const pick = pickInput?.value || '';

  let rgb = parseHexOrRgb(txt);

  if (txt && !rgb) {
    txtInput.style.borderColor = 'red';
  } else if (txtInput) {
    txtInput.style.borderColor = '';
  }

  if (!rgb) {
    rgb = parseHexOrRgb(pick);
  }

  if (!rgb) return;

  updateBasePreview(rgb);
  setBaseRGB(rgb, null, null);
  clearGradientCache();

  refreshUI();
}

function setupBasePicker() {
    const preview = $('basePreview');
    const picker = $('baseColor');
    if (!preview || !picker) return;

    preview.addEventListener('click', () => picker.click());
    picker.addEventListener('input', () => {
        $('textColor').value = picker.value;
        onBaseChange();
    });
}

/* ---------- BATCH ---------- */
function setupBatch(){
  const container = $('batchContainer');
  if (!container) return;

  const wrap = document.createElement('div');
  wrap.className = 'group';
  wrap.innerHTML = `
    <label>Liczba kolorów</label>
    <div style="display:flex; gap:8px;">
        <input id="colorCount" type="number" min="1" value="3">
        <button id="applyCount">Generuj</button>
    </div>
  `;
  container.appendChild(wrap);

  wrap.querySelector('#applyCount').addEventListener('click', () => {
    const n = Math.max(1, Number(wrap.querySelector('#colorCount').value) || 1);
    setColorCount(n);
    clearGradientCache();
    refreshUI();
  });
}

/* ---------- RELATIONS ---------- */
function setupRelations(){
  const sel = $('harmony');
  if (!sel) return;

  const distContainer = document.createElement('div');
  distContainer.className = 'group';
  distContainer.innerHTML = `
    <label>Dystans relacji</label>
    <input id="relationDistance" type="range" min="0" max="180" value="30">
  `;
  sel.parentNode.insertBefore(distContainer, sel.nextSibling);

  const distInput = distContainer.querySelector('#relationDistance');
  distInput.addEventListener('input', e => {
      setRelationDistance(e.target.value);
      clearGradientCache();
      renderAllPalettes();
      import('./ui.gradients.js').then(m => m.renderAllGradients());
  });

  sel.addEventListener('change', () => {
    setRelation(sel.value);
    clearGradientCache();
    refreshUI();
  });
}

/* ---------- ADD COLOR ---------- */
function setupAddColor(){
  const btn = $('addColor');
  if (!btn) return;

  btn.addEventListener('click', () => {
    addColor();
    clearGradientCache();
    refreshUI();
  });
}

/* ---------- SLIDERS ---------- */
function renderSliders(){
  const list = $('colorList');
  if (!list) return;

  const state = getState();
  const existingCards = list.querySelectorAll('.color-card');

  if (existingCards.length !== state.colors.length) {
    list.innerHTML = '';
    state.colors.forEach(c => {
      const card = createSliderCard(c);
      list.appendChild(card);
    });
  } else {
    state.colors.forEach((c, i) => {
      const card = existingCards[i];
      const slider = card.querySelector('input[type="range"]');
      if (slider && document.activeElement !== slider) {
        slider.value = c.slider;
      }
      card.querySelector('strong').textContent = `Kolor ${c.index + 1}`;
      const roleSel = card.querySelector('select');
      if (roleSel && document.activeElement !== roleSel) {
          roleSel.value = c.role;
      }
    });
  }
}

function createSliderCard(c) {
  const card = document.createElement('div');
  card.className = 'color-card';
  card.dataset.index = c.index;
  card.draggable = true;

  const title = document.createElement('strong');
  title.textContent = `Kolor ${c.index + 1}`;

  const roleSelect = document.createElement('select');
  ['dominant', 'secondary', 'accent'].forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    opt.selected = c.role === r;
    roleSelect.appendChild(opt);
  });
  roleSelect.addEventListener('change', e => {
      updateColorRole(c.index, e.target.value);
      clearGradientCache();
      refreshUI();
  });

  const preview = document.createElement('div');
  preview.className = 'color-mini-preview';
  preview.id = `preview-${c.index}`;
  // Will be updated by renderer

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = 0;
  slider.max = 1;
  slider.step = 0.001;
  slider.value = c.slider;

  slider.addEventListener('input', e => {
    setColorSlider(c.index, Number(e.target.value));
    // Optimized: only render palettes and update gradients
    renderAllPalettes();
    import('./ui.gradients.js').then(m => m.renderAllGradients());
  });

  const del = document.createElement('button');
  del.textContent = 'Usuń';
  del.classList.add('btn-danger');
  del.addEventListener('click', () => {
    removeColor(c.index);
    clearGradientCache();
    refreshUI();
  });

  card.append(title, roleSelect, preview, slider, del);
  return card;
}

/* ---------- MODES ---------- */
function setupModes(){
  $('mode')?.addEventListener('change', e => {
    setPaletteMode(e.target.value);
    clearGradientCache();
    refreshUI();
  });

  document
    .querySelectorAll('input[name="scaleMode"]')
    .forEach(r => r.addEventListener('change', e => {
      setScaleMode(e.target.value);
      clearGradientCache();
      refreshUI();
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
    refreshUI();
  });
  wrap.querySelector('#lockC').addEventListener('change', e => {
    setLock('C', e.target.checked);
    clearGradientCache();
    refreshUI();
  });
}

function setupReorder() {
  const list = $('colorList');
  if (!list) return;

  list.addEventListener('dragstart', e => {
    if (e.target.classList.contains('color-card')) {
      e.dataTransfer.setData('text/plain', e.target.dataset.index);
    }
  });

  list.addEventListener('dragover', e => {
    e.preventDefault();
  });

  list.addEventListener('drop', e => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const targetCard = e.target.closest('.color-card');
    if (targetCard) {
      const toIndex = parseInt(targetCard.dataset.index);
      reorderColors(fromIndex, toIndex);
      clearGradientCache();
      refreshUI();
    }
  });
}

/* ---------- INIT ---------- */
export function initControls(){
  $('textColor')?.addEventListener('input', onBaseChange);

  setupBasePicker();
  setupBatch();
  setupRelations();
  setupAddColor();
  renderSliders();
  setupModes();
  setupLocks();
  setupReorder();

  onBaseChange();
}
