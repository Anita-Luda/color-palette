// engine/engine.scales.js
// Absolute & Symmetric scales (anchor-aware). No DOM.

import { EngineState } from './engine.core.js';

/* ---------- OKLCH MATH ---------- */
function srgbToLinear(c){
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c){
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
function rgbToOklab(r,g,b){
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
function oklabToRgb(L,a,b){
  const l_ = L + 0.3963377774*a + 0.2158037573*b;
  const m_ = L - 0.1055613458*a - 0.0638541728*b;
  const s_ = L - 0.0894841775*a - 1.2914855480*b;
  const l = l_**3, m = m_**3, s = s_**3;
  let r =  4.0767416621*l - 3.3077115913*m + 0.2309699292*s;
  let g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s;
  let b2= -0.0041960863*l - 0.7034186147*m + 1.7076147010*s;
  r = linearToSrgb(r); g = linearToSrgb(g); b2 = linearToSrgb(b2);
  return {
    r: Math.round(Math.min(1,Math.max(0,r))*255),
    g: Math.round(Math.min(1,Math.max(0,g))*255),
    b: Math.round(Math.min(1,Math.max(0,b2))*255)
  };
}
function oklabToOklch({L,a,b}){
  return { L, C: Math.sqrt(a*a+b*b), h: (Math.atan2(b,a)*180/Math.PI+360)%360 };
}
function oklchToOklab(L,C,h){
  const hr = h*Math.PI/180;
  return { L, a: Math.cos(hr)*C, b: Math.sin(hr)*C };
}
function rgbToHex({r,g,b}){
  return `#${((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}`;
}

/* ---------- HELPERS ---------- */
const STEPS = Array.from({length:101},(_,i)=>i*10);

function stepToL(step){
  const t = step/1000;
  return EngineState.mode.palette === 'dark'
    ? 0.12 + (1 - t) * 0.7
    : 0.98 - t * 0.8;
}

function LToStep(L){
  return Math.round(
    EngineState.mode.palette === 'dark'
      ? (1 - (L - 0.12)/0.7) * 1000
      : (0.98 - L)/0.8 * 1000
  );
}

// Guardrail chromy – brak „szarzenia”
function clampChroma(L, C){
  const max =
    L > 0.85 ? 0.10 :
    L > 0.65 ? 0.16 :
    L > 0.45 ? 0.24 : 0.32;
  return Math.min(C, max);
}

/* ---------- CORE GENERATORS ---------- */
function makeSwatch(step, lch){
  const L = stepToL(step);
  const C = clampChroma(L, lch.C);
  const lab = oklchToOklab(L, C, lch.h);
  const rgb = oklabToRgb(lab.L, lab.a, lab.b);
  return { step, hex: rgbToHex(rgb) };
}

export function generateAbsoluteScale(lch){
  return STEPS.map(s => makeSwatch(s, lch));
}

export function generateSymmetricScale(lch){
  const anchorStep = LToStep(lch.L);
  const span = Math.max(anchorStep, 1000 - anchorStep);
  const out = [];

  for (let d = -span; d <= span; d += 10){
    const s = anchorStep + d;
    if (s < 0 || s > 1000) continue;
    const L = stepToL(s);
    // Symetria: ta sama relacja chromy w górę i w dół
    const t = Math.abs(d) / span;
    const C = clampChroma(L, lch.C * (1 - 0.15*t));
    const lab = oklchToOklab(L, C, lch.h);
    const rgb = oklabToRgb(lab.L, lab.a, lab.b);
    out.push({ step: s, hex: rgbToHex(rgb), isBase: d === 0 });
  }

  // Wstaw bazowy jako osobny swatch, jeśli wypada między progami
  const snapped = Math.round(anchorStep/10)*10;
  if (Math.abs(snapped - anchorStep) > 1){
    const lab = oklchToOklab(lch.L, clampChroma(lch.L, lch.C), lch.h);
    const rgb = oklabToRgb(lab.L, lab.a, lab.b);
    out.push({ step: anchorStep, hex: rgbToHex(rgb), isBase: true, isInserted: true });
  }

  return out.sort((a,b)=>a.step-b.step);
}

/* ---------- PUBLIC API ---------- */
export function generateScaleForLCH(lch){
  return EngineState.mode.scale === 'symmetric'
    ? generateSymmetricScale(lch)
    : generateAbsoluteScale(lch);
}

// Utility: compute base LCH from EngineState.base.rgb
export function getBaseLCH(){
  const { r,g,b } = EngineState.base.rgb;
  return oklabToOklch(rgbToOklab(r,g,b));
}
