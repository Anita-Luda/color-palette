// ui/controls/ui.controls.export.js
const $ = id => document.getElementById(id);

export function setupExportControls() {
    const exportBtns = [
        'export-figma-btn',
        'export-figma-func-btn',
        'export-figma-badge-btn',
        'export-figma-contrast-btn'
    ];

    exportBtns.forEach(id => {
        $(id)?.addEventListener('click', (e) => {
            const type = e.target.dataset.type || 'main';
            import('../ui.render.js').then(m => {
                const svg = m.generateExportSVG(type);
                navigator.clipboard.writeText(svg).then(() => {
                    alert(`SVG (${type}) skopiowano do schowka. Możesz teraz wkleić go bezpośrednio w Figmie.`);
                });
            });
        });
    });

    $('copy-hex-list-btn')?.addEventListener('click', () => {
        import('../ui.render.js').then(m => {
            const hexes = m.getAllVisibleHexes();
            const list = Array.from(new Set(hexes)).join(', ');
            navigator.clipboard.writeText(list).then(() => {
                alert('Skopiowano listę unikatowych HEXów.');
            });
        });
    });
}
