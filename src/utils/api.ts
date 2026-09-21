// Dinamik Backend ve API Base URL Yapılandırması
// VITE_API_URL veya VITE_BACKEND_URL tanımlıysa doğrudan onu kullanır,
// aksi takdirde vercel.json veya vite dev proxy tünelini baz alır.
export const BACKEND_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  ""
).replace(/\/$/, "");

/**
 * Göreceli API yolunu tam URL'e dönüştürür (Eğer harici backend tanımlıysa başına ekler).
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return BACKEND_URL ? `${BACKEND_URL}${cleanPath}` : cleanPath;
}

/**
 * Socket.IO sunucu URL'ini döndürür.
 * Tanımlı bir backend URL yoksa undefined dönerek tarayıcının mevcut host/proxy'sini kullanmasını sağlar.
 */
export function getSocketUrl(): string | undefined {
  return BACKEND_URL || undefined;
}

/**
 * HTML/404 veya sunucu uyku modundayken oluşabilecek "Unexpected token" JSON çökmesini engelleyen
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
