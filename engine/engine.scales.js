// engine/engine.scales.js
// Orchestrator V9: Layered Design Logic.

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

  // --- LOGIKA ROZKŁADÓW (V9) ---
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

  // Absolute mode logic: always include anchor
  if (scaleMode === 'absolute' && !forceExcludeAnchor) {
      if (!actualSteps.find(s => Math.abs(s - anchorStep) < 0.1)) {
          actualSteps = [...actualSteps, anchorStep].sort((a,b) => a-b);
      }
  }

  // --- GENEROWANIE BAZY ---
  let rawScale = (mode.algorithm === 'adaptive')
      ? generateAdaptiveScale(lch, actualSteps, isDarkMode)
      : generateStandardScale(lch, actualSteps, isDarkMode);

  const isAnyBoost = mode.darkModeBoost || mode.neonBoost || mode.pastelBoost ||
                     mode.glassmorphismBoost || mode.inkSaveMode || mode.spectralBalance;

  return rawScale.map(swatch => {
      const isBaseStep = Math.abs(swatch.step - anchorStep) < 0.1;

      // 1. DESIGN BOOSTS (IDEAL LCH)
      let p = applyBoosts(swatch, lch, mode);

      // 2. SPECTRAL BALANCE
      if (mode.spectralBalance) {
          p.l = Math.max(0.001, p.l - p.c * 0.18);
      }

      // 3. PERCEPTUAL POLISH
      if (mode.perceptualPolish) {
          const lab = oklchToOklab(p.l, p.c, p.h);
          const xyz = oklabToXyz(lab.L, lab.a, lab.b);
          const cam = xyzToCam16(xyz.X, xyz.Y, xyz.Z);
          p.l = p.l * 0.7 + (cam.J / 100) * 0.3;
      }

      // 4. DARK MODE ADJUST (LAST MASK LAYER)
      // Dark Mode damping is applied as the final correction to everything.
      if (isDarkMode) {
          // General damping for comfort
          p.c *= (0.7 + 0.25 * (1 - p.l));

          // Perceptual boost: correcting warmth perception shift
          if (mode.darkModeBoost) {
              if (p.h > 40 && p.h < 120) p.h += 12; // Yellow -> Orange
              if (p.h > 200 && p.h < 280) p.h -= 12; // Blue -> Cyan
              if (p.l > 0.4) p.c *= 1.35; // Pop lights
          }
      }

      // 5. CLIPPING & CLAMP
      const maxC = maxChromaForL(p.l, p.h, profile);
      p.clipping = (p.c > maxC + 0.005) ? Math.round((1 - (maxC / p.c)) * 100) : 0;
      p.c = Math.min(p.c, maxC);

      // 6. RENDER & MAPPING
      const finalLab = oklchToOklab(p.l, p.c, p.h);
      p.hex = rgbToHex(oklabToRgb(finalLab.L, finalLab.a, finalLab.b));

      if (isBaseStep && !isDarkMode && !isAnyBoost && sourceHex) {
          p.hex = sourceHex;
      }

      p.isBase = isBaseStep;

      // Map anchor to 500 for Asymmetric display
      if (scaleMode === 'asymmetric') {
          if (isBaseStep) p.displayStep = 500;
          else {
              const idx = actualSteps.indexOf(swatch.step);
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
