// Editor presentation methods. Session state is provided through the explicit editor context.
import { object } from '../dom.js';
import { parseSkyline } from '../../landscape/skyline-parse.js';
import { paintSkyline } from '../../landscape/skyline-render.js';
import { Grid } from '../../graphics/pixel.js';
import { THEMES } from '../../scene/themes.js';
import { SCENE_W, GY0 } from '../../scene/layout.js';
import { paintSky, celestialGrid } from '../../scene/sky.js';
import { paintBackdrop } from '../../scene/backdrop.js';
/** @param {Record<string, any>} editor */
export function createSkylineCanvas(editor) {

  function applyZoom() {
    const fit = (editor.wrap.clientWidth - 20) / SCENE_W;
    const scale = editor.zoom === 'auto' ? (fit >= 1.5 ? 'fit' : 2) : editor.zoom;
    editor.canvas.style.width = scale === 'fit' ? '' : `${SCENE_W * scale}px`;
    editor.zoomOptions.forEach(([value], i) => editor.zoomSeg.children[i].setAttribute('aria-pressed', String(value === scale)));
  }
  // Scroll the zoomed canvas so the selected building is in view.

  function revealSelected() {
    const box = editor.bounds[editor.selected];
    if (!box || editor.wrap.scrollWidth <= editor.wrap.clientWidth) return;
    const c = editor.canvas.getBoundingClientRect();
    const scale = c.width / SCENE_W;
    const origin = c.left - editor.wrap.getBoundingClientRect().left + editor.wrap.scrollLeft;
    const left = origin + box.left * scale;
    const right = origin + (box.right + 1) * scale;
    if (left < editor.wrap.scrollLeft + 10 || right > editor.wrap.scrollLeft + editor.wrap.clientWidth - 10) {
      editor.wrap.scrollLeft = (left + right) / 2 - editor.wrap.clientWidth / 2;
    }
  }

  function refreshCanvas() {
    editor.canvasIndices = [];
    if (!editor.errors.length) {
      editor.canvasSky = editor.parsed;
      editor.canvasIndices = editor.parsed?.buildings.map((_, index) => index) ?? [];
    } else {
      // Keep the working canvas useful while a building is incomplete, including
      // the empty Blank draft. Only the SVG keeps the last fully valid skyline.
      const valid = [];
      editor.buildings().forEach((building, index) => {
        try {
          valid.push(parseSkyline({ buildings: [building] }).buildings[0]);
          editor.canvasIndices.push(index);
        } catch {}
      });
      editor.canvasSky = { fill: editor.draft?.fill === true, buildings: valid };
    }
    editor.hits = new Grid(SCENE_W, GY0);
    editor.bounds = [];
    // Paint the same silhouettes into a picking buffer: near buildings win,
    // holes remain clickable, and every top uses the production geometry.
    for (const layer of ['far', 'near']) {
      editor.canvasSky?.buildings.forEach((building, i) => {
        if (building.layer !== layer) return;
        const index = editor.canvasIndices[i];
        const box = { left: SCENE_W, right: -1, top: GY0, bottom: -1 };
        const painter = {
          set(x, y) {
            if (!editor.hits.inside(x, y)) return;
            editor.hits.set(x, y, index + 1);
            box.left = Math.min(box.left, x); box.right = Math.max(box.right, x);
            box.top = Math.min(box.top, y); box.bottom = Math.max(box.bottom, y);
          },
          rect(x, y, w, h) {
            for (let row = Math.max(0, y); row < Math.min(GY0, y + h); row++) {
              for (let col = Math.max(0, x); col < Math.min(SCENE_W, x + w); col++) this.set(col, row);
            }
          },
        };
        paintSkyline(painter, { buildings: [building] }, GY0, layer);
        if (box.right >= box.left) editor.bounds[index] = box;
      });
    }
    drawCanvas();
  }

  function drawCanvas() {
    const ctx = editor.canvas.getContext('2d');
    const palette = THEMES[editor.view.theme];
    ctx.clearRect(0, 0, SCENE_W, GY0);
    const paint = (pixels) => {
      for (let y = 0; y < pixels.h; y++) {
        for (let x = 0; x < pixels.w; x++) {
          const color = pixels.get(x, y);
          if (!color) continue;
          ctx.fillStyle = color.startsWith('@') ? palette[color.slice(1)] : color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    };
    const sky = new Grid(SCENE_W, GY0);
    paintSky(sky);
    paint(sky);
    paint(celestialGrid(SCENE_W));
    paint(paintBackdrop(SCENE_W, GY0, [], editor.stats.user, editor.canvasSky));
    const style = getComputedStyle(editor.root);
    const guide = (x, y, w, h, color) => {
      ctx.save();
      ctx.fillStyle = ctx.strokeStyle = color;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 0.8;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.restore();
    };
    const guideColor = style.getPropertyValue('--muted').trim() || palette.text;
    if (editor.view.train) guide(0, 63, SCENE_W, 25, guideColor);
    if (editor.view.sign) guide(10, 10, 80, 14, guideColor);
    if (editor.view.sun) guide(382, 10, 20, 20, guideColor);
    const box = editor.bounds[editor.selected];
    if (box) {
      ctx.strokeStyle = style.getPropertyValue('--green').trim() || palette.text;
      ctx.lineWidth = 1;
      ctx.strokeRect(box.left + 0.5, box.top + 0.5, Math.max(1, box.right - box.left), Math.max(1, box.bottom - box.top));
    }
  }
  const point = (event) => {
    const rect = editor.canvas.getBoundingClientRect();
    return [Math.floor((event.clientX - rect.left) * SCENE_W / rect.width), Math.floor((event.clientY - rect.top) * GY0 / rect.height)];
  };
  // The building under the pointer, or failing that the nearest one within
  // about 10 screen pixels, so thin towers stay easy to grab on a small canvas.

  function pick(x, y) {
    const exact = editor.hits.get(x, y);
    if (exact && object(editor.buildings()[exact - 1])) return exact;
    const reach = Math.ceil(10 * SCENE_W / editor.canvas.getBoundingClientRect().width);
    let best = 0;
    let bestDistance = Infinity;
    editor.bounds.forEach((box, index) => {
      if (!box || !object(editor.buildings()[index])) return;
      const distance = Math.max(box.left - x, x - box.right, box.top - y, y - box.bottom, 0);
      if (distance <= reach && distance < bestDistance) { best = index + 1; bestDistance = distance; }
    });
    return best;
  }
  return { applyZoom, revealSelected, refreshCanvas, drawCanvas, point, pick };
}
