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

  // Disable scrolling and get position
  document.body.style.overflow = 'hidden';
  const rect = img.getBoundingClientRect();
  originalImg = img;

  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scaleFactor = window.innerWidth < 768 ? 1 : 0.8;
  const isLongImage = natH / natW > 1.8;

  // Clone and setup image
  zoomedImg = img.cloneNode() as HTMLImageElement;
  zoomedImg.className = 'zoom-img';
  zoomedImg.removeAttribute('id');
  zoomedImg.removeAttribute('loading');

  if (isLongImage) {
    // Long image mode: scale to viewport width, scroll vertically, slide-up animation
    const targetW = viewportWidth * scaleFactor;
    const targetH = targetW * (natH / natW);
    const SCROLL_PADDING = 32;

    overlay.classList.add('zoom-scroll');
    zoomedImg.style.position = 'absolute';
    zoomedImg.style.top = `${SCROLL_PADDING}px`;
    zoomedImg.style.left = `${(viewportWidth - targetW) / 2}px`;
    zoomedImg.style.width = `${targetW}px`;
    zoomedImg.style.height = `${targetH}px`;
    zoomedImg.style.transform = 'translateY(30px)';
    overlay.appendChild(zoomedImg);

    overlay.style.display = 'block';
    overlay.focus();

    requestAnimationFrame(() => {
      if (overlay) overlay.style.opacity = '1';
      if (zoomedImg) {
        zoomedImg.style.opacity = '1';
        zoomedImg.style.transform = 'translateY(0)';
      }
    });
  } else {
    // Normal image mode: original elegant transform animation
    zoomedImg.style.top = `${rect.top}px`;
    zoomedImg.style.left = `${rect.left}px`;
    zoomedImg.style.width = `${rect.width}px`;
    zoomedImg.style.height = `${rect.height}px`;

    document.body.appendChild(zoomedImg);
    overlay.style.display = 'block';
    overlay.focus();

    // Calculate scale and position (original algorithm)
    const scale = Math.min(
      (viewportWidth * scaleFactor) / rect.width,
      (viewportHeight * scaleFactor) / rect.height,
    );
    const translateX = (-rect.left + (viewportWidth - rect.width) / 2) / scale;
    const translateY = (-rect.top + (viewportHeight - rect.height) / 2) / scale;

    // Start animation
    requestAnimationFrame(() => {
      if (overlay) {
        overlay.style.opacity = '1';
      }
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

  // Start closing animation
  overlay.style.opacity = '0';
  document.body.style.overflow = '';

  const isScrollMode = overlay.classList.contains('zoom-scroll');
  if (isScrollMode) {
    overlay.classList.remove('zoom-scroll');
    overlay.scrollTop = 0;
    zoomedImg.style.opacity = '0';
    zoomedImg.style.transform = 'translateY(30px)';
  } else {
    // Original: reset transform to animate back to initial position
    zoomedImg.style.transform = '';
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
