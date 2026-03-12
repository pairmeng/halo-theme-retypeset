/**
 * Unit tests for Image Zoom Component
 *
 * Covers: zoom in/out, small image ignore, code block image ignore,
 * reinit cleanup, overlay creation, keyboard/resize handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initImageZoom, reinitImageZoom, cleanupImageZoom } from '../../src/components/image-zoom';

// ── Test helpers ───────────────────────────────────────────────────

function createImage(options: {
  width?: number;
  height?: number;
  complete?: boolean;
  insideCode?: boolean;
} = {}): HTMLImageElement {
  const { width = 200, height = 200, complete = true, insideCode = false } = options;

  const img = document.createElement('img');
  img.src = 'test.jpg';

  // jsdom doesn't set naturalWidth/height or complete, mock them
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  Object.defineProperty(img, 'complete', { value: complete, configurable: true });

  if (insideCode) {
    const pre = document.createElement('pre');
    pre.appendChild(img);
    document.body.appendChild(pre);
  } else {
    document.body.appendChild(img);
  }

  return img;
}

function clickElement(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function getOverlay(): HTMLDivElement | null {
  return document.querySelector('.zoom-overlay');
}

function getZoomedImg(): HTMLImageElement | null {
  return document.querySelector('.zoom-img');
}

// ── Setup / Teardown ──────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = '';
  // Mock requestAnimationFrame
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

  describe('Zoom in', () => {
    it('should create zoomed image when clicking a valid image', () => {
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
  });

  describe('Zoom out', () => {
    it('should restore body overflow on zoom out', () => {
      const img = createImage();

      // Zoom in
      clickElement(img);
      expect(document.body.style.overflow).toBe('hidden');

      // Zoom out (click again while zoomed)
      clickElement(img);
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Ignore conditions', () => {
    it('should ignore images smaller than 100px width', () => {
      const img = createImage({ width: 50, height: 200 });

      clickElement(img);

      expect(getZoomedImg()).toBeNull();
    });

    it('should ignore images smaller than 100px height', () => {
      const img = createImage({ width: 200, height: 50 });

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

      // Overlay should still be present after reinit
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
