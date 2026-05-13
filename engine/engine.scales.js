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

// Guardrail chromy
function clampChroma(L, C){
  // Paleta kolorów dark mode miała mieć skorygowaną chromę, żeby dobrze wyglądać na dark mode.
  // In dark mode, we usually want slightly lower chroma to avoid "glowing" or "vibrating" against dark backgrounds.
  let multiplier = EngineState.mode.palette === 'dark' ? 0.8 : 1.0;

  const max =
    L > 0.85 ? 0.10 :
    L > 0.65 ? 0.16 :
    L > 0.45 ? 0.24 : 0.32;
  return Math.min(C * multiplier, max);
}

/* ---------- CORE GENERATORS ---------- */
function makeSwatch(step, lch){
  const L = stepToL(step);
  const C = clampChroma(L, lch.C);
  const lab = oklchToOklab(L, C, lch.h);
  const rgb = oklabToRgb(lab.L, lab.a, lab.b);
  return {
    step,
    hex: rgbToHex(rgb),
    h: lch.h,
    c: C,
    l: L,
    isBase: false // default
  };
}

export function generateAbsoluteScale(lch, steps = DEFAULT_STEPS, forceExcludeAnchor = false){
  // Requirement: "Wszystkie progi (100, 200, itd.) są generowane w równych odstępach matematycznych, niezależnie od wartości Cin."
  const anchorStep = LToStep(lch.L);
  const scale = steps.map(s => makeSwatch(s, lch));

  // Mark anchor if it exists in the steps or insert it
  let found = false;
  scale.forEach(sw => {
      if (Math.abs(sw.step - anchorStep) < 2) {
          sw.isBase = true;
          sw.step = anchorStep; // show exact step
          found = true;
      }
  });

  if (!found && !forceExcludeAnchor) {
      const baseSwatch = makeSwatch(anchorStep, lch);
      baseSwatch.isBase = true;
      baseSwatch.isInserted = true;
      scale.push(baseSwatch);
  }

  return scale.sort((a,b)=>a.step-b.step);
}

function maxChromaForL(L, H, C_start) {
  let low = 0;
  let high = Math.max(C_start, 0.4); // Start with at least 0.4 to find max possible
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    const lab = oklchToOklab(L, mid, H);
    const rgb = oklabToRgb(lab.L, lab.a, lab.b);

    // Check if in gamut [0, 255]
    if (rgb.r >= 0 && rgb.r <= 255 && rgb.g >= 0 && rgb.g <= 255 && rgb.b >= 0 && rgb.b <= 255) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return low;
}

function chromaFalloff(L, baseL) {
  const max_range = 0.6;
  const alpha = 1.3;
  const d = Math.abs(L - baseL);
  return Math.max(0, 1 - Math.pow(d / max_range, alpha));
}

function hueShift(L, baseL, baseH) {
  const shift_strength = 5; // degrees
  const d = L - baseL;
  return (baseH + d * shift_strength + 360) % 360;
}

function lightnessCurve(t) {
  const L_max = 0.97;
  const L_min = 0.12;
  const gamma = 1.3;
  return L_max - (L_max - L_min) * Math.pow(t, gamma);
}

export function generateAdaptiveScale(lch) {
  const out = [];
  const baseL = lch.L;
  const baseC = lch.C;
  const baseH = lch.h;

  for (let i = 0; i <= 100; i++) {
    const step = i * 10;
    const t = step / 1000;

    // Step 2: Target L
    const L = lightnessCurve(t);

    // Step 5: Hue shift
    const H = hueShift(L, baseL, baseH);

    // Step 3 & 4: Adaptive Chroma
    const maxC = maxChromaForL(L, H, baseC);
    const falloff = chromaFalloff(L, baseL);
    const C = Math.min(maxC, baseC * falloff);

    const lab = oklchToOklab(L, C, H);
    const rgb = oklabToRgb(lab.L, lab.a, lab.b);

    out.push({
      step,
      hex: rgbToHex(rgb),
      h: H,
      c: C,
      l: L,
      isBase: false
    });
  }

  // Find and mark the "real" base if we want, but in adaptive mode
  // the curve might not hit baseL exactly at step 500.
  // The requirement didn't specify anchor for adaptive.

  return out;
}

export function generateAsymmetricScale(lch){
  // Requirement: Anchor is fixed at 500.
  // Nonlinearity: "Jeśli Cin jest ciemny, kroki w stronę 1000 są mniejsze (większe zagęszczenie), a w stronę 0 – większe (rozciągnięcie skali)."

  const out = [];
  const anchorL = lch.L;

  for (let i = 0; i <= 100; i++) {
      const step = i * 10;
      let L;
      if (step === 500) {
          L = anchorL;
      } else if (step < 500) {
          const t = step / 500;
          // If anchorL is dark (0.2), p = 1/(0.4+0.1) = 2. t^2 stretches small t, squeezes large t near anchor.
          // Wait, if p > 1, small t (near 0 step / white) grows slowly.
          // If Cin is dark, we want "rozciągnięcie skali" towards 0.
          // Meaning 100, 200, 300 should be further apart in L.
          const p = anchorL < 0.5 ? 1 / (2 * anchorL + 0.1) : 1;
          L = 1 - (1 - anchorL) * Math.pow(t, p);
      } else {
          const t = (step - 500) / 500;
          // If anchorL is dark (0.2), p = 0.5. t^0.5 makes small t (near 500) grow fast in L drop.
          // Meaning 600, 700 are closer to 1000 in L. (zagęszczenie)
          const p = anchorL < 0.5 ? 2 * anchorL + 0.1 : 1;
          L = anchorL * (1 - Math.pow(t, p));
      }

      const C = clampChroma(L, lch.C);
      const lab = oklchToOklab(L, C, lch.h);
      const rgb = oklabToRgb(lab.L, lab.a, lab.b);
      const sw = { step, hex: rgbToHex(rgb), h: lch.h, c: C, l: L };
      if (step === 500) sw.isBase = true;
      out.push(sw);
  }

  return out.sort((a,b)=>a.step-b.step);
}

/* ---------- PUBLIC API ---------- */
export function generateScaleForLCH(lch, steps = DEFAULT_STEPS, forceExcludeAnchor = false){
  // Check if we are using the default granular steps (0, 10, 20...)
  const isDefaultGranular = steps === DEFAULT_STEPS || (steps.length === 101 && steps[1] === 10);

  if (isDefaultGranular) {
    if (EngineState.mode.scale === 'adaptive') {
      return generateAdaptiveScale(lch);
    }
    if (EngineState.mode.scale === 'asymmetric') {
      return generateAsymmetricScale(lch);
    }
  }
  return generateAbsoluteScale(lch, steps, forceExcludeAnchor);
}

export function getBaseLCH(){
  const { r,g,b } = EngineState.base.rgb;
  return oklabToOklch(rgbToOklab(r,g,b));
}
