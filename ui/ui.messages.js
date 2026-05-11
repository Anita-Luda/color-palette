// ui/ui.messages.js
// System messages renderer (warnings / info). No state mutation.

import { getWarnings } from '../engine/engine.core.js';

/* ---------- ROOT ---------- */
const sidebar = document.getElementById('sidebar');

/* ---------- HELPERS ---------- */
function el(tag, cls, text){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function ensureContainer(){
  let box = document.getElementById('system-messages');
  if (!box) {
    box = el('div', 'group');
    box.id = 'system-messages';

    const title = el('strong', null, 'Komunikaty systemowe');
    box.appendChild(title);

    sidebar.appendChild(box);
  }
  return box;
}

/* ---------- RENDER ---------- */
export function renderMessages(){
  const box = ensureContainer();

  // remove old messages
  const old = box.querySelectorAll('.message');
  old.forEach(n => n.remove());

  const warnings = getWarnings();
  if (!warnings.length) {
    const empty = el('div', 'message message-empty', 'Brak komunikatów.');
    box.appendChild(empty);
    return;
  }

  warnings.forEach(msg => {
    const item = el('div', 'message message-warning');
    item.textContent = msg;
    box.appendChild(item);
  });
}
