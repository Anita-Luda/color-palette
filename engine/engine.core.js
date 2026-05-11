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
    scale: 'absolute'        // absolute | symmetric
  },

  relation: {
    type: 'custom',          // custom | analogous | complementary | triadic | tetradic | split | warmcool
    limits: {
      custom: Infinity,
      analogous: Infinity,
      warmcool: Infinity,
      complementary: 2,
      split: 2,
      triadic: 3,
      tetradic: 4
    }
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
  if (mode !== 'absolute' && mode !== 'symmetric') return;
  EngineState.mode.scale = mode;
}

/* ---------- RELATIONS ---------- */

export function setRelation(type) {
  if (!(type in EngineState.relation.limits)) return;

  EngineState.relation.type = type;

  const limit = EngineState.relation.limits[type];
  if (EngineState.colors.length > limit) {
    pushWarning(
      `Relacja "${type}" obsługuje maks. ${limit} kolory`
    );
    EngineState.colors.length = limit;
  }
}

/* ---------- COLORS MANAGEMENT ---------- */

export function setColorCount(count) {
  clearWarnings();
  const limit = EngineState.relation.limits[EngineState.relation.type];

  if (count > limit) {
    pushWarning(
      `Relacja "${EngineState.relation.type}" obsługuje maks. ${limit} kolory`
    );
    count = limit;
  }

  EngineState.colors = [];
  for (let i = 0; i < count; i++) {
    EngineState.colors.push(createColor(i));
  }
}

export function addColor() {
  const limit = EngineState.relation.limits[EngineState.relation.type];
  if (EngineState.colors.length >= limit) {
    pushWarning(
      `Nie można dodać więcej kolorów dla relacji "${EngineState.relation.type}"`
    );
    return;
  }
  EngineState.colors.push(createColor(EngineState.colors.length));
}

export function removeColor(index) {
  if (index < 0 || index >= EngineState.colors.length) return;
  EngineState.colors.splice(index, 1);
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

function createColor(index) {
  return {
    index,
    slider: 0.5,          // 0..1 (position in gradient)
    role: index === 0
      ? 'dominant'
      : index === 1
        ? 'secondary'
        : 'accent'
  };
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
