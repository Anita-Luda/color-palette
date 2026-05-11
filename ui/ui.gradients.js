// ui/ui.gradients.js
// Slider gradient renderer (OKLCH, base-aware). No state mutation.

import {
  generateSliderGradient
} from '../engine/engine.gradients.js';

import { getState } from '../engine/engine.core.js';

/* ---------- HELPERS ---------- */
function el(tag, cls){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

function stopsToCSS(stops){
  if (!stops.length) return 'transparent';
  const min = stops[0].hue;
  const max = stops[stops.length - 1].hue;
  return `linear-gradient(90deg, ${stops
    .map(s => {
      const pct = ((s.hue - min) / (max - min)) * 100;
      return `${s.hex} ${pct.toFixed(2)}%`;
    })
    .join(', ')})`;
}

/* ---------- CORE ---------- */
function renderGradientForColor(container, role){
  const grad = generateSliderGradient(role);
  const bar = el('div', 'hue-gradient');

  bar.style.background = stopsToCSS(grad.stops);

  // Optional visual bounds (min/max)
  bar.style.setProperty('--hue-min', grad.min);
  bar.style.setProperty('--hue-max', grad.max);

  container.appendChild(bar);
}

/* ---------- PUBLIC API ---------- */
export function renderAllGradients(){
  const state = getState();
  const cards = document.querySelectorAll('.color-card');

  cards.forEach((card, i) => {
    const role = state.colors[i]?.role || 'dominant';

    // remove old gradient
    const old = card.querySelector('.hue-gradient');
    if (old) old.remove();

    renderGradientForColor(card, role);
  });
}
