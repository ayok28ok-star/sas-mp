const DEFAULT_FAVICON = '/favicon.ico';

function applyFaviconHref(href: string, type?: string) {
  const existingLinks = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')
  );

  if (existingLinks.length === 0) {
    const iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    iconLink.href = href;
    if (type) iconLink.type = type;
    document.head.appendChild(iconLink);

    const shortcutLink = document.createElement('link');
    shortcutLink.rel = 'shortcut icon';
    shortcutLink.href = href;
    if (type) shortcutLink.type = type;
    document.head.appendChild(shortcutLink);
    return;
  }

  existingLinks.forEach((link) => {
    link.href = href;
    if (type) {
      link.type = type;
    } else {
      link.removeAttribute('type');
    }
  });
}

/**
 * Dynamically updates the browser tab favicon to match the saved school logo
 * from SchoolSettings, falling back to /favicon.ico when none is set.
 */
export function syncFaviconWithSchoolLogo(logoUrl?: string) {
  if (typeof document === 'undefined') return;

  const trimmed = logoUrl?.trim();
  if (!trimmed) {
    applyFaviconHref(DEFAULT_FAVICON);
    return;
  }

  if (trimmed.startsWith('data:image/svg+xml')) {
    applyFaviconHref(trimmed, 'image/svg+xml');
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        applyFaviconHref(trimmed);
        return;
      }

      // Draw crisp rounded white badge background for clean contrast in dark/light browser tabs
      const radius = 12;
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(size - radius, 0);
      ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius);
      ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size);
      ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      const padding = 4;
      const maxDim = size - padding * 2;
      const ratio = Math.min(maxDim / img.width, maxDim / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      const offsetX = (size - drawW) / 2;
      const offsetY = (size - drawH) / 2;

      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      const pngDataUrl = canvas.toDataURL('image/png');
      applyFaviconHref(pngDataUrl, 'image/png');
    } catch {
      applyFaviconHref(trimmed);
    }
  };
  img.onerror = () => {
    applyFaviconHref(DEFAULT_FAVICON);
  };
  img.src = trimmed;
}
