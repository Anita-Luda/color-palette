// ui/ui.controls.js
// Orchestration for UI controls.

import { getState, getWarnings, addManualColor } from '../engine/engine.core.js';
import { rgbToOklab, oklabToOklch } from '../engine/engine.math.js';
import { clearGradientCache } from '../engine/engine.gradients.js';
import { renderAllPalettes } from './ui.render.js';

import { onBaseChange, setupBasePicker, updateBaseContrastInfo, parseHexOrRgb } from './controls/ui.controls.base.js';
import { updateSidebarLayout, setupSidebarControls, setupCollapsibles, setupFloatingPanel } from './controls/ui.controls.sidebar.js';
import { setupPalettesControls, createSliderCard } from './controls/ui.controls.palettes.js';
import { setupContrastControls } from './controls/ui.controls.contrast.js';
import { setupExportControls } from './controls/ui.controls.export.js';

const $ = id => document.getElementById(id);

function refreshUI(differential = false) {
  updateSidebarLayout();
  renderAllPalettes(differential);
  renderSliders();
  renderWarnings();
  updateContrastInfos();
  updateContrastSidebarLabels();

  import('./ui.gradients.js').then(m => m.renderAllGradients());
}
window.refreshUI = refreshUI;

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

function updateContrastSidebarLabels() {
  const state = getState();
  const topLabel = $('active-bg-source-top');
  if (topLabel) {
      const source = state.mode.backgroundSource;
      topLabel.textContent = source === 'base' ? 'Tło z: Paleta Główna' : `Tło z: Kolor ${source + 1}`;
  }
  const glassLabel = $('active-glass-bg-source');
  if (glassLabel) {
      const source = state.mode.glassBackgroundSource;
      glassLabel.textContent = source === 'base' ? 'Tło z: Paleta Główna' : `Tło z: Kolor ${source + 1}`;
  }
}

function renderSliders(){
  const list = $('colorList');
  if (!list) return;
  const state = getState();
  const existingCards = list.querySelectorAll('.color-card');

  if (existingCards.length !== state.colors.length) {
    list.innerHTML = '';
    state.colors.forEach(c => list.appendChild(createSliderCard(c)));
  } else {
    state.colors.forEach((c, i) => {
      const card = existingCards[i];
      const slider = card.querySelector('input[type="range"]');
      if (slider && document.activeElement !== slider) slider.value = c.slider;
      card.querySelector('strong').textContent = `Kolor ${c.index + 1}`;
      const roleSel = card.querySelector('select');
      if (roleSel && document.activeElement !== roleSel) roleSel.value = c.role;

      const bgBtn = card.querySelector('.contrast-bg-btn');
      if (bgBtn) {
          if (state.mode.backgroundSource === c.index) bgBtn.classList.add('active');
          else bgBtn.classList.remove('active');
      }
      const gBgBtn = card.querySelector('.glass-bg-btn');
      if (gBgBtn) {
          if (state.mode.glassBackgroundSource === c.index) gBgBtn.classList.add('active');
          else gBgBtn.classList.remove('active');
      }
    });
  }

  const baseBgBtn = document.querySelector('#sec-base-color .contrast-bg-btn');
  if (baseBgBtn) {
      if (state.mode.backgroundSource === 'base') baseBgBtn.classList.add('active');
      else baseBgBtn.classList.remove('active');
  }
  const baseGlassBtn = document.querySelector('#sec-base-color .glass-bg-btn');
  if (baseGlassBtn) {
      if (state.mode.glassBackgroundSource === 'base') baseGlassBtn.classList.add('active');
      else baseGlassBtn.classList.remove('active');
  }
}

function updateContrastInfos() {
    updateBaseContrastInfo();
    const state = getState();
    import('../engine/engine.palettes.js').then(m => {
        const additional = m.getAdditionalPalettes();
        state.colors.forEach((c) => {
            const info = $(`contrast-info-${c.index}`);
            if (info) {
                const palette = additional.find(p => p.index === c.index);
                if (palette) {
                    const anchor = palette.scale.find(s => s.isBase) || palette.scale[50];
                    const ratio = 4.5; // Dummy or compute if needed
                    info.textContent = `Kontrast: ...`; // Simplification
                }
            }
        });
    });
}

function setupAddManualColor() {
  const manualBtn = $('addManualColorBtn');
  const manualInput = $('addManualColorInput');
  const msgBox = $('manualColorMsg');
  if (manualBtn && manualInput) {
    manualBtn.addEventListener('click', () => {
        const val = manualInput.value;
        const rgb = parseHexOrRgb(val);
        if (!rgb) {
            import('./ui.messages.js').then(m => m.renderMessages(msgBox, 'error', 'Błędny format koloru (użyj HEX lub RGB).'));
            return;
        }
        const lch = oklabToOklch(rgbToOklab(rgb.r, rgb.g, rgb.b));
        addManualColor(val, lch, 0.5);
        manualInput.value = '';
        clearGradientCache();
        refreshUI();
        import('./ui.messages.js').then(m => m.renderMessages(msgBox, 'success', 'Dodano pomyślnie.'));
    });
  }
}

function setupReorder() {
  const list = $('colorList');
  if (!list) return;
  list.addEventListener('dragstart', e => { if (e.target.classList.contains('color-card')) e.dataTransfer.setData('text/plain', e.target.dataset.index); });
  list.addEventListener('dragover', e => e.preventDefault());
  list.addEventListener('drop', e => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const targetCard = e.target.closest('.color-card');
    if (targetCard) {
      import('../../engine/engine.core.js').then(m => {
          m.reorderColors(fromIndex, parseInt(targetCard.dataset.index));
          clearGradientCache();
          refreshUI();
      });
    }
  });
}

export function initControls(){
  $('textColor')?.addEventListener('input', onBaseChange);
  setupBasePicker();
  setupSidebarControls();
  setupPalettesControls();
  setupContrastControls();
  setupExportControls();
  setupAddManualColor();
  setupReorder();
  setupCollapsibles();
  setupFloatingPanel();

  $('clipping-info-btn')?.addEventListener('click', () => {
      alert("Kropki sygnalizują Gamut Clipping (redukcję nasycenia dla sRGB/P3).");
  });

  updateSidebarLayout();
  onBaseChange();
}
