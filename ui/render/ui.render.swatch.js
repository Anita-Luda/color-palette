// ui/render/ui.render.swatch.js
import { previewContrast } from '../../engine/engine.accessibility.js';
import { getState } from '../../engine/engine.core.js';

function el(tag, cls, text){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function renderSwatch(swatch, opts = {}){
  const d = el('div', 'swatch');
  const displayVal = Math.round(swatch.displayStep ?? swatch.step);

  if (displayVal % 50 === 0) d.classList.add('major');
  if (displayVal === 500) d.classList.add('ref');
  if (swatch.isBase) d.classList.add('base-color');
  if (opts.compact) d.classList.add('compact');

  const state = getState();
  const gran = state.mode.granularity;

  // Logic for filtering (V9): Use metadata from engine
  const is100 = swatch.isProg100;
  const is50  = swatch.isProg50;

  // For compact views (Functional/Badge), we don't filter by global granularity
  if (!opts.compact) {
    if (gran === 50 && !is50 && !swatch.isBase) return null;
    if (gran === 100 && !is100 && !swatch.isBase) return null;
  }

  d.style.background = swatch.hex;

  const contrast = previewContrast(swatch.hex);
  const onWhite = contrast.light.ratio;
  const onBlack = contrast.dark.ratio;
  d.style.color = (onWhite > onBlack) ? '#fff' : '#000';

  const stepEl = el('div', 'swatch-step', String(displayVal));
  const hexEl  = el('div', 'swatch-hex', swatch.hex.toUpperCase());

  // Badges rules: Always show badges on closest match
  if (swatch.isBase) {
      const badge = el('div', 'swatch-badge base visible', 'BASE');
      badge.style.zIndex = "10";
      d.appendChild(badge);
  }

  if (gran === 10 || opts.compact) {
      if (is100) {
          const badge = el('div', 'swatch-badge step100 visible', 'PROG');
          if (!swatch.isBase) d.appendChild(badge);
      } else if (is50) {
          const badge = el('div', 'swatch-badge step50 visible', 'STEP');
          if (!swatch.isBase) d.appendChild(badge);
      }
  } else if (gran === 50) {
      if (is100) {
          const badge = el('div', 'swatch-badge step100 visible', 'PROG');
          if (!swatch.isBase) d.appendChild(badge);
      }
  } else if (gran === 100) {
      // In Gradation 100, we don't necessarily show badges unless requested,
      // but let's show PROG if it's the 100-step (which is always true in Grad 100 mode)
      if (is100 && !swatch.isBase) {
           const badge = el('div', 'swatch-badge step100 visible', 'PROG');
           d.appendChild(badge);
      }
  }

  const bgMode = state.mode.background;
  const info = contrast[bgMode];
  const contrastEl = el('div', 'swatch-contrast', `${info.ratio} ${info.level}`);

  const whiteBlackContrast = el('div', 'swatch-wb-contrast');
  whiteBlackContrast.style.fontSize = '0.6rem';
  whiteBlackContrast.innerHTML = `<span class="c-w">W: ${contrast.light.ratio}</span><span class="c-b">B: ${contrast.dark.ratio}</span>`;

  d.append(stepEl, hexEl, contrastEl, whiteBlackContrast);

  // Requirement 8.3: Contrast Suggestion (very simple implementation)
  if (info.ratio < 4.5 && bgMode === 'light') {
      const suggest = el('div', 'swatch-suggest', 'Try darker');
      suggest.style.fontSize = '0.6rem'; suggest.style.opacity = '0.5';
      d.appendChild(suggest);
  } else if (info.ratio < 4.5 && bgMode === 'dark') {
      const suggest = el('div', 'swatch-suggest', 'Try lighter');
      suggest.style.fontSize = '0.6rem'; suggest.style.opacity = '0.5';
      d.appendChild(suggest);
  }

  if (swatch.clipping > 0) {
      const dot = el('div', 'clipping-dot');
      dot.style.position = 'absolute'; dot.style.top = '8px'; dot.style.right = '8px';
      dot.style.width = '8px'; dot.style.height = '8px'; dot.style.borderRadius = '50%';
      dot.style.background = (onWhite > onBlack) ? '#ffffff' : '#000000';
      dot.style.opacity = '0.5';
      d.appendChild(dot);
  }

  d.addEventListener('click', () => {
    navigator.clipboard.writeText(swatch.hex.toUpperCase());
    alert("Copied " + swatch.hex.toUpperCase());
  });

  return d;
}

export function renderScale(scale, opts = {}){
  const grid = el('div', opts.compact ? 'swatches compact-grid' : 'swatches');
  scale.forEach(s => {
      const node = renderSwatch(s, opts);
      if (node) grid.appendChild(node);
  });
  return grid;
}
