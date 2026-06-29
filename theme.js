/* LinPlan — nav state: floating pill at top, wavy hamburger past the hero */
(function () {
  function ready(fn) { document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;
    var hero = document.querySelector('.lnhero, .phero, .hero');
    function onScroll() {
      var threshold = hero ? (hero.offsetTop + hero.offsetHeight - 70) : 360;
      if (window.scrollY > threshold) nav.classList.add('past-hero');
      else nav.classList.remove('past-hero');
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  });
})();
