/* ============================================================
   LinPlan 共通スクリプト
   - ナビのスクロール追従 / body.at-top トグル
   - モバイルメニュー開閉
   - .reveal の IntersectionObserver
   - フッターパネルの展開制御
   ============================================================ */

(() => {
  // ========== PAGE LOADER ==========
  const lpLoader = document.getElementById('lpLoader');
  if (lpLoader && lpLoader.style.display !== 'none') {
    const isQuick = lpLoader.hasAttribute('data-quick');
    const MIN_DISPLAY = isQuick ? 0 : 1200;
    const MAX_DISPLAY = isQuick ? 1500 : 3000;
    const loaderStart = performance.now();
    let hidden = false;

    const hideLoader = () => {
      if (hidden) return;
      hidden = true;
      sessionStorage.setItem('lp-visited', '1');
      if (isQuick) {
        // 再訪問: CSS 読み込み後に即座に非表示（FOUC 防止）
        lpLoader.style.display = 'none';
        document.body.classList.remove('loading');
        return;
      }
      const elapsed = performance.now() - loaderStart;
      const remaining = Math.max(0, MIN_DISPLAY - elapsed);
      setTimeout(() => {
        lpLoader.classList.add('is-hidden');
        setTimeout(() => {
          lpLoader.style.display = 'none';
          document.body.classList.remove('loading');
        }, 500);
      }, remaining);
    };

    if (document.readyState === 'complete') {
      hideLoader();
    } else {
      window.addEventListener('load', hideLoader);
    }
    setTimeout(hideLoader, MAX_DISPLAY);

    if (!isQuick) {
      const escHandler = (e) => {
        if (e.key === 'Escape') { hideLoader(); document.removeEventListener('keydown', escHandler); }
      };
      document.addEventListener('keydown', escHandler);
    }
  }

  // ========== NAV / AT-TOP ==========
  const nav = document.getElementById('nav');
  if (nav) {
    let rafPending = false;
    const updateScrollState = () => {
      nav.classList.toggle('scrolled', window.scrollY > 50);
      document.body.classList.toggle('at-top', window.scrollY <= 0);
      rafPending = false;
    };
    updateScrollState();
    window.addEventListener('scroll', () => {
      if (!rafPending) { rafPending = true; requestAnimationFrame(updateScrollState); }
    }, { passive: true });
  }

  // ========== NAV LOGO CLICK TRANSITION ==========
  const navLogoEl = document.querySelector('.nav-logo');
  if (navLogoEl) {
    navLogoEl.addEventListener('click', (e) => {
      const innerSvg = navLogoEl.querySelector('svg');
      if (!innerSvg) return;
      e.preventDefault();

      const href = navLogoEl.getAttribute('href') || '';
      const heroLogoEl = document.querySelector('.hero-logo');

      if (heroLogoEl) {
        // 同一ページ（index）
        const navEl = document.getElementById('nav');
        if (window.scrollY > 50) {
          // スクロール状態: 背景で画面全体を覆ってからトップへジャンプ → フェードアウト
          // nav テキスト/ロゴは .lp-loader-active で背景上に残す
          const bg = document.createElement('div');
          bg.className = 'lp-nav-loader-bg';
          document.body.appendChild(bg);
          if (navEl) navEl.classList.add('lp-loader-active');
          requestAnimationFrame(() => bg.classList.add('active'));
          setTimeout(() => {
            // 背景が全画面を覆ってからトップへ即時ジャンプ
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            setTimeout(() => {
              bg.style.opacity = '0';
              setTimeout(() => {
                bg.remove();
                if (navEl) navEl.classList.remove('lp-loader-active');
              }, 450);
            }, 150);
          }, 400);
          return;
        }

        // ページ最上部にいる場合: 既存の拡大アニメーション
        const navSvgRect = innerSvg.getBoundingClientRect();

        const bg = document.createElement('div');
        bg.className = 'lp-nav-loader-bg';
        document.body.appendChild(bg);

        const clone = document.createElement('div');
        clone.className = 'lp-nav-logo-fly';
        clone.innerHTML = innerSvg.outerHTML;
        clone.style.left = navSvgRect.left + 'px';
        clone.style.top = navSvgRect.top + 'px';
        clone.style.width = navSvgRect.width + 'px';
        clone.style.height = navSvgRect.height + 'px';
        document.body.appendChild(clone);

        navLogoEl.style.opacity = '0';
        if (navEl) navEl.classList.add('lp-loader-active');
        requestAnimationFrame(() => bg.classList.add('active'));

        requestAnimationFrame(() => {
          const heroSvg = heroLogoEl.querySelector('svg') || heroLogoEl;
          const sr = heroSvg.getBoundingClientRect();
          clone.style.left = sr.left + 'px';
          clone.style.top = sr.top + 'px';
          clone.style.width = sr.width + 'px';
          clone.style.height = sr.height + 'px';
        });
        setTimeout(() => {
          clone.style.opacity = '0';
          bg.style.opacity = '0';
          setTimeout(() => {
            clone.remove();
            bg.remove();
            navLogoEl.style.opacity = '';
            if (navEl) navEl.classList.remove('lp-loader-active');
          }, 450);
        }, 950);
      } else {
        // 別ページから index.html へ — 通常リンク遷移（ローダー廃止に伴い、到着後の拡大アニメは行わない）
        window.location.href = href || 'index.html';
      }
    });
  }

  // ========== MOBILE MENU ==========
  window.toggleMenu = function () {
    const menu = document.getElementById('mobileMenu');
    const hamburger = document.getElementById('hamburger');
    if (!menu) return;
    const isOpen = menu.classList.toggle('open');
    if (hamburger) hamburger.setAttribute('aria-expanded', isOpen);
  };
  // ESC キーでモバイルメニューを閉じる
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const menu = document.getElementById('mobileMenu');
    if (menu && menu.classList.contains('open')) {
      window.toggleMenu();
    }
  });

  // ========== REVEAL ==========
  const revealTargets = document.querySelectorAll('.reveal');
  if (revealTargets.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -100px 0px' });
    revealTargets.forEach(el => observer.observe(el));
  }


  // ========== FOOTER EXPANDING PANEL ==========
  const wrapper = document.getElementById('footerWrapper');
  const toggle = document.getElementById('footerToggle');
  const backdrop = document.getElementById('footerBackdrop');
  if (wrapper && toggle && backdrop) {
    let isManualOpen = false;
    let lastScrollY = window.scrollY;

    const openFooter = (manual) => {
      wrapper.classList.remove('auto_open');
      if (manual) {
        wrapper.classList.add('open');
        backdrop.classList.add('active');
        isManualOpen = true;
      } else {
        wrapper.classList.add('auto_open');
      }
    };

    const closeFooter = () => {
      wrapper.classList.remove('open', 'auto_open');
      backdrop.classList.remove('active');
      isManualOpen = false;
    };

    toggle.addEventListener('click', () => {
      if (wrapper.classList.contains('open') || wrapper.classList.contains('auto_open')) {
        closeFooter();
      } else {
        openFooter(true);
      }
    });

    backdrop.addEventListener('click', closeFooter);

    // フッター自動展開は削除（営業ツールとして手動操作のみに）
  }
})();
