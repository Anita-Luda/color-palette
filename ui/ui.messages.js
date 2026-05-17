// ui/ui.messages.js
// Centralized messaging and feedback system

export function renderMessages(container, type, message) {
    if (!container) return;

    const msgEl = document.createElement('div');
    msgEl.className = `ui-message ui-message-${type}`;
    msgEl.style.padding = '8px 12px';
    msgEl.style.borderRadius = '4px';
    msgEl.style.marginBottom = '8px';
    msgEl.style.fontSize = '0.85rem';

    if (type === 'error') {
        msgEl.style.backgroundColor = 'rgba(255, 82, 82, 0.1)';
        msgEl.style.color = '#ff5252';
        msgEl.style.borderLeft = '4px solid #ff5252';
    } else if (type === 'success') {
        msgEl.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        msgEl.style.color = '#4caf50';
        msgEl.style.borderLeft = '4px solid #4caf50';
    } else {
        msgEl.style.backgroundColor = 'rgba(255, 193, 7, 0.1)';
        msgEl.style.color = '#ffc107';
        msgEl.style.borderLeft = '4px solid #ffc107';
    }

    msgEl.textContent = message;
    container.appendChild(msgEl);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        msgEl.style.opacity = '0';
        msgEl.style.transition = 'opacity 0.5s ease';
        setTimeout(() => msgEl.remove(), 500);
    }, 5000);
}

// Global hook for quick messaging
window.showUIMessage = (message, type = 'info') => {
    const container = document.getElementById('manualColorMsg') || document.body;
    renderMessages(container, type, message);
};
