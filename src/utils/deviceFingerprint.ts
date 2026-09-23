import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: ReturnType<typeof FingerprintJS.load> | null = null;
let cachedVisitorId: string = typeof window !== 'undefined' ? (localStorage.getItem('kaps_device_id') || '') : '';

/**
 * High-entropy client-side fallback hash if FingerprintJS is blocked by adblockers or offline.
 */
function generateFallbackFingerprint(): string {
  if (typeof window === 'undefined') return 'server-side';
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let canvasHash = '';
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial"';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('kapsapp_device_entropy_101', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('kapsapp_device_entropy_101', 4, 17);
      canvasHash = canvas.toDataURL();
    }

    const entropyComponents = [
      navigator.userAgent || '',
      navigator.language || '',
      screen.colorDepth || '',
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || '',
      (navigator as any).deviceMemory || '',
      canvasHash.slice(0, 100)
    ].join('###');

    // Simple robust djb2-like string hash
    let hash = 5381;
    for (let i = 0; i < entropyComponents.length; i++) {
      hash = ((hash << 5) + hash) + entropyComponents.charCodeAt(i);
      hash = hash & hash;
    }
    return 'fallback_' + Math.abs(hash).toString(36) + '_' + screen.width + 'x' + screen.height;
  } catch {
    return 'fallback_' + Math.random().toString(36).substring(2, 15);
  }
}

/**
 * Initializes and retrieves the persistent Device Fingerprint ID (visitorId).
 */
export async function getDeviceId(): Promise<string> {
  if (cachedVisitorId) {
    return cachedVisitorId;
  }

  try {
    if (!fpPromise) {
      fpPromise = FingerprintJS.load();
    }
    const fp = await fpPromise;
    const result = await fp.get();
    if (result && result.visitorId) {
      cachedVisitorId = result.visitorId;
      try {
        localStorage.setItem('kaps_device_id', cachedVisitorId);
      } catch {}
      return cachedVisitorId;
    }
  } catch (err) {
    console.warn('FingerprintJS initialization notice (using high-entropy fallback):', err);
  }

  // Fallback if network blocked FingerprintJS
  const fallback = generateFallbackFingerprint();
  cachedVisitorId = fallback;
  try {
    localStorage.setItem('kaps_device_id', fallback);
  } catch {}
  return fallback;
}

/**
 * Synchronous getter for device ID from localStorage (instant 0ms retrieval)
 */
export function getCachedDeviceId(): string {
  if (cachedVisitorId) return cachedVisitorId;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('kaps_device_id');
    if (stored) {
      cachedVisitorId = stored;
      return stored;
    }
    // Generate fallback immediately so every first request has a valid deviceId
    const fallback = generateFallbackFingerprint();
    cachedVisitorId = fallback;
    try {
      localStorage.setItem('kaps_device_id', fallback);
    } catch {}
    return fallback;
  }
  return '';
}

// Trigger initialization in background on module load
if (typeof window !== 'undefined') {
  getDeviceId().catch(() => {});
}
