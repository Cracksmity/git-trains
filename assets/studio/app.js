// Page controller. Relative fetch URLs intentionally resolve against the page.
import { mountTrainEditor } from '../../src/studio/train/controller.js';
import { decodeShare } from '../../src/sharing/codec.js';

/** Dynamic page IDs address mixed form and image elements. @returns {any} */
const $ = (id) => document.getElementById(id);
let shared = null;
try {
  shared = await decodeShare(location.hash);
} catch (err) {
  $('share-error').hidden = false;
  $('share-error').textContent = err.message;
}

function show(kind) {
  for (const k of ['train', 'skyline']) {
    $(`tab-${k}`).setAttribute('aria-selected', String(k === kind));
    $(`panel-${k}`).hidden = k !== kind;
  }
}
$('tab-train').addEventListener('click', () => show('train'));
$('tab-skyline').addEventListener('click', () => show('skyline'));

mountTrainEditor($('panel-train'), { initialText: shared?.kind === 'train' ? shared.text : undefined });

try {
  const { mountSkylineEditor } = await import('../../src/studio/skyline/controller.js');
  $('panel-skyline').replaceChildren();
  mountSkylineEditor($('panel-skyline'), { initialText: shared?.kind === 'skyline' ? shared.text : undefined });
} catch {
  $('panel-skyline').querySelector('.placeholder').textContent = 'The skyline editor is coming soon. Meanwhile, the playground checks skyline JSON.';
}
if (shared?.kind === 'skyline') show('skyline');
