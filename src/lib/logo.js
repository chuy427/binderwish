// Vendor logo for the center of placeholder QR codes. The uploaded image is
// scaled down (keeping transparency) and stored as a small PNG data URL in the
// print settings, so it prints with no external requests and survives backups.

const MAX_PX = 160;
const MAX_FILE = 5 * 1024 * 1024;

export async function logoFromFile(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (PNG, JPG, SVG or WebP).');
  if (file.size > MAX_FILE) throw new Error('That image is too large — please use one under 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Couldn’t read that image.'));
      i.src = url;
    });
    const w = img.naturalWidth || MAX_PX, h = img.naturalHeight || MAX_PX;
    const scale = Math.min(1, MAX_PX / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return { src: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// qrcode.react settings for a centered logo: highest error correction (≈30% of
// the code can be covered), modules cleared behind the logo, and the logo kept
// to ~22% of the code's width so it still scans reliably.
export const QR_UNITS = 128;
export function qrLogoProps(options) {
  const logo = options?.qrLogo;
  if (!logo?.src) return { level: 'M', size: QR_UNITS };
  const box = QR_UNITS * 0.22;
  const aspect = logo.aspect || 1;
  const width = aspect >= 1 ? box : box * aspect;
  const height = aspect >= 1 ? box / aspect : box;
  return { level: 'H', size: QR_UNITS, imageSettings: { src: logo.src, width, height, excavate: true } };
}

// A logo needs a slightly bigger code to stay easy to scan from home prints.
export const MIN_QR_WITH_LOGO = 18;
