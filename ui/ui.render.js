// ui/ui.render.js
import { getState } from '../engine/engine.core.js';
import { getMainPalette } from '../engine/engine.palettes.js';
import { renderMain, renderAdditional, renderFunctional, renderBadge } from './render/ui.render.palettes.js';
import { renderContrastView } from './render/ui.render.contrast.js';
import { renderGlassView } from './ui.glass.js';
import { renderGradientsView } from './ui.gradients.view.js';
import { getAllVisibleHexes, generateExportSVG } from './render/ui.render.export.js';

export { getAllVisibleHexes, generateExportSVG };

const root = document.getElementById('output');

export function updateSidebarPreviews() {
  const state = getState();
  const basePreview = document.getElementById('basePreview');
  if (basePreview) basePreview.style.background = `rgb(${state.base.rgb.r}, ${state.base.rgb.g}, ${state.base.rgb.b})`;
}

export function renderAllPalettes() {
  if (!root) return;
  const state = getState();
  updateSidebarPreviews();
  root.innerHTML = '';

  if (state.mode.view === 'contrast') {
      root.appendChild(renderContrastView());
  } else if (state.mode.view === 'glass') {
      const baseLch = state.base.lch || getMainPalette().scale.find(s=>s.isBase);
      root.appendChild(renderGlassView(baseLch));
  } else if (state.mode.view === 'gradients') {
      const baseLch = state.base.lch || getMainPalette().scale.find(s=>s.isBase);
      root.appendChild(renderGradientsView(baseLch));
  } else {
      const frag = document.createDocumentFragment();
      frag.appendChild(renderMain());
      frag.appendChild(renderAdditional());
      frag.appendChild(renderFunctional());
      frag.appendChild(renderBadge());
      root.appendChild(frag);
  }

  const isDarkPreview = state.mode.background === 'dark';
  document.querySelectorAll('.contrast-grid').forEach(g => {
      g.style.backgroundColor = isDarkPreview ? '#000000' : '#ffffff';
  });
  const textColor = isDarkPreview ? '#ffffff' : '#000000';
  document.querySelectorAll('.palette-title strong, .contrast-title, .role-tag').forEach(el => {
      el.style.color = textColor;
  });
}
