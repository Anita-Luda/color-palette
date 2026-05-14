// engine/engine.core.js
// Core state + API contract (no rendering, no DOM)

export const EngineState = {
  base: {
    rgb: { r: 124, g: 108, b: 255 },
    lch: null,
    step: null
  },

  mode: {
    palette: 'light',        // light | dark
    scale: 'absolute',       // absolute | asymmetric
    algorithm: 'standard',   // standard | adaptive
    darkModeBoost: false,    // post-processing boost
    neonBoost: false,        // post-processing neon effect
    pastelBoost: false,      // post-processing pastel effect
    glassmorphismBoost: false, // glassmorphism optimization
    inkSaveMode: false,      // print optimization
    view: 'palettes',        // palettes | contrast
    granularity: 100,        // 10 | 50 | 100
    background: 'light',     // light | dark
    backgroundSource: 'base', // 'base' or index (0, 1, 2...)
    sidebarPosition: 'left',
    sidebarTheme: 'dark',
    sidebarVisible: true
  },

  contrastSettings: {
    brightness: 0.5,
    boost: 0,
    ignoredThresholds: []    // list of contrast ratios to ignore
  },

  relation: {
    type: 'custom',          // custom | analogous | complementary | triadic | tetradic | split | warmcool
    distance: 30             // hue distance for harmonies
  },

  colors: [],                // additional colors (user-defined)
  warnings: [],              // system messages (non-blocking)

  locks: {
    L: false,
    C: false
  }
};

/* ---------- INTERNAL HELPERS ---------- */

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function pushWarning(msg) {
  if (!EngineState.warnings.includes(msg)) {
    EngineState.warnings.push(msg);
  }
}

function clearWarnings() {
  EngineState.warnings.length = 0;
}

/* ---------- BASE COLOR ---------- */

export function setBaseRGB(rgb, lch, step) {
  EngineState.base.rgb = clone(rgb);
  EngineState.base.lch = clone(lch);
  EngineState.base.step = step;
  clearWarnings();
}

/* ---------- MODE ---------- */

export function setPaletteMode(mode) {
  if (mode !== 'light' && mode !== 'dark') return;
  EngineState.mode.palette = mode;
}

export function setScaleMode(mode) {
  if (mode !== 'absolute' && mode !== 'asymmetric' && mode !== 'fixed') return;
  EngineState.mode.scale = mode;
}

export function setAlgorithmMode(mode) {
  if (mode !== 'standard' && mode !== 'adaptive') return;
  EngineState.mode.algorithm = mode;
}

export function setDarkModeBoost(enabled) {
  EngineState.mode.darkModeBoost = Boolean(enabled);
}

export function setNeonBoost(enabled) {
  EngineState.mode.neonBoost = Boolean(enabled);
}

export function setPastelBoost(enabled) {
  EngineState.mode.pastelBoost = Boolean(enabled);
}

export function setGlassmorphismBoost(enabled) {
  EngineState.mode.glassmorphismBoost = Boolean(enabled);
}

export function setInkSaveMode(enabled) {
  EngineState.mode.inkSaveMode = Boolean(enabled);
}

export function setView(view) {
  if (view !== 'palettes' && view !== 'contrast') return;
  EngineState.mode.view = view;
}

export function setGranularity(value) {
  const v = Number(value);
  if ([10, 50, 100].includes(v)) {
    EngineState.mode.granularity = v;
  }
}

export function setBackgroundMode(mode) {
  if (mode !== 'light' && mode !== 'dark') return;
  EngineState.mode.background = mode;
}

export function setSidebarPosition(pos) {
    EngineState.mode.sidebarPosition = pos;
}

export function setSidebarTheme(theme) {
    EngineState.mode.sidebarTheme = theme;
}

export function setSidebarVisibility(visible) {
    EngineState.mode.sidebarVisible = visible;
}

export function setBackgroundSource(source) {
  EngineState.mode.backgroundSource = source;
}

export function setContrastSettings(key, value) {
  if (EngineState.contrastSettings.hasOwnProperty(key)) {
    if (key === 'ignoredThresholds') {
        EngineState.contrastSettings[key] = value;
    } else {
        EngineState.contrastSettings[key] = Number(value);
    }
  }
}

export function toggleIgnoredThreshold(thresholdId) {
    const list = EngineState.contrastSettings.ignoredThresholds;
    const idx = list.indexOf(thresholdId);
    if (idx === -1) {
        list.push(thresholdId);
    } else {
        list.splice(idx, 1);
    }
}

/* ---------- RELATIONS ---------- */

export function setRelation(type) {
  EngineState.relation.type = type;
}

export function setRelationDistance(dist) {
  EngineState.relation.distance = Number(dist);
}

/* ---------- COLORS MANAGEMENT ---------- */

export function setColorCount(count) {
  clearWarnings();
  EngineState.colors = [];
  for (let i = 0; i < count; i++) {
    EngineState.colors.push(createColor(i));
  }
}

export function addColor() {
  EngineState.colors.push(createColor(EngineState.colors.length));
}

export function removeColor(index) {
  if (index < 0 || index >= EngineState.colors.length) return;

  const removedColorIndex = EngineState.colors[index].index;
  EngineState.colors.splice(index, 1);

  if (EngineState.mode.backgroundSource === removedColorIndex) {
    EngineState.mode.backgroundSource = 'base';
  }

  reindexColors();
}

export function reorderColors(from, to) {
  if (from === to) return;
  if (from < 0 || to < 0) return;
  if (from >= EngineState.colors.length) return;
  if (to >= EngineState.colors.length) return;

  const item = EngineState.colors.splice(from, 1)[0];
  EngineState.colors.splice(to, 0, item);
  reindexColors();
}

function reindexColors() {
  EngineState.colors.forEach((c, i) => {
    c.index = i;
  });
}

function createColor(index, manualData = null) {
  return {
    index,
    slider: manualData ? (manualData.slider || 0.5) : 0.5,
    role: index === 0
      ? 'dominant'
      : index === 1
        ? 'secondary'
        : 'accent',
    manualLCH: manualData ? manualData.lch : null,
    manualHex: manualData ? manualData.hex : null
  };
}

export function addManualColor(hex, lch, slider) {
    EngineState.colors.push(createColor(EngineState.colors.length, { hex, lch, slider }));
}

export function addGrayPalette() {
    const grayHex = "#808080";
    const grayLCH = { L: 0.5, C: 0, h: 0 };
    addManualColor(grayHex, grayLCH, 0.5);
}

export function getAllHexesForFigma() {
    return clone(EngineState);
}

export function updateColorRole(index, role) {
  if (!EngineState.colors[index]) return;
  EngineState.colors[index].role = role;
}

/* ---------- SLIDERS ---------- */

export function setColorSlider(index, value) {
  if (!EngineState.colors[index]) return;
  EngineState.colors[index].slider = Math.min(1, Math.max(0, value));
}

/* ---------- LOCKS ---------- */

export function setLock(param, value) {
  if (param !== 'L' && param !== 'C') return;
  EngineState.locks[param] = Boolean(value);
}

/* ---------- READ API ---------- */

export function getState() {
  return clone(EngineState);
}

export function getWarnings() {
  return [...EngineState.warnings];
}
