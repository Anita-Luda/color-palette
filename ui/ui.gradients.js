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

  return `linear-gradient(90deg, ${stops
    .map(s => {
      const pct = s.t * 100;
      const color = s.disabled ? 'rgba(0,0,0,0.2)' : s.hex;
      return `${color} ${pct.toFixed(2)}%`;
    })
    .join(', ')})`;
}

/* ---------- CORE ---------- */
function renderGradientForColor(container, role, index){
  const grad = generateSliderGradient(role, index);
  const bar = el('div', 'hue-gradient');

  bar.style.background = stopsToCSS(grad.stops);
  container.appendChild(bar);
}

/* ---------- PUBLIC API ---------- */
export function renderAllGradients(){
  const state = getState();
  const cards = document.querySelectorAll('.color-card');

  cards.forEach((card, i) => {
    const role = state.colors[i]?.role || 'dominant';
    const index = parseInt(card.dataset.index);

    // remove old gradient
    const old = card.querySelector('.hue-gradient');
    if (old) old.remove();

    renderGradientForColor(card, role, index);
  });
}

window.refreshGradients = renderAllGradients;
