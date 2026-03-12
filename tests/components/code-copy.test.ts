/**
 * Unit tests for Code Copy Button Component
 *
 * Covers: copy success/failure, visual feedback (copied class),
 * rapid-click debounce, missing elements gracefully handled
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initCodeCopy } from '../../src/components/code-copy';

// ── Test helpers ───────────────────────────────────────────────────

function buildCodeBlock(code = 'const x = 1;'): {
  button: HTMLButtonElement;
  codeEl: HTMLElement;
} {
  const wrapper = document.createElement('div');

  const pre = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.textContent = code;
  pre.appendChild(codeEl);

  const button = document.createElement('button');
  button.className = 'code-copy-button';

  wrapper.appendChild(pre);
  wrapper.appendChild(button);
  document.body.appendChild(wrapper);

  return { button, codeEl };
}

function clickElement(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

// ── Setup / Teardown ──────────────────────────────────────────────

let clipboardWriteSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.body.innerHTML = '';
  clipboardWriteSpy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWriteSpy },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────

describe('Code Copy Button', () => {
  // Register the delegated listener once
  beforeEach(() => {
    initCodeCopy();
  });

  describe('Copy functionality', () => {
    it('should copy code text to clipboard on button click', async () => {
      const { button } = buildCodeBlock('hello world');

      clickElement(button);
      await vi.waitFor(() => {
        expect(clipboardWriteSpy).toHaveBeenCalledWith('hello world');
      });
    });

    it('should add copied class after successful copy', async () => {
      const { button } = buildCodeBlock();

      clickElement(button);
      await vi.waitFor(() => {
        expect(button.classList.contains('copied')).toBe(true);
      });
    });

    it('should remove copied class after 1.5s', async () => {
      vi.useFakeTimers();
      const { button } = buildCodeBlock();

      clickElement(button);
      // Flush only the microtask (promise), not the 1500ms timer
      await vi.advanceTimersByTime(0);

      expect(button.classList.contains('copied')).toBe(true);

      vi.advanceTimersByTime(1500);
      expect(button.classList.contains('copied')).toBe(false);

      vi.useRealTimers();
    });

    it('should not add copied class when clipboard fails', async () => {
      clipboardWriteSpy.mockRejectedValue(new Error('Permission denied'));
      const { button } = buildCodeBlock();

      clickElement(button);
      await vi.waitFor(() => {
        expect(clipboardWriteSpy).toHaveBeenCalled();
      });

      expect(button.classList.contains('copied')).toBe(false);
    });
  });

  describe('Rapid click debounce', () => {
    it('should reset timeout on rapid clicks (no flicker)', async () => {
      vi.useFakeTimers();
      const { button } = buildCodeBlock();

      // First click
      clickElement(button);
      await vi.advanceTimersByTime(0);
      expect(button.classList.contains('copied')).toBe(true);

      // Advance 1s, click again
      vi.advanceTimersByTime(1000);
      clickElement(button);
      await vi.advanceTimersByTime(0);

      // Still has copied class
      expect(button.classList.contains('copied')).toBe(true);

      // After 1s (2s total from first click, but only 1s from second), still copied
      vi.advanceTimersByTime(1000);
      expect(button.classList.contains('copied')).toBe(true);

      // After 1.5s from second click, copied removed
      vi.advanceTimersByTime(500);
      expect(button.classList.contains('copied')).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('Edge cases', () => {
    it('should ignore clicks on non-copy-button elements', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      expect(() => clickElement(div)).not.toThrow();
      expect(clipboardWriteSpy).not.toHaveBeenCalled();
    });

    it('should handle missing code element gracefully', () => {
      const button = document.createElement('button');
      button.className = 'code-copy-button';
      // No parent with pre > code
      const wrapper = document.createElement('div');
      wrapper.appendChild(button);
      document.body.appendChild(wrapper);

      expect(() => clickElement(button)).not.toThrow();
      expect(clipboardWriteSpy).not.toHaveBeenCalled();
    });

    it('should handle click on child of copy button', async () => {
      const { button } = buildCodeBlock('child click test');
      const span = document.createElement('span');
      span.textContent = 'icon';
      button.appendChild(span);

      clickElement(span);
      await vi.waitFor(() => {
        expect(clipboardWriteSpy).toHaveBeenCalledWith('child click test');
      });
    });
  });
});
