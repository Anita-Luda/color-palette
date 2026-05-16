// engine/engine.math.js
// OKLCH Math & Color Conversions - V9 Robust Stability

export function srgbToLinearWCAG(c){
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

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

export function oklabToRgbRaw(L,a,b){
  const l_ = L + 0.3963377774*a + 0.2158037573*b;
  const m_ = L - 0.1055613458*a - 0.0638541728*b;
  const s_ = L - 0.0894841775*a - 1.2914855480*b;
  const l = l_ < 0 ? 0 : l_**3, m = m_ < 0 ? 0 : m_**3, s = s_ < 0 ? 0 : s_**3;
  let r =  4.0767416621*l - 3.3077115913*m + 0.2309699292*s;
  let g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s;
  let b2= -0.0041960863*l - 0.7034186147*m + 1.7076147010*s;
  return { r, g, b: b2 };
}

export function oklabToRgb(L,a,b){
  const { r: r_, g: g_, b: b_ } = oklabToRgbRaw(L, a, b);
  const r = Math.max(0, Math.min(1, r_));
  const g = Math.max(0, Math.min(1, g_));
  const b2 = Math.max(0, Math.min(1, b_));
  return {
    r: Math.round(linearToSrgb(r) * 255),
    g: Math.round(linearToSrgb(g) * 255),
    b: Math.round(linearToSrgb(b2) * 255)
  };
}

export function oklabToOklch({L,a,b}){
  return { L, C: Math.sqrt(a*a+b*b), h: (Math.atan2(b,a)*180/Math.PI+360)%360 };
}

export function oklchToOklab(L,C,h){
  const hr = h*Math.PI/180;
  return { L, a: Math.cos(hr)*C, b: Math.sin(hr)*C };
}

export function oklchToOkluv(L, C, h) {
    const maxC = maxChromaForL(L, h, 'srgb');
    const saturation = maxC > 0.001 ? C / maxC : 0;
    return { L, saturation, h };
}

export function okluvToOklch(L, saturation, h) {
    const maxC = maxChromaForL(L, h, 'srgb');
    return { L, C: saturation * maxC, h };
}

export function rgbToHex({r,g,b}){
  return `#${((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}`;
}

// --- CAM16-UCS ---

const CAM_VC = {
    whitePoint: [95.047, 100.0, 108.883], // D65
    adaptingLuminance: 40,
    surround: 1.0,
    discounting: false
};

function getCAMParameters(vc) {
    const { whitePoint, adaptingLuminance, surround } = vc;
    const [Xw, Yw, Zw] = whitePoint;
    const La = adaptingLuminance;
    const k = 1 / (5 * La + 1);
    const F = surround;
    const fL = 0.2 * Math.pow(k, 4) * (5 * La) + 0.1 * Math.pow(1 - Math.pow(k, 4), 2) * Math.pow(5 * La, 1/3);
    const n = 1.0;
    const z = 1.48 + Math.sqrt(n);
    const D = Math.max(0, Math.min(1, F * (1 - (1/3.6) * Math.exp((-La - 42)/92))));
    return { F, fL, n, z, D, Xw, Yw, Zw };
}

export function xyzToCam16(X, Y, Z) {
    const params = getCAMParameters(CAM_VC);
    const r = 0.401288 * X + 0.650173 * Y - 0.051461 * Z;
    const g = -0.250268 * X + 1.204414 * Y + 0.045854 * Z;
    const b = -0.002079 * X + 0.048952 * Y + 0.953127 * Z;

    const rW = 0.401288 * params.Xw + 0.650173 * params.Yw - 0.051461 * params.Zw;
    const gW = -0.250268 * params.Xw + 1.204414 * params.Yw + 0.045854 * params.Zw;
    const bW = -0.002079 * params.Xw + 0.048952 * params.Yw + 0.953127 * params.Zw;

    const D = params.D;
    const rc = ((params.Yw * D / rW) + (1 - D)) * r;
    const gc = ((params.Yw * D / gW) + (1 - D)) * g;
    const bc = ((params.Yw * D / bW) + (1 - D)) * b;

    const fL = params.fL;
    // Robust post-adaptation with protection against ultra-low values.
    const getS = (v) => {
        const absV = Math.abs(v);
        if (absV < 0.0001) return 0;
        return Math.pow((fL * absV) / 100, 0.422);
    };

    const r_ = getS(rc), g_ = getS(gc), b_ = getS(bc);

    const ra = (400 * r_) / (r_ + 27.13);
    const ga = (400 * g_) / (g_ + 27.13);
    const ba = (400 * b_) / (b_ + 27.13);

    const a = ra - (12 * ga / 11) + (ba / 11);
    const b_alt = (ra + ga - 2 * ba) / 9;
    const h = (Math.atan2(b_alt, a) * 180 / Math.PI + 360) % 360;

    const sYw = getS(params.Yw);
    const Aw = (2 * 400 * sYw / (sYw + 27.13)) + 0.305;
    const A = (2 * ra + ga + 0.05 * ba) - 0.305;
    const J = 100 * Math.pow(Math.max(0, A / Aw), params.z);

    const C = Math.sqrt(a * a + b_alt * b_alt) * 0.11;
    return { J, C, h };
}

export function oklabToXyz(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = Math.max(0, l_ ** 3), m = Math.max(0, m_ ** 3), s = Math.max(0, s_ ** 3);
    const r =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const b_ = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    return {
        X: (0.4124564 * r + 0.3575761 * g + 0.1804375 * b_) * 100,
        Y: (0.2126729 * r + 0.7151522 * g + 0.0721750 * b_) * 100,
        Z: (0.0193339 * r + 0.1191920 * g + 0.9503041 * b_) * 100
    };
}

export function maxChromaForL(L, H, profile = 'srgb') {
    if (L <= 0.0001 || L >= 0.9999) return 0;
    let low = 0;
    let high = (profile === 'p3' || profile === 'rec2020') ? 0.6 : 0.45;
    const iterations = (H > 60 && H < 130) || (H > 170 && H < 220) ? 32 : 20;
    for (let i = 0; i < iterations; i++) {
        const mid = (low + high) / 2;
        const lab = oklchToOklab(L, mid, H);
        const { r, g, b } = oklabToRgbRaw(lab.L, lab.a, lab.b);
        let inGamut;
        if (profile === 'p3') inGamut = (r >= -0.15 && r <= 1.15 && g >= -0.15 && g <= 1.15 && b >= -0.15 && b <= 1.15);
        else inGamut = (r >= -0.00001 && r <= 1.00001 && g >= -0.00001 && g <= 1.00001 && b >= -0.00001 && b <= 1.00001);
        if (inGamut) low = mid; else high = mid;
    }
    return low;
}
