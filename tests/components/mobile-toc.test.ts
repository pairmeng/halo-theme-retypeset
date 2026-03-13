/**
 * Unit tests for Mobile Sidebar TOC Component
 *
 * Covers: ribbon visibility, overlay open/close, heading tracking,
 * keyboard accessibility, popstate handling, reinit lifecycle
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { initMobileToc, reinitMobileToc } from '../../src/components/mobile-toc';

// ── Test helpers ───────────────────────────────────────────────────

/** Build a minimal post page DOM with TOC elements */
function buildPostDOM(options: {
  headings?: { tag: string; id: string; text: string }[];
  includeRibbon?: boolean;
  includeOverlay?: boolean;
  includeTocContainer?: boolean;
} = {}): void {
  const {
    headings = [
      { tag: 'h2', id: 'intro', text: 'Introduction' },
      { tag: 'h3', id: 'sub-1', text: 'Sub Section 1' },
      { tag: 'h2', id: 'chapter-2', text: 'Chapter 2' },
      { tag: 'h4', id: 'deep-1', text: 'Deep Section' },
    ],
    includeRibbon = true,
    includeOverlay = true,
    includeTocContainer = true,
  } = options;

  // Inline TOC container
  if (includeTocContainer) {
    const tocContainer = document.createElement('div');
    tocContainer.id = 'toc-container';
    document.body.appendChild(tocContainer);
  }

  // Post date (fallback observe target)
  const postDate = document.createElement('div');
  postDate.id = 'post-date';
  document.body.appendChild(postDate);

  // Ribbon trigger
  if (includeRibbon) {
    const ribbon = document.createElement('div');
    ribbon.id = 'toc-ribbon';
    ribbon.className = 'toc-ribbon';
    ribbon.setAttribute('role', 'button');
    ribbon.setAttribute('tabindex', '0');
    ribbon.setAttribute('aria-label', 'Table of Contents');
    document.body.appendChild(ribbon);
  }

  // Overlay
  if (includeOverlay) {
    const overlay = document.createElement('div');
    overlay.id = 'toc-overlay';
    overlay.className = 'toc-overlay';
    overlay.innerHTML = `
      <div class="toc-overlay-content">
        <h2 class="toc-overlay-title">目录</h2>
        <nav>
          <ul id="toc-overlay-links"></ul>
        </nav>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // Post content with headings
  const postContent = document.createElement('div');
  postContent.id = 'post-content';
  for (const h of headings) {
    const el = document.createElement(h.tag);
    el.id = h.id;
    el.textContent = h.text;
    postContent.appendChild(el);
  }
  document.body.appendChild(postContent);

  // Populate overlay links (mimics the inline script in post.html)
  const overlayList = document.getElementById('toc-overlay-links');
  if (overlayList) {
    for (const h of headings) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${h.id}`;
      a.textContent = h.text;
      a.setAttribute('data-depth', h.tag[1]);
      li.appendChild(a);
      overlayList.appendChild(li);
    }
  }
}

function getRibbon(): HTMLElement | null {
  return document.getElementById('toc-ribbon');
}

function getOverlay(): HTMLElement | null {
  return document.getElementById('toc-overlay');
}

function getOverlayLinks(): HTMLElement | null {
  return document.getElementById('toc-overlay-links');
}

function clickElement(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function pressKey(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

// ── Mock IntersectionObserver ──────────────────────────────────────

let mockObserverInstances: MockIntersectionObserver[] = [];

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observedElements = new Set<Element>();

  root: Element | Document | null = null;
  rootMargin = '0px';
  thresholds: ReadonlyArray<number> = [0];

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    mockObserverInstances.push(this);
  }

  observe(el: Element): void { this.observedElements.add(el); }
  unobserve(el: Element): void { this.observedElements.delete(el); }
  disconnect(): void { this.observedElements.clear(); }
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

function setupIntersectionObserverMock(): void {
  mockObserverInstances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
}

/** Simulate an IntersectionObserver callback for a specific observer */
function triggerIntersection(
  observerIndex: number,
  entries: Partial<IntersectionObserverEntry>[]
): void {
  const observer = mockObserverInstances[observerIndex];
  if (!observer) throw new Error(`No observer at index ${observerIndex}`);
  observer.callback(entries as IntersectionObserverEntry[], observer as unknown as IntersectionObserver);
}

// ── Test suites ────────────────────────────────────────────────────

describe('Mobile Sidebar TOC', () => {
  beforeAll(() => {
    setupIntersectionObserverMock();
    vi.stubGlobal('CSS', { escape: (s: string) => s });
    // Register event listeners once (matches real app behavior)
    initMobileToc();
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    mockObserverInstances = [];
    // Mock history.pushState / history.back
    vi.spyOn(history, 'pushState').mockImplementation(() => {});
    vi.spyOn(history, 'back').mockImplementation(() => {});
    // Mock Element.scrollIntoView (not available in jsdom)
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initialization ───────────────────────────────────────────────

  describe('initMobileToc', () => {
    it('should register click and keydown listeners on document', () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      buildPostDOM();
      initMobileToc(); // Extra call to verify spy captures it

      const eventTypes = addSpy.mock.calls.map(c => c[0]);
      expect(eventTypes).toContain('click');
      expect(eventTypes).toContain('keydown');
    });

    it('should guard against duplicate popstate listeners', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      buildPostDOM();
      // popstateHandlerBound is already true from beforeAll, so this should NOT add another
      initMobileToc();

      const popstateCalls = addSpy.mock.calls.filter(c => c[0] === 'popstate');
      expect(popstateCalls.length).toBe(0);
    });
  });

  describe('reinitMobileToc', () => {
    it('should reset body overflow', () => {
      buildPostDOM();
      document.body.style.overflow = 'hidden';
      reinitMobileToc();
      expect(document.body.style.overflow).toBe('');
    });

    it('should immediately show ribbon', () => {
      buildPostDOM();
      reinitMobileToc();
      const ribbon = getRibbon()!;
      expect(ribbon.classList.contains('visible')).toBe(true);
    });

    it('should create IntersectionObserver for heading tracking', () => {
      buildPostDOM();
      reinitMobileToc();
      // Only heading observer (no ribbon observer)
      expect(mockObserverInstances.length).toBe(1);
      expect(mockObserverInstances[0].observedElements.size).toBe(4);
    });

    it('should not create heading observer when no headings', () => {
      buildPostDOM({ headings: [] });
      reinitMobileToc();
      expect(mockObserverInstances.length).toBe(0);
    });

    it('should disconnect previous heading observer on re-init', () => {
      buildPostDOM();
      reinitMobileToc();
      const firstHeadingObs = mockObserverInstances[0];
      const headingDisconnectSpy = vi.spyOn(firstHeadingObs, 'disconnect');

      reinitMobileToc();
      expect(headingDisconnectSpy).toHaveBeenCalled();
    });
  });

  // ── H1 heading support ──────────────────────────────────────────

  describe('H1 heading support', () => {
    it('should include h1 in heading tracking when h1 exists in content', () => {
      buildPostDOM({
        headings: [
          { tag: 'h1', id: 'title-1', text: 'Title 1' },
          { tag: 'h2', id: 'section-1', text: 'Section 1' },
          { tag: 'h3', id: 'sub-1', text: 'Sub 1' },
        ],
      });
      reinitMobileToc();

      const observer = mockObserverInstances[0];
      expect(observer).toBeDefined();
      // All 3 headings (h1, h2, h3) should be observed
      expect(observer.observedElements.size).toBe(3);
    });

    it('should observe h1 element specifically', () => {
      buildPostDOM({
        headings: [
          { tag: 'h1', id: 'main-title', text: 'Main Title' },
          { tag: 'h2', id: 'intro', text: 'Intro' },
        ],
      });
      reinitMobileToc();

      const observer = mockObserverInstances[0];
      const h1 = document.getElementById('main-title')!;
      expect(observer.observedElements.has(h1)).toBe(true);
    });

    it('should NOT include h1 in tracking when no h1 in content', () => {
      buildPostDOM({
        headings: [
          { tag: 'h2', id: 'intro', text: 'Introduction' },
          { tag: 'h3', id: 'sub-1', text: 'Sub Section' },
        ],
      });
      reinitMobileToc();

      const observer = mockObserverInstances[0];
      expect(observer.observedElements.size).toBe(2);
    });

    it('should track h1 as active heading when it intersects', () => {
      buildPostDOM({
        headings: [
          { tag: 'h1', id: 'top-title', text: 'Top Title' },
          { tag: 'h2', id: 'section-a', text: 'Section A' },
        ],
      });
      reinitMobileToc();

      const h1 = document.getElementById('top-title')!;
      triggerIntersection(0, [{ isIntersecting: true, target: h1 }]);

      clickElement(getRibbon()!);

      const activeLi = getOverlayLinks()!.querySelector('li.toc-active');
      expect(activeLi).not.toBeNull();
      expect(activeLi!.querySelector('a')!.getAttribute('href')).toBe('#top-title');
    });

    it('should handle mixed h1-h4 headings', () => {
      buildPostDOM({
        headings: [
          { tag: 'h1', id: 'ch1', text: 'Chapter 1' },
          { tag: 'h2', id: 's1', text: 'Section 1' },
          { tag: 'h3', id: 'ss1', text: 'Subsection 1' },
          { tag: 'h4', id: 'd1', text: 'Detail 1' },
        ],
      });
      reinitMobileToc();

      const observer = mockObserverInstances[0];
      expect(observer.observedElements.size).toBe(4);
    });

    it('should only observe h2-h4 when content has no h1', () => {
      buildPostDOM({
        headings: [
          { tag: 'h2', id: 'a', text: 'A' },
          { tag: 'h3', id: 'b', text: 'B' },
          { tag: 'h4', id: 'c', text: 'C' },
        ],
      });
      reinitMobileToc();

      const observer = mockObserverInstances[0];
      expect(observer.observedElements.size).toBe(3);

      // Verify h2, h3, h4 are observed
      expect(observer.observedElements.has(document.getElementById('a')!)).toBe(true);
      expect(observer.observedElements.has(document.getElementById('b')!)).toBe(true);
      expect(observer.observedElements.has(document.getElementById('c')!)).toBe(true);
    });
  });

  // ── Ribbon visibility ────────────────────────────────────────────

  describe('Ribbon visibility', () => {
    it('should always be visible after reinit', () => {
      buildPostDOM();
      reinitMobileToc();
      expect(getRibbon()!.classList.contains('visible')).toBe(true);
    });

    it('should hide when overlay opens and restore when overlay closes', () => {
      buildPostDOM();
      reinitMobileToc();

      const ribbon = getRibbon()!;
      expect(ribbon.classList.contains('visible')).toBe(true);

      clickElement(ribbon);
      expect(ribbon.classList.contains('visible')).toBe(false);

      // Close overlay by clicking on it
      const overlay = getOverlay()!;
      clickElement(overlay);
      expect(ribbon.classList.contains('visible')).toBe(true);
    });
  });

  // ── Overlay open ─────────────────────────────────────────────────

  describe('Overlay open', () => {
    it('should open overlay when ribbon is clicked', () => {
      buildPostDOM();
      initMobileToc();
      reinitMobileToc();

      const ribbon = getRibbon()!;
      clickElement(ribbon);

      const overlay = getOverlay()!;
      expect(overlay.classList.contains('open')).toBe(true);
    });

    it('should open overlay when Enter is pressed on ribbon', () => {
      buildPostDOM();
      initMobileToc();
      reinitMobileToc();

      const ribbon = getRibbon()!;
      pressKey(ribbon, 'Enter');

      const overlay = getOverlay()!;
      expect(overlay.classList.contains('open')).toBe(true);
    });

    it('should open overlay when Space is pressed on ribbon', () => {
      buildPostDOM();
      initMobileToc();
      reinitMobileToc();

      const ribbon = getRibbon()!;
      pressKey(ribbon, ' ');

      const overlay = getOverlay()!;
      expect(overlay.classList.contains('open')).toBe(true);
    });

    it('should not open overlay on non-Enter/Space keys', () => {
      buildPostDOM();
      initMobileToc();
      reinitMobileToc();

      const ribbon = getRibbon()!;
      pressKey(ribbon, 'Tab');

      const overlay = getOverlay()!;
      expect(overlay.classList.contains('open')).toBe(false);
    });

    it('should prevent background scroll when opened', () => {
      buildPostDOM();
      initMobileToc();
      reinitMobileToc();

      clickElement(getRibbon()!);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should push history state when opened', () => {
      buildPostDOM();
      initMobileToc();
      reinitMobileToc();

      clickElement(getRibbon()!);
      expect(history.pushState).toHaveBeenCalledWith({ tocOverlay: true }, '');
    });

    it('should hide ribbon when overlay opens', () => {
      buildPostDOM();
      initMobileToc();
      reinitMobileToc();

      const ribbon = getRibbon()!;
      ribbon.classList.add('visible');

      clickElement(ribbon);
      expect(ribbon.classList.contains('visible')).toBe(false);
    });

    it('should not open overlay twice on rapid clicks', () => {
      buildPostDOM();
      reinitMobileToc();

      const ribbon = getRibbon()!;
      clickElement(ribbon);
      clickElement(ribbon);

      // Guard prevents double-open: pushState called once
      expect(history.pushState).toHaveBeenCalledTimes(1);
    });
  });

  // ── Overlay close ────────────────────────────────────────────────

  describe('Overlay close', () => {
    function openFirst(): void {
      clickElement(getRibbon()!);
    }

    it('should close overlay when clicking on overlay area', () => {
      buildPostDOM();
      reinitMobileToc();
      openFirst();

      const overlay = getOverlay()!;
      clickElement(overlay);

      expect(overlay.classList.contains('open')).toBe(false);
      expect(overlay.classList.contains('closing')).toBe(true);
    });

    it('should close overlay when a TOC link is clicked', () => {
      buildPostDOM();
      reinitMobileToc();
      openFirst();

      const firstLink = getOverlayLinks()!.querySelector('a')!;
      clickElement(firstLink);

      const overlay = getOverlay()!;
      expect(overlay.classList.contains('open')).toBe(false);
    });

    it('should close overlay when empty area (not a link) is clicked', () => {
      buildPostDOM();
      reinitMobileToc();
      openFirst();

      const title = document.querySelector('.toc-overlay-title')!;
      clickElement(title);

      expect(getOverlay()!.classList.contains('open')).toBe(false);
    });

    it('should restore body overflow when closed', () => {
      buildPostDOM();
      reinitMobileToc();
      openFirst();
      expect(document.body.style.overflow).toBe('hidden');

      clickElement(getOverlay()!);
      expect(document.body.style.overflow).toBe('');
    });

    it('should add closing class and remove after transitionend', () => {
      buildPostDOM();
      reinitMobileToc();
      openFirst();

      const overlay = getOverlay()!;
      clickElement(overlay);

      expect(overlay.classList.contains('closing')).toBe(true);
      expect(overlay.classList.contains('open')).toBe(false);

      // Simulate transitionend on content panel (fade animation target)
      const contentPanel = overlay.querySelector('.toc-overlay-content')!;
      contentPanel.dispatchEvent(new Event('transitionend', { bubbles: false }));
      expect(overlay.classList.contains('closing')).toBe(false);
    });

    it('should fallback-hide after timeout if transitionend does not fire', () => {
      vi.useFakeTimers();
      buildPostDOM();
      reinitMobileToc();
      openFirst();

      const overlay = getOverlay()!;
      clickElement(overlay);

      expect(overlay.classList.contains('closing')).toBe(true);

      // Fast-forward 400ms (fallback timeout)
      vi.advanceTimersByTime(400);
      expect(overlay.classList.contains('closing')).toBe(false);

      vi.useRealTimers();
    });

    it('should close overlay on click inside #toc-overlay-links (non-link area)', () => {
      buildPostDOM();
      reinitMobileToc();
      openFirst();

      // Click on the <ul> itself, not on an <a> — frosted overlay closes on any tap
      const linksList = getOverlayLinks()!;
      linksList.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(getOverlay()!.classList.contains('open')).toBe(false);
    });
  });

  // ── Popstate (back button) ───────────────────────────────────────

  describe('Popstate handling', () => {
    it('should close overlay on popstate event when open', () => {
      buildPostDOM();
      reinitMobileToc();

      clickElement(getRibbon()!);
      expect(getOverlay()!.classList.contains('open')).toBe(true);

      // Simulate back button
      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(getOverlay()!.classList.contains('open')).toBe(false);
    });

    it('should not call history.back when closing via popstate', () => {
      buildPostDOM();
      reinitMobileToc();

      clickElement(getRibbon()!);
      vi.mocked(history.back).mockClear();

      window.dispatchEvent(new PopStateEvent('popstate'));
      // closeOverlay(true) should skip history.back
      expect(history.back).not.toHaveBeenCalled();
    });

    it('should not error on popstate when overlay is not open', () => {
      buildPostDOM();
      reinitMobileToc();

      expect(() => {
        window.dispatchEvent(new PopStateEvent('popstate'));
      }).not.toThrow();
    });
  });

  // ── Current chapter highlight ────────────────────────────────────

  describe('Heading tracking & highlight', () => {
    it('should track the last intersecting heading as active', () => {
      buildPostDOM();
      reinitMobileToc();

      const h2 = document.getElementById('chapter-2')!;

      // Simulate heading entering viewport
      triggerIntersection(0, [{
        isIntersecting: true,
        target: h2,
      }]);

      // Open overlay to trigger highlight
      clickElement(getRibbon()!);

      const activeLi = getOverlayLinks()!.querySelector('li.toc-active');
      expect(activeLi).not.toBeNull();
      const activeLink = activeLi!.querySelector('a');
      expect(activeLink!.getAttribute('href')).toBe('#chapter-2');
    });

    it('should clear previous highlight when new heading becomes active', () => {
      buildPostDOM();
      reinitMobileToc();

      const h2Intro = document.getElementById('intro')!;
      const h2Ch2 = document.getElementById('chapter-2')!;

      // First heading active
      triggerIntersection(0, [{
        isIntersecting: true,
        target: h2Intro,
      }]);

      clickElement(getRibbon()!);
      let activeLis = getOverlayLinks()!.querySelectorAll('li.toc-active');
      expect(activeLis.length).toBe(1);
      expect(activeLis[0].querySelector('a')!.getAttribute('href')).toBe('#intro');

      // Close and change heading
      clickElement(getOverlay()!);
      getOverlay()!.querySelector('.toc-overlay-content')!.dispatchEvent(new Event('transitionend', { bubbles: false }));

      // Second heading becomes active
      triggerIntersection(0, [{
        isIntersecting: true,
        target: h2Ch2,
      }]);

      // Re-open
      clickElement(getRibbon()!);
      activeLis = getOverlayLinks()!.querySelectorAll('li.toc-active');
      expect(activeLis.length).toBe(1);
      expect(activeLis[0].querySelector('a')!.getAttribute('href')).toBe('#chapter-2');
    });

    it('should call scrollIntoView on the active link when overlay opens', () => {
      buildPostDOM();
      reinitMobileToc();

      const h2 = document.getElementById('chapter-2')!;
      triggerIntersection(0, [{
        isIntersecting: true,
        target: h2,
      }]);

      clickElement(getRibbon()!);

      // scrollIntoView is a shared prototype mock; verify it was called with overlay-scroll args
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        behavior: 'instant',
      });
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should handle page with no headings gracefully', () => {
      buildPostDOM({ headings: [] });

      expect(() => reinitMobileToc()).not.toThrow();
      // No observers created (ribbon is class-based, no headings to track)
      expect(mockObserverInstances.length).toBe(0);
    });

    it('should handle missing overlay element gracefully', () => {
      buildPostDOM({ includeOverlay: false });
      reinitMobileToc();

      // Clicking ribbon should not throw
      expect(() => clickElement(getRibbon()!)).not.toThrow();
    });

    it('should handle missing ribbon and overlay gracefully', () => {
      buildPostDOM({ includeRibbon: false, includeOverlay: false });
      expect(() => {
        reinitMobileToc();
      }).not.toThrow();
    });

    it('should handle click on non-element target gracefully', () => {
      buildPostDOM();
      reinitMobileToc();

      // Dispatch click with null target — should not throw
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: null });
      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('should handle overlay links with special characters in heading IDs', () => {
      buildPostDOM({
        headings: [
          { tag: 'h2', id: 'section-1.1', text: 'Section 1.1' },
          { tag: 'h2', id: '中文标题', text: '中文标题' },
        ],
      });
      reinitMobileToc();

      // Should not throw when opening overlay with special IDs
      expect(() => clickElement(getRibbon()!)).not.toThrow();
    });
  });

  // ── Ribbon conditional display ──────────────────────────────────

  describe('Ribbon conditional display', () => {
    it('should not show ribbon when overlay TOC has no links', () => {
      buildPostDOM({ headings: [] });
      reinitMobileToc();

      const ribbon = getRibbon()!;
      // Ribbon should NOT have 'visible' class when there are no TOC entries
      expect(ribbon.classList.contains('visible')).toBe(false);
    });

    it('should show ribbon when overlay TOC has links', () => {
      buildPostDOM();
      reinitMobileToc();

      const ribbon = getRibbon()!;
      expect(ribbon.classList.contains('visible')).toBe(true);
    });
  });

  // ── TOC link navigation ──────────────────────────────────────────

  describe('TOC link navigation', () => {
    it('should smooth-scroll to target heading after 150ms delay', () => {
      vi.useFakeTimers();
      buildPostDOM();
      reinitMobileToc();

      clickElement(getRibbon()!);

      vi.mocked(Element.prototype.scrollIntoView).mockClear();

      const link = getOverlayLinks()!.querySelector('a[href="#chapter-2"]')!;
      clickElement(link);

      // No scroll yet — overlay is fading out
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

      // After 150ms (overlay nearly transparent), smooth scroll starts
      vi.advanceTimersByTime(150);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });

      vi.useRealTimers();
    });

    it('should close overlay after link click', () => {
      buildPostDOM();
      reinitMobileToc();

      clickElement(getRibbon()!);

      const link = getOverlayLinks()!.querySelector('a[href="#intro"]')!;
      clickElement(link);

      expect(getOverlay()!.classList.contains('open')).toBe(false);
      expect(document.body.style.overflow).toBe('');
    });

    it('should not call history.back on link click (uses replaceState)', () => {
      buildPostDOM();
      reinitMobileToc();

      const backSpy = vi.spyOn(history, 'back');

      clickElement(getRibbon()!);
      // Reset spy — pushState was called during open
      backSpy.mockClear();

      const link = getOverlayLinks()!.querySelector('a[href="#chapter-2"]')!;
      clickElement(link);

      // Should NOT call history.back (avoids browser scroll restoration)
      expect(backSpy).not.toHaveBeenCalled();

      backSpy.mockRestore();
    });

    it('should handle link click with non-existent target gracefully', () => {
      vi.useFakeTimers();
      buildPostDOM();
      reinitMobileToc();

      clickElement(getRibbon()!);

      // Inject a link pointing to a non-existent heading
      const overlayLinks = getOverlayLinks()!;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#non-existent-heading';
      a.setAttribute('data-depth', '2');
      a.textContent = 'Ghost Section';
      li.appendChild(a);
      overlayLinks.appendChild(li);

      vi.mocked(Element.prototype.scrollIntoView).mockClear();

      // Should not throw
      expect(() => clickElement(a)).not.toThrow();

      // Should still close overlay
      expect(getOverlay()!.classList.contains('open')).toBe(false);

      // After 150ms, no scroll should fire (target doesn't exist)
      vi.advanceTimersByTime(150);
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not scroll when link has no href', () => {
      vi.useFakeTimers();
      buildPostDOM();
      reinitMobileToc();

      clickElement(getRibbon()!);

      const overlayLinks = getOverlayLinks()!;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.setAttribute('data-depth', '2');
      a.textContent = 'No Href';
      li.appendChild(a);
      overlayLinks.appendChild(li);

      vi.mocked(Element.prototype.scrollIntoView).mockClear();

      expect(() => clickElement(a)).not.toThrow();
      vi.advanceTimersByTime(150);
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
