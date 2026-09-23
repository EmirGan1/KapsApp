import React from "react";
import { ShieldAlert, AlertOctagon, Lock, RefreshCw } from "lucide-react";
import { getCachedDeviceId } from "../utils/deviceFingerprint";

interface DeviceBanScreenProps {
  reason?: string;
  onRetry?: () => void;
}

export default function DeviceBanScreen({ reason, onRetry }: DeviceBanScreenProps) {
  const deviceId = getCachedDeviceId();
  const maskedId = deviceId ? `${deviceId.slice(0, 8)}...${deviceId.slice(-6)}` : "FP-IDENTIFIER";

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950 flex items-center justify-center p-4 select-none overflow-y-auto">
      {/* Background Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-950/40 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative max-w-lg w-full bg-slate-900/90 border-2 border-red-800/80 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-red-950/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
        
        {/* Pulsing Alert Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 mb-6 shadow-lg shadow-red-600/20">
          <ShieldAlert size={44} className="animate-pulse" />
        </div>

        {/* Header */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-700/60 text-red-400 text-xs font-black uppercase tracking-wider mb-3">
          <AlertOctagon size={13} />
          <span>Kalıcı Donanım / Cihaz Engeli</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
          Cihaz Erişimi Engellendi
        </h1>

        {/* Primary Notice */}
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-900/60 text-red-200 text-sm sm:text-base font-medium leading-relaxed mb-6">
          {reason || "Bu cihaz kurallara aykırı faaliyet sebebiyle platformdan kalıcı olarak uzaklaştırılmıştır."}
        </div>

        {/* Technical Explanations */}
        <div className="space-y-3 text-left text-xs text-slate-400 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 mb-6">
          <div className="flex items-start gap-2.5">
            <Lock size={15} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">Donanım & Tarayıcı Parmak İzi:</span>
              <p className="mt-0.5 text-slate-400">
                Bu kısıtlama hesap bazlı olmayıp fiziksel cihaz ve tarayıcı bileşenleri (Browser Fingerprint) üzerinden uygulanmıştır.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <AlertOctagon size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">Oturum / Çerez Koruması:</span>
              <p className="mt-0.5 text-slate-400">
                Gizli sekmeye geçmek, çerezleri temizlemek veya yeni hesap açmak platforma erişim sağlamaz.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Cihaz İmzası:</span>
            <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {maskedId}
            </span>
          </div>
        </div>

        {/* Action button if needed */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
          >
            <RefreshCw size={14} />
            <span>Bağlantıyı Yeniden Dene</span>
          </button>
        )}

        <p className="text-[11px] text-slate-500 mt-4">
          Güvenlik Bildirimi • KapsApp Yaptırım Sistemi
        </p>
      </div>
    </div>
  );
}
