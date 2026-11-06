// Typed DOM boundaries for the static pages' delegated events and selectors.
/** @param {Event} event @param {string} selector @returns {HTMLElement | null} */
export function closest(event, selector) {
  return event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest(selector)) : null;
}

/** @param {string} selector @returns {NodeListOf<HTMLElement>} */
export function elements(selector) {
  return document.querySelectorAll(selector);
}
