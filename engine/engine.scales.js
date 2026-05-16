// engine/engine.scales.js
// Orchestrator V7: Design Quality over Pure Math.

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

  // Choose Base Algorithm
  let rawScale = (mode.algorithm === 'adaptive')
      ? generateAdaptiveScale(lch, actualSteps, isDarkMode)
      : generateStandardScale(lch, actualSteps, isDarkMode);

  const isAnyBoost = mode.darkModeBoost || mode.neonBoost || mode.pastelBoost ||
                     mode.glassmorphismBoost || mode.inkSaveMode || mode.spectralBalance;

  return rawScale.map(swatch => {
      const isBaseStep = Math.abs(swatch.step - anchorStep) < 0.1;

      // 1. APPLY DESIGN BOOSTS (on un-clamped LCH)
      let p = applyBoosts(swatch, lch, mode);

      // 2. HYBRID CAM16 POLISH
      if (mode.perceptualPolish) {
          const lab = oklchToOklab(p.l, p.c, p.h);
          const xyz = oklabToXyz(lab.L, lab.a, lab.b);
          const cam = xyzToCam16(xyz.X, xyz.Y, xyz.Z);
          const targetL = cam.J / 100;
          // Weighted nudge towards CAM16 J (perceptual brightness consistency)
          p.l = p.l * 0.65 + targetL * 0.35;
      }

      // 3. DARK MODE COMFORT DAMPING
      if (isDarkMode) {
          p.c *= (0.7 + 0.3 * (1 - p.l));
      }

      // 4. CLIPPING DETECTION
      const maxC = maxChromaForL(p.l, p.h, profile);
      p.clipping = (p.c > maxC + 0.005) ? Math.round((1 - (maxC / p.c)) * 100) : 0;

      // 5. FINAL GAMUT CLAMP
      p.c = Math.min(p.c, maxC);

      // Final Color
      const finalLab = oklchToOklab(p.l, p.c, p.h);
      p.hex = rgbToHex(oklabToRgb(finalLab.L, finalLab.a, finalLab.b));

      // Preservation
      if (isBaseStep && !isDarkMode && !isAnyBoost && sourceHex) {
          p.hex = sourceHex;
      }

      p.isBase = isBaseStep;
      return p;
  });
}

export function getBaseLCH(){
  const { r,g,b } = EngineState.base.rgb;
  return oklabToOklch(rgbToOklab(r,g,b));
}
