/**
 * Tisso Banner controller
 * ----------------------------------------------------------------------------
 * The Figma mobile frame shows a hamburger icon in the top bar. This landing
 * page's banner doesn't define its own navigation menu (that's the theme's
 * global header/drawer), so rather than guessing at unrelated menu markup,
 * this dispatches a custom event other theme code can listen for and wire
 * up to the real nav drawer, e.g.:
 *   document.addEventListener('tisso:menu-toggle', () => headerDrawer.open());
 */
(function () {
  'use strict';

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-tisso-mobile-menu-toggle]');
    if (!toggle) return;
    document.dispatchEvent(new CustomEvent('tisso:menu-toggle'));
  });
})();
