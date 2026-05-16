// ui/controls/ui.controls.contrast.js
import { setContrastSettings, toggleIgnoredThreshold, getState } from '../../engine/engine.core.js';
import { renderAllPalettes } from '../ui.render.js';

const $ = id => document.getElementById(id);

export function setupContrastControls() {
    const bTop = $('contrast-brightness-top');
    const bBoostTop = $('contrast-boost-top');

    document.querySelectorAll('input[name="contrastAlgo"]').forEach(r => {
        r.addEventListener('change', e => {
            setContrastSettings('algorithm', e.target.value);
            renderAllPalettes();
        });
    });

    bTop?.addEventListener('input', e => {
        setContrastSettings('brightness', e.target.value);
        renderAllPalettes();
    });
    bBoostTop?.addEventListener('input', e => {
        setContrastSettings('boost', e.target.value);
        renderAllPalettes();
    });

    document.querySelectorAll('.ignore-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.val;
            const allOfSameVal = document.querySelectorAll(`.ignore-btn[data-val="${val}"]`);
            const isActivating = !btn.classList.contains('active');
            allOfSameVal.forEach(b => {
                if (isActivating) b.classList.add('active');
                else b.classList.remove('active');
            });
            toggleIgnoredThreshold(val);
            renderAllPalettes();
        });
    });
}
