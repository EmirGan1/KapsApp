// Frontend API & Socket URL Yapılandırması
// Tüm istekler göreceli (relative path) olarak gönderilir: /api/* ve /socket.io/*
// Bu sayede kullanıcı kapsapp.online veya www.kapsapp.online üzerinden bağlandığında
// tarayıcı aynı origin'e istek atar ve CORS engeli oluşmaz.

/**
 * Göreceli API yolunu döndürür. (örn: /api/login)
 */
export function getApiUrl(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Socket.IO sunucu URL'ini döndürür.
 * Göreceli bağlantı için undefined döner (mevcut origin üzerinden bağlanır).
 */
export function getSocketUrl(): string | undefined {
  return undefined;
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
