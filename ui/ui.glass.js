// ui/ui.glass.js
// Specialized Glass View Renderer

import { getState } from '../engine/engine.core.js';
import { generateGlassData } from '../engine/engine.glass.js';

export function renderGlassView(lch) {
    const data = generateGlassData(lch);
    const wrap = document.createElement('div');
    wrap.className = 'glass-view-container';
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
    wrap.style.gap = '32px';
    wrap.style.padding = '32px';

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'glass-demo-card';
        card.style.background = item.bgHex;
        card.style.height = '400px';
        card.style.borderRadius = '24px';
        card.style.position = 'relative';
        card.style.overflow = 'hidden';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'center';
        card.style.border = '1px solid rgba(0,0,0,0.1)';

        // BG Pattern / Bubbles for depth
        const bubble = document.createElement('div');
        bubble.style.position = 'absolute';
        bubble.style.width = '150px';
        bubble.style.height = '150px';
        bubble.style.borderRadius = '50%';
        bubble.style.background = 'linear-gradient(45deg, #ff0080, #7928ca)';
        bubble.style.top = '10%';
        bubble.style.left = '10%';
        card.appendChild(bubble);

        const glass = document.createElement('div');
        glass.style.width = '80%';
        glass.style.height = '200px';
        glass.style.borderRadius = '20px';
        glass.style.backdropFilter = 'blur(16px)';
        glass.style.webkitBackdropFilter = 'blur(16px)';
        glass.style.background = hexToRgba(item.glassFillHex, item.glassOpacity);
        glass.style.border = `1px solid ${hexToRgba(item.glassBorderHex, item.borderOpacity)}`;
        glass.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
        glass.style.display = 'flex';
        glass.style.flexDirection = 'column';
        glass.style.alignItems = 'center';
        glass.style.justifyContent = 'center';
        glass.style.padding = '20px';
        glass.style.zIndex = '5';

        const title = document.createElement('div');
        title.textContent = item.name;
        title.style.fontWeight = '800';
        title.style.fontSize = '0.9rem';
        title.style.marginBottom = '8px';
        title.style.color = item.glassL > 0.5 ? '#000' : '#fff';

        const info = document.createElement('div');
        info.innerHTML = `Fill: ${item.glassFillHex}<br>Border: ${item.glassBorderHex}`;
        info.style.fontSize = '0.7rem';
        info.style.opacity = '0.7';
        info.style.textAlign = 'center';
        info.style.color = title.style.color;

        glass.append(title, info);
        card.appendChild(glass);
        wrap.appendChild(card);
    });

    return wrap;
}

function hexToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
