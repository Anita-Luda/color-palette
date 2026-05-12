// engine/engine.gradients.js
// Slider gradients in OKLCH, gamut-aware. No DOM.

import { EngineState } from './engine.core.js';
import { getBaseLCH } from './engine.scales.js';

/* ---------- OKLCH MATH (LOCAL) ---------- */
function linearToSrgb(c){
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1/2.4) - 0.055;
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
  return { r, g, b: b2 };
}
function oklchToOklab(L,C,h){
  const hr = h * Math.PI/180;
  return { L, a: Math.cos(hr)*C, b: Math.sin(hr)*C };
}
function rgbInGamut({r,g,b}){
  return r>=0 && r<=1 && g>=0 && g<=1 && b>=0 && b<=1;
}
function rgbToHex01({r,g,b}){
  const R = Math.round(Math.min(1,Math.max(0,r))*255);
  const G = Math.round(Math.min(1,Math.max(0,g))*255);
  const B = Math.round(Math.min(1,Math.max(0,b))*255);
  return `#${((1<<24)+(R<<16)+(G<<8)+B).toString(16).slice(1)}`;
}

/* ---------- ROLE PROFILES ---------- */
const ROLE_CHROMA_MULT = {
  dominant: 1.0,
  secondary: 0.75,
  accent: 1.15
};

/* ---------- LIGHT/DARK ADJUST ---------- */
function adjustForMode(L, C){
  if (EngineState.mode.palette === 'dark') {
    return { L: Math.max(0.15, L), C: C * 1.05 };
  }
  return { L, C };
}

/* ---------- CACHE ---------- */
const gradientCache = new Map();
function cacheKey({L,C,h}, role){
  return [
    EngineState.mode.palette,
    role,
    EngineState.locks.L ? 'L' : '',
    EngineState.locks.C ? 'C' : '',
    L.toFixed(3),
    C.toFixed(3),
    Math.round(h)
  ].join('|');
}

/* ---------- CORE ---------- */
export function computeHueRange(baseLCH, role){
  const samples = [];
  const roleMult = ROLE_CHROMA_MULT[role] ?? 1;
  const baseC = baseLCH.C * roleMult;

  for (let h = 0; h < 360; h += 2){
    const { L, C } = adjustForMode(
      EngineState.locks.L ? baseLCH.L : baseLCH.L,
      EngineState.locks.C ? baseC : baseC
    );
    const lab = oklchToOklab(L, C, h);
    const rgb = oklabToRgb(lab.L, lab.a, lab.b);
    if (rgbInGamut(rgb)) samples.push(h);
  }

  if (!samples.length) return { min: 0, max: 0 };

  return {
    min: Math.min(...samples),
    max: Math.max(...samples)
  };
}

export function generateSliderGradient(role, index){
  const baseLCH = getBaseLCH();
  // We need to know the 'center' hue for this specific slider from the relation system
  const { type, distance } = EngineState.relation;

  // Re-calculate the specific hue logic from palettes.js locally for gradient
  // Total count of colors is needed
  const total = EngineState.colors.length;

  // We want to show +/- 180 degrees around the relation-defined hue
  // Or just show 0-360 mapped so that center is the relation hue?
  // User says: "Pozycja suwaga na gradiencie ma wskazywać aktualnie wybraną barwę."
  // If slider is 0.5, it should be the relation hue.

  function getRelHue(baseHue, idx, tot, t, dist){
      const step = 360 / (tot + 1);
      switch(t){
        case 'custom': return (baseHue + (idx + 1) * step + (dist - 30)) % 360;
        case 'analogous': return (baseHue + (idx + 1) * dist) % 360;
        case 'complementary': return (baseHue + 180 + idx * dist) % 360;
        case 'split':
          if (idx === 0) return (baseHue + 180 - dist) % 360;
          if (idx === 1) return (baseHue + 180 + dist) % 360;
          return (baseHue + 180 + (idx - 1) * dist) % 360;
        case 'triadic': return (baseHue + (idx + 1) * 120 + idx * dist) % 360;
        case 'tetradic': return (baseHue + (idx + 1) * 90 + idx * dist) % 360;
        case 'warmcool': return (baseHue + 180 + idx * dist) % 360;
        default: return baseHue;
      }
  }

  const centerHue = getRelHue(baseLCH.h, index, total, type, distance);

  const stops = [];
  const roleMult = ROLE_CHROMA_MULT[role] ?? 1;

  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    // Map t 0..1 to centerHue - 180 .. centerHue + 180
    let h = (centerHue + (t - 0.5) * 360) % 360;
    if (h < 0) h += 360;

    const L = baseLCH.L;
    const C = baseLCH.C * roleMult;
    const adj = adjustForMode(L, C);
    const lab = oklchToOklab(adj.L, adj.C, h);
    const rgb = oklabToRgb(lab.L, lab.a, lab.b);
    const inGamut = rgbInGamut(rgb);

    stops.push({
      t,
      hue: h,
      hex: rgbToHex01(rgb),
      disabled: !inGamut
    });
  }

  return { stops, centerHue };
}

/* ---------- UTIL ---------- */
export function clearGradientCache(){
  gradientCache.clear();
}
