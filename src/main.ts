import '@unocss/reset/tailwind.css';
import 'virtual:uno.css';
import '../templates/assets/styles/global.css';
import '../templates/assets/styles/markdown.css';
import '../templates/assets/styles/comment.css';
import '../templates/assets/styles/extension.css';
import '../templates/assets/styles/lqip.css';
import '../templates/assets/styles/transition.css';
import { initCodeCopy } from './components/code-copy';
import { initImageZoom, reinitImageZoom } from './components/image-zoom';
import { initClientRouter } from './components/client-router';
import { initMobileToc, reinitMobileToc } from './components/mobile-toc';

// Theme configuration
interface ThemeSettings {
  colorMode: 'light' | 'dark' | 'system';
  fontStyle: 'sans' | 'serif';
  enableTransition: boolean;
  customColors: {
    enabled: boolean;
    light: ThemePalette;
    dark: ThemePalette;
  };
  customCss: string;
}

interface ThemePalette {
  primary: string;
  secondary: string;
  background: string;
  highlight: string;
}

function getThemeSettings(): ThemeSettings {
  const element = document.getElementById('theme-settings');
  if (element) {
    try {
      return JSON.parse(element.textContent || '{}');
    } catch (e) {
      console.warn('Failed to parse theme settings:', e);
    }
  }
  return {
    colorMode: 'system',
    fontStyle: 'sans',
    enableTransition: true,
    customColors: {
      enabled: false,
      light: {
        primary: '#403d42',
        secondary: '#625d66',
        background: '#f5f3f6',
        highlight: '#f5d94f',
      },
      dark: {
        primary: '#ece9ef',
        secondary: '#c2bdc6',
        background: '#302d33',
        highlight: '#f5d94f',
      },
    },
    customCss: '',
  };
}

const LIGHT_BG = 'oklch(96% 0.005 298)';
const DARK_BG = 'oklch(22% 0.005 298)';

function getThemeBackgrounds(): { light: string; dark: string } {
  const settings = getThemeSettings();
  if (!settings.customColors?.enabled) {
    return { light: LIGHT_BG, dark: DARK_BG };
  }
  return {
    light: settings.customColors.light?.background || LIGHT_BG,
    dark: settings.customColors.dark?.background || DARK_BG,
  };
}

function hexToRgb(hex: string): [number, number, number] | null {
  let value = hex.trim();
  if (value.startsWith('#')) value = value.slice(1);
  if (value.length === 3) {
    value = value.split('').map(c => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ];
}

function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function hexToOklchChannels(hex: string, alpha?: number): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = toLinear(rgb[0]);
  const g = toLinear(rgb[1]);
  const b = toLinear(rgb[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const chroma = Math.sqrt(a * a + bb * bb);
  let hue = Math.atan2(bb, a) * 180 / Math.PI;
  if (hue < 0) hue += 360;
  const channels = `${(lightness * 100).toFixed(3)}% ${chroma.toFixed(5)} ${hue.toFixed(3)}`;
  return typeof alpha === 'number' ? `${channels} / ${alpha}` : channels;
}

function setThemeColorToken(name: string, color: string, alpha?: number): void {
  const channels = hexToOklchChannels(color, alpha);
  if (channels) {
    document.documentElement.style.setProperty(`--un-preset-theme-colors-${name}`, channels);
  }
}

function applyCustomColorTokens(isDark: boolean): void {
  const settings = getThemeSettings();
  if (!settings.customColors?.enabled) return;

  const palette = isDark ? settings.customColors.dark : settings.customColors.light;
  if (!palette) return;

  setThemeColorToken('primary', palette.primary);
  setThemeColorToken('secondary', palette.secondary);
  setThemeColorToken('background', palette.background);
  setThemeColorToken('highlight', palette.highlight, isDark ? 0.2 : 0.5);

  const root = document.documentElement;
  root.style.setProperty('--halo-search-widget-primary-color', palette.primary);
  root.style.setProperty('--halo-search-widget-muted-color', palette.secondary);
  root.style.setProperty('--halo-search-widget-content-color', palette.primary);
  root.style.setProperty('--halo-search-widget-base-bg-color', palette.background);
  root.style.setProperty('--halo-search-widget-modal-bg-color', palette.background);
  root.style.setProperty('--halo-search-widget-modal-layer-color', `color-mix(in srgb, ${isDark ? palette.background : palette.primary} ${isDark ? '70%' : '30%'}, transparent)`);
  root.style.setProperty('--halo-search-widget-hit-bg-color', `color-mix(in srgb, ${palette.background} 88%, ${isDark ? 'black' : palette.primary})`);
  root.style.setProperty('--halo-search-widget-divider-color', `color-mix(in srgb, ${palette.secondary} 15%, transparent)`);
  root.style.setProperty('--halo-search-widget-kbd-border-color', `color-mix(in srgb, ${palette.secondary} 25%, transparent)`);
}

// Apply theme changes (matches original Button.astro logic)
function applyTheme(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
  applyCustomColorTokens(isDark);

  const metaThemeColor = document.head.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    const backgrounds = getThemeBackgrounds();
    metaThemeColor.setAttribute('content', isDark ? backgrounds.dark : backgrounds.light);
  }

  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  document.dispatchEvent(new Event('theme-changed'));
}

// Toggle theme mode
function toggleTheme(): void {
  const isDark = !document.documentElement.classList.contains('dark');
  applyTheme(isDark);
}

// Handle theme toggle click (matches original Button.astro)
function handleThemeToggle(e: MouseEvent): void {
  if (!(e.target instanceof Element)) return;
  if (!e.target.closest('#theme-toggle-button')) return;

  // If reduceMotion, update directly
  if (document.documentElement.classList.contains('reduce-motion')) {
    toggleTheme();
    return;
  }

  // Use View Transitions API for theme toggle
  if ('startViewTransition' in document) {
    document.documentElement.style.setProperty('view-transition-name', 'theme-toggle-transition');
    document.documentElement.setAttribute('data-theme-changing', '');

    const transition = (document as Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } }).startViewTransition(toggleTheme);

    transition.finished.then(() => {
      document.documentElement.style.removeProperty('view-transition-name');
      document.documentElement.removeAttribute('data-theme-changing');
    });
  } else {
    toggleTheme();
  }
}

// Listen to system theme changes
function handleSystemChange(event: MediaQueryListEvent): void {
  const saved = localStorage.getItem('theme');
  if (!saved || saved === 'auto') {
    applyTheme(event.matches);
  }
}

// Scroll to top
const SCROLL_THRESHOLD = 300;

function updateScrollTopVisibility(): void {
  const btn = document.getElementById('scroll-top-button');
  if (!btn) return;
  btn.classList.toggle('visible', window.scrollY > SCROLL_THRESHOLD);
}

function handleScrollTopClick(e: MouseEvent): void {
  if (!(e.target instanceof Element)) return;
  if (!e.target.closest('#scroll-top-button')) return;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Search button handler (opens SearchWidget from plugin)
function handleSearchClick(e: MouseEvent): void {
  if (!(e.target instanceof Element)) return;
  if (!e.target.closest('#search-button')) return;
  const win = window as unknown as Record<string, unknown>;
  if (win.SearchWidget && typeof (win.SearchWidget as Record<string, unknown>).open === 'function') {
    (win.SearchWidget as { open: () => void }).open();
  }
}

// Back button handler (matches original BackButton.astro)
function handleBackButtonClick(e: MouseEvent): void {
  if (!(e.target instanceof Element)) return;
  if (!e.target.closest('#back-button')) return;

  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  const siteTitleLink = document.getElementById('site-title-link');
  if (siteTitleLink) {
    siteTitleLink.click();
  }
}

// TOC generation (matches original TOC.astro)
let tocScrollHandler: (() => void) | null = null;

function initToc(): void {
  // Clean up previous scroll listener to prevent accumulation across SPA swaps
  if (tocScrollHandler) {
    document.removeEventListener('scroll', tocScrollHandler);
    tocScrollHandler = null;
  }

  const tocContainer = document.getElementById('toc-container');
  const tocLinksList = document.getElementById('toc-links-list');

  if (!tocContainer || !tocLinksList) return;

  // Skip if no TOC items (inline script hid the container, or no headings)
  if (tocLinksList.children.length === 0) return;

  // Auto-scroll active TOC link on desktop
  const is2xl = window.matchMedia('(min-width: 1536px)');
  let ticking = false;
  let lastLink: Element | null = null;

  function scrollToActiveLink(): void {
    const activeLink = tocLinksList?.querySelector('a:target-current');
    if (activeLink && activeLink !== lastLink) {
      activeLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      lastLink = activeLink;
    }
    ticking = false;
  }

  tocScrollHandler = function handleTocScroll(): void {
    if (!ticking && is2xl.matches) {
      window.requestAnimationFrame(scrollToActiveLink);
      ticking = true;
    }
  };

  if (CSS.supports('selector(:target-current)')) {
    document.addEventListener('scroll', tocScrollHandler, { passive: true });
  }
}

// Re-trigger third-party plugin rendering after SPA navigation.
// Libraries are already loaded in memory (smart script activation skips
// re-cloning them), so we call their render APIs directly.
function reInitPlugins(): void {
  const win = window as unknown as Record<string, unknown>;

  // Vditor: math (KaTeX), mermaid, flowchart, mindmap, etc.
  if (win.vditorRender && typeof (win.vditorRender as Record<string, unknown>).render === 'function') {
    (win.vditorRender as { render: () => void }).render();
  }

  // KaTeX standalone (renderMathInElement from auto-render extension)
  if (typeof win.renderMathInElement === 'function') {
    (win.renderMathInElement as (el: Element) => void)(document.body);
  }

  // MathJax
  if (win.MathJax && typeof (win.MathJax as Record<string, unknown>).typeset === 'function') {
    (win.MathJax as { typeset: () => void }).typeset();
  }

  // Mermaid standalone
  if (win.mermaid && typeof (win.mermaid as Record<string, unknown>).run === 'function') {
    (win.mermaid as { run: () => void }).run();
  }
}

// Patch accessibility for plugin-injected buttons that lack aria-label
function patchButtonAccessibility(): void {
  document.querySelectorAll<HTMLButtonElement>('button:not([aria-label])').forEach(btn => {
    if (btn.textContent?.trim()) return;
    if (btn.getAttribute('title')) return;
    const pre = btn.closest('pre') ?? btn.parentElement?.querySelector('pre');
    if (pre || btn.classList.contains('code-copy-button')) {
      btn.setAttribute('aria-label', 'Copy code');
    }
  });
}

// Per-page initialization (runs on first load + after each page swap)
function initPageComponents(): void {
  initToc();
  reinitImageZoom();

  // Re-trigger third-party plugin rendering
  reInitPlugins();

  // Mobile sidebar TOC (re-scan headings, re-setup observers)
  reinitMobileToc();

  // Patch plugin buttons after a short delay (plugins inject DOM async)
  setTimeout(patchButtonAccessibility, 500);
}

// One-time initialization (runs only on first page load)
function initOnce(): void {
  const settings = getThemeSettings();

  // Code copy (event delegation on document, survives body swap)
  initCodeCopy();

  // Mobile sidebar TOC (event delegation on document, survives body swap)
  initMobileToc();

  // Image zoom (event listeners on document/window, survives body swap)
  initImageZoom();

  // Custom CSS (appended to head, persists across swaps)
  if (settings.customCss) {
    const styleEl = document.createElement('style');
    styleEl.textContent = settings.customCss;
    document.head.appendChild(styleEl);
  }

  // Client router for page transitions (respect OS reduce-motion from FOUC script)
  const isReduceMotion = document.documentElement.classList.contains('reduce-motion');
  if (settings.enableTransition && !isReduceMotion) {
    initClientRouter();
    document.addEventListener('page-swapped', initPageComponents);
  }

  // TOC (first page load)
  initToc();

  // Mobile sidebar TOC (setup observers for first page)
  reinitMobileToc();

  // Patch plugin buttons on initial load
  setTimeout(patchButtonAccessibility, 500);
}

// Register global event listeners (once, survive body swap)
document.addEventListener('click', handleThemeToggle);
document.addEventListener('click', handleBackButtonClick);
document.addEventListener('click', handleScrollTopClick);
document.addEventListener('click', handleSearchClick);
window.addEventListener('scroll', updateScrollTopVisibility, { passive: true });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemChange);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOnce);
} else {
  initOnce();
}
