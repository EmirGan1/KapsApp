import { getCachedHardwareFingerprint, getHardwareFingerprint } from "./deviceFingerprint";

// Frontend API & WebSocket Configuration (VDS / KapsApp Architecture Standard)
export const BACKEND_URL = (
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  ""
).replace(/\/$/, "");

/**
 * Returns relative or absolute API URL
 */
export function getApiUrl(path: string = ""): string {
  if (!path) return BACKEND_URL || "";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return BACKEND_URL ? `${BACKEND_URL}${cleanPath}` : cleanPath;
}

/**
 * Returns Socket.IO URL
 */
export function getSocketUrl(): string | undefined {
  return BACKEND_URL || undefined;
}

/**
 * Safe fetch JSON wrapper with automatic Physical Hardware Fingerprint headers
 * (`X-Hardware-Fingerprint` & `X-Device-Id`) and instantaneous Device Ban interception.
 */
export async function safeFetchJson<T = any>(input: string, init?: RequestInit): Promise<T> {
  const targetUrl = getApiUrl(input);
  
  // Ensure physical hardware fingerprint is ready
  let hwFingerprint = getCachedHardwareFingerprint();
  if (!hwFingerprint || hwFingerprint === "hw_pending_init") {
    hwFingerprint = await getHardwareFingerprint();
  }

  const headers = new Headers(init?.headers || {});
  if (hwFingerprint) {
    headers.set("X-Hardware-Fingerprint", hwFingerprint);
    headers.set("X-Device-Id", hwFingerprint);
  }

  const res = await fetch(targetUrl, {
    ...init,
    headers
  });

  const contentType = res.headers.get("content-type");

  if (!contentType || !contentType.includes("application/json")) {
    const text = await res.text();
    console.error("Beklenmeyen sunucu yanıtı (HTML/404):", text);
    throw new Error("Sunucuya bağlanılamadı. Backend servisi henüz uyanmamış veya çevrimdışı olabilir.");
  }

  const data = await res.json();
  
  // Hardware / Device Ban interceptor
  if (res.status === 403 && (data.banned || data.type === "device_banned" || data.error === "DEVICE_BANNED")) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kaps:device_banned", { detail: data }));
    }
    throw new Error(data.message || data.error || "Bu cihaz platform kurallarının ihlali nedeniyle kalıcı olarak yasaklanmıştır.");
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || "İşlem gerçekleştirilemedi.");
  }

  return data;
}
