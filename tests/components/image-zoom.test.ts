/**
 * Unit tests for Image Zoom Component
 *
 * Covers: zoom in/out, small image ignore, code block image ignore,
 * reinit cleanup, overlay creation, keyboard/resize handling,
 * long image detection, scroll mode, size threshold boundary
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initImageZoom, reinitImageZoom, cleanupImageZoom } from '../../src/components/image-zoom';

// ── Test helpers ───────────────────────────────────────────────────

function createImage(options: {
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  complete?: boolean;
  insideCode?: boolean;
} = {}): HTMLImageElement {
  const {
    width = 200,
    height = 200,
    naturalWidth = 800,
    naturalHeight = 600,
    complete = true,
    insideCode = false,
  } = options;

  const img = document.createElement('img');
  img.src = 'test.jpg';

  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  Object.defineProperty(img, 'complete', { value: complete, configurable: true });

  // jsdom getBoundingClientRect returns all zeros; mock realistic values
  img.getBoundingClientRect = () => ({
    top: 100, left: 50, width, height,
    bottom: 100 + height, right: 50 + width,
    x: 50, y: 100, toJSON() { return this; },
  });

  if (insideCode) {
    const pre = document.createElement('pre');
    pre.appendChild(img);
    document.body.appendChild(pre);
  } else {
    document.body.appendChild(img);
  }

  return img;
}

/** Create a long image (ratio > 1.8) */
function createLongImage(): HTMLImageElement {
  return createImage({ naturalWidth: 400, naturalHeight: 2000 });
}

function clickElement(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function pressKey(key: string): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function getOverlay(): HTMLDivElement | null {
  return document.querySelector('.zoom-overlay');
}

function getZoomedImg(): HTMLImageElement | null {
  return document.querySelector('.zoom-img');
}

function getZoomedLongImg(): HTMLImageElement | null {
  return document.querySelector('.zoom-img-long');
}

function fireTransitionEnd(el: Element, propertyName: string): void {
  el.dispatchEvent(new TransitionEvent('transitionend', { propertyName, bubbles: true }));
}

// ── Setup / Teardown ──────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = '';
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────

describe('Image Zoom', () => {
  beforeEach(() => {
    initImageZoom();
  });

  afterEach(() => {
    cleanupImageZoom();
  });

  describe('Overlay setup', () => {
    it('should create overlay element on init', () => {
      const overlay = getOverlay();
      expect(overlay).not.toBeNull();
      expect(overlay?.getAttribute('role')).toBe('dialog');
      expect(overlay?.getAttribute('aria-modal')).toBe('true');
    });
  });

  describe('Zoom in (normal image)', () => {
    it('should create zoomed image with zoom-img class', () => {
      const img = createImage();
      clickElement(img);

      const zoomed = getZoomedImg();
      expect(zoomed).not.toBeNull();
      expect(zoomed?.className).toBe('zoom-img');
    });

    it('should show overlay when zooming in', () => {
      const img = createImage();
      clickElement(img);

      const overlay = getOverlay();
      expect(overlay?.style.display).toBe('block');
    });

    it('should disable body scroll when zoomed', () => {
      const img = createImage();
      clickElement(img);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should apply scale() translate3d() transform for normal images', () => {
      const img = createImage({ width: 300, height: 200 });
      clickElement(img);

      const zoomed = getZoomedImg();
      expect(zoomed?.style.transform).toMatch(/scale\(.+\) translate3d\(.+\)/);
    });

    it('should append zoomed image to body (not overlay) for normal images', () => {
      const img = createImage();
      clickElement(img);

      const zoomed = getZoomedImg();
      expect(zoomed?.parentElement).toBe(document.body);
    });
  });

  describe('Zoom in (long image)', () => {
    it('should detect long image when naturalHeight/naturalWidth > 1.8', () => {
      const img = createLongImage();
      clickElement(img);

      expect(getZoomedLongImg()).not.toBeNull();
      expect(getZoomedImg()).toBeNull();
    });

    it('should use zoom-img-long class for long images', () => {
      const img = createLongImage();
      clickElement(img);

      const zoomed = getZoomedLongImg();
      expect(zoomed?.className).toBe('zoom-img-long');
    });

    it('should place long image inside overlay (not body)', () => {
      const img = createLongImage();
      clickElement(img);

      const zoomed = getZoomedLongImg();
      const overlay = getOverlay();
      expect(zoomed?.parentElement).toBe(overlay);
    });

    it('should create a scroll spacer inside overlay', () => {
      const img = createLongImage();
      clickElement(img);

      const spacer = getOverlay()?.querySelector('.zoom-scroll-spacer');
      expect(spacer).not.toBeNull();
    });

    it('should set overlay overflow to hidden during fly-in', () => {
      const img = createLongImage();
      clickElement(img);

      expect(getOverlay()?.style.overflow).toBe('hidden');
    });

    it('should animate transform to none on fly-in', () => {
      const img = createLongImage();
      clickElement(img);

      const zoomed = getZoomedLongImg();
      expect(zoomed?.style.transform).toBe('none');
    });

    it('should constrain long image width to max 500px on desktop', () => {
      // Simulate desktop viewport
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

      const img = createLongImage();
      clickElement(img);

      const zoomed = getZoomedLongImg();
      const w = parseFloat(zoomed?.style.width ?? '0');
      expect(w).toBeLessThanOrEqual(500);
    });

    it('should enable scroll mode after fly-in transitionend', () => {
      const img = createLongImage();
      clickElement(img);

      const zoomed = getZoomedLongImg()!;
      const overlay = getOverlay()!;

      // Before transitionend: no scroll
      expect(overlay.classList.contains('zoom-scroll')).toBe(false);

      // Fire transitionend for transform
      fireTransitionEnd(zoomed, 'transform');

      expect(overlay.classList.contains('zoom-scroll')).toBe(true);
      expect(overlay.classList.contains('zoom-show-gradient')).toBe(true);
    });

    it('should ignore non-transform transitionend events', () => {
      const img = createLongImage();
      clickElement(img);

      const zoomed = getZoomedLongImg()!;
      const overlay = getOverlay()!;

      fireTransitionEnd(zoomed, 'opacity');
      expect(overlay.classList.contains('zoom-scroll')).toBe(false);
    });

    it('should not treat image with ratio exactly 1.8 as long', () => {
      const img = createImage({ naturalWidth: 500, naturalHeight: 900 });
      clickElement(img);

      expect(getZoomedImg()).not.toBeNull();
      expect(getZoomedLongImg()).toBeNull();
    });

    it('should treat image with ratio > 1.8 as long', () => {
      const img = createImage({ naturalWidth: 500, naturalHeight: 901 });
      clickElement(img);

      expect(getZoomedLongImg()).not.toBeNull();
    });
  });

  describe('Zoom out (normal image)', () => {
    it('should restore body overflow on zoom out', () => {
      const img = createImage();
      clickElement(img);
      expect(document.body.style.overflow).toBe('hidden');

      clickElement(img);
      expect(document.body.style.overflow).toBe('');
    });

    it('should reset transform to empty on zoom out', () => {
      const img = createImage({ width: 300, height: 200 });
      clickElement(img);

      const zoomed = getZoomedImg()!;
      expect(zoomed.style.transform).toMatch(/scale\(.+\)/);

      clickElement(img);
      expect(zoomed.style.transform).toBe('');
    });
  });

  describe('Zoom out (long image)', () => {
    it('should set fly-back transform on close', () => {
      const img = createLongImage();
      clickElement(img);

      const zoomed = getZoomedLongImg()!;
      fireTransitionEnd(zoomed, 'transform');

      // Close
      clickElement(img);

      expect(zoomed.style.transform).toMatch(/translate\(.+\) scale\(.+\)/);
    });

    it('should remove zoom-scroll class on close', () => {
      const img = createLongImage();
      clickElement(img);

      const zoomed = getZoomedLongImg()!;
      const overlay = getOverlay()!;
      fireTransitionEnd(zoomed, 'transform');

      expect(overlay.classList.contains('zoom-scroll')).toBe(true);

      clickElement(img);
      expect(overlay.classList.contains('zoom-scroll')).toBe(false);
    });

    it('should remove zoom-show-gradient class on close', () => {
      const img = createLongImage();
      clickElement(img);

      const zoomed = getZoomedLongImg()!;
      const overlay = getOverlay()!;
      fireTransitionEnd(zoomed, 'transform');

      clickElement(img);
      expect(overlay.classList.contains('zoom-show-gradient')).toBe(false);
    });

    it('should clean up spacer after close animation', () => {
      vi.useFakeTimers();
      const img = createLongImage();
      clickElement(img);

      const zoomed = getZoomedLongImg()!;
      fireTransitionEnd(zoomed, 'transform');

      clickElement(img);
      // Trigger cleanup via fallback timeout
      vi.advanceTimersByTime(400);

      expect(getOverlay()?.querySelector('.zoom-scroll-spacer')).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('Keyboard handling', () => {
    it('should close zoom on Escape key', () => {
      const img = createImage();
      clickElement(img);
      expect(getZoomedImg()).not.toBeNull();

      pressKey('Escape');
      expect(document.body.style.overflow).toBe('');
    });

    it('should not error when Escape pressed without zoom', () => {
      expect(() => pressKey('Escape')).not.toThrow();
    });

    it('should ignore non-Escape keys', () => {
      const img = createImage();
      clickElement(img);

      pressKey('Enter');
      // Zoomed image should still exist
      expect(getZoomedImg()).not.toBeNull();
    });

    it('should close long image zoom on Escape key', () => {
      const img = createLongImage();
      clickElement(img);
      expect(getZoomedLongImg()).not.toBeNull();

      pressKey('Escape');
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Size threshold boundary', () => {
    it('should ignore image with width exactly 49px', () => {
      const img = createImage({ width: 49, height: 200 });
      clickElement(img);
      expect(getZoomedImg()).toBeNull();
    });

    it('should zoom image with width exactly 50px', () => {
      const img = createImage({ width: 50, height: 200 });
      clickElement(img);
      expect(getZoomedImg()).not.toBeNull();
    });

    it('should ignore image with height exactly 49px', () => {
      const img = createImage({ width: 200, height: 49 });
      clickElement(img);
      expect(getZoomedImg()).toBeNull();
    });

    it('should zoom image with height exactly 50px', () => {
      const img = createImage({ width: 200, height: 50 });
      clickElement(img);
      expect(getZoomedImg()).not.toBeNull();
    });
  });

  describe('Ignore conditions', () => {
    it('should ignore images smaller than 50px width', () => {
      const img = createImage({ width: 30, height: 200 });
      clickElement(img);
      expect(getZoomedImg()).toBeNull();
    });

    it('should ignore images smaller than 50px height', () => {
      const img = createImage({ width: 200, height: 30 });
      clickElement(img);
      expect(getZoomedImg()).toBeNull();
    });

    it('should ignore incomplete images', () => {
      const img = createImage({ complete: false });
      clickElement(img);
      expect(getZoomedImg()).toBeNull();
    });

    it('should ignore images inside code blocks', () => {
      const img = createImage({ insideCode: true });
      clickElement(img);
      expect(getZoomedImg()).toBeNull();
    });

    it('should ignore clicks on non-image elements', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      clickElement(div);
      expect(getZoomedImg()).toBeNull();
    });
  });

  describe('reinitImageZoom', () => {
    it('should ensure overlay exists after reinit', () => {
      expect(getOverlay()).not.toBeNull();
      reinitImageZoom();
      expect(getOverlay()).not.toBeNull();
    });

    it('should not throw when called multiple times', () => {
      expect(() => {
        reinitImageZoom();
        reinitImageZoom();
        reinitImageZoom();
      }).not.toThrow();
    });
  });

  describe('cleanupImageZoom', () => {
    it('should not throw when called without active zoom', () => {
      expect(() => cleanupImageZoom()).not.toThrow();
    });
  });
});
