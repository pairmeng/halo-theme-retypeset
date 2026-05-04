/**
 * Client Router - Lightweight SPA-like page transition engine
 *
 * Features:
 * - Intercepts internal links, fetches pages, swaps DOM (SPA-like)
 * - View Transitions API for crossfade + element morphing (Chromium 111+)
 * - Post title/date morph between list ↔ detail pages
 * - Head merging: adds new plugin scripts/stylesheets without duplicates
 * - Body script re-activation: ensures injected scripts execute after swap
 * - Prefetch on hover for near-instant transitions
 */

const MAX_CACHE_SIZE = 20;

interface CachedPage {
  html: string;
  scrollY: number;
}

interface NavigateOptions {
  push: boolean;
  sourceElement?: Element | null;
}

interface MorphContext {
  postName: string | null;
}

let cache: Map<string, CachedPage> = new Map();
let currentAbort: AbortController | null = null;
let isNavigating = false;

// Track current page (pathname + search, no hash) to detect same-page hash changes
let currentPagePath = location.pathname + location.search;

function stripHash(url: string): string {
  const u = new URL(url, location.origin);
  u.hash = '';
  return u.href;
}

// ── Link Interception ──────────────────────────────────────────────

function shouldIntercept(link: HTMLAnchorElement, event: MouseEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (event.button !== 0) return false;
  if (link.target && link.target !== '_self') return false;
  if (link.origin !== location.origin) return false;
  if (link.pathname === location.pathname && link.hash) return false;
  if (link.protocol !== 'http:' && link.protocol !== 'https:') return false;
  if (link.hasAttribute('data-no-transition')) return false;
  if (link.pathname === location.pathname && !link.hash) return false;
  return true;
}

// ── Page Fetching ──────────────────────────────────────────────────

async function fetchPage(url: string, signal?: AbortSignal): Promise<string> {
  const key = stripHash(url);
  const cached = cache.get(key);
  if (cached) return cached.html;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

  const html = await response.text();

  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { html, scrollY: 0 });

  return html;
}

// ── Element Morphing ───────────────────────────────────────────────

function prepareMorph(sourceElement: Element | null, newDoc: Document): MorphContext {
  // Case 1: Clicking from a post list item → post detail
  // Target the <a> inside h3 (inline text, not the block h3) for clean morph
  const postItem = sourceElement?.closest('li[data-post-name]');
  if (postItem) {
    const postName = postItem.getAttribute('data-post-name');
    if (postName && newDoc.querySelector(`article[data-post-name="${postName}"]`)) {
      const link = postItem.querySelector('h3 a');
      if (link) (link as HTMLElement).style.viewTransitionName = 'post-title';
      return { postName };
    }
  }

  // Case 2: Leaving a post detail → page with matching list item (back nav)
  // Target the <span> inside .post-title (inline text, not the block h1)
  const article = document.querySelector('article[data-post-name]');
  if (article) {
    const postName = article.getAttribute('data-post-name');
    if (postName && newDoc.querySelector(`li[data-post-name="${postName}"]`)) {
      const span = article.querySelector('.post-title span');
      if (span) (span as HTMLElement).style.viewTransitionName = 'post-title';
      return { postName };
    }
  }

  return { postName: null };
}

// Set VTN on morph targets and override CSS animations that would
// cause opacity:0 at VT capture time (e.g. fadeInUp on #post-date).
function setMorphVTN(el: HTMLElement, name: string): void {
  el.style.viewTransitionName = name;
  el.style.opacity = '1';
  el.style.animation = 'none';
}

function applyMorphToNewPage(ctx: MorphContext): void {
  if (!ctx.postName) return;

  // New page is a post detail → target <span> inside .post-title
  const article = document.querySelector(`article[data-post-name="${ctx.postName}"]`);
  if (article) {
    const span = article.querySelector('.post-title span');
    if (span) setMorphVTN(span as HTMLElement, 'post-title');
    return;
  }

  // New page is a list → target <a> inside h3
  const postItem = document.querySelector(`li[data-post-name="${ctx.postName}"]`);
  if (postItem) {
    const link = postItem.querySelector('h3 a');
    if (link) setMorphVTN(link as HTMLElement, 'post-title');
  }
}

// Remove residual inline VTN styles after transition to prevent
// multiple elements sharing the same view-transition-name on next nav.
function cleanupMorphVTN(): void {
  document.querySelectorAll<HTMLElement>('[style*="view-transition-name"]').forEach(el => {
    el.style.viewTransitionName = '';
    el.style.opacity = '';
    el.style.animation = '';
  });
}

// ── Head Merging ───────────────────────────────────────────────────

function mergeHead(newDoc: Document): void {
  // Update title
  document.title = newDoc.title;

  // Update meta theme-color
  const newMeta = newDoc.head.querySelector('meta[name="theme-color"]');
  const oldMeta = document.head.querySelector('meta[name="theme-color"]');
  if (newMeta && oldMeta) {
    oldMeta.setAttribute('content', newMeta.getAttribute('content') || '');
  }

  // Add new external scripts not already present
  const existingScripts = new Set<string>();
  document.head.querySelectorAll('script[src]').forEach(s => {
    const src = s.getAttribute('src');
    if (src) existingScripts.add(src);
  });

  newDoc.head.querySelectorAll('script[src]').forEach(newScript => {
    const src = newScript.getAttribute('src');
    if (src && !existingScripts.has(src)) {
      const script = document.createElement('script');
      Array.from(newScript.attributes).forEach(attr => {
        script.setAttribute(attr.name, attr.value);
      });
      document.head.appendChild(script);
    }
  });

  // Add new stylesheets not already present
  const existingLinks = new Set<string>();
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
    const href = l.getAttribute('href');
    if (href) existingLinks.add(href);
  });

  newDoc.head.querySelectorAll('link[rel="stylesheet"]').forEach(newLink => {
    const href = newLink.getAttribute('href');
    if (href && !existingLinks.has(href)) {
      document.head.appendChild(document.adoptNode(newLink));
    }
  });
}

// ── Script Activation ──────────────────────────────────────────────

// Track external scripts that have already been loaded and executed.
// Re-cloning these would trigger global singleton guards (e.g. Vditor's
// `if (!window.vditorPjax)`) and waste bandwidth.
const loadedScripts = new Set<string>();

function seedLoadedScripts(): void {
  document.body.querySelectorAll('script[src]').forEach(s => {
    const src = s.getAttribute('src');
    if (src) loadedScripts.add(src);
  });
  document.head.querySelectorAll('script[src]').forEach(s => {
    const src = s.getAttribute('src');
    if (src) loadedScripts.add(src);
  });
}

function isExecutableScript(script: Element): boolean {
  const type = script.getAttribute('type');
  return !type || type === 'text/javascript' || type === 'module' || type === '';
}

function activateBodyScripts(): void {
  document.body.querySelectorAll('script').forEach(oldScript => {
    if (!isExecutableScript(oldScript)) return;

    const src = oldScript.getAttribute('src');

    // External script already loaded → skip (library is in memory,
    // re-cloning would re-download and hit singleton guards)
    if (src && loadedScripts.has(src)) return;

    // Clone to force execution (new external scripts + inline scripts)
    const newScript = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => {
      newScript.setAttribute(attr.name, attr.value);
    });
    newScript.textContent = oldScript.textContent;
    oldScript.parentNode?.replaceChild(newScript, oldScript);

    // Track newly loaded external scripts
    if (src) loadedScripts.add(src);
  });
}

// ── DOM Swap ───────────────────────────────────────────────────────

function syncHtmlElement(newDoc: Document): void {
  const oldHtml = document.documentElement;
  const newHtml = newDoc.documentElement;

  // Preserve JS-managed classes
  const isDark = oldHtml.classList.contains('dark');
  const isReduceMotion = oldHtml.classList.contains('reduce-motion');

  oldHtml.className = newHtml.className;
  oldHtml.classList.toggle('dark', isDark);
  oldHtml.classList.toggle('reduce-motion', isReduceMotion);

  // Sync layout sidebar gap from the new page (set via th:style on <html>),
  // otherwise it stays stale after SPA navigation when the admin changes
  // desktop_offset in theme settings.
  const newGap = newHtml.style.getPropertyValue('--layout-sidebar-gap');
  if (newGap) {
    oldHtml.style.setProperty('--layout-sidebar-gap', newGap);
  }

  if (newHtml.lang) oldHtml.lang = newHtml.lang;
}

function swapContent(newDoc: Document): void {
  syncHtmlElement(newDoc);
  mergeHead(newDoc);

  // Preserve plugin-injected custom elements (e.g. <search-modal>)
  // before body swap — they are direct body children with hyphenated
  // tag names (Web Components created at runtime by Halo plugins).
  const preserved: Element[] = [];
  for (const el of Array.from(document.body.children)) {
    if (el.tagName.includes('-')) {
      preserved.push(el);
      el.remove();
    }
  }

  document.body.replaceWith(document.adoptNode(newDoc.body));

  // Re-append preserved plugin elements to the new body
  for (const el of preserved) {
    document.body.appendChild(el);
  }

  activateBodyScripts();
}

// ── Navigation ─────────────────────────────────────────────────────

// Compute scroll target for the new page.
function getScrollTarget(url: string, isPush: boolean): { x: number; y: number } {
  const hash = new URL(url, location.origin).hash;
  if (hash) {
    const target = document.querySelector(hash);
    if (target) {
      const rect = target.getBoundingClientRect();
      return { x: 0, y: window.scrollY + rect.top };
    }
  }
  if (isPush) return { x: 0, y: 0 };
  const cachedPage = cache.get(stripHash(url));
  return { x: 0, y: cachedPage?.scrollY ?? 0 };
}

async function navigate(url: string, options: NavigateOptions): Promise<void> {
  if (isNavigating) {
    currentAbort?.abort();
  }

  isNavigating = true;
  currentAbort = new AbortController();

  try {
    const html = await fetchPage(url, currentAbort.signal);
    const newDoc = new DOMParser().parseFromString(html, 'text/html');

    // Same-page hash navigation: skip fetch/swap, just scroll
    const targetPath = new URL(url, location.origin);
    const targetPagePath = targetPath.pathname + targetPath.search;
    if (targetPagePath === currentPagePath && targetPath.hash) {
      if (options.push) history.pushState({ scrollY: 0 }, '', url);
      const el = document.querySelector(targetPath.hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Save scroll position for the page we're leaving.
    // Only on forward nav: popstate has already changed location.href
    // to the destination, so saving would overwrite the wrong entry.
    if (options.push) {
      const currentCached = cache.get(stripHash(location.href));
      if (currentCached) {
        currentCached.scrollY = window.scrollY;
      }
      history.pushState({ scrollY: 0 }, '', url);
    }

    // Update current page path tracker
    currentPagePath = targetPagePath;

    // Prepare element morphing (set VTN on OLD page elements)
    const morphCtx = prepareMorph(options.sourceElement ?? null, newDoc);

    // Perform swap with or without View Transitions
    const hasVT = 'startViewTransition' in document;
    const isReduceMotion = document.documentElement.classList.contains('reduce-motion');

    if (hasVT && !isReduceMotion) {
      const transition = (document as Document & {
        startViewTransition: (cb: () => void) => { finished: Promise<void> };
      }).startViewTransition(() => {
        swapContent(newDoc);
        // Set VTN on NEW page elements (before browser captures new state)
        applyMorphToNewPage(morphCtx);
        // Scroll INSIDE callback so VT captures new state at correct position.
        // Use 'instant' to override CSS scroll-behavior:smooth on post pages.
        const scroll = getScrollTarget(url, options.push);
        window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      });
      await transition.finished;
      // Clean up residual VTN to prevent multi-element conflicts on next nav
      cleanupMorphVTN();
    } else {
      swapContent(newDoc);
      const scroll = getScrollTarget(url, options.push);
      window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
    }

    // Notify: page-specific components should re-initialize
    document.dispatchEvent(new Event('page-swapped'));

  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    // Fall back to normal navigation on any error
    location.href = url;
  } finally {
    isNavigating = false;
    currentAbort = null;
  }
}

// ── Event Handlers ─────────────────────────────────────────────────

function handleClick(event: MouseEvent): void {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest('a');
  if (!link || !(link instanceof HTMLAnchorElement)) return;
  if (!shouldIntercept(link, event)) return;

  event.preventDefault();
  navigate(link.href, { push: true, sourceElement: link });
}

function handlePopState(): void {
  const newPagePath = location.pathname + location.search;
  if (newPagePath === currentPagePath) {
    // Same page, only hash changed — let browser handle scroll natively
    return;
  }
  navigate(location.href, { push: false });
}

function handleHover(event: Event): void {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest('a');
  if (!link || !(link instanceof HTMLAnchorElement)) return;
  if (link.origin !== location.origin) return;
  if (link.pathname === location.pathname) return;
  if (cache.has(stripHash(link.href))) return;

  fetchPage(link.href).catch(() => {
    // Silently ignore prefetch errors
  });
}

// ── Init ───────────────────────────────────────────────────────────

export function initClientRouter(): void {
  // Seed the loaded-scripts tracker with all scripts on the initial page
  seedLoadedScripts();

  document.addEventListener('click', handleClick);
  window.addEventListener('popstate', handlePopState);
  document.addEventListener('mouseenter', handleHover, { capture: true });
  document.addEventListener('touchstart', handleHover, { capture: true });

  // Cache the current page
  cache.set(stripHash(location.href), {
    html: document.documentElement.outerHTML,
    scrollY: window.scrollY,
  });
}
