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
  const baseHex = rgbToHex(EngineState.base.rgb);
  return {
    scale: generateScaleForLCH(baseLch, undefined, false, baseHex),
    mode: EngineState.mode.scale
  };
}

import { rgbToHex } from './engine.scales.js';

/* ---------- ADDITIONAL PALETTES ---------- */
function getHarmonyHue(baseHue, index, total, type, distance){
  const step = 360 / (total + 1);

  switch(type){
    case 'custom':
      return (baseHue + (index + 1) * step + (distance - 30)) % 360;
    case 'analogous':
      return (baseHue + (index + 1) * distance) % 360;
    case 'complementary':
      // index 0 -> 180, index 1 -> 180+dist, etc
      return (baseHue + 180 + index * distance) % 360;
    case 'split':
      if (index === 0) return (baseHue + 180 - distance) % 360;
      if (index === 1) return (baseHue + 180 + distance) % 360;
      return (baseHue + 180 + (index - 1) * distance) % 360;
    case 'triadic':
      return (baseHue + (index + 1) * 120 + index * distance) % 360;
    case 'tetradic':
      return (baseHue + (index + 1) * 90 + index * distance) % 360;
    case 'warmcool':
      return (baseHue + 180 + index * distance) % 360;
    default:
      return baseHue;
  }
}

export function getAdditionalPalettes(){
  const baseLch = getBaseLCH();
  const { type, distance } = EngineState.relation;

  return EngineState.colors.map((c, i) => {
    if (c.manualLCH) {
        return {
            index: c.index,
            role: c.role,
            scale: generateScaleForLCH(c.manualLCH)
        };
    }

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
      scale: generateScaleForLCH(lch, undefined, false, c.manualHex)
    };
  });
}

/* ---------- FUNCTIONAL PALETTES ---------- */
const SEMANTIC_RANGES = {
  success: { min: 120, max: 155, def: 142 },
  info:    { min: 210, max: 280, def: 250 },
  warning: { min: 60,  max: 95,  def: 75 },
  danger:  { min: 0,   max: 40,  def: 25 }
};

export function getFunctionalPalettes(){
  const baseLch = getBaseLCH();
  const additional = getAdditionalPalettes();

  // Reserved hues
  const reserved = [baseLch.h, ...additional.map(p => {
      const base = p.scale.find(s=>s.isBase);
      return base ? base.h : p.scale[Math.floor(p.scale.length/2)].h;
  })];

  const out = {};
  for (const [name, range] of Object.entries(SEMANTIC_RANGES)) {
    let bestHue = range.def;

    // Simple collision avoidance: if reserved hue is too close to default, shift
    for (const r of reserved) {
      if (Math.abs(r - bestHue) < 15 || Math.abs(r - bestHue) > 345) {
        // Try shifting within range
        if (bestHue + 15 <= range.max) bestHue += 15;
        else if (bestHue - 15 >= range.min) bestHue -= 15;
      }
    }

    out[name] = {
      scale: generateScaleForLCH({ L: 0.6, C: 0.15, h: bestHue }, FUNCTIONAL_STEPS, true)
    };
  }
  return out;
}

/* ---------- BADGE PALETTES ---------- */
export function getBadgePalettes(){
  const baseLch = getBaseLCH();
  const additional = getAdditionalPalettes();
  const functional = getFunctionalPalettes();

  // 1. Gather all reserved hues
  const reserved = [baseLch.h];
  additional.forEach(p => {
    const base = p.scale.find(s => s.isBase);
    if (base) reserved.push(base.h);
  });
  Object.values(functional).forEach(p => {
    reserved.push(p.scale[0].h);
  });

  // 2. Find 8 hues with max distance (Collision Avoidance)
  // Use a simple brute-force or step-based search for 8 points
  const count = 8;
  const bestHues = [];

  // We want to maximize min distance to any reserved or already picked hue
  for (let i = 0; i < count; i++) {
    let maxMinDist = -1;
    let candidateHue = 0;

    for (let h = 0; h < 360; h += 5) {
      let minDist = Infinity;
      // Dist to reserved
      for (const r of reserved) {
        let d = Math.abs(h - r);
        if (d > 180) d = 360 - d;
        if (d < minDist) minDist = d;
      }
      // Dist to already picked
      for (const b of bestHues) {
        let d = Math.abs(h - b);
        if (d > 180) d = 360 - d;
        if (d < minDist) minDist = d;
      }

      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        candidateHue = h;
      }
    }
    bestHues.push(candidateHue);
  }

  // 3. Generate scales
  return bestHues.map((h, i) => ({
    index: i,
    scale: generateScaleForLCH({ L: 0.75, C: 0.12, h }, BADGE_STEPS, true)
  }));
}
