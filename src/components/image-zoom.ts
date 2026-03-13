/**
 * Image Zoom Component
 * Provides click-to-zoom functionality for images.
 * Normal images: fly-to-center transform animation.
 * Long images (ratio > 1.8): single-phase fly-in + scrollable overlay.
 */

let overlay: HTMLDivElement | null = null;
let zoomedImg: HTMLImageElement | null = null;
let originalImg: HTMLImageElement | null = null;
let isScrollMode = false;

const LONG_IMAGE_RATIO = 1.8;
const LONG_IMAGE_MAX_WIDTH = 500;
const LONG_IMAGE_SCROLL_PADDING = 32;

interface LongTarget {
  w: number;
  h: number;
  x: number;
  y: number;
}

// Compute target layout for long image
function longTarget(natW: number, natH: number, vw: number): LongTarget {
  const w = Math.min(LONG_IMAGE_MAX_WIDTH, vw < 768 ? vw - 32 : vw * 0.5);
  const h = w * (natH / natW);
  return { w, h, x: (vw - w) / 2, y: LONG_IMAGE_SCROLL_PADDING };
}

// Compute translate() scale() transform from final position to rect
function longTransform(rect: DOMRect, tgt: LongTarget): string {
  const sx = rect.width / tgt.w;
  const sy = rect.height / tgt.h;
  const tx = (rect.left + rect.width / 2) - (tgt.x + tgt.w / 2);
  const ty = (rect.top + rect.height / 2) - (tgt.y + tgt.h / 2);
  return `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
}

// Handle scroll gradient visibility
function onScrollGradient() {
  if (!overlay) return;
  const atBottom = overlay.scrollHeight - overlay.scrollTop - overlay.clientHeight < 80;
  overlay.classList.toggle('zoom-show-gradient', !atBottom);
}

// Setup overlay element
function setupOverlay() {
  overlay = document.createElement('div');
  overlay.className = 'zoom-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Image Viewer');
  overlay.setAttribute('tabindex', '-1');

  document.body.appendChild(overlay);
}

// Clean up zoom state
function cleanupZoom() {
  overlay = null;
  zoomedImg = null;
  originalImg = null;
  isScrollMode = false;
}

// Zoom in the image
function zoomIn(img: HTMLImageElement) {
  if (!overlay) {
    return;
  }

  document.body.style.overflow = 'hidden';
  const rect = img.getBoundingClientRect();
  originalImg = img;

  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isLong = natH / natW > LONG_IMAGE_RATIO;

  // Clone and setup image
  zoomedImg = img.cloneNode() as HTMLImageElement;
  zoomedImg.removeAttribute('id');
  zoomedImg.removeAttribute('loading');

  if (isLong) {
    // ═══ LONG IMAGE: single-phase fly-in + scroll ═══
    // Image sits at final position from the start.
    // Transform fakes it at the rect position.
    // Animate to transform:none → after transition, enable scroll.
    isScrollMode = true;
    const tgt = longTarget(natW, natH, vw);

    zoomedImg.className = 'zoom-img-long';
    zoomedImg.style.top = `${tgt.y}px`;
    zoomedImg.style.left = `${tgt.x}px`;
    zoomedImg.style.width = `${tgt.w}px`;
    zoomedImg.style.height = `${tgt.h}px`;
    zoomedImg.style.transform = longTransform(rect, tgt);

    // Bottom spacer for comfortable scroll end
    const spacer = document.createElement('div');
    spacer.className = 'zoom-scroll-spacer';

    overlay.style.overflow = 'hidden';
    overlay.appendChild(zoomedImg);
    overlay.appendChild(spacer);
    overlay.style.display = 'block';
    overlay.focus();

    requestAnimationFrame(() => {
      if (overlay) overlay.style.opacity = '1';
      if (zoomedImg) zoomedImg.style.transform = 'none';
    });

    // After fly-in completes: enable scrolling seamlessly
    const onFlyInEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'transform') return;
      zoomedImg?.removeEventListener('transitionend', onFlyInEnd);
      if (!zoomedImg || !isScrollMode || !overlay) return;

      overlay.classList.add('zoom-scroll');
      overlay.style.overflow = '';
      overlay.classList.add('zoom-show-gradient');
      overlay.addEventListener('scroll', onScrollGradient);
    };
    zoomedImg.addEventListener('transitionend', onFlyInEnd);

  } else {
    // ═══ NORMAL IMAGE: original elegant transform animation ═══
    isScrollMode = false;
    zoomedImg.className = 'zoom-img';
    zoomedImg.style.top = `${rect.top}px`;
    zoomedImg.style.left = `${rect.left}px`;
    zoomedImg.style.width = `${rect.width}px`;
    zoomedImg.style.height = `${rect.height}px`;

    document.body.appendChild(zoomedImg);
    overlay.style.display = 'block';
    overlay.focus();

    const scaleFactor = vw < 768 ? 1 : 0.8;
    const scale = Math.min(
      (vw * scaleFactor) / rect.width,
      (vh * scaleFactor) / rect.height,
    );
    const translateX = (-rect.left + (vw - rect.width) / 2) / scale;
    const translateY = (-rect.top + (vh - rect.height) / 2) / scale;

    requestAnimationFrame(() => {
      if (overlay) overlay.style.opacity = '1';
      if (zoomedImg) {
        zoomedImg.style.transform = `scale(${scale}) translate3d(${translateX}px, ${translateY}px, 0)`;
      }
    });
  }
}

// Zoom out the image
function zoomOut() {
  if (!overlay || !zoomedImg || !originalImg) {
    return;
  }

  overlay.removeEventListener('scroll', onScrollGradient);

  if (isScrollMode) {
    const rect = originalImg.getBoundingClientRect();
    const natW = originalImg.naturalWidth;
    const natH = originalImg.naturalHeight;
    const tgt = longTarget(natW, natH, window.innerWidth);
    const scrollTop = overlay.scrollTop;

    // Disable scroll for close animation
    overlay.classList.remove('zoom-scroll', 'zoom-show-gradient');
    overlay.style.overflow = 'hidden';
    overlay.scrollTop = 0;

    // Fly back: adjust target for scroll offset
    const adjustedTgt: LongTarget = { ...tgt, y: tgt.y - scrollTop };
    overlay.style.opacity = '0';
    zoomedImg.style.transform = longTransform(rect, adjustedTgt);
    isScrollMode = false;
  } else {
    overlay.style.opacity = '0';
    zoomedImg.style.transform = '';
  }

  document.body.style.overflow = '';

  // Cleanup after animation
  const cleanup = () => {
    if (!zoomedImg) return;

    zoomedImg.remove();
    zoomedImg = null;

    // Remove spacer if any
    const spacer = overlay?.querySelector('.zoom-scroll-spacer');
    if (spacer) spacer.remove();

    if (overlay) {
      overlay.classList.remove('zoom-scroll', 'zoom-show-gradient');
      overlay.style.display = 'none';
      overlay.style.overflow = '';
    }

    originalImg?.focus();
    originalImg = null;
  };

  zoomedImg.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'transform') cleanup();
  }, { once: true });

  // Fallback in case transitionend doesn't fire
  setTimeout(cleanup, 400);
}

// Handle click events
function handleClick(event: MouseEvent) {
  if (zoomedImg) {
    zoomOut();
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLImageElement)) {
    return;
  }

  // Ignore small or incomplete images
  if (!target.complete || target.width < 100 || target.height < 100) {
    return;
  }

  // Ignore images that shouldn't be zoomed (e.g., within code blocks)
  if (target.closest('pre, code')) {
    return;
  }

  event.preventDefault();
  zoomIn(target);
}

// Handle keyboard events
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && zoomedImg) {
    zoomOut();
  }
}

export function initImageZoom() {
  setupOverlay();
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', zoomOut);
}

export function reinitImageZoom() {
  cleanupZoom();
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  setupOverlay();
}

export function cleanupImageZoom() {
  cleanupZoom();
}
