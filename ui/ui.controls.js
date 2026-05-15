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
  setAlgorithmMode,
  setDarkModeBoost,
  setNeonBoost,
  setPastelBoost,
  setGlassmorphismBoost,
  setInkSaveMode,
  setSpectralBalance,
  setPerceptualPolish,
  setInterpolationMode,
  setGamutProfile,
  setChromaShapingFactor,
  setLock,
  getState,
  getWarnings,
  updateColorRole,
  setView,
  setContrastSettings,
  setGranularity,
  setBackgroundMode,
  setBackgroundSource,
  setSidebarPosition,
  setSidebarTheme,
  setSidebarVisibility,
  toggleIgnoredThreshold,
  addManualColor,
  addGrayPalette
} from '../engine/engine.core.js';

import { rgbToOklab, oklabToOklch, rgbToHex } from '../engine/engine.math.js';
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
  updateSidebarLayout();
  renderAllPalettes();
  renderSliders();
  renderWarnings();
  updateContrastInfos();
  updateContrastSidebarLabels();
  updateDegreeDisplay();

  // Gradients are recalculated here (base color change / batch change)
  import('./ui.gradients.js').then(m => m.renderAllGradients());
  import('./ui.messages.js').then(m => m.renderMessages());
}

function updateDegreeDisplay() {
    const state = getState();
    const label = document.querySelector('label[for="relationDistance"]');
    if (label) {
        label.textContent = `Dystans relacji (${state.relation.distance}°)`;
    }
}

function updateSidebarLayout() {
    const state = getState();
    const body = document.body;

    // Update active pos button
    document.querySelectorAll('.pos-btn').forEach(btn => {
        if (btn.dataset.val === state.mode.sidebarPosition) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Clear previous classes
    body.classList.remove('pos-left', 'pos-right', 'pos-top', 'pos-bottom', 'pos-floating');
    body.classList.add(`pos-${state.mode.sidebarPosition}`);

    body.classList.remove('sb-dark', 'sb-light');
    body.classList.add(`sb-${state.mode.sidebarTheme}`);

    if (state.mode.sidebarVisible) {
        body.classList.remove('sb-hidden');
    } else {
        body.classList.add('sb-hidden');
    }

    // Sync form elements
    const boostToggle = $('boost-toggle');
    if (boostToggle) boostToggle.checked = state.mode.darkModeBoost;

    const neonToggle = $('neon-toggle');
    if (neonToggle) neonToggle.checked = state.mode.neonBoost;

    const pastelToggle = $('pastel-toggle');
    if (pastelToggle) pastelToggle.checked = state.mode.pastelBoost;

    const glassToggle = $('glass-toggle');
    if (glassToggle) glassToggle.checked = state.mode.glassmorphismBoost;

    const inkToggle = $('ink-toggle');
    if (inkToggle) inkToggle.checked = state.mode.inkSaveMode;

    const spectralToggle = $('spectral-toggle');
    if (spectralToggle) spectralToggle.checked = state.mode.spectralBalance;

    const polishToggle = $('polish-toggle');
    if (polishToggle) polishToggle.checked = state.mode.perceptualPolish;

    const labelShaping = $('label-shaping');
    if (labelShaping) labelShaping.textContent = `Chroma Shaping: ${state.mode.chromaShapingFactor.toFixed(2)}`;

    document.querySelectorAll('input[name="interpMode"]').forEach(r => {
        r.checked = (r.value === state.mode.interpolation);
    });

    document.querySelectorAll('input[name="gamutMode"]').forEach(r => {
        r.checked = (r.value === state.mode.gamutProfile);
    });

    document.querySelectorAll('input[name="contrastAlgo"]').forEach(r => {
        r.checked = (r.value === state.contrastSettings.algorithm);
    });

    document.querySelectorAll('input[name="algoMode"]').forEach(r => {
        r.checked = (r.value === state.mode.algorithm);
    });
}

function updateContrastSidebarLabels() {
  const state = getState();
  const topLabel = $('active-bg-source-top');
  if (topLabel) {
      const source = state.mode.backgroundSource;
      if (source === 'base') {
          topLabel.textContent = 'Tło z: Paleta Główna';
      } else {
          topLabel.textContent = `Tło z: Kolor ${source + 1}`;
      }
  }
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
  const lch = oklabToOklch(rgbToOklab(rgb.r, rgb.g, rgb.b));
  setBaseRGB(rgb, lch, null);
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
    bgBtn.className = 'bg-source-btn primary';
    bgBtn.textContent = 'Ustaw jako tło';
    bgBtn.style.marginTop = '8px';
    bgBtn.onclick = () => {
        setBackgroundSource('base');
        refreshUI();
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
  distContainer.className = 'rel-dist-group';
  distContainer.innerHTML = `
    <label for="relationDistance">Dystans relacji</label>
    <input id="relationDistance" type="range" min="0" max="180" value="30">
  `;
  sel.parentNode.insertBefore(distContainer, sel.nextSibling);

  const distInput = distContainer.querySelector('#relationDistance');
  distInput.addEventListener('input', e => {
      setRelationDistance(e.target.value);
      updateDegreeDisplay();
      clearGradientCache();
      renderAllPalettes(true);
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
  bgBtn.className = 'bg-source-btn primary';
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
    renderAllPalettes(true);
    // Refresh sidebar previews immediately for feedback
    import('./ui.render.js').then(m => m.updateSidebarPreviews());
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
  document.querySelectorAll('input[name="mode"]').forEach(r => {
      r.addEventListener('change', e => {
          setPaletteMode(e.target.value);
          setContrastSettings('brightness', 0);
          const slider = $('contrast-brightness-top');
          if (slider) slider.value = 0;
          clearGradientCache();
          refreshUI();
      });
  });

  document.querySelectorAll('input[name="previewBg"]').forEach(r => {
      r.addEventListener('change', e => {
          const mode = e.target.value;
          setBackgroundMode(mode);
          const out = $('output');
          if (mode === 'dark') {
              out.classList.add('preview-dark');
              out.classList.remove('preview-light');
          } else {
              out.classList.add('preview-light');
              out.classList.remove('preview-dark');
          }
          renderAllPalettes();
      });
  });

  document.querySelectorAll('input[name="viewMode"]').forEach(r => {
      r.addEventListener('change', e => {
          const view = e.target.value;
          setView(view);
          const contrastSec = $('sec-contrast');
          if (view === 'contrast') {
              if (contrastSec) contrastSec.style.display = 'block';
          } else {
              if (contrastSec) contrastSec.style.display = 'none';
          }
          refreshUI();
      });
  });

  document.querySelectorAll('input[name="scaleMode"]').forEach(r => r.addEventListener('change', e => {
      setScaleMode(e.target.value);
      clearGradientCache();
      refreshUI();
  }));

  document.querySelectorAll('input[name="algoMode"]').forEach(r => r.addEventListener('change', e => {
      setAlgorithmMode(e.target.value);
      clearGradientCache();
      refreshUI();
  }));

  $('boost-toggle')?.addEventListener('change', e => {
      setDarkModeBoost(e.target.checked);
      clearGradientCache();
      refreshUI();
  });

  $('neon-toggle')?.addEventListener('change', e => {
      setNeonBoost(e.target.checked);
      clearGradientCache();
      refreshUI();
  });

  $('pastel-toggle')?.addEventListener('change', e => {
      setPastelBoost(e.target.checked);
      clearGradientCache();
      refreshUI();
  });

  $('glass-toggle')?.addEventListener('change', e => {
      setGlassmorphismBoost(e.target.checked);
      clearGradientCache();
      refreshUI();
  });

  $('ink-toggle')?.addEventListener('change', e => {
      setInkSaveMode(e.target.checked);
      clearGradientCache();
      refreshUI();
  });

  $('spectral-toggle')?.addEventListener('change', e => {
      setSpectralBalance(e.target.checked);
      clearGradientCache();
      refreshUI();
  });

  $('polish-toggle')?.addEventListener('change', e => {
      setPerceptualPolish(e.target.checked);
      clearGradientCache();
      refreshUI();
  });

  document.querySelectorAll('input[name="interpMode"]').forEach(r => {
      r.addEventListener('change', e => {
          setInterpolationMode(e.target.value);
          clearGradientCache();
          refreshUI();
      });
  });

  document.querySelectorAll('input[name="gamutMode"]').forEach(r => {
      r.addEventListener('change', e => {
          setGamutProfile(e.target.value);
          clearGradientCache();
          refreshUI();
      });
  });

  $('shaping-slider')?.addEventListener('input', e => {
      setChromaShapingFactor(e.target.value);
      const label = $('label-shaping');
      if (label) label.textContent = `Chroma Shaping: ${Number(e.target.value).toFixed(2)}`;
      clearGradientCache();
      renderAllPalettes(true);
  });
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

function setupCollapsibles() {
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.sidebar-header');
        if (!header) return;
        if (e.target.closest('button')) return;

        const section = header.closest('.sidebar-section');
        if (section && section.classList.contains('collapsible')) {
            section.classList.toggle('collapsed');
        }
    });
}

function setupFloatingPanel() {
    const sidebar = $('sidebar');
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    sidebar.addEventListener('mousedown', e => {
        const state = getState();
        if (state.mode.sidebarPosition !== 'floating') return;
        if (e.target.closest('input, select, button, .big-swatch')) return;

        isDragging = true;
        offset.x = e.clientX - sidebar.offsetLeft;
        offset.y = e.clientY - sidebar.offsetTop;
        sidebar.style.transition = 'none';
    });

    document.addEventListener('mousemove', e => {
        if (!isDragging) return;
        sidebar.style.left = (e.clientX - offset.x) + 'px';
        sidebar.style.top = (e.clientY - offset.y) + 'px';
        sidebar.style.bottom = 'auto';
        sidebar.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        sidebar.style.transition = '';
    });
}

function setupContrastSliders() {
    const bTop = $('contrast-brightness-top');
    const bBoostTop = $('contrast-boost-top');

    document.querySelectorAll('input[name="contrastAlgo"]').forEach(r => {
        r.addEventListener('change', e => {
            setContrastSettings('algorithm', e.target.value);
            renderAllPalettes();
        });
    });

    bTop?.addEventListener('input', e => {
        setContrastSettings('brightness', e.target.value);
        renderAllPalettes();
    });
    bBoostTop?.addEventListener('input', e => {
        setContrastSettings('boost', e.target.value);
        renderAllPalettes();
    });

    document.querySelectorAll('.ignore-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Find all buttons with same data-val to sync them
            const val = btn.dataset.val;
            const allOfSameVal = document.querySelectorAll(`.ignore-btn[data-val="${val}"]`);

            const isActivating = !btn.classList.contains('active');

            allOfSameVal.forEach(b => {
                if (isActivating) b.classList.add('active');
                else b.classList.remove('active');
            });

            toggleIgnoredThreshold(val);
            renderAllPalettes();
        });
    });
}

function setupSidebarControls() {
    const posBtns = document.querySelectorAll('.pos-btn');
    const hideBtn = $('hide-panel-btn');
    const toggleBtn = $('panel-toggle');
    const themeRadios = document.querySelectorAll('input[name="sbTheme"]');

    posBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setSidebarPosition(btn.dataset.val);
            const sidebar = $('sidebar');
            sidebar.style.left = ''; sidebar.style.top = ''; sidebar.style.bottom = ''; sidebar.style.right = '';
            refreshUI();
        });
    });

    hideBtn?.addEventListener('click', () => {
        setSidebarVisibility(false);
        refreshUI();
    });

    toggleBtn?.addEventListener('click', () => {
        setSidebarVisibility(true);
        refreshUI();
    });

    themeRadios.forEach(r => {
        r.addEventListener('change', e => {
            const theme = e.target.value;
            setSidebarTheme(theme);

            const pbgDark = $('pbg-dark');
            const pbgLight = $('pbg-light');

            if (theme === 'dark') {
                setBackgroundMode('dark');
                if (pbgDark) pbgDark.checked = true;
                $('output').classList.add('preview-dark');
                $('output').classList.remove('preview-light');
            } else {
                setBackgroundMode('light');
                if (pbgLight) pbgLight.checked = true;
                $('output').classList.add('preview-light');
                $('output').classList.remove('preview-dark');
            }

            refreshUI();
        });
    });
}

function setupExport() {
    const exportBtns = [
        'export-figma-btn',
        'export-figma-func-btn',
        'export-figma-badge-btn',
        'export-figma-contrast-btn'
    ];

    exportBtns.forEach(id => {
        $(id)?.addEventListener('click', (e) => {
            const type = e.target.dataset.type || 'main';
            import('./ui.render.js').then(m => {
                const svg = m.generateExportSVG(type);
                navigator.clipboard.writeText(svg).then(() => {
                    alert(`SVG (${type}) skopiowano do schowka. Możesz teraz wkleić go bezpośrednio w Figmie.`);
                });
            });
        });
    });

    $('copy-hex-list-btn')?.addEventListener('click', () => {
        import('./ui.render.js').then(m => {
            const hexes = m.getAllVisibleHexes();
            const list = Array.from(new Set(hexes)).join(', ');
            navigator.clipboard.writeText(list).then(() => {
                alert('Skopiowano listę unikatowych HEXów.');
            });
        });
    });
}

/* ---------- INIT ---------- */
export function initControls(){
  $('textColor')?.addEventListener('input', onBaseChange);

  setupSidebarControls();
  setupBasePicker();
  setupBatch();
  setupRelations();
  setupAddColor();
  renderSliders();
  setupModes();
  setupLocks();
  setupGranularity();
  setupReorder();
  setupCollapsibles();
  setupContrastSliders();
  setupFloatingPanel();
  setupExport();

  updateSidebarLayout();
  onBaseChange();
}
