// transitions.js — shared page-to-page transition behavior.
// Edit this file only; it's loaded by every page, chapter HTML is never touched.
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Fade the incoming page in (undoes the .is-leaving state set before navigation).
  window.addEventListener('pageshow', function () {
    document.body.classList.remove('is-leaving');
  });

  if (reduceMotion) return;

  var LEAVE_DELAY_MS = 150;

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (!link) return;
    if (link.target === '_blank' || link.hasAttribute('download')) return;
    if (link.classList.contains('is-disabled')) return;

    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (err) {
      return;
    }

    // Only intercept same-origin, same-page navigations (i.e. not external links).
    if (url.origin !== window.location.origin) return;
    if (url.href === window.location.href) return;

    event.preventDefault();
    document.body.classList.add('is-leaving');
    window.setTimeout(function () {
      window.location.href = link.href;
    }, LEAVE_DELAY_MS);
  });
})();
