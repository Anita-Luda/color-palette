// engine/engine.accessibility.js// engine/engine// Accessibility utilities: contrast (AA/AAA), previews, suggestions. No DOM.

import { EngineState } from './engine.core.js';
import { generateScaleForLCH, getBaseLCH } from './engine.scales.js';

/* ---------- COLOR UTILS ---------- */
function hexToRgb(hex){
  const h = hex.replace('#','');
  return {
    r: parseInt(h.slice(0,2),16),
    g: parseInt(h.slice(2,4),16),
    b: parseInt(h.slice(4,6),16)
  };
}
function srgbToLinear(c){
  c /= 255;
  return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
}
function relativeLuminance({r,g,b}){
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  return 0.2126*R + 0.7152*G + 0.0722*B;
}

/* ---------- CONTRAST ---------- */
export function contrastRatio(hexA, hexB){
  const L1 = relativeLuminance(hexToRgb(hexA)) + 0.05;
  const L2 = relativeLuminance(hexToRgb(hexB)) + 0.05;
  return L1 > L2 ? L1/L2 : L2/L1;
}

export function wcagLevel(ratio, isLargeText=false){
  if (isLargeText){
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3.0) return 'AA';
    return 'FAIL';
  }
  if (ratio >= 7.0) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'FAIL';
}

/* ---------- PREVIEW (LIGHT / DARK) ---------- */
const LIGHT_BG = '#ffffff';
const DARK_BG  = '#0f1115';

export function previewContrast(hex, opts={ largeText:false }){
  const light = contrastRatio(hex, LIGHT_BG);
  const dark  = contrastRatio(hex, DARK_BG);
  return {
    light: {
      ratio: Number(light.toFixed(2)),
      level: wcagLevel(light, opts.largeText)
    },
    dark: {
      ratio: Number(dark.toFixed(2)),
      level: wcagLevel(dark, opts.largeText)
    }
  };
}

/* ---------- SUGGESTIONS (NO AUTO-FIX) ---------- */
/**
 * Finds nearest accessible swatches within the SAME FAMILY
 * (same hue; varies L along the generated scale).
 */
export function suggestAlternatives({
  hex,
  familyLCH,
  target='AA',           // 'AA' | 'AAA'
  background='light',    // 'light' | 'dark'
  largeText=false,
  limit=3
}){
  const bgHex = background === 'dark' ? DARK_BG : LIGHT_BG;
  const required = target === 'AAA'
    ? (largeText ? 4.5 : 7.0)
    : (largeText ? 3.0 : 4.5);

  // Build family scale (absolute/symmetric handled upstream)
  const scale = generateScaleForLCH(familyLCH);

  // Rank by perceptual closeness (|Δstep|)
  const baseStep = scale.find(s => s.hex.toLowerCase() === hex.toLowerCase())?.step;

  const ranked = scale
    .map(s => ({
      ...s,
      ratio: contrastRatio(s.hex, bgHex),
      dist: baseStep != null ? Math.abs(s.step - baseStep) : 0
    }))
    .filter(s => s.ratio >= required)
    .sort((a,b) => a.dist - b.dist)
    .slice(0, limit)
    .map(s => ({
      step: s.step,
      hex: s.hex,
      ratio: Number(s.ratio.toFixed(2)),
      level: wcagLevel(s.ratio, largeText)
    }));

  return ranked;
}

/* ---------- FAMILY HELPERS ---------- */
/**
 * Convenience: build family LCH for base or additional color by index.
 * UI decides which to pass; engine stays read-only here.
 */
export function getBaseFamilyLCH(){
  return getBaseLCH();
}

export function getAdditionalFamilyLCH(index){
  const base = getBaseLCH();
  const color = EngineState.colors[index];
  if (!color) return base;

  // Relation offset + slider offset
  const relationOffset = (function(){
    switch (EngineState.relation.type){
      case 'complementary': return index * 180;
      case 'triadic': return index * 120;
      case 'tetradic': return index * 90;
      case 'split': return index === 0 ? -150 : 150;
      case 'analogous':
        return EngineState.colors.length > 1
          ? -40 + (80/(EngineState.colors.length-1))*index
          : 0;
      case 'warmcool': return index % 2 === 0 ? -40 : 40;
      default: return 0;
    }
  })();

  const sliderOffset = (color.slider - 0.5) * 360;

  return {
    L: base.L,
    C: base.C,
    h: (base.h + relationOffset + sliderOffset + 360) % 360
  };
}
