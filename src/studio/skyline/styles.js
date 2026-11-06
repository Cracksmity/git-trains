// skyline/styles.js: focused styles operations.

import { el } from '../dom.js';

export function installStyles() {
  if (document.getElementById('skyline-editor-style')) return;
  document.head.append(el('style', {
    id: 'skyline-editor-style',
    textContent: `
      .se-canvas { display: block; width: 100%; max-width: none; height: auto; image-rendering: pixelated; touch-action: pan-y; cursor: grab; }
      .se-tools { display: flex; flex-wrap: wrap; align-items: end; gap: 4px 18px; margin-top: 10px; }
      .se-tools .field { margin: 0; }
      .se-canvas:active { cursor: grabbing; }
      .se-building-list.seg { display: grid; max-height: 220px; overflow-y: auto; }
      .se-building-list button { text-align: left; overflow-wrap: anywhere; }
      .se-top { border: 1px solid var(--line); border-radius: 8px; padding: 10px; margin: 8px 0; background: var(--surface); }
      .se-editor { border-top: 1px solid var(--line); padding-top: 12px; }
      .te button:disabled { opacity: .5; cursor: default; }
    `,
  }));
}
