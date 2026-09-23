import React from "react";
import { ShieldAlert, AlertOctagon, Lock, Cpu, RefreshCw, XCircle } from "lucide-react";
import { getCachedHardwareFingerprint } from "../utils/deviceFingerprint";

interface DeviceBanScreenProps {
  reason?: string;
  onRetry?: () => void;
}

export default function DeviceBanScreen({ reason, onRetry }: DeviceBanScreenProps) {
  const hwFingerprint = getCachedHardwareFingerprint();
  const maskedId = hwFingerprint && hwFingerprint !== "hw_pending_init"
    ? `${hwFingerprint.slice(0, 10)}...${hwFingerprint.slice(-8)}`
    : "HW-FINGERPRINT-LOCKED";

  return (
    <div className="fixed inset-0 z-[999999] bg-black flex items-center justify-center p-4 select-none overflow-y-auto">
      {/* Dark Red Radial Glow Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-950/50 via-black to-black pointer-events-none" />

      <div className="relative max-w-lg w-full bg-zinc-950/95 border-2 border-red-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-red-950/90 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-300">
        
        {/* Pulsing Lock / Hardware Alert Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-red-600/20 border-2 border-red-500/50 flex items-center justify-center text-red-500 mb-6 shadow-xl shadow-red-600/30">
          <ShieldAlert size={44} className="animate-pulse" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-red-950 border border-red-700 text-red-400 text-xs font-black uppercase tracking-wider mb-3 shadow-inner">
          <AlertOctagon size={14} />
          <span>Fiziksel Cihaz / Donanım Engeli</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
          Cihaz Kalıcı Olarak Yasaklandı
        </h1>

        {/* Primary Required Notice Message */}
        <div className="p-4 rounded-2xl bg-red-950/50 border border-red-800/80 text-red-100 text-sm sm:text-base font-bold leading-relaxed mb-6 shadow-lg">
          {reason || "Bu cihaz, platform kurallarının ihlali nedeniyle kalıcı olarak yasaklanmıştır. Yeni hesap açılamaz."}
        </div>

        {/* Technical Explanations */}
        <div className="space-y-3 text-left text-xs text-zinc-400 bg-black/80 p-4 rounded-2xl border border-zinc-800 mb-6">
          <div className="flex items-start gap-2.5">
            <Cpu size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-zinc-200">Fiziksel Donanım Parmak İzi (Hardware Ban):</span>
              <p className="mt-0.5 text-zinc-400 leading-relaxed">
                Bu engel IP adresine değil; doğrudan cihazınızın ekran kartı (GPU), ses çipi, işlemci mimarisi ve donanım bileşenlerine uygulanmıştır.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Lock size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-zinc-200">Kalıcı Korumalı Bellek (Anti-Tamper):</span>
              <p className="mt-0.5 text-zinc-400 leading-relaxed">
                Gizli sekmeye geçmek, tarayıcı geçmişini/çerezleri silmek, modemi resetlemek veya VPN kullanmak bu engeli kaldırmaz.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-zinc-200">Hesap Açma Kısıtlaması:</span>
              <p className="mt-0.5 text-zinc-400 leading-relaxed">
                Bu cihaz üzerinden hiçbir yeni kullanıcı hesabı oluşturulamaz veya mevcut hesaplara giriş yapılamaz.
              </p>
            </div>
          </div>

          <div className="pt-2.5 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>Donanım İmzası:</span>
            <span className="text-red-400 bg-zinc-900 px-2.5 py-0.5 rounded border border-zinc-800 font-bold">
              {maskedId}
            </span>
          </div>
        </div>

        {/* Action Button (if retry handler provided) */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer border border-zinc-700"
          >
            <RefreshCw size={14} />
            <span>Yeniden Kontrol Et</span>
          </button>
        )}

        <p className="text-[11px] text-zinc-600 mt-4">
          Güvenlik Protokolü • KapsApp Donanım Koruma Sistemi
        </p>
      </div>
    </div>
  );
}
