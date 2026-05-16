// engine/engine.scales.js
// Orchestrator V9: Stability, Character & Thresholds.

import { EngineState } from './engine.core.js';
import {
  srgbToLinear, linearToSrgb, rgbToOklab, oklabToRgb,
  oklabToOklch, oklchToOklab, rgbToHex, maxChromaForL,
  oklabToXyz, xyzToCam16
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
  const profile = mode.gamutProfile || 'srgb';

  let actualSteps = steps;

  // --- 1. DISTRIBUTION LOGIC (V9) ---
  if (scaleMode === 'fixed') {
      // Shifted grid so that anchor lands on a step.
      const offset = anchorStep % 10;
      actualSteps = steps.map(s => s + offset).filter(s => s >= 0 && s <= 1000);
      actualSteps = [...new Set(actualSteps)].sort((a,b)=>a-b);
  } else if (scaleMode === 'asymmetric') {
      // Equal count below and above 500. Anchor IS 500.
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

  // Always include anchor in Absolute mode
  if (scaleMode === 'absolute' && !forceExcludeAnchor) {
      if (!actualSteps.find(s => Math.abs(s - anchorStep) < 0.1)) {
          actualSteps = [...actualSteps, anchorStep].sort((a,b) => a-b);
      }
  }

  // --- 2. BASE GENERATION ---
  let rawScale = (mode.algorithm === 'adaptive')
      ? generateAdaptiveScale(lch, actualSteps, isDarkMode)
      : generateStandardScale(lch, actualSteps, isDarkMode);

  const isAnyBoost = mode.darkModeBoost || mode.neonBoost || mode.pastelBoost ||
                     mode.glassmorphismBoost || mode.inkSaveMode || mode.spectralBalance;

  return rawScale.map(swatch => {
      const isBaseStep = Math.abs(swatch.step - anchorStep) < 0.1;

      // A. APPLY BOOSTS
      let p = applyBoosts(swatch, lch, mode);

      // B. SPECTRAL BALANCE (H-K Correction)
      if (mode.spectralBalance) {
          p.l = Math.max(0.001, p.l - p.c * 0.18);
      }

      // C. CAM16 PERCEPTUAL POLISH
      if (mode.perceptualPolish) {
          const lab = oklchToOklab(p.l, p.c, p.h);
          const xyz = oklabToXyz(lab.L, lab.a, lab.b);
          const cam = xyzToCam16(xyz.X, xyz.Y, xyz.Z);
          p.l = p.l * 0.7 + (cam.J / 100) * 0.3;
      }

      // D. DARK MODE DAMPING (FINAL MASK)
      if (isDarkMode) {
          p.c *= (0.7 + 0.25 * (1 - p.l));
          if (mode.darkModeBoost) {
              if (p.h > 40 && p.h < 120) p.h += 10;
              if (p.h > 200 && p.h < 280) p.h -= 10;
              if (p.l > 0.4) p.c *= 1.25;
          }
      }

      // E. CLIPPING & CLAMP
      const maxC = maxChromaForL(p.l, p.h, profile);
      p.clipping = (p.c > maxC + 0.005) ? Math.round((1 - (maxC / p.c)) * 100) : 0;
      p.c = Math.min(p.c, maxC);

      const finalLab = oklchToOklab(p.l, p.c, p.h);
      p.hex = rgbToHex(oklabToRgb(finalLab.L, finalLab.a, finalLab.b));

      if (isBaseStep && !isDarkMode && !isAnyBoost && sourceHex) {
          p.hex = sourceHex;
      }

      p.isBase = isBaseStep;

      // Asymmetric requirement: map anchor to step 500 for display
      if (scaleMode === 'asymmetric') {
          if (isBaseStep) p.displayStep = 500;
          else {
              const idx = actualSteps.indexOf(swatch.step);
              const half = Math.floor(actualSteps.length / 2);
              p.displayStep = Math.round((idx / (actualSteps.length - 1)) * 1000);
          }
      } else {
          p.displayStep = swatch.step;
      }

      return p;
  });
}

export function getBaseLCH(){
  const { r,g,b } = EngineState.base.rgb;
  return oklabToOklch(rgbToOklab(r,g,b));
}
