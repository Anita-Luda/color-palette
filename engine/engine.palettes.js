// engine/engine.palettes.js
// Scale composition: Main, Functional, Badge. No DOM.

import { EngineState } from './engine.core.js';
import {
  generateScaleForLCH,
  getBaseLCH,
  COARSE_STEPS,
  FUNCTIONAL_STEPS,
  BADGE_STEPS
} from './engine.scales.js';

/* ---------- MAIN PALETTE ---------- */
export function getMainPalette(){
  const baseLch = getBaseLCH();
  return {
    scale: generateScaleForLCH(baseLch),
    mode: EngineState.mode.scale
  };
}

/* ---------- ADDITIONAL PALETTES ---------- */
function getHarmonyHue(baseHue, index, total, type, distance){
  if (type === 'custom') return (baseHue + 360) % 360; // Base hue by default for custom

  switch(type){
    case 'analogous':
      return (baseHue + (index + 1) * distance) % 360;
    case 'complementary':
      return (baseHue + 180 + (index % 2 === 1 ? distance : 0)) % 360;
    case 'split':
      if (index === 0) return (baseHue + 180 - distance) % 360;
      if (index === 1) return (baseHue + 180 + distance) % 360;
      return (baseHue + 180 + (index - 1) * distance) % 360;
    case 'triadic':
      return (baseHue + (index + 1) * 120) % 360;
    case 'tetradic':
      return (baseHue + (index + 1) * 90) % 360;
    case 'warmcool':
      return (baseHue + 180) % 360;
    default:
      return baseHue;
  }
}

export function getAdditionalPalettes(){
  const baseLch = getBaseLCH();
  const { type, distance } = EngineState.relation;

  return EngineState.colors.map((c, i) => {
    let hue = getHarmonyHue(baseLch.h, i, EngineState.colors.length, type, distance);

    // Custom slider offset
    hue = (hue + (c.slider - 0.5) * 360) % 360;
    if (hue < 0) hue += 360;

    const lch = {
      L: EngineState.locks.L ? baseLch.L : baseLch.L * 0.95,
      C: EngineState.locks.C ? baseLch.C : baseLch.C * 0.9,
      h: hue
    };

    return {
      index: c.index,
      role: c.role,
      scale: generateScaleForLCH(lch)
    };
  });
}

/* ---------- FUNCTIONAL PALETTES ---------- */
export function getFunctionalPalettes(){
  const baseLch = getBaseLCH();

  // Semantic Hues in OKLCH
  // Success: Green (~140)
  // Info: Blue (~250)
  // Warning: Yellow/Orange (~70)
  // Danger: Red (~30)

  const semanticHues = {
    success: 142,
    info: 250,
    warning: 70,
    danger: 30
  };

  const out = {};
  for (const [name, hue] of Object.entries(semanticHues)) {
    out[name] = {
      scale: generateScaleForLCH({ L: 0.6, C: 0.15, h: hue }, FUNCTIONAL_STEPS, true)
    };
  }
  return out;
}

/* ---------- BADGE PALETTES ---------- */
export function getBadgePalettes(){
  const baseLch = getBaseLCH();
  const count = 8;
  const out = [];

  // Exclude semantic hues to avoid overlap
  // Semantic hues are roughly: 30, 70, 142, 250
  const excluded = [30, 70, 142, 250];

  let hue = (baseLch.h + 20) % 360; // start offset
  for (let i = 0; i < count; i++) {
    // Attempt to find a hue that is not too close to excluded or already used
    // Simple approach: distribute evenly and shift if too close to excluded
    let h = (hue + i * (360/count)) % 360;

    // Very simple check to push away from danger/success
    for (const ex of excluded) {
        if (Math.abs(h - ex) < 15 || Math.abs(h - ex) > 345) {
            h = (h + 20) % 360;
        }
    }

    out.push({
      index: i,
      scale: generateScaleForLCH({ L: 0.8, C: 0.1, h: h }, BADGE_STEPS, true)
    });
  }
  return out;
}
