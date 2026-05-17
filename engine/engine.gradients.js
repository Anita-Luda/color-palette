// engine/engine.gradients.js
// Slider gradients in OKLCH, gamut-aware. No DOM.

import { EngineState } from './engine.core.js';
import {
  getBaseLCH
} from './engine.scales.js';
import { oklchToOklab, oklabToRgb, rgbToHex, oklabToRgbRaw } from './engine.math.js';

/* ---------- OKLCH MATH (ROBUST) ---------- */
function isStrictlyInGamut(L, a, b) {
  const { r, g, b: b2 } = oklabToRgbRaw(L, a, b);

  // Linear RGB check
  return r >= 0 && r <= 1 && g >= 0 && g <= 1 && b2 >= 0 && b2 <= 1;
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
    if (isStrictlyInGamut(lab.L, lab.a, lab.b)) samples.push(h);
  }

  if (!samples.length) return { min: 0, max: 0 };

  return {
    min: Math.min(...samples),
    max: Math.max(...samples)
  };
}

export function getColorsForGradient() {
    const state = EngineState;
    const colors = [];

    // Add base color
    const baseLch = getBaseLCH();
    colors.push({
        lch: { l: baseLch.L, c: baseLch.C, h: baseLch.h },
        hex: rgbToHex(oklabToRgb(oklchToOklab(baseLch.L, baseLch.C, baseLch.h).L, oklchToOklab(baseLch.L, baseLch.C, baseLch.h).a, oklchToOklab(baseLch.L, baseLch.C, baseLch.h).b))
    });

    // Add enabled additional colors
    state.colors.forEach((c, idx) => {
        if (c.inGradient) {
            // Recalculate LCH for this color based on its slider
            const { type, distance } = state.relation;
            const total = state.colors.length;

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

            const h = getRelHue(baseLch.h, idx, total, type, distance);
            const roleMult = ROLE_CHROMA_MULT[c.role] ?? 1;
            const l = baseLch.L;
            const cVal = baseLch.C * roleMult;

            // Adjust hue by slider
            const finalH = (h + (c.slider - 0.5) * 360) % 360;
            const adj = adjustForMode(l, cVal);

            colors.push({
                lch: { l: adj.L, c: adj.C, h: finalH >= 0 ? finalH : finalH + 360 },
                hex: rgbToHex(oklabToRgb(oklchToOklab(adj.L, adj.C, finalH >= 0 ? finalH : finalH + 360).L, oklchToOklab(adj.L, adj.C, finalH >= 0 ? finalH : finalH + 360).a, oklchToOklab(adj.L, adj.C, finalH >= 0 ? finalH : finalH + 360).b))
            });
        }
    });

    return colors;
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
  const range = computeHueRange(baseLCH, role);

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
    const inGamut = isStrictlyInGamut(lab.L, lab.a, lab.b);
    const rgb = oklabToRgb(lab.L, lab.a, lab.b); // Returns 0-255 clamped

    stops.push({
      t,
      hue: h,
      hex: rgbToHex(rgb),
      disabled: !inGamut
    });
  }

  return { stops, centerHue, range };
}

/* ---------- UTIL ---------- */
export function clearGradientCache(){
  gradientCache.clear();
}
