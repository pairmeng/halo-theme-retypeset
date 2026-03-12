/**
 * Mobile Sidebar TOC Component
 * Ribbon trigger on screen right edge + full-screen overlay "table of contents page"
 */

// ── State ──────────────────────────────────────────────────────────

let ribbonObserver: IntersectionObserver | null = null;
let headingObserver: IntersectionObserver | null = null;
let currentActiveId = '';
let isOverlayOpen = false;
let popstateHandlerBound = false;

// ── DOM helpers ────────────────────────────────────────────────────

function getRibbon(): HTMLElement | null {
  return document.getElementById('toc-ribbon');
}

function getOverlay(): HTMLElement | null {
  return document.getElementById('toc-overlay');
}

function getOverlayLinks(): HTMLElement | null {
  return document.getElementById('toc-overlay-links');
}

function getInlineToc(): HTMLElement | null {
  return document.getElementById('toc-container');
}

// ── Ribbon visibility (IntersectionObserver on inline TOC) ─────────

function setupRibbonVisibility(): void {
  const ribbon = getRibbon();
  const inlineToc = getInlineToc();
  if (!ribbon) return;

  // Cleanup previous observer
  if (ribbonObserver) {
    ribbonObserver.disconnect();
    ribbonObserver = null;
  }

  // If inline TOC is hidden (display:none in sidebar mode) or absent, observe post-date instead
  const isTocVisible = inlineToc !== null && inlineToc.offsetParent !== null;
  const observeTarget = isTocVisible ? inlineToc : document.getElementById('post-date');
  if (!observeTarget) return;

  ribbonObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          ribbon.classList.remove('visible');
        } else {
          // Only show when target is above viewport (scrolled past)
          if (entry.boundingClientRect.bottom < 0) {
            ribbon.classList.add('visible');
          } else {
            ribbon.classList.remove('visible');
          }
        }
      }
    },
    { threshold: 0 }
  );

  ribbonObserver.observe(observeTarget);
}

// ── Heading tracking (current chapter highlight) ───────────────────

function setupHeadingTracking(): void {
  if (headingObserver) {
    headingObserver.disconnect();
    headingObserver = null;
  }

  const content = document.getElementById('post-content');
  if (!content) return;

  const headings = content.querySelectorAll<HTMLElement>('h2, h3, h4');
  if (headings.length === 0) return;

  headingObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          currentActiveId = entry.target.id;
        }
      }
    },
    { rootMargin: '0px 0px -70% 0px', threshold: 0 }
  );

  headings.forEach(h => headingObserver?.observe(h));
}

// ── Overlay open / close ───────────────────────────────────────────

function highlightCurrentEntry(): void {
  const linksList = getOverlayLinks();
  if (!linksList) return;

  linksList.querySelectorAll('li.toc-active').forEach(li => {
    li.classList.remove('toc-active');
  });

  if (currentActiveId) {
    const activeLink = linksList.querySelector<HTMLAnchorElement>(
      `a[href="#${CSS.escape(currentActiveId)}"]`
    );
    if (activeLink?.parentElement) {
      activeLink.parentElement.classList.add('toc-active');
      // Scroll the active entry into view within the overlay
      activeLink.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }
}

function openOverlay(): void {
  const overlay = getOverlay();
  const ribbon = getRibbon();
  if (!overlay || isOverlayOpen) return;

  isOverlayOpen = true;

  // Highlight current chapter
  highlightCurrentEntry();

  // Show overlay with animation
  overlay.removeAttribute('hidden');
  // Force reflow before adding .open class
  void overlay.offsetHeight;
  overlay.classList.add('open');

  // Hide ribbon
  if (ribbon) ribbon.classList.remove('visible');

  // Prevent background scroll
  document.body.style.overflow = 'hidden';

  // Push history state for back-button close
  history.pushState({ tocOverlay: true }, '');
}

function closeOverlay(skipHistoryBack = false): void {
  const overlay = getOverlay();
  if (!overlay || !isOverlayOpen) return;

  isOverlayOpen = false;

  // Trigger closing animation
  overlay.classList.remove('open');
  overlay.classList.add('closing');

  // After animation completes, hide overlay
  const onTransitionEnd = (): void => {
    overlay.classList.remove('closing');
    overlay.setAttribute('hidden', '');
    overlay.removeEventListener('transitionend', onTransitionEnd);
  };
  overlay.addEventListener('transitionend', onTransitionEnd, { once: true });

  // Fallback timeout in case transitionend doesn't fire
  setTimeout(() => {
    if (overlay.classList.contains('closing')) {
      overlay.classList.remove('closing');
      overlay.setAttribute('hidden', '');
    }
  }, 400);

  // Restore background scroll
  document.body.style.overflow = '';

  // Pop the history state we pushed
  if (!skipHistoryBack && history.state?.tocOverlay) {
    history.back();
  }
}

// ── Event handlers (delegated on document, survive body swap) ──────

function handleRibbonClick(e: MouseEvent): void {
  if (!(e.target instanceof Element)) return;
  if (!e.target.closest('#toc-ribbon')) return;
  openOverlay();
}

function handleRibbonKeydown(e: KeyboardEvent): void {
  if (!(e.target instanceof Element)) return;
  if (!e.target.closest('#toc-ribbon')) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openOverlay();
  }
}

function handleOverlayClick(e: MouseEvent): void {
  if (!(e.target instanceof Element)) return;
  const overlay = getOverlay();
  if (!overlay || !isOverlayOpen) return;

  // Ignore clicks outside the overlay (e.g. ribbon click that just opened it)
  if (!e.target.closest('#toc-overlay')) return;

  // Click on a TOC link → navigate + close
  const link = e.target.closest<HTMLAnchorElement>('#toc-overlay-links a');
  if (link) {
    e.preventDefault();
    const targetId = link.getAttribute('href')?.slice(1);
    closeOverlay();
    if (targetId) {
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        // Small delay to let overlay close animation start
        setTimeout(() => {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
    return;
  }

  // Click on backdrop → close
  if (e.target.closest('.toc-overlay-backdrop')) {
    closeOverlay();
    return;
  }

  // Click on empty area within overlay content (not on a link) → close
  if (!e.target.closest('#toc-overlay-links')) {
    closeOverlay();
  }
}

function handlePopstate(): void {
  if (isOverlayOpen) {
    closeOverlay(true);
  }
}

// ── Public API ─────────────────────────────────────────────────────

export function initMobileToc(): void {
  // Event delegation on document level — survives body swap
  document.addEventListener('click', handleRibbonClick);
  document.addEventListener('keydown', handleRibbonKeydown);
  document.addEventListener('click', handleOverlayClick);

  if (!popstateHandlerBound) {
    window.addEventListener('popstate', handlePopstate);
    popstateHandlerBound = true;
  }
}

export function reinitMobileToc(): void {
  // Reset state
  isOverlayOpen = false;
  currentActiveId = '';
  document.body.style.overflow = '';

  // Setup observers for the new page content
  setupRibbonVisibility();
  setupHeadingTracking();
}
