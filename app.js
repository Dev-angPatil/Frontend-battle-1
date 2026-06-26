/**
 * ARMORY AI — APP.JS
 *
 * Features:
 * 1. Matrix-Driven Pricing & Performance-Isolated Currency Switcher
 * 2. Bento-to-Accordion Wrapper with State Persistence (ResizeObserver)
 * 3. Sticky Nav scroll handler
 * 4. Mobile menu
 * 5. Product demo tab switching
 * 6. Scroll-reveal IntersectionObserver
 * 7. Scroll-to-top button
 * 8. FAQ accordion
 * 9. Performance budget guardrail (500ms check)
 */

'use strict';

// ─── PERFORMANCE BUDGET MARKER ──────────────────────────────────────────────
const _perfStart = performance.now();
window.addEventListener('DOMContentLoaded', () => {
  const elapsed = performance.now() - _perfStart;
  if (elapsed > 500) {
    console.warn(`[Armory] Entry orchestration exceeded 500ms budget: ${elapsed.toFixed(1)}ms`);
  }
});

// ─── 1. PRICING MATRIX ───────────────────────────────────────────────────────
/**
 * Multi-dimensional config matrix.
 * RULE: Zero hardcoded UI values. All prices are computed at runtime.
 * DOM updates: ONLY .textContent of [data-price] and [data-symbol] spans.
 */
const PRICING_MATRIX = {
  tiers: {
    starter:    { base: 19 },
    pro:        { base: 49 },
    enterprise: { base: 149 },
  },
  currencies: {
    USD: { symbol: '$', multiplier: 1.0 },
    EUR: { symbol: '€', multiplier: 0.92 },
    INR: { symbol: '₹', multiplier: 83.5 },
  },
  billing: {
    monthly: 1.0,
    annual:  0.8,   // 20% flat discount
  },
};

// State — isolated, never touches DOM structure
const pricingState = {
  currency: 'USD',
  billing:  'monthly',
};

/**
 * Computes price from matrix.
 * @param {string} tier - 'starter' | 'pro' | 'enterprise'
 * @returns {number}
 */
function computePrice(tier) {
  const { base }        = PRICING_MATRIX.tiers[tier];
  const { multiplier }  = PRICING_MATRIX.currencies[pricingState.currency];
  const billingMult     = PRICING_MATRIX.billing[pricingState.billing];
  return Math.round(base * multiplier * billingMult);
}

/**
 * Updates ONLY the price text nodes — no innerHTML, no parent reflows.
 * Chrome DevTools Paint Flashing will only highlight the span elements.
 */
function updatePrices() {
  const { symbol } = PRICING_MATRIX.currencies[pricingState.currency];

  // Update each price value (text node only)
  document.querySelectorAll('[data-price]').forEach(el => {
    const tier = el.getAttribute('data-price');
    el.textContent = computePrice(tier);
  });

  // Update each currency symbol (text node only)
  document.querySelectorAll('[data-symbol]').forEach(el => {
    el.textContent = symbol;
  });

  // Update savings note if annual
  const savingsNote = document.getElementById('savings-note');
  if (savingsNote) {
    if (pricingState.billing === 'annual') {
      const { symbol: sym } = PRICING_MATRIX.currencies[pricingState.currency];
      const proBase    = PRICING_MATRIX.tiers.pro.base;
      const currMult   = PRICING_MATRIX.currencies[pricingState.currency].multiplier;
      const monthlyCost = Math.round(proBase * currMult);
      const annualCost  = Math.round(proBase * currMult * 0.8);
      const saved       = Math.round((monthlyCost - annualCost) * 12);
      savingsNote.textContent = `Annual plan saves you ${sym}${saved} per year on the Pro tier.`;
    } else {
      savingsNote.textContent = '';
    }
  }
}

function initPricing() {
  // Billing toggle buttons
  document.querySelectorAll('.billing-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const billingCycle = btn.getAttribute('data-billing');
      if (pricingState.billing === billingCycle) return;

      pricingState.billing = billingCycle;

      // Update button active states (CSS only, no parent layout change)
      document.querySelectorAll('.billing-btn').forEach(b => {
        const isActive = b.getAttribute('data-billing') === billingCycle;
        b.classList.toggle('billing-btn--active', isActive);
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      updatePrices();
    });
  });

  // Currency select
  const currencySelect = document.getElementById('currency-select');
  if (currencySelect) {
    currencySelect.addEventListener('change', (e) => {
      pricingState.currency = e.target.value;
      updatePrices();
    });
  }

  // Initialize prices on load
  updatePrices();
}

// ─── 2. BENTO-TO-ACCORDION WITH CONTEXT LOCK ─────────────────────────────────
/**
 * ResizeObserver-based context sync.
 * - Desktop: tracks hover/focus index on bento cards via data-active-index
 * - On resize past breakpoint: transfers active index to accordion
 * - On resize back: transfers accordion open index to bento
 */
function initBentoAccordion() {
  const bentoGrid = document.getElementById('bento-grid');
  const accordion = document.getElementById('features-accordion');
  if (!bentoGrid || !accordion) return;

  const BREAKPOINT = 767; // matches CSS mobile breakpoint

  // Track active bento index on hover/focus
  bentoGrid.querySelectorAll('.bento-card').forEach(card => {
    const idx = parseInt(card.getAttribute('data-index'), 10);

    card.addEventListener('mouseenter', () => {
      bentoGrid.setAttribute('data-active-index', idx);
      // Visual active state
      bentoGrid.querySelectorAll('.bento-card').forEach(c =>
        c.setAttribute('data-active', c === card ? 'true' : 'false')
      );
    });

    card.addEventListener('mouseleave', () => {
      bentoGrid.querySelectorAll('.bento-card').forEach(c =>
        c.removeAttribute('data-active')
      );
    });

    card.addEventListener('focus', () => {
      bentoGrid.setAttribute('data-active-index', idx);
    });
  });

  // Helper: get currently open accordion index
  function getOpenAccordionIndex() {
    let openIdx = -1;
    accordion.querySelectorAll('.accordion-item').forEach(item => {
      if (item.open) {
        openIdx = parseInt(item.getAttribute('data-index'), 10);
      }
    });
    return openIdx;
  }

  // Helper: open accordion panel by index
  function openAccordionPanel(idx) {
    accordion.querySelectorAll('.accordion-item').forEach(item => {
      const itemIdx = parseInt(item.getAttribute('data-index'), 10);
      item.open = itemIdx === idx;
    });
    if (idx >= 0) {
      const targetItem = accordion.querySelector(`[data-index="${idx}"]`);
      if (targetItem) {
        // Smooth scroll into view after short delay (layout settle)
        setTimeout(() => {
          targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      }
    }
  }

  // Helper: highlight bento card by index
  function activateBentoCard(idx) {
    bentoGrid.querySelectorAll('.bento-card').forEach(card => {
      const isTarget = parseInt(card.getAttribute('data-index'), 10) === idx;
      card.setAttribute('data-active', isTarget ? 'true' : 'false');
    });
    if (idx >= 0) {
      bentoGrid.setAttribute('data-active-index', idx);
    }
  }

  let wasMobile = window.innerWidth <= BREAKPOINT;

  // ResizeObserver — fires when bento wrapper changes size
  const observer = new ResizeObserver(() => {
    const isMobile = window.innerWidth <= BREAKPOINT;

    if (isMobile && !wasMobile) {
      // ── Desktop → Mobile crossing ──
      // Transfer active bento index to accordion
      const activeIdx = parseInt(bentoGrid.getAttribute('data-active-index'), 10);
      if (activeIdx >= 0) {
        openAccordionPanel(activeIdx);
      }
      wasMobile = true;
    } else if (!isMobile && wasMobile) {
      // ── Mobile → Desktop crossing ──
      // Transfer open accordion index to bento
      const openIdx = getOpenAccordionIndex();
      if (openIdx >= 0) {
        activateBentoCard(openIdx);
      }
      wasMobile = false;
    }
  });

  observer.observe(bentoGrid);
}

// ─── 3. STICKY NAV ───────────────────────────────────────────────────────────
function initStickyNav() {
  const header = document.getElementById('site-header');
  if (!header) return;

  let ticking = false;

  function updateNav() {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateNav);
      ticking = true;
    }
  }, { passive: true });
}

// ─── 4. MOBILE MENU ──────────────────────────────────────────────────────────
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger-btn');
  const closeBtn  = document.getElementById('mobile-close-btn');
  const menu      = document.getElementById('mobile-menu');
  if (!hamburger || !menu || !closeBtn) return;

  function openMenu() {
    menu.hidden = false;
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    menu.hidden = true;
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);

  // Close on nav link click
  menu.querySelectorAll('.mobile-nav-link, .mobile-cta').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) closeMenu();
  });
}

// ─── 5. PRODUCT DEMO TABS ────────────────────────────────────────────────────
function initProductTabs() {
  const tabAgent = document.getElementById('tab-agent');
  const tabChat  = document.getElementById('tab-chat');
  const panelAgent = document.getElementById('panel-agent');
  const panelChat  = document.getElementById('panel-chat');
  if (!tabAgent || !tabChat || !panelAgent || !panelChat) return;

  function switchTab(activeTab, activePanel, inactiveTab, inactivePanel) {
    // Tabs
    activeTab.classList.add('demo-tab--active');
    activeTab.setAttribute('aria-selected', 'true');
    inactiveTab.classList.remove('demo-tab--active');
    inactiveTab.setAttribute('aria-selected', 'false');

    // Panels — CSS class only, no DOM add/remove
    activePanel.classList.remove('demo-panel--hidden');
    activePanel.hidden = false;
    inactivePanel.classList.add('demo-panel--hidden');
    inactivePanel.hidden = true;
  }

  tabAgent.addEventListener('click', () => switchTab(tabAgent, panelAgent, tabChat, panelChat));
  tabChat.addEventListener('click',  () => switchTab(tabChat, panelChat, tabAgent, panelAgent));

  // Keyboard: left/right arrow navigation
  [tabAgent, tabChat].forEach(tab => {
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') tabChat.click(), tabChat.focus();
      if (e.key === 'ArrowLeft')  tabAgent.click(), tabAgent.focus();
    });
  });
}

// ─── 6. SCROLL-REVEAL (IntersectionObserver) ─────────────────────────────────
function initScrollReveal() {
  const revealEls = document.querySelectorAll(
    '.bento-card, .pricing-card, .case-study-row, .blog-card, .faq-item, ' +
    '.section-header, .product-demo, .cta-content'
  );

  revealEls.forEach(el => el.classList.add('reveal'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(el => observer.observe(el));
}

// ─── 7. SCROLL-TO-TOP ────────────────────────────────────────────────────────
function initScrollToTop() {
  const btn = document.getElementById('scroll-top-btn');
  if (!btn) return;

  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        btn.hidden = window.scrollY < 500;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ─── 8. SMOOTH ANCHOR SCROLL (for nav links) ─────────────────────────────────
function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = 80; // nav height
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

// ─── 9. CTA FORM ─────────────────────────────────────────────────────────────
function initCtaForm() {
  const form = document.querySelector('.cta-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('cta-email');
    const hint = document.getElementById('cta-email-hint');
    if (!emailInput || !emailInput.value.includes('@')) {
      emailInput.style.borderBottom = '2px solid var(--deep-saffron)';
      return;
    }
    emailInput.style.borderBottom = '';
    const btn = form.querySelector('.cta-submit');
    const original = btn.textContent;
    btn.textContent = 'Subscribed ✓';
    btn.style.background = 'var(--nocturnal-exp)';
    btn.style.color = 'var(--forsythia)';
    emailInput.value = '';
    if (hint) hint.textContent = 'You\'re in. Welcome to the loop.';
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = '';
      btn.style.color = '';
      if (hint) hint.textContent = 'No spam, ever. Unsubscribe in one click.';
    }, 4000);
  });
}


// ─── 10. STATS DASHBOARD ──────────────────────────────────────────────────────

/**
 * Generates an SVG gradient defs block and injects into <body> once.
 * Used by the line chart fill.
 */
function injectSvgDefs() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `
    <defs>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>`;
  document.body.prepend(svg);
}

/**
 * Builds the bar chart with random-ish heights.
 */
function buildBarChart() {
  const container = document.getElementById('bar-chart');
  if (!container) return;
  const heights = [55, 80, 45, 95, 60, 110, 70, 85, 40, 100, 65, 75];
  const slaLine = 70; // % of max — bars above this are "above SLA"
  const maxH = Math.max(...heights);
  container.innerHTML = '';
  heights.forEach(h => {
    const pct = (h / maxH) * 100;
    const bar = document.createElement('div');
    bar.className = 'bar' + (pct >= slaLine ? ' bar--above' : '');
    bar.style.height = `${pct}%`;
    const dot = document.createElement('div');
    dot.className = 'bar-dot';
    bar.appendChild(dot);
    container.appendChild(bar);
  });
}

/**
 * Animates the circular gauge fill and number.
 * @param {number} pct - 0 to 100
 */
function setCircularGauge(pct) {
  const fill = document.getElementById('sys-gauge-fill');
  const num  = document.getElementById('sys-gauge-num');
  if (!fill || !num) return;
  const circumference = 2 * Math.PI * 50; // r=50
  const offset = circumference - (pct / 100) * circumference;
  fill.style.strokeDashoffset = offset;
  num.textContent = Math.round(pct / 6.5); // core count correlates with %
}

/**
 * Animates the arc gauge fill and centre number.
 * @param {number} pct - 0 to 100
 */
function setArcGauge(pct) {
  const fill = document.getElementById('arc-fill');
  const num  = document.getElementById('arc-num');
  if (!fill || !num) return;
  const total = 251; // measured arc length for the SVG path
  const offset = total - (pct / 100) * total;
  fill.style.strokeDashoffset = offset;
  num.textContent = Math.round(280 + pct * 1.5);
}

/**
 * Draws a smooth SVG line chart path given y-values.
 * @param {number[]} data - normalised 0–100
 */
function drawLineChart(data) {
  const path = document.getElementById('line-path');
  const fill = document.getElementById('line-fill');
  if (!path || !fill) return;

  const W = 800, H = 120;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - (v / 100) * (H - 16) - 8,
  ]);

  // Smooth catmull-rom-like cubic bezier
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx1 = pts[i][0] + (pts[i + 1][0] - pts[i][0]) / 3;
    const cy1 = pts[i][1];
    const cx2 = pts[i][0] + 2 * (pts[i + 1][0] - pts[i][0]) / 3;
    const cy2 = pts[i + 1][1];
    d += ` C ${cx1},${cy1} ${cx2},${cy2} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }

  path.setAttribute('d', d);
  fill.setAttribute('d', d + ` L ${W},${H} L 0,${H} Z`);
}

/**
 * Generates random fluctuating values around a base.
 */
function fluctuate(base, range) {
  return Math.max(0, Math.min(100, base + (Math.random() - 0.5) * range));
}

/**
 * Main dashboard initialiser — builds charts then starts live update loop.
 */
function initStatsDashboard() {
  injectSvgDefs();
  buildBarChart();

  // Initial render
  setCircularGauge(85);
  setArcGauge(78);

  // Growth line: simulate 30-day upward trend with noise
  const baseData = Array.from({ length: 20 }, (_, i) =>
    20 + i * 3 + (Math.random() - 0.5) * 15
  );
  drawLineChart(baseData);

  // Live update every 2 seconds (non-blocking, requestAnimationFrame-based)
  let tick = 0;
  setInterval(() => {
    tick++;

    // Circular gauge — fluctuates around 85%
    const sysLoad = fluctuate(85, 20);
    setCircularGauge(sysLoad);
    const cachePct = Math.round(fluctuate(97, 4));
    const sysCache = document.getElementById('sys-cache');
    if (sysCache) sysCache.textContent = `${cachePct}%`;
    const sysLoadEl = document.getElementById('sys-load-pct');
    if (sysLoadEl) sysLoadEl.textContent = `${sysLoad.toFixed(1)}%`;

    // Arc gauge — fluctuates around 75%
    const tokenLoad = fluctuate(75, 25);
    setArcGauge(tokenLoad);
    const queries = Math.round(140 + Math.random() * 30);
    const nodes   = Math.round(100 + Math.random() * 30);
    const qEl = document.getElementById('arc-queries');
    const nEl = document.getElementById('arc-nodes');
    if (qEl) qEl.textContent = queries;
    if (nEl) nEl.textContent = nodes;

    // Rebuild bar chart every 6 ticks (12 seconds)
    if (tick % 6 === 0) buildBarChart();

    // Scroll line data left and append new value
    baseData.shift();
    baseData.push(fluctuate(baseData[baseData.length - 1] || 50, 12));
    drawLineChart(baseData);
  }, 2000);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initPricing();
  initBentoAccordion();
  initStickyNav();
  initMobileMenu();
  initProductTabs();
  initScrollReveal();
  initScrollToTop();
  initSmoothAnchors();
  initCtaForm();
  initStatsDashboard();
});
