// engine/engine.scales.js
// Orchestrator for scaling algorithms and boosts.

import { EngineState } from './engine.core.js';
import {
  srgbToLinear, linearToSrgb, rgbToOklab, oklabToRgb,
  oklabToOklch, oklchToOklab, rgbToHex, maxChromaForL
} from './engine.math.js';
import { generateStandardScale } from './algo.standard.js';
import { generateAdaptiveScale } from './algo.adaptive.js';
import { applyBoosts } from './algo.boosts.js';

export {
  srgbToLinear, linearToSrgb, rgbToOklab, oklabToRgb,
  oklabToOklch, oklchToOklab, rgbToHex
};

const DEFAULT_STEPS = Array.from({length:101},(_,i)=>i*10);
export const COARSE_STEPS = Array.from({length:11}, (_,i)=>i*100);
export const FUNCTIONAL_STEPS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
export const BADGE_STEPS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

function LToStep(L){
  return Math.round((1 - L) * 1000);
}

export function generateScaleForLCH(lch, steps = DEFAULT_STEPS, forceExcludeAnchor = false, sourceHex = null){
  const mode = EngineState.mode;
  const isDarkMode = mode.palette === 'dark';
  const scaleMode = mode.scale;
  const anchorStep = LToStep(lch.L);

  let actualSteps = steps;

  if (scaleMode === 'fixed') {
      const offset = anchorStep % 10;
      actualSteps = steps.map(s => s + offset).filter(s => s >= 0 && s <= 1000);
      actualSteps = [...new Set(actualSteps)].sort((a,b)=>a-b);
  } else if (scaleMode === 'asymmetric') {
      const targetCount = steps.length;
      if (targetCount > 1) {
          const half = Math.floor(targetCount / 2);
          const below = [];
          for (let i = 0; i < half; i++) below.push((anchorStep / half) * i);
          const above = [];
          for (let i = 1; i <= half; i++) above.push(anchorStep + ((1000 - anchorStep) / half) * i);
          actualSteps = [...below, anchorStep, ...above];
          actualSteps = [...new Set(actualSteps.map(Math.round))].sort((a,b)=>a-b);
      }
  }

  // Generate Base Scale
  let scale = (mode.algorithm === 'adaptive')
      ? generateAdaptiveScale(lch, actualSteps, isDarkMode)
      : generateStandardScale(lch, actualSteps, isDarkMode);

  const profile = mode.gamutProfile || 'srgb';
  const isAnyBoost = mode.darkModeBoost || mode.neonBoost || mode.pastelBoost ||
                     mode.glassmorphismBoost || mode.inkSaveMode || mode.spectralBalance;

  return scale.map(swatch => {
      const isBaseStep = Math.abs(swatch.step - anchorStep) < 0.1;

      // 1. Apply overlays (un-clamped)
      let boosted = applyBoosts(swatch, lch, mode);

      // 2. Detection of clipping
      const maxC = maxChromaForL(boosted.l, boosted.h, profile);
      boosted.clipping = (boosted.c > maxC + 0.005) ? Math.round((1 - (maxC / boosted.c)) * 100) : 0;

      // 3. Final Clamp for stability
      boosted.c = Math.min(boosted.c, maxC);

      const lab = oklchToOklab(boosted.l, boosted.c, boosted.h);
      boosted.hex = rgbToHex(oklabToRgb(lab.L, lab.a, lab.b));

      if (isBaseStep && !isDarkMode && !isAnyBoost && sourceHex) boosted.hex = sourceHex;
      boosted.isBase = isBaseStep;

      return boosted;
  });
}

export function getBaseLCH(){
  const { r,g,b } = EngineState.base.rgb;
  return oklabToOklch(rgbToOklab(r,g,b));
}
