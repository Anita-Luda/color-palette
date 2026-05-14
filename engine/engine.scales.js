// engine/engine.scales.js
// Absolute & Asymmetric scales (anchor-aware). No DOM.

import { EngineState } from './engine.core.js';

/* ---------- OKLCH MATH ---------- */
export function srgbToLinear(c){
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function linearToSrgb(c){
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
export function rgbToOklab(r,g,b){
  r = srgbToLinear(r); g = srgbToLinear(g); b = srgbToLinear(b);
  const l = 0.4122214708*r + 0.5363325363*g + 0.0514459929*b;
  const m = 0.2119034982*r + 0.6806995451*g + 0.1073969566*b;
  const s = 0.0883024619*r + 0.2817188376*g + 0.6299787005*b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return {
    L: 0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_,
    a: 1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_,
    b: 0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_
  };
}
export function oklabToRgb(L,a,b){
  const l_ = L + 0.3963377774*a + 0.2158037573*b;
  const m_ = L - 0.1055613458*a - 0.0638541728*b;
  const s_ = L - 0.0894841775*a - 1.2914855480*b;
  const l = l_**3, m = m_**3, s = s_**3;
  let r =  4.0767416621*l - 3.3077115913*m + 0.2309699292*s;
  let g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s;
  let b2= -0.0041960863*l - 0.7034186147*m + 1.7076147010*s;

  // Clamp linear RGB to [0, 1] before conversion to non-linear sRGB to avoid NaN
  r = Math.max(0, r);
  g = Math.max(0, g);
  b2 = Math.max(0, b2);

  r = linearToSrgb(r); g = linearToSrgb(g); b2 = linearToSrgb(b2);
  return {
    r: Math.round(Math.min(1, r) * 255),
    g: Math.round(Math.min(1, g) * 255),
    b: Math.round(Math.min(1, b2) * 255)
  };
}
export function oklabToOklch({L,a,b}){
  return { L, C: Math.sqrt(a*a+b*b), h: (Math.atan2(b,a)*180/Math.PI+360)%360 };
}
export function oklchToOklab(L,C,h){
  const hr = h*Math.PI/180;
  return { L, a: Math.cos(hr)*C, b: Math.sin(hr)*C };
}
export function rgbToHex({r,g,b}){
  return `#${((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}`;
}

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

// Guardrail chromy - ulepszony, aby uniknąć "skoków" nasycenia
function getHueDependentSafeChroma(L, H) {
  // Żółcie (70-110) mają najwyższy gamut, błękity (230-270) niższy.
  // Zwracamy "projektowo bezpieczny" limit nasycenia, który płynnie zmienia się z Hue.

  let baseSafe = 0.18; // standardowy bezpieczny limit

  // Podbijamy dla żółci/pomarańczy
  if (H > 40 && H < 140) {
      const t = 1 - Math.abs(H - 90) / 50;
      baseSafe += 0.12 * Math.max(0, t);
  }

  // Obniżamy dla błękitów/fioletów (by uniknąć "neonowości" w standardzie)
  if (H > 220 && H < 320) {
      const t = 1 - Math.abs(H - 270) / 50;
      baseSafe -= 0.04 * Math.max(0, t);
  }

  // Dopasowanie do jasności (najwięcej nasycenia w tonach średnich)
  const lightnessMult = 1 - Math.pow(Math.abs(L - 0.5) * 2, 1.5);

  return baseSafe * (0.6 + 0.4 * lightnessMult);
}

function clampChroma(L, C, H){
  let multiplier = EngineState.mode.palette === 'dark' ? 0.8 : 1.0;

  const maxGamut = maxChromaForL(L, H, C);
  const designSafe = getHueDependentSafeChroma(L, H);

  // W Standard mode celujemy w designSafe, ale nie przekraczamy gamutu ani oryginalnego C.
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

function applyNeonBoost(L, C, H) {
  // Neon effect: maximize chroma within gamut and slightly shift lightness for vibrancy.
  // We ignore current C and find the absolute maximum for this L and H.
  const maxC = maxChromaForL(L, H, 0.4);

  // To make it look "neon", we want very high saturation.
  // We take the max gamut chroma but cap it slightly to avoid extreme "broken" colors
  // and keep it in a "vibrant" zone.
  let newC = maxC * 0.98;

  // Optional: subtle lightness shift to a "sweeter" spot for neon colors
  // (e.g. making it slightly lighter if it's too dark)
  let newL = L;
  if (L < 0.5) newL = L + (0.5 - L) * 0.2;

  // IMPORTANT: For neon to be visible, we must ensure it bypasses multipliers
  // We return a slightly modified L and forced high C
  return { L: newL, C: newC, H };
}

function applyPastelBoost(L, C, H) {
  // Pastel effect: low chroma, high lightness.
  // We reduce chroma significantly and push lightness towards 0.85-0.95.
  let newL = L + (0.9 - L) * 0.4;
  let newC = Math.min(C, 0.05) * 0.8;
  return { L: newL, C: newC, H };
}

function applyGlassmorphismBoost(L, C, H) {
  // Glassmorphism optimization: increase lightness and subtle saturation
  // to ensure the color remains visible through blurred surfaces.
  let newL = L + (1.0 - L) * 0.15;
  let newC = C * 1.1;
  return { L: newL, C: newC, H };
}

function applyInkSaveMode(L, C, H) {
  // Ink-save mode: desaturate light tones (where ink is most visible as dots)
  // to reduce ink consumption in print.
  let newC = C;
  // L range 0 (black) to 1 (white). Light tones are L > 0.6.
  if (L > 0.5) {
    const t = (L - 0.5) / 0.5;
    // Aggressive desaturation for ink saving
    newC = C * (1 - t * 0.9);
  }
  return { L, C: newC, H };
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
  // mapujemy d (0..1) na zakres sigmoidy
  // 0 -> 1, 0.6 -> blisko 0
  return sigmoidalFalloff(d * 1.5);
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

          // Dodajemy delikatny falloff dla skali standard, aby kolory nie były
          // nienaturalnie nasycone w bardzo ciemnych/jasnych partiach,
          // co pomaga zachować spójność wizualną "zlejania się" palety.
          const falloff = chromaFalloff(L, lch.L);
          if (!isBaseStep) C *= (0.7 + 0.3 * falloff); // Mniej agresywny falloff niż w adaptive
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

      const lab = oklchToOklab(L, C, H);
      const rgb = oklabToRgb(lab.L, lab.a, lab.b);
      let hex = rgbToHex(rgb);

      // Base color preservation: ONLY if Light Mode AND NO boost active
      const isAnyBoost = isBoost || isNeon || isPastel || isGlass || isInk;
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

          const lab = oklchToOklab(L, C, H);
          const rgb = oklabToRgb(lab.L, lab.a, lab.b);
          let hex = rgbToHex(rgb);

          const isAnyBoost = isBoost || isNeon || isPastel || isGlass || isInk;
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
