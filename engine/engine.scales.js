// engine/engine.scales.js
// Absolute & Asymmetric scales (anchor-aware). No DOM.

import { EngineState } from './engine.core.js';
import {
  oklchToOklab, oklabToRgb, rgbToHex,
  oklabToOklch, rgbToOklab, srgbToLinear,
  linearToSrgb
} from './engine.math.js';

export {
  srgbToLinear, linearToSrgb, rgbToOklab, oklabToRgb,
  oklabToOklch, oklchToOklab, rgbToHex
};

/* ---------- HELPERS ---------- */
const DEFAULT_STEPS = Array.from({length:101},(_,i)=>i*10);
export const COARSE_STEPS = Array.from({length:11}, (_,i)=>i*100);
export const FUNCTIONAL_STEPS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
export const BADGE_STEPS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

function stepToL(step){
  // 0 = White (L=1), 1000 = Black (L=0)
  return 1 - (step / 1000);
}

function LToStep(L){
  return Math.round((1 - L) * 1000);
}

/**
 * Wyznacza bezpieczne nasycenie (Chroma) dla algorytmu Standard.
 * Zapobiega "wybijaniu się" agresywnych barw.
 */
function getHueDependentSafeChroma(L, H) {
  // Bazowy limit nasycenia dla zrównoważonych palet UI
  let baseSafe = 0.11;

  // Żółcie i pomarańcze (40-130°) mogą przyjąć więcej energii bez drażnienia oka
  if (H > 40 && H < 130) {
      const weight = 1 - Math.abs(H - 85) / 45;
      baseSafe += 0.07 * Math.max(0, weight);
  }

  // Błękity, fiolety i róże są najbardziej drażniące przy wysokiej chromie
  // Dodatkowe tłumienie dla tych zakresów
  if (H > 220 && H < 340) {
      baseSafe *= 0.85;
  }
  if (H > 140 && H < 200) { // Chłodne zielenie/cyjan
      baseSafe *= 0.9;
  }

  // Krzywa jasności: nasycenie osiąga szczyt w tonach średnich.
  // Stosujemy agresywny falloff (power 2.2), aby uniknąć "neonowości" w światłach i cieniach.
  const lDist = Math.abs(L - 0.5) * 2;
  const lightnessMult = Math.pow(Math.max(0, 1 - lDist), 2.2);

  return baseSafe * (0.4 + 0.6 * lightnessMult);
}

/**
 * Główny strażnik nasycenia dla palet tonalnych.
 */
function clampChroma(L, C, H){
  let multiplier = 1.0;

  if (EngineState.mode.palette === 'dark') {
      // Nieliniowa kompensacja dla Dark Mode:
      // Im jaśniejszy kolor bazowy, tym bardziej go tłumimy na ciemnym tle.
      // Ciemne kolory mogą zachować więcej nasycenia dla czytelności.
      multiplier = 0.6 + 0.3 * Math.pow(1 - L, 1.5);
  }

  const maxGamut = maxChromaForL(L, H, C);
  const designSafe = getHueDependentSafeChroma(L, H);

  // Standard mode dąży do balansu między oryginalną intencją a bezpieczeństwem wizualnym
  return Math.min(C * multiplier, maxGamut, designSafe);
}

/* ---------- CORE GENERATORS ---------- */
/* ---------- CORE GENERATORS ---------- */

function getHueCompensationTarget(H) {
  // Requirement: "na czarnym tle ten sam kolor... zaczyna wpadać wizualnie w ciepło, beżowo, żółte... trzeba to skorygować"
  // Blues (180-300) tend to look warmer/purplish on black if desaturated.
  // We push them towards colder/cyan (subtract hue).
  if (H >= 180 && H < 300) return H - 15;

  // Warm colors (0-60) can look overly yellowish. Push them towards red/orange.
  if (H >= 0 && H < 60) return H - 10;

  // Greens/Cyans (60-180) can look yellowish too. Push towards more pure green/cyan.
  if (H >= 60 && H < 180) return H + 10;

  return H;
}

function applyDarkModeBoost(L, C, H) {
  let newC = C;
  let newH = H;

  // Always apply hue compensation to keep "brand identity" on black background
  const H_target = getHueCompensationTarget(H);
  let diff = H_target - H;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  // Apply shift proportional to desaturation or just always?
  // Let's apply it more strongly for lighter tones, but keep a base shift.
  const shift_factor = L > 0.5 ? 0.8 : 0.4;
  newH = (H + diff * shift_factor + 360) % 360;

  // 1. Chroma Boost for Light Tones (L > 0.8)
  if (L > 0.8) {
    const t = (L - 0.8) / 0.2;
    const boost_strength = 0.4; // Increased for visibility
    const chroma_boost = 1 + (t * boost_strength);
    newC = C * chroma_boost;
  }

  // 2. Hue Compensation for Light Tones (L > 0.75)
  if (L > 0.75) {
    const t = (L - 0.75) / 0.25;
    const strength = 0.5; // Increased for visibility
    const H_target = getHueCompensationTarget(H);

    let diff = H_target - H;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    newH = (H + diff * (t * strength) + 360) % 360;
  }

  return { C: newC, H: newH };
}

/**
 * Wzmocnienie Neon: Techniczna intensywność przy zachowaniu gradacji.
 */
function applyNeonBoost(L, C, H) {
  const maxC = maxChromaForL(L, H, 0.5);

  // Zamiast spłaszczać nasycenie, wzmacniamy obecną chromę o stały czynnik (2.8x),
  // ale pilnujemy "podłogi", żeby nawet stłumione kolory nabrały neonowego blasku.
  let newC = C * 2.8;
  newC = Math.max(newC, maxC * 0.75);
  newC = Math.min(newC, maxC * 0.99); // Blisko fizycznej granicy gamutu

  // Zachowujemy rytm tonalny L, jedynie delikatnie rozjaśniając najgłębsze cienie.
  let newL = L;
  if (L < 0.15) newL = L + (0.15 - L) * 0.4;

  return { L: newL, C: newC, H };
}

/**
 * Wzmocnienie Pastel: Świeżość i czystość w wysokim kluczu.
 */
function applyPastelBoost(L, C, H) {
  // Pastele wymagają wysokiej jasności, ale nie mogą być "wyprane" z barwy (brudne).
  // Mapujemy jasność na zakres 0.82 - 0.98, zachowując relacje między stopniami.
  const newL = 0.82 + (L * 0.16);

  // Idealna "świeża" chroma dla pastelowych barw w OKLCH to ok. 0.05 - 0.07.
  // Używamy stabilnego targetu z lekkim wpływem barwy bazowej.
  const newC = 0.05 + (C * 0.12);

  return { L: newL, C: newC, H };
}

function applyGlassmorphismBoost(L, C, H) {
  // Requirement: Lightness boost for readability under blur.
  // We use a non-linear shift to keep more detail in the mid-tones.
  const newL = L + (1.0 - L) * 0.2;

  // Saturation boost: slightly higher for mid-tones to avoid "gray-out" under blur.
  const boost = 1 + (0.15 * (1 - Math.abs(L - 0.5) * 2));
  const newC = C * boost;

  return { L: newL, C: newC, H };
}

function applyInkSaveMode(L, C, H) {
  // Goal: reduce ink in high-key while preserving the "tint" of the color.
  let newC = C;
  if (L > 0.4) {
    const t = (L - 0.4) / 0.6;
    // Soft desaturation (up to 70%) to keep the color identifiable.
    newC = C * (1 - t * 0.7);
  }
  return { L, C: newC, H };
}

function applySpectralBalance(L, C, H) {
  // Helmholtz–Kohlrausch effect compensation:
  // Highly saturated colors are perceived as brighter than less saturated ones
  // at the same physical lightness (L).
  // To compensate, we lower the physical L for high C colors.

  // Empirical weight: brightness perception increases with C.
  // We use a simplified model: perceived brightness boost approx 0.15 * C
  const perceived_boost = C * 0.18;

  // To balance, we subtract a fraction of this boost from physical L.
  // We avoid making it too dark in the low-L range.
  let newL = L - (perceived_boost * Math.min(1, L * 1.5));

  // Ensure L remains within [0, 1]
  newL = Math.max(0, Math.min(1, newL));

  return { L: newL, C, H };
}

function maxChromaForL(L, H, C_start) {
  let multiplier = EngineState.mode.palette === 'dark' ? 0.8 : 1.0;
  let low = 0;
  let high = Math.max(C_start * multiplier, 0.4);
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    const lab = oklchToOklab(L, mid, H);
    const rgb = oklabToRgb(lab.L, lab.a, lab.b);
    if (rgb.r >= 0 && rgb.r <= 255 && rgb.g >= 0 && rgb.g <= 255 && rgb.b >= 0 && rgb.b <= 255) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return low;
}

function sigmoidalFalloff(x) {
  // Funkcja sigmoidalna (S-curve) dla bardziej "aksamitnych" przejść nasycenia.
  // x: 0..1 (odległość od bazy), zwraca 1..0
  return 1 / (1 + Math.exp(12 * (x - 0.5)));
}

function chromaFalloff(L, baseL) {
  const d = Math.abs(L - baseL);
  // Steeper mapping (2.0 instead of 1.5) for a more "tonal" look (faster desaturation away from base)
  return sigmoidalFalloff(d * 2.0);
}

function hueShift(L, baseL, baseH) {
  const shift_strength = 5;
  const d = L - baseL;
  return (baseH + d * shift_strength + 360) % 360;
}

function getAdaptiveGamma(baseL, baseT) {
  const L_max = 0.97;
  const L_min = 0.12;
  if (baseT <= 0.001) return 1.3;
  if (baseT >= 0.999) return 1.3;
  const ratio = (L_max - baseL) / (L_max - L_min);
  const safeRatio = Math.max(0.01, Math.min(0.99, ratio));
  return Math.log(safeRatio) / Math.log(baseT);
}

function lightnessCurve(t, gamma = 1.3) {
  const L_max = 0.97;
  const L_min = 0.12;
  return L_max - (L_max - L_min) * Math.pow(t, gamma);
}

export function generateScaleForLCH(lch, steps = DEFAULT_STEPS, forceExcludeAnchor = false, sourceHex = null){
  const anchorStep = LToStep(lch.L);
  const isAsymmetric = EngineState.mode.scale === 'asymmetric';
  const isFixed = EngineState.mode.scale === 'fixed';
  const isAdaptive = EngineState.mode.algorithm === 'adaptive';
  const isBoost = EngineState.mode.darkModeBoost;
  const isNeon = EngineState.mode.neonBoost;
  const isPastel = EngineState.mode.pastelBoost;
  const isGlass = EngineState.mode.glassmorphismBoost;
  const isInk = EngineState.mode.inkSaveMode;
  const isSpectral = EngineState.mode.spectralBalance;
  const isDarkMode = EngineState.mode.palette === 'dark';
  const granularity = EngineState.mode.granularity || 100;

  const adaptiveGamma = isAdaptive ? getAdaptiveGamma(lch.L, anchorStep / 1000) : 1.3;

  let actualSteps = steps;
  if (isFixed) {
      const offset = anchorStep % 10;
      actualSteps = steps.map(s => s + offset).filter(s => s >= 0 && s <= 1000);
      actualSteps = [...new Set(actualSteps)].sort((a,b)=>a-b);
  }

  const scale = actualSteps.map(step => {
      let L;
      if (isAsymmetric) {
          if (step === 500) L = lch.L;
          else if (step < 500) {
              const t = step / 500;
              const p = lch.L < 0.5 ? 1 / (2 * lch.L + 0.1) : 1;
              L = 1 - (1 - lch.L) * Math.pow(t, p);
          } else {
              const t = (step - 500) / 500;
              const p = lch.L < 0.5 ? 2 * lch.L + 0.1 : 1;
              L = lch.L * (1 - Math.pow(t, p));
          }
      } else {
          L = isAdaptive ? lightnessCurve(step/1000, adaptiveGamma) : stepToL(step);
      }

      let C, H;
      const isBaseStep = isAsymmetric ? (step === 500) : (Math.abs(step - anchorStep) < 0.1);

      if (isAdaptive) {
          let multiplier = isDarkMode ? 0.8 : 1.0;

          // Original adaptive behavior: use hueShift and falloff only if boost is NOT applied here,
          // or if we want them to be part of the base adaptive algorithm.
          // The user says "Adaptive works like it has dark mode boost permanently on".
          // In previous version, adaptive simply found max chroma.

          H = lch.h;
          const maxC = maxChromaForL(L, H, lch.C);
          C = Math.min(maxC, lch.C * multiplier);

          // If it's adaptive, we might still want the falloff to avoid "neon" extremes away from base,
          // but we'll make it part of the adaptive core, while hueShift and extra boosts move to applyDarkModeBoost.
          const falloff = chromaFalloff(L, lch.L);
          if (!isBaseStep) C *= falloff;

      } else {
          H = lch.h;
          C = clampChroma(L, lch.C, H);

          // Agresywniejszy falloff dla Standard, aby uzyskać gładsze wblendowanie w biel/czerń
          const falloff = chromaFalloff(L, lch.L);
          if (!isBaseStep) {
              // Płynne przejście nasycenia: im dalej od bazy, tym mocniej wyciszamy barwę
              C *= (0.55 + 0.45 * falloff);
          }
      }

      if (isBoost) {
        // Boost applies Hue Shift and extra Chroma for Light tones on Dark background
        const boosted = applyDarkModeBoost(L, C, H);

        if (isAdaptive) {
           H = hueShift(L, lch.L, lch.h);
        } else {
           H = boosted.H;
        }
        C = boosted.C;
      }

      if (isNeon) {
        const neon = applyNeonBoost(L, C, H);
        L = neon.L;
        C = neon.C;
        H = neon.H;
      }

      if (isPastel) {
        const pastel = applyPastelBoost(L, C, H);
        L = pastel.L; C = pastel.C; H = pastel.H;
      }

      if (isGlass) {
        const glass = applyGlassmorphismBoost(L, C, H);
        L = glass.L; C = glass.C; H = glass.H;
      }

      if (isInk) {
        const ink = applyInkSaveMode(L, C, H);
        L = ink.L; C = ink.C; H = ink.H;
      }

      if (isSpectral) {
        const balanced = applySpectralBalance(L, C, H);
        L = balanced.L; C = balanced.C; H = balanced.H;
      }

      const lab = oklchToOklab(L, C, H);
      const rgb = oklabToRgb(lab.L, lab.a, lab.b);
      let hex = rgbToHex(rgb);

      // Base color preservation: ONLY if Light Mode AND NO boost active
      const isAnyBoost = isBoost || isNeon || isPastel || isGlass || isInk || isSpectral;
      if (isBaseStep && !isDarkMode && !isAnyBoost && sourceHex) {
          hex = sourceHex;
      }

      return {
          step,
          hex,
          h: H, c: C, l: L,
          isBase: isBaseStep
      };
  });

  if (!isAsymmetric && !isFixed && !forceExcludeAnchor) {
      if (!scale.find(s => Math.abs(s.step - anchorStep) < 0.1)) {
          let L = lch.L;
          let C, H;
          if (isAdaptive) {
              let multiplier = isDarkMode ? 0.8 : 1.0;
          H = lch.h;
              const maxC = maxChromaForL(L, H, lch.C);
              C = Math.min(maxC, lch.C * multiplier);
          } else {
              H = lch.h;
              C = clampChroma(L, lch.C, H);
          }

          if (isBoost) {
            const boosted = applyDarkModeBoost(L, C, H);
            C = boosted.C;
            if (isAdaptive) {
                H = hueShift(L, lch.L, lch.h);
            } else {
                H = boosted.H;
            }
          }

          if (isNeon) {
              const neon = applyNeonBoost(L, C, H);
              L = neon.L;
              C = neon.C;
              H = neon.H;
          }

          if (isPastel) {
            const pastel = applyPastelBoost(L, C, H);
            L = pastel.L; C = pastel.C; H = pastel.H;
          }

          if (isGlass) {
            const glass = applyGlassmorphismBoost(L, C, H);
            L = glass.L; C = glass.C; H = glass.H;
          }

          if (isInk) {
            const ink = applyInkSaveMode(L, C, H);
            L = ink.L; C = ink.C; H = ink.H;
          }

          if (isSpectral) {
            const balanced = applySpectralBalance(L, C, H);
            L = balanced.L; C = balanced.C; H = balanced.H;
          }

          const lab = oklchToOklab(L, C, H);
          const rgb = oklabToRgb(lab.L, lab.a, lab.b);
          let hex = rgbToHex(rgb);

          const isAnyBoost = isBoost || isNeon || isPastel || isGlass || isInk || isSpectral;
          if (!isDarkMode && !isAnyBoost && sourceHex) hex = sourceHex;

          scale.push({
              step: anchorStep,
              hex,
              h: H, c: C, l: L,
              isBase: true,
              isInserted: true
          });
      }
  }

  return scale.sort((a,b)=>a.step-b.step);
}

export function getBaseLCH(){
  const { r,g,b } = EngineState.base.rgb;
  return oklabToOklch(rgbToOklab(r,g,b));
}
