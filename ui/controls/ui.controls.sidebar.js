// ui/controls/ui.controls.sidebar.js
import {
    setSidebarPosition, setSidebarTheme, setSidebarVisibility,
    setBackgroundMode, getState, setGradientBgBrightness
} from '../../engine/engine.core.js';

const $ = id => document.getElementById(id);

export function updateSidebarLayout() {
    const state = getState();
    const body = document.body;

    const glassSec = $('sec-glass-settings');
    if (glassSec) {
        glassSec.style.display = state.mode.view === 'glass' ? 'block' : 'none';
    }

    const gradSec = $('sec-gradient-settings');
    if (gradSec) {
        gradSec.style.display = state.mode.view === 'gradients' ? 'block' : 'none';
    }

    document.querySelectorAll('.pos-btn').forEach(btn => {
        if (btn.dataset.val === state.mode.sidebarPosition) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    body.classList.remove('pos-left', 'pos-right', 'pos-top', 'pos-bottom', 'pos-floating');
    body.classList.add(`pos-${state.mode.sidebarPosition}`);

    body.classList.remove('sb-dark', 'sb-light');
    body.classList.add(`sb-${state.mode.sidebarTheme}`);

    if (state.mode.sidebarVisible) body.classList.remove('sb-hidden');
    else body.classList.add('sb-hidden');

    const boostToggle = $('boost-toggle');
    if (boostToggle) boostToggle.checked = state.mode.darkModeBoost;
    const lmBoostToggle = $('light-mode-boost-toggle');
    if (lmBoostToggle) lmBoostToggle.checked = state.mode.lightModeBoost;
    const neonToggle = $('neon-toggle');
    if (neonToggle) neonToggle.checked = state.mode.neonBoost;
    const pastelToggle = $('pastel-toggle');
    if (pastelToggle) pastelToggle.checked = state.mode.pastelBoost;
    const glassToggle = $('glass-toggle');
    if (glassToggle) glassToggle.checked = state.mode.glassmorphismBoost;
    const inkToggle = $('ink-toggle');
    if (inkToggle) inkToggle.checked = state.mode.inkSaveMode;
    const spectralToggle = $('spectral-toggle');
    if (spectralToggle) spectralToggle.checked = state.mode.spectralBalance;
    const polishToggle = $('polish-toggle');
    if (polishToggle) polishToggle.checked = state.mode.perceptualPolish;

    const labelShaping = $('label-shaping');
    if (labelShaping) labelShaping.textContent = `Chroma Shaping: ${state.mode.chromaShapingFactor.toFixed(2)}`;

    const lockL = $('lock-l-toggle');
    if (lockL) lockL.checked = state.locks.L;
    const lockC = $('lock-c-toggle');
    if (lockC) lockC.checked = state.locks.C;

    document.querySelectorAll('input[name="interpMode"]').forEach(r => {
        r.checked = (r.value === state.mode.interpolation);
    });
    document.querySelectorAll('input[name="gamutMode"]').forEach(r => {
        r.checked = (r.value === state.mode.gamutProfile);
    });
    document.querySelectorAll('input[name="contrastAlgo"]').forEach(r => {
        r.checked = (r.value === state.contrastSettings.algorithm);
    });
    document.querySelectorAll('input[name="algoMode"]').forEach(r => {
        r.checked = (r.value === state.mode.algorithm);
    });
}

export function setupSidebarControls() {
    const posBtns = document.querySelectorAll('.pos-btn');
    const hideBtn = $('hide-panel-btn');
    const toggleBtn = $('panel-toggle');
    const themeRadios = document.querySelectorAll('input[name="sbTheme"]');

    posBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setSidebarPosition(btn.dataset.val);
            const sidebar = $('sidebar');
            sidebar.style.left = ''; sidebar.style.top = ''; sidebar.style.bottom = ''; sidebar.style.right = '';
            if (window.refreshUI) window.refreshUI();
        });
    });

    hideBtn?.addEventListener('click', () => {
        setSidebarVisibility(false);
        if (window.refreshUI) window.refreshUI();
    });

    toggleBtn?.addEventListener('click', () => {
        setSidebarVisibility(true);
        if (window.refreshUI) window.refreshUI();
    });

    themeRadios.forEach(r => {
        r.addEventListener('change', e => {
            setSidebarTheme(e.target.value);
            if (window.refreshUI) window.refreshUI();
        });
    });

    document.querySelectorAll('input[name="previewBg"]').forEach(r => {
        r.addEventListener('change', e => {
            const mode = e.target.value;
            setBackgroundMode(mode);
            const out = $('output');
            if (mode === 'dark') {
                out.classList.add('preview-dark');
                out.classList.remove('preview-light');
            } else {
                out.classList.add('preview-light');
                out.classList.remove('preview-dark');
            }
            if (window.refreshUI) window.refreshUI();
        });
    });

    $('grad-bg-brightness-light')?.addEventListener('input', e => {
        setGradientBgBrightness('light', e.target.value);
        if (window.refreshUI) window.refreshUI(true);
    });

    $('grad-bg-brightness-dark')?.addEventListener('input', e => {
        setGradientBgBrightness('dark', e.target.value);
        if (window.refreshUI) window.refreshUI(true);
    });
}

export function setupCollapsibles() {
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.sidebar-header');
        if (!header || e.target.closest('button')) return;
        const section = header.closest('.sidebar-section');
        if (section && section.classList.contains('collapsible')) {
            section.classList.toggle('collapsed');
        }
    });
}

export function setupFloatingPanel() {
    const sidebar = $('sidebar');
    let isDragging = false;
    let offset = { x: 0, y: 0 };
    sidebar.addEventListener('mousedown', e => {
        const state = getState();
        if (state.mode.sidebarPosition !== 'floating' || e.target.closest('input, select, button, .big-swatch')) return;
        isDragging = true;
        offset.x = e.clientX - sidebar.offsetLeft;
        offset.y = e.clientY - sidebar.offsetTop;
        sidebar.style.transition = 'none';
    });
    document.addEventListener('mousemove', e => {
        if (!isDragging) return;
        sidebar.style.left = (e.clientX - offset.x) + 'px';
        sidebar.style.top = (e.clientY - offset.y) + 'px';
        sidebar.style.bottom = 'auto'; sidebar.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { isDragging = false; sidebar.style.transition = ''; });
}
