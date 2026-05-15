// engine/engine.scales.js
// Orchestrator for scaling algorithms and boosts.

import { EngineState } from './engine.core.js';
import {
  srgbToLinear, linearToSrgb, rgbToOklab, oklabToRgb,
  oklabToOklch, oklchToOklab, rgbToHex
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
  const isFixed = mode.scale === 'fixed';
  const anchorStep = LToStep(lch.L);

  let actualSteps = steps;
  if (isFixed) {
      const offset = anchorStep % 10;
      actualSteps = steps.map(s => s + offset).filter(s => s >= 0 && s <= 1000);
      actualSteps = [...new Set(actualSteps)].sort((a,b)=>a-b);
  }

  // Choose Base Algorithm
  let scale;
  if (mode.algorithm === 'adaptive') {
      scale = generateAdaptiveScale(lch, actualSteps, isDarkMode);
  } else {
      scale = generateStandardScale(lch, actualSteps, isDarkMode);
  }

  // Apply Post-processing Boosts
  const isAnyBoost = mode.darkModeBoost || mode.neonBoost || mode.pastelBoost ||
                     mode.glassmorphismBoost || mode.inkSaveMode || mode.spectralBalance;

  scale = scale.map(swatch => {
      const isBaseStep = Math.abs(swatch.step - anchorStep) < 0.1;

      // Apply boosts
      let processed = applyBoosts(swatch, lch, mode);

      // Light Mode Base preservation: ONLY if NOT in Dark Mode and NO boosts active
      if (isBaseStep && !isDarkMode && !isAnyBoost && sourceHex) {
          processed.hex = sourceHex;
      }

      processed.isBase = isBaseStep;
      return processed;
  });

  // Ensure anchor is included if not already there
  if (!isFixed && !forceExcludeAnchor && !scale.find(s => Math.abs(s.step - anchorStep) < 0.1)) {
      const anchorSwatch = (mode.algorithm === 'adaptive')
          ? generateAdaptiveScale(lch, [anchorStep], isDarkMode)[0]
          : generateStandardScale(lch, [anchorStep], isDarkMode)[0];

      let processedAnchor = applyBoosts(anchorSwatch, lch, mode);
      if (!isDarkMode && !isAnyBoost && sourceHex) processedAnchor.hex = sourceHex;
      processedAnchor.isBase = true;

      scale.push(processedAnchor);
      scale.sort((a,b) => a.step - b.step);
  }

  return scale;
}

export function getBaseLCH(){
  const { r,g,b } = EngineState.base.rgb;
  return oklabToOklch(rgbToOklab(r,g,b));
}
