import FingerprintJS from '@fingerprintjs/fingerprintjs';

/**
 * ============================================================================
 * PHYSICAL HARDWARE & MULTI-LAYER BROWSER FINGERPRINTING (ANTI-TAMPER)
 * ============================================================================
 * This module derives a permanent physical hardware identifier (`device_uuid`)
 * from low-level GPU/WebGL properties, AudioContext buffer processing characteristics,
 * CPU/RAM hardware specs, and Canvas rendering engines.
 *
 * It uses a 3-tier self-healing storage (Evercookie / Anti-Tamper) across:
 * 1. LocalStorage
 * 2. IndexedDB (KapsSecurityDB)
 * 3. CacheStorage (kaps-security-v1)
 *
 * If the user clears browser cookies/localStorage, the identifier is
 * automatically restored from IndexedDB or CacheStorage seamlessly.
 */

const STORAGE_KEY = 'kaps_hw_fingerprint';
const LEGACY_STORAGE_KEY = 'kaps_device_id';
const IDB_DB_NAME = 'KapsSecurityDB';
const IDB_STORE_NAME = 'HardwareKeyStore';
const IDB_KEY = 'device_uuid';
const CACHE_NAME = 'kaps-security-v1';
const CACHE_URL = '/kaps-hw-identifier.json';

let cachedFingerprint: string = '';
let fpJsPromise: ReturnType<typeof FingerprintJS.load> | null = null;

// Synchronous fast-read on startup from localStorage
if (typeof window !== 'undefined') {
  try {
    cachedFingerprint = 
      localStorage.getItem(STORAGE_KEY) || 
      localStorage.getItem(LEGACY_STORAGE_KEY) || 
      '';
  } catch {}
}

/**
 * Computes a SHA-256 hexadecimal string from any arbitrary text string.
 */
async function sha256(str: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    // Fallback DJB2-like hash if subtle crypto is unavailable
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return 'hw_' + Math.abs(hash).toString(16).padStart(16, '0');
  }

  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 1. WebGL & GPU Hardware Fingerprinting
 * Extracts GPU model (UNMASKED_RENDERER_WEBGL), Vendor, Supported Extensions, and Shader rendering artifacts.
 */
function getWebGLFingerprint(): string {
  if (typeof window === 'undefined') return 'no-webgl';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'no-webgl-context';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
    const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : '';
    const glVendor = gl.getParameter(gl.VENDOR) || '';
    const glRenderer = gl.getParameter(gl.RENDERER) || '';
    const glVersion = gl.getParameter(gl.VERSION) || '';
    const shadingLanguageVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || '';

    // Max texture size & vertex attributes
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
    const maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS) || 0;
    const maxVaryingVectors = gl.getParameter(gl.MAX_VARYING_VECTORS) || 0;

    // Shader Precision Format
    let precisionStr = '';
    try {
      const vShaderPrecision = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
      const fShaderPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      if (vShaderPrecision && fShaderPrecision) {
        precisionStr = `${vShaderPrecision.precision}_${vShaderPrecision.rangeMin}_${vShaderPrecision.rangeMax}_${fShaderPrecision.precision}`;
      }
    } catch {}

    // WebGL Extensions list signature
    const extensions = (gl.getSupportedExtensions() || []).sort().join(';');

    return [
      renderer,
      vendor,
      glVendor,
      glRenderer,
      glVersion,
      shadingLanguageVersion,
      maxTextureSize,
      maxVertexAttribs,
      maxVaryingVectors,
      precisionStr,
      extensions
    ].join('||');
  } catch (err) {
    return 'webgl-err';
  }
}

/**
 * 2. AudioContext Acoustic Hardware Processing Fingerprint
 * Renders an audio wave buffer with dynamics compression to measure physical sound card DSP characteristics.
 */
async function getAudioFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return 'no-audio';
  return new Promise((resolve) => {
    try {
      const AudioContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      if (!AudioContextClass) {
        return resolve('no-offline-audio-context');
      }

      const context = new AudioContextClass(1, 44100, 44100);
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, context.currentTime);

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, context.currentTime);
      compressor.knee.setValueAtTime(40, context.currentTime);
      compressor.ratio.setValueAtTime(12, context.currentTime);
      compressor.attack.setValueAtTime(0, context.currentTime);
      compressor.release.setValueAtTime(0.25, context.currentTime);

      oscillator.connect(compressor);
      compressor.connect(context.destination);
      oscillator.start(0);

      context.oncomplete = (event) => {
        try {
          const renderedBuffer = event.renderedBuffer;
          const channelData = renderedBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 4500; i < 5000; i++) {
            sum += Math.abs(channelData[i]);
          }
          resolve('audio_' + sum.toString());
        } catch {
          resolve('audio_render_err');
        }
      };

      context.startRendering();

      // Safety timeout in case audio context doesn't complete
      setTimeout(() => {
        resolve('audio_timeout');
      }, 500);
    } catch (e) {
      resolve('audio_init_err');
    }
  });
}

/**
 * 3. HTML5 Canvas 2D Render Fingerprint
 */
function getCanvasFingerprint(): string {
  if (typeof window === 'undefined') return 'no-canvas';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas-2d';

    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial", "Helvetica", sans-serif';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('KapsHardwareProtection#2026', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('KapsHardwareProtection#2026', 4, 17);

    // Canvas arc and winding rule
    ctx.beginPath();
    ctx.arc(50, 30, 20, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    return canvas.toDataURL();
  } catch {
    return 'canvas_err';
  }
}

/**
 * 4. Deep Physical Hardware Specs Entropy
 */
function getHardwareSpecs(): string {
  if (typeof window === 'undefined') return 'no-window';
  const nav = window.navigator as any;
  const scr = window.screen as any;

  return [
    nav.hardwareConcurrency || 'cpu-unknown',
    nav.deviceMemory || 'ram-unknown',
    scr.width + 'x' + scr.height,
    scr.availWidth + 'x' + scr.availHeight,
    scr.colorDepth || '',
    scr.pixelDepth || '',
    window.devicePixelRatio || 1,
    nav.maxTouchPoints || 0,
    nav.platform || '',
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    nav.languages ? nav.languages.join(',') : (nav.language || '')
  ].join('##');
}

/**
 * ============================================================================
 * MULTI-TIER PERSISTENT STORAGE (SELF-HEALING / ANTI-TAMPER)
 * ============================================================================
 */

// IndexedDB Layer
function getFromIndexedDB(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        try {
          const tx = db.transaction(IDB_STORE_NAME, 'readonly');
          const store = tx.objectStore(IDB_STORE_NAME);
          const getReq = store.get(IDB_KEY);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function saveToIndexedDB(val: string): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        try {
          const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
          const store = tx.objectStore(IDB_STORE_NAME);
          store.put(val, IDB_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// CacheStorage Layer
async function getFromCacheStorage(): Promise<string | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(CACHE_URL);
    if (match) {
      const json = await match.json();
      return json?.uuid || null;
    }
  } catch {}
  return null;
}

async function saveToCacheStorage(val: string): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(JSON.stringify({ uuid: val, timestamp: Date.now() }), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put(CACHE_URL, response);
  } catch {}
}

/**
 * Saves the identifier across all 3 persistent storage tiers simultaneously.
 */
async function persistAcrossAllTiers(val: string): Promise<void> {
  if (!val || typeof window === 'undefined') return;

  // 1. LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY, val);
    localStorage.setItem(LEGACY_STORAGE_KEY, val);
  } catch {}

  // 2. IndexedDB
  saveToIndexedDB(val).catch(() => {});

  // 3. CacheStorage
  saveToCacheStorage(val).catch(() => {});
}

/**
 * Checks all storage tiers for an existing token (Self-healing).
 */
async function retrieveFromAnyTier(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Check 1: LocalStorage
  try {
    const local = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (local && local.trim().length > 10) return local.trim();
  } catch {}

  // Check 2: IndexedDB
  const fromIdb = await getFromIndexedDB();
  if (fromIdb && fromIdb.trim().length > 10) {
    // Heal other tiers
    persistAcrossAllTiers(fromIdb.trim()).catch(() => {});
    return fromIdb.trim();
  }

  // Check 3: CacheStorage
  const fromCache = await getFromCacheStorage();
  if (fromCache && fromCache.trim().length > 10) {
    // Heal other tiers
    persistAcrossAllTiers(fromCache.trim()).catch(() => {});
    return fromCache.trim();
  }

  return null;
}

/**
 * Computes the primary SHA-256 Physical Hardware Fingerprint.
 */
export async function getHardwareFingerprint(): Promise<string> {
  if (cachedFingerprint && cachedFingerprint.length > 15) {
    return cachedFingerprint;
  }

  // 1. Check self-healing multi-tier storage
  const existingId = await retrieveFromAnyTier();
  if (existingId) {
    cachedFingerprint = existingId;
    return existingId;
  }

  // 2. Derive raw hardware and rendering components
  let fpJsVisitorId = '';
  try {
    if (!fpJsPromise) {
      fpJsPromise = FingerprintJS.load();
    }
    const fp = await fpJsPromise;
    const result = await fp.get();
    if (result && result.visitorId) {
      fpJsVisitorId = result.visitorId;
    }
  } catch {}

  const webglEntropy = getWebGLFingerprint();
  const audioEntropy = await getAudioFingerprint();
  const canvasEntropy = getCanvasFingerprint();
  const specsEntropy = getHardwareSpecs();

  const combinedPayload = [
    'GPU:' + webglEntropy,
    'AUDIO:' + audioEntropy,
    'CANVAS:' + canvasEntropy.slice(0, 150),
    'SPECS:' + specsEntropy,
    'FPJS:' + fpJsVisitorId
  ].join('@@@@');

  const rawHash = await sha256(combinedPayload);
  const finalFingerprint = `hw_${rawHash}`;

  cachedFingerprint = finalFingerprint;

  // Persist into all 3 storage tiers
  await persistAcrossAllTiers(finalFingerprint);

  return finalFingerprint;
}

/**
 * Alias for getHardwareFingerprint for backwards compatibility.
 */
export const getDeviceId = getHardwareFingerprint;

/**
 * Synchronous instant getter (0ms latency for synchronous callers)
 */
export function getCachedHardwareFingerprint(): string {
  if (cachedFingerprint) return cachedFingerprint;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        cachedFingerprint = stored;
        return stored;
      }
    } catch {}

    // Trigger async resolution in background
    getHardwareFingerprint().catch(() => {});
  }
  return cachedFingerprint || 'hw_pending_init';
}

/**
 * Alias for getCachedHardwareFingerprint
 */
export const getCachedDeviceId = getCachedHardwareFingerprint;

// Trigger immediate background resolution on initial module load
if (typeof window !== 'undefined') {
  getHardwareFingerprint().catch(() => {});
}
