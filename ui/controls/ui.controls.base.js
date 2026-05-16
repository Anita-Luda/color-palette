// ui/controls/ui.controls.base.js
import { setBaseRGB, setBackgroundSource, setGlassBackgroundSource, getState } from '../../engine/engine.core.js';
import { rgbToOklab, oklabToOklch, rgbToHex } from '../../engine/engine.math.js';
import { clearGradientCache } from '../../engine/engine.gradients.js';
import { contrastRatio } from '../../engine/engine.accessibility.js';

const $ = id => document.getElementById(id);

export function parseHexOrRgb(value){
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
  if (m) return { r:+m[1], g:+m[2], b:+m[3] };
  return null;
}

export function onBaseChange(){
  const txtInput = $('textColor');
  const pickInput = $('baseColor');
  const txt = txtInput?.value || '';
  const pick = pickInput?.value || '';

  let rgb = parseHexOrRgb(txt);
  if (txt && !rgb) txtInput.style.borderColor = 'red';
  else if (txtInput) txtInput.style.borderColor = '';

  if (!rgb) rgb = parseHexOrRgb(pick);
  if (!rgb) return;

  const el = $('basePreview');
  if (el) el.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

  const lch = oklabToOklch(rgbToOklab(rgb.r, rgb.g, rgb.b));
  setBaseRGB(rgb, lch, null);
  clearGradientCache();
  if (window.refreshUI) window.refreshUI();
}

export function setupBasePicker() {
    const preview = $('basePreview');
    const picker = $('baseColor');
    if (!preview || !picker) return;

    preview.addEventListener('click', () => picker.click());
    picker.addEventListener('input', () => {
        $('textColor').value = picker.value;
        onBaseChange();
    });

    const bgBtn = document.createElement('button');
    bgBtn.className = 'bg-source-btn primary contrast-bg-btn';
    bgBtn.textContent = 'Tło Kontrast';
    bgBtn.style.marginTop = '8px';
    bgBtn.onclick = () => {
        setBackgroundSource('base');
        if (window.refreshUI) window.refreshUI();
    };
    preview.parentNode.appendChild(bgBtn);

    const glassBgBtn = document.createElement('button');
    glassBgBtn.className = 'bg-source-btn secondary glass-bg-btn';
    glassBgBtn.textContent = 'Tło Glass';
    glassBgBtn.style.marginTop = '4px';
    glassBgBtn.onclick = () => {
        setGlassBackgroundSource('base');
        if (window.refreshUI) window.refreshUI();
    };
    preview.parentNode.appendChild(glassBgBtn);
}

export function updateBaseContrastInfo() {
    const state = getState();
    const bgMode = state.mode.background;
    const bgHex = bgMode === 'dark' ? '#000000' : '#FFFFFF';
    const baseInfo = $('base-contrast-info');
    if (baseInfo) {
        const hex = rgbToHex(state.base.rgb);
        const ratio = contrastRatio(bgHex, hex);
        baseInfo.textContent = `Kontrast: ${ratio.toFixed(2)}:1`;
    }
}
