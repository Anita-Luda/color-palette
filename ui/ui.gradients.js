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

  // Requirement: Show full range 0..360 but mark out-of-gamut
  // We'll use a slightly different approach: just linear-gradient of in-gamut colors
  // or a full gradient if we want to show everything.
  return `linear-gradient(90deg, ${stops
    .map(s => {
      const pct = (s.hue / 360) * 100;
      // If disabled, maybe use gray or transparent?
      // "Użytkownik widzi, że pewne kolory są niedostępne"
      const color = s.disabled ? 'rgba(0,0,0,0.5)' : s.hex;
      return `${color} ${pct.toFixed(2)}%`;
    })
    .join(', ')})`;
}

/* ---------- CORE ---------- */
function renderGradientForColor(container, role){
  const grad = generateSliderGradient(role);
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

    // remove old gradient
    const old = card.querySelector('.hue-gradient');
    if (old) old.remove();

    renderGradientForColor(card, role);
  });
}
