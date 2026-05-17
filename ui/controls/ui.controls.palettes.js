// ui/controls/ui.controls.palettes.js
import {
    setColorCount, addColor, addGrayPalette, addManualColor,
    setColorSlider, setPaletteMode, setScaleMode, setAlgorithmMode,
    setDarkModeBoost, setLightModeBoost, setNeonBoost, setPastelBoost, setGlassmorphismBoost,
    setInkSaveMode, setSpectralBalance, setPerceptualPolish, setInterpolationMode,
    setGamutProfile, setChromaShapingFactor, setGranularity, setView,
    updateColorRole, removeColor, setBackgroundSource, setGlassBackgroundSource,
    getState, setRelation, setRelationDistance, setLock
} from '../../engine/engine.core.js';
import { clearGradientCache } from '../../engine/engine.gradients.js';
import { rgbToOklab, oklabToOklch, rgbToHex } from '../../engine/engine.math.js';
import { contrastRatio } from '../../engine/engine.accessibility.js';
import { renderAllPalettes } from '../ui.render.js';

const $ = id => document.getElementById(id);

export function setupPalettesControls() {
    // Modes
    document.querySelectorAll('input[name="mode"]').forEach(r => {
        r.addEventListener('change', e => {
            setPaletteMode(e.target.value);
            if (window.refreshUI) window.refreshUI();
        });
    });

    document.querySelectorAll('input[name="viewMode"]').forEach(r => {
        r.addEventListener('change', e => {
            const view = e.target.value;
            setView(view);
            const contrastSec = $('sec-contrast');
            if (contrastSec) contrastSec.style.display = view === 'contrast' ? 'block' : 'none';
            const glassSec = $('sec-glass-settings');
            if (glassSec) glassSec.style.display = view === 'glass' ? 'block' : 'none';
            if (window.refreshUI) window.refreshUI();
        });
    });

    document.querySelectorAll('input[name="scaleMode"]').forEach(r => r.addEventListener('change', e => {
        setScaleMode(e.target.value);
        clearGradientCache();
        if (window.refreshUI) window.refreshUI();
    }));

    document.querySelectorAll('input[name="algoMode"]').forEach(r => r.addEventListener('change', e => {
        setAlgorithmMode(e.target.value);
        clearGradientCache();
        if (window.refreshUI) window.refreshUI();
    }));

    // Boosts
    const toggles = {
        'boost-toggle': setDarkModeBoost,
        'light-mode-boost-toggle': setLightModeBoost,
        'neon-toggle': setNeonBoost,
        'pastel-toggle': setPastelBoost,
        'glass-toggle': setGlassmorphismBoost,
        'ink-toggle': setInkSaveMode,
        'spectral-toggle': setSpectralBalance,
        'polish-toggle': setPerceptualPolish
    };
    for (const [id, fn] of Object.entries(toggles)) {
        $(id)?.addEventListener('change', e => {
            fn(e.target.checked);
            clearGradientCache();
            if (window.refreshUI) window.refreshUI();
        });
    }

    document.querySelectorAll('input[name="interpMode"]').forEach(r => {
        r.addEventListener('change', e => {
            setInterpolationMode(e.target.value);
            clearGradientCache();
            if (window.refreshUI) window.refreshUI();
        });
    });

    document.querySelectorAll('input[name="gamutMode"]').forEach(r => {
        r.addEventListener('change', e => {
            setGamutProfile(e.target.value);
            clearGradientCache();
            if (window.refreshUI) window.refreshUI();
        });
    });

    $('shaping-slider')?.addEventListener('input', e => {
        setChromaShapingFactor(e.target.value);
        const label = $('label-shaping');
        if (label) label.textContent = `Chroma Shaping: ${Number(e.target.value).toFixed(2)}`;
        clearGradientCache();
        if (window.refreshUI) window.refreshUI(true);
    });

    // Granularity
    document.querySelectorAll('.gran-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.gran-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setGranularity(btn.dataset.val);
            renderAllPalettes();
        });
    });

    // Relations
    $('harmony')?.addEventListener('change', e => {
        const type = e.target.value;
        setRelation(type);

        // Relation Enforcement
        const state = getState();
        let limit = 10;
        if (type === 'complementary') limit = 1;
        if (type === 'triadic' || type === 'split') limit = 2;
        if (type === 'tetradic') limit = 3;

        if (state.colors.length > limit) {
            if (confirm(`Relacja ${type} obsługuje optymalnie do ${limit} dodatkowych kolorów. Czy zredukować liczbę kolorów?`)) {
                setColorCount(limit);
            }
        }

        clearGradientCache();
        if (window.refreshUI) window.refreshUI();
    });

    // Locks (Global for now, as per engine)
    $('lock-l-toggle')?.addEventListener('change', e => {
        setLock('L', e.target.checked);
        if (window.refreshUI) window.refreshUI();
    });
    $('lock-c-toggle')?.addEventListener('change', e => {
        setLock('C', e.target.checked);
        if (window.refreshUI) window.refreshUI();
    });

    $('relationDistance')?.addEventListener('input', e => {
        setRelationDistance(e.target.value);
        const label = document.querySelector('label[for="relationDistance"]');
        if (label) label.textContent = `Dystans relacji (${e.target.value}°)`;
        clearGradientCache();
        renderAllPalettes(true);
    });

    // Add Color
    $('addColor')?.addEventListener('click', () => {
        const state = getState();
        const type = state.relation.type;
        let limit = 10;
        if (type === 'complementary') limit = 1;
        if (type === 'triadic' || type === 'split') limit = 2;
        if (type === 'tetradic') limit = 3;

        if (state.colors.length >= limit) {
            alert(`Relacja ${type} obsługuje maksymalnie ${limit} dodatkowych kolorów.`);
            return;
        }
        addColor();
        clearGradientCache();
        if (window.refreshUI) window.refreshUI();
    });
    $('addGrayBtn')?.addEventListener('click', () => { addGrayPalette(); clearGradientCache(); if (window.refreshUI) window.refreshUI(); });

    // Batch
    $('applyCount')?.addEventListener('click', () => {
        const n = Math.max(1, Number($('colorCount').value) || 1);
        setColorCount(n);
        clearGradientCache();
        if (window.refreshUI) window.refreshUI();
    });
}

export function createSliderCard(c) {
  const card = document.createElement('div');
  card.className = 'color-card';
  card.dataset.index = c.index;
  card.draggable = true;

  const header = document.createElement('div');
  header.style.display = 'flex'; header.style.justifyContent = 'space-between'; header.style.alignItems = 'center';
  const title = document.createElement('strong');
  title.textContent = `Kolor ${c.index + 1}`;
  const hexLabel = document.createElement('span');
  hexLabel.className = 'swatch-hex'; hexLabel.id = `hex-val-${c.index}`;
  header.append(title, hexLabel);

  const roleSelect = document.createElement('select');
  ['dominant', 'secondary', 'accent'].forEach(r => {
    const opt = document.createElement('option');
    opt.value = r; opt.textContent = r; opt.selected = c.role === r;
    roleSelect.appendChild(opt);
  });
  roleSelect.addEventListener('change', e => { updateColorRole(c.index, e.target.value); clearGradientCache(); if (window.refreshUI) window.refreshUI(); });

  const preview = document.createElement('div');
  preview.className = 'color-mini-preview'; preview.id = `preview-${c.index}`;

  const bgBtn = document.createElement('button');
  bgBtn.className = 'bg-source-btn primary contrast-bg-btn'; bgBtn.textContent = 'Tło Kontrast';
  bgBtn.onclick = () => { setBackgroundSource(c.index); if (window.refreshUI) window.refreshUI(); };

  const gBgBtn = document.createElement('button');
  gBgBtn.className = 'bg-source-btn secondary glass-bg-btn'; gBgBtn.textContent = 'Tło Glass';
  gBgBtn.onclick = () => { setGlassBackgroundSource(c.index); if (window.refreshUI) window.refreshUI(); };

  const contrastInfo = document.createElement('div');
  contrastInfo.className = 'card-contrast-info'; contrastInfo.id = `contrast-info-${c.index}`;

  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = 0; slider.max = 1; slider.step = 0.001; slider.value = c.slider;
  slider.addEventListener('input', e => {
    setColorSlider(c.index, Number(e.target.value));
    if (window.refreshUI) window.refreshUI(true);
    import('../ui.render.js').then(m => m.updateSidebarPreviews());
  });

  const del = document.createElement('button');
  del.textContent = 'Usuń'; del.classList.add('btn-danger');
  del.addEventListener('click', () => { removeColor(c.index); clearGradientCache(); if (window.refreshUI) window.refreshUI(); });

  card.append(header, roleSelect, preview, bgBtn, gBgBtn, contrastInfo, slider, del);
  return card;
}
