// Frontend API & WebSocket Yapılandırması (VDS / KapsApp Mimari Standardı)
// Varsayılan olarak tüm istekler ve soket bağlantıları aynı origin üzerinden göreceli (relative path)
// çalışır: /api/* ve /socket.io/*.
// Geliştirme veya harici ortamda VITE_BACKEND_URL tanımlıysa ilgili adresi kullanır.

export const BACKEND_URL = (
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  ""
).replace(/\/$/, "");

/**
 * Göreceli API yolunu döndürür. (Eğer harici backend tanımlıysa başına ekler, aksi halde göreceli /api/... döner)
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return BACKEND_URL ? `${BACKEND_URL}${cleanPath}` : cleanPath;
}

/**
 * Socket.IO sunucu URL'ini döndürür.
 * Harici backend tanımlıysa onu döner, yoksa undefined dönerek doğrudan mevcut origin'i (window.location.origin) baz alır.
 */
export function getSocketUrl(): string | undefined {
  return BACKEND_URL || undefined;
}

/**
 * HTML/404 veya sunucu uyku/başlangıç modundayken oluşabilecek "Unexpected token" JSON çökmesini engelleyen
 * güvenli fetch yardımcısı.
 */
export async function safeFetchJson<T = any>(input: string, init?: RequestInit): Promise<T> {
  const targetUrl = getApiUrl(input);
  const res = await fetch(targetUrl, init);
  const contentType = res.headers.get("content-type");

  if (!contentType || !contentType.includes("application/json")) {
    const text = await res.text();
    console.error("Beklenmeyen sunucu yanıtı (HTML/404):", text);
    throw new Error("Sunucuya bağlanılamadı. Backend servisi henüz uyanmamış veya çevrimdışı olabilir.");
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "İşlem gerçekleştirilemedi.");
  }

  return data;
}
