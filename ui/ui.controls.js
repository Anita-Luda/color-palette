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
  updateColorRole,
  setView,
  setContrastSettings,
  setGranularity,
  setBackgroundMode,
  setBackgroundSource,
  toggleIgnoredThreshold,
  addManualColor,
  addGrayPalette
} from '../engine/engine.core.js';

import { rgbToOklab, oklabToOklch, rgbToHex } from '../engine/engine.scales.js';
import { clearGradientCache } from '../engine/engine.gradients.js';
import { renderAllPalettes } from './ui.render.js';
import { contrastRatio } from '../engine/engine.accessibility.js';

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
  updateContrastInfos();

  // Gradients are recalculated here (base color change / batch change)
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

    const bgBtn = document.createElement('button');
    bgBtn.id = 'base-bg-btn';
    bgBtn.className = 'bg-source-btn';
    bgBtn.textContent = 'Ustaw jako tło';
    bgBtn.style.marginTop = '8px';
    bgBtn.onclick = () => {
        import('../engine/engine.core.js').then(m => {
            m.setBackgroundSource('base');
            refreshUI();
        });
    };
    preview.parentNode.appendChild(bgBtn);

    const contrastInfo = document.createElement('div');
    contrastInfo.id = 'base-contrast-info';
    contrastInfo.style.fontSize = '0.75rem';
    contrastInfo.style.marginTop = '4px';
    contrastInfo.style.opacity = '0.8';
    preview.parentNode.appendChild(contrastInfo);
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
      // Gradients depend on base LCH and role mult, not relation distance itself usually,
      // but if relation changes roles or hues, we refresh.
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
  if (btn) {
    btn.addEventListener('click', () => {
      addColor();
      clearGradientCache();
      refreshUI();
    });
  }

  const grayBtn = $('addGrayBtn');
  if (grayBtn) {
    grayBtn.addEventListener('click', () => {
      addGrayPalette();
      clearGradientCache();
      refreshUI();
    });
  }

  const manualBtn = $('addManualColorBtn');
  const manualInput = $('addManualColorInput');
  const msgBox = $('manualColorMsg');

  if (manualBtn && manualInput) {
    manualBtn.addEventListener('click', () => {
        const val = manualInput.value;
        const rgb = parseHexOrRgb(val);
        if (!rgb) {
            msgBox.textContent = 'Błędny format koloru.';
            return;
        }

        const lch = oklabToOklch(rgbToOklab(rgb.r, rgb.g, rgb.b));

        // Suggestion logic: check if "fits"
        // For now, any color is added, but we could check if hue is already taken.
        // The user says: "jeżeli pasują ... jeżeli nie pasują, to powiadom ... i zaproponuj korektę na najbliższy pasujący"
        // Let's implement a simple check: is it within 15 degrees of any existing?
        const state = getState();
        const baseLch = oklabToOklch(rgbToOklab(state.base.rgb.r, state.base.rgb.g, state.base.rgb.b));

        let conflict = Math.abs(lch.h - baseLch.h) < 15 || Math.abs(lch.h - baseLch.h) > 345;
        if (!conflict) {
            for (const c of state.colors) {
                if (c.manualLCH && (Math.abs(lch.h - c.manualLCH.h) < 15 || Math.abs(lch.h - c.manualLCH.h) > 345)) {
                    conflict = true; break;
                }
            }
        }

        if (conflict) {
            if (confirm(`Kolor ${val} jest zbyt blisko istniejących barw. Czy skorygować go do najbliższej wolnej przestrzeni?`)) {
                // simple shift
                lch.h = (lch.h + 30) % 360;
                addManualColor(null, lch, 0.5);
                msgBox.textContent = 'Dodano skorygowany kolor.';
            } else {
                addManualColor(val, lch, 0.5);
                msgBox.textContent = 'Dodano kolor bez korekty.';
            }
        } else {
            addManualColor(val, lch, 0.5);
            msgBox.textContent = 'Kolor dodany.';
        }

        manualInput.value = '';
        clearGradientCache();
        refreshUI();
    });
  }
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

      const bgBtn = card.querySelector('.bg-source-btn');
      if (bgBtn) {
          if (state.mode.backgroundSource === c.index) bgBtn.classList.add('active');
          else bgBtn.classList.remove('active');
      }
    });
  }

  const baseBgBtn = $('base-bg-btn');
  if (baseBgBtn) {
      if (state.mode.backgroundSource === 'base') baseBgBtn.classList.add('active');
      else baseBgBtn.classList.remove('active');
  }
}

function updateContrastInfos() {
    const state = getState();
    const bgMode = state.mode.background;
    const bgHex = bgMode === 'dark' ? '#000000' : '#FFFFFF';

    // Base
    const baseInfo = $('base-contrast-info');
    if (baseInfo) {
        const hex = rgbToHex(state.base.rgb);
        const ratio = contrastRatio(bgHex, hex);
        baseInfo.textContent = `Kontrast: ${ratio.toFixed(2)}:1`;
    }

    // Additional
    import('../engine/engine.palettes.js').then(m => {
        const additional = m.getAdditionalPalettes();
        state.colors.forEach((c, i) => {
            const info = $(`contrast-info-${c.index}`);
            if (info) {
                const palette = additional.find(p => p.index === c.index);
                if (palette) {
                    const anchor = palette.scale.find(s => s.isBase) || palette.scale[50];
                    const ratio = contrastRatio(bgHex, anchor.hex);
                    info.textContent = `Kontrast: ${ratio.toFixed(2)}:1`;
                }
            }
        });
    });
}

function createSliderCard(c) {
  const state = getState();
  const card = document.createElement('div');
  card.className = 'color-card';
  card.dataset.index = c.index;
  card.draggable = true;

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';

  const title = document.createElement('strong');
  title.textContent = `Kolor ${c.index + 1}`;

  const hexLabel = document.createElement('span');
  hexLabel.className = 'swatch-hex';
  hexLabel.style.fontSize = '0.7rem';
  hexLabel.id = `hex-val-${c.index}`;

  header.append(title, hexLabel);

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

  const bgBtn = document.createElement('button');
  bgBtn.className = 'bg-source-btn';
  bgBtn.textContent = 'Ustaw jako tło';
  bgBtn.style.width = '100%';
  bgBtn.style.marginBottom = '8px';
  if (state.mode.backgroundSource === c.index) bgBtn.classList.add('active');
  bgBtn.onclick = () => {
      setBackgroundSource(c.index);
      refreshUI();
  };

  const contrastInfo = document.createElement('div');
  contrastInfo.className = 'card-contrast-info';
  contrastInfo.id = `contrast-info-${c.index}`;
  contrastInfo.style.fontSize = '0.75rem';
  contrastInfo.style.marginBottom = '8px';
  contrastInfo.style.opacity = '0.8';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = 0;
  slider.max = 1;
  slider.step = 0.001;
  slider.value = c.slider;

  slider.addEventListener('input', e => {
    setColorSlider(c.index, Number(e.target.value));
    // Optimized: only render palettes
    // Gradients are NOT recalculated here to avoid jumping and for performance
    renderAllPalettes(true);
  });

  const del = document.createElement('button');
  del.textContent = 'Usuń';
  del.classList.add('btn-danger');
  del.addEventListener('click', () => {
    removeColor(c.index);
    clearGradientCache();
    refreshUI();
  });

  card.append(header, roleSelect, preview, bgBtn, contrastInfo, slider, del);
  return card;
}

/* ---------- MODES ---------- */
function setupModes(){
  $('mode')?.addEventListener('change', e => {
    setPaletteMode(e.target.value);
    clearGradientCache();
    refreshUI();
  });

  $('previewBg')?.addEventListener('change', e => {
      const mode = e.target.value;
      setBackgroundMode(mode);

      const out = $('output');
      if (mode === 'dark') {
          document.body.classList.add('preview-dark');
          document.body.classList.remove('preview-light');
          out.classList.add('preview-dark');
          out.classList.remove('preview-light');
      } else {
          document.body.classList.add('preview-light');
          document.body.classList.remove('preview-dark');
          out.classList.add('preview-light');
          out.classList.remove('preview-dark');
      }
      // No need for refreshUI if only CSS classes change, but let's be safe
      renderAllPalettes();
  });

  document
    .querySelectorAll('input[name="scaleMode"]')
    .forEach(r => r.addEventListener('change', e => {
      const mode = e.target.value === 'symmetric' ? 'asymmetric' : 'absolute';
      setScaleMode(mode);
      clearGradientCache();
      refreshUI();
    }));
}

function setupGranularity() {
    document.querySelectorAll('.gran-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.gran-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setGranularity(btn.dataset.val);
            renderAllPalettes();
        });
    });
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

function setupTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const view = btn.dataset.view;
            setView(view);

            // Toggle sidebar controls
            const contrastCtrl = $('contrast-controls');
            // DLA PALETY KONTRASTÓW PANEL STEROWANIA NIE POWINIEN ZNIKAĆ.
            // I interpret this as "sidebar should stay", but we might still hide/show specific knobs.
            // The user says "Dla palety kontrasttów panel sterowania nie powinien znikać"
            // but the original code hid everything else. Let's keep things visible as much as possible.

            if (view === 'contrast') {
                contrastCtrl.style.display = 'block';
            } else {
                contrastCtrl.style.display = 'none';
            }

            refreshUI();
        });
    });
}

function setupContrastSliders() {
    $('contrast-brightness')?.addEventListener('input', e => {
        setContrastSettings('brightness', e.target.value);
        renderAllPalettes(); // just re-render grid
    });
    $('contrast-boost')?.addEventListener('input', e => {
        setContrastSettings('boost', e.target.value);
        renderAllPalettes(); // just re-render grid
    });

    document.querySelectorAll('.ignore-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            toggleIgnoredThreshold(Number(btn.dataset.val));
            renderAllPalettes();
        });
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
  setupGranularity();
  setupReorder();
  setupTabs();
  setupContrastSliders();

  onBaseChange();
}
