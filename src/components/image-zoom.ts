/**
 * Image Zoom Component
 * Provides click-to-zoom functionality for images
 */

let overlay: HTMLDivElement | null = null;
let zoomedImg: HTMLImageElement | null = null;
let originalImg: HTMLImageElement | null = null;

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
}

// Zoom in the image
function zoomIn(img: HTMLImageElement) {
  if (!overlay) {
    return;
  }

  document.body.style.overflow = 'hidden';
  const rect = img.getBoundingClientRect();
  originalImg = img;

  // Use natural dimensions for correct aspect ratio (CSS may distort via aspect-ratio/object-fit)
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scaleFactor = viewportWidth < 768 ? 1 : 0.8;
  const isLongImage = natH / natW > 1.8;

  // Clone and setup image
  zoomedImg = img.cloneNode() as HTMLImageElement;
  zoomedImg.className = 'zoom-img';
  zoomedImg.removeAttribute('id');
  zoomedImg.removeAttribute('loading');

  if (isLongImage) {
    // Long image: scale to viewport width, scroll vertically
    const targetW = viewportWidth * scaleFactor;
    const targetH = targetW * (natH / natW);
    const SCROLL_PADDING = 32;

    overlay.classList.add('zoom-scroll');
    zoomedImg.style.position = 'absolute';
    zoomedImg.style.top = `${SCROLL_PADDING}px`;
    zoomedImg.style.left = `${(viewportWidth - targetW) / 2}px`;
    zoomedImg.style.width = `${targetW}px`;
    zoomedImg.style.height = `${targetH}px`;
    overlay.appendChild(zoomedImg);

    overlay.style.display = 'block';
    overlay.focus();

    requestAnimationFrame(() => {
      if (overlay) overlay.style.opacity = '1';
      if (zoomedImg) zoomedImg.style.opacity = '1';
    });
  } else {
    // Normal image: animate from rect position to viewport center
    // Start at displayed rect bounds
    zoomedImg.style.top = `${rect.top}px`;
    zoomedImg.style.left = `${rect.left}px`;
    zoomedImg.style.width = `${rect.width}px`;
    zoomedImg.style.height = `${rect.height}px`;

    document.body.appendChild(zoomedImg);
    overlay.style.display = 'block';
    overlay.focus();

    // Calculate target: fit natural ratio image to viewport
    const scale = Math.min(
      (viewportWidth * scaleFactor) / natW,
      (viewportHeight * scaleFactor) / natH,
    );
    const targetW = natW * scale;
    const targetH = natH * scale;

    // Animate to centered target via top/left/width/height transition
    requestAnimationFrame(() => {
      if (overlay) overlay.style.opacity = '1';
      if (zoomedImg) {
        zoomedImg.style.top = `${(viewportHeight - targetH) / 2}px`;
        zoomedImg.style.left = `${(viewportWidth - targetW) / 2}px`;
        zoomedImg.style.width = `${targetW}px`;
        zoomedImg.style.height = `${targetH}px`;
      }
    });
  }
}

// Zoom out the image
function zoomOut() {
  if (!overlay || !zoomedImg || !originalImg) {
    return;
  }

  // Start closing animation
  overlay.style.opacity = '0';
  document.body.style.overflow = '';

  const isScrollMode = overlay.classList.contains('zoom-scroll');
  if (isScrollMode) {
    overlay.classList.remove('zoom-scroll');
    overlay.scrollTop = 0;
    zoomedImg.style.opacity = '0';
  } else {
    // Animate back to original position
    const rect = originalImg.getBoundingClientRect();
    zoomedImg.style.top = `${rect.top}px`;
    zoomedImg.style.left = `${rect.left}px`;
    zoomedImg.style.width = `${rect.width}px`;
    zoomedImg.style.height = `${rect.height}px`;
  }

  // Define cleanup logic
  const cleanup = () => {
    if (!zoomedImg) {
      return;
    }

    // Remove zoomed image
    zoomedImg?.remove();
    zoomedImg = null;

    // Hide overlay
    if (overlay) {
      overlay.style.display = 'none';
    }

    // Restore focus
    originalImg?.focus();
    originalImg = null;
  };

  // Listen for transition end to cleanup
  zoomedImg.addEventListener('transitionend', cleanup, { once: true });
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

export function initImageZoom() {
  setupOverlay();
  document.addEventListener('click', handleClick);
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
