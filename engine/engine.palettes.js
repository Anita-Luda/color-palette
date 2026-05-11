// engine/engine.palettes.js
// Main / Functional / Badge palettes (no DOM)

import { EngineState } from './engine.core.js';
import { generateScaleForLCH, getBaseLCH } from './engine.scales.js';

/* ---------- UTIL ---------- */
const FUNCTIONAL_STEPS = [0, 200, 400, 600, 800];
const BADGE_STEPS = [0, 200, 400, 600, 800];

// Stały zestaw hue do badge (nie zależy od relacji ani liczby kolorów)
const BADGE_HUES = [0, 40, 80, 140, 200, 260];

/* ---------- MAIN PALETTE ---------- */
export function getMainPalette() {
  const baseLCH = getBaseLCH();
  return {
    type: 'main',
    mode: EngineState.mode.scale,
    scale: generateScaleForLCH(baseLCH)
  };
}

/* ---------- ADDITIONAL COLOR PALETTES ---------- */
export function getAdditionalPalettes() {
  const baseLCH = getBaseLCH();
  const count = EngineState.colors.length;

  return EngineState.colors.map((color, index) => {
    const relationOffset = getRelationHueOffset(index, count);
    const sliderOffset = (color.slider - 0.5) * 360;

    const h = (baseLCH.h + relationOffset + sliderOffset + 360) % 360;

    const lch = {
      L: baseLCH.L,
      C: baseLCH.C,
      h
    };

    return {
      type: 'additional',
      index,
      role: color.role,
      scale: generateScaleForLCH(lch)
    };
  });
}

/* ---------- FUNCTIONAL PALETTE ---------- */
export function getFunctionalPalettes() {
  const baseLCH = getBaseLCH();

  const profiles = {
    success: { hueOffset: 30,  chromaMult: 0.75 },
    warning: { hueOffset: 90,  chromaMult: 0.85 },
    danger:  { hueOffset: 150, chromaMult: 0.9  },
    info:    { hueOffset: 210, chromaMult: 0.7  }
  };

  const result = {};

  Object.entries(profiles).forEach(([name, cfg]) => {
    const h = (baseLCH.h + cfg.hueOffset) % 360;
    const lch = {
      L: baseLCH.L,
      C: baseLCH.C * cfg.chromaMult,
      h
    };

    const fullScale = generateScaleForLCH(lch);
    const filtered = fullScale.filter(s => FUNCTIONAL_STEPS.includes(s.step));

    result[name] = {
      type: 'functional',
      name,
      steps: FUNCTIONAL_STEPS,
      scale: filtered
    };
  });

  return result;
}

/* ---------- BADGE PALETTE ---------- */
export function getBadgePalettes() {
  const baseLCH = getBaseLCH();

  return BADGE_HUES.map((offset, i) => {
    const h = (baseLCH.h + offset) % 360;
    const lch = {
      L: baseLCH.L,
      C: baseLCH.C * 0.9,
      h
    };

    const fullScale = generateScaleForLCH(lch);
    const filtered = fullScale.filter(s => BADGE_STEPS.includes(s.step));

    return {
      type: 'badge',
      index: i,
      hueOffset: offset,
      steps: BADGE_STEPS,
      scale: filtered
    };
  });
}

/* ---------- RELATION OFFSET ---------- */
function getRelationHueOffset(index, count) {
  switch (EngineState.relation.type) {
    case 'complementary':
      return index * 180;
    case 'triadic':
      return index * 120;
    case 'tetradic':
      return index * 90;
    case 'split':
      return index === 0 ? -150 : 150;
    case 'analogous':
      return count > 1
        ? -40 + (80 / (count - 1)) * index
        : 0;
    case 'warmcool':
      return index % 2 === 0 ? -40 : 40;
    default:
      return 0;
  }
}
