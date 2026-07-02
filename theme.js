/* Linplan — nav state: floating pill at top, wavy hamburger past the hero */
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

    /* current page indicator（PC ピルナビのみ。CTA ボタンは対象外） */
    var here = location.pathname.replace(/\/$/, '/index.html');
    nav.querySelectorAll('.site-nav__links a:not(.site-nav__cta)').forEach(function (a) {
      var p = a.pathname;
      var dir = p.slice(0, p.lastIndexOf('/') + 1);
      /* 完全一致、または「blog/index.html へのリンク × blog/ 配下の記事ページ」のような
         ディレクトリ index への包含一致（ルート index は nav に無いので dir==='/' は除外） */
      if (p === here || (p.slice(-11) === '/index.html' && dir !== '/' && here.indexOf(dir) === 0)) {
        a.classList.add('is-current');
        a.setAttribute('aria-current', 'page');
      }
    });
  });
})();
