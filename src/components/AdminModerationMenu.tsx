import React, { useState, useRef, useEffect } from "react";
import { 
  MoreVertical, 
  Trash2, 
  Ban, 
  ShieldAlert, 
  AlertTriangle, 
  X, 
  Shield, 
  Check, 
  Loader2, 
  Cpu
} from "lucide-react";
import { getApiUrl, safeFetchJson } from "../utils/api";
import { getCachedHardwareFingerprint } from "../utils/deviceFingerprint";

interface AdminModerationMenuProps {
  targetUserId: number;
  targetUsername: string;
  currentUsername?: string;
  onSuccess?: (actionType: "delete" | "ban-account" | "ban-device") => void;
  className?: string;
  variant?: "dots" | "button";
}

type ModalType = "delete" | "ban-account" | "ban-device" | null;

export default function AdminModerationMenu({
  targetUserId,
  targetUsername,
  currentUsername,
  onSuccess,
  className = "",
  variant = "dots"
}: AdminModerationMenuProps) {
  const isEmirgan = currentUsername?.trim().toLowerCase() === "emirgan";
  const isTargetEmirgan = targetUsername?.trim().toLowerCase() === "emirgan";

  // Strict check: Only "emirgan" can see and trigger this menu, and never on himself
  if (!isEmirgan || isTargetEmirgan || !targetUserId) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Outside click to close menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const openActionModal = (type: ModalType) => {
    setIsOpen(false);
    setErrorMsg("");
    setSuccessMsg("");
    setReason("");
    setActiveModal(type);
  };

  const handleExecuteAction = async () => {
    if (!activeModal) return;
    setIsLoading(true);
    setErrorMsg("");

    const token = localStorage.getItem("token") || localStorage.getItem("lan_token") || "";
    const hwFingerprint = getCachedHardwareFingerprint();

    let endpoint = "";
    let method = "POST";
    let body: any = { reason: reason.trim() || undefined };

    if (activeModal === "delete") {
      endpoint = `/api/admin/users/${targetUserId}/delete`;
      method = "DELETE";
      body = undefined;
    } else if (activeModal === "ban-account") {
      endpoint = `/api/admin/users/${targetUserId}/ban-account`;
      method = "POST";
    } else if (activeModal === "ban-device") {
      endpoint = `/api/admin/users/${targetUserId}/ban-hardware`;
      method = "POST";
    }

    try {
      const targetUrl = getApiUrl(endpoint);
      const res = await fetch(targetUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Hardware-Fingerprint": hwFingerprint,
          "X-Device-Id": hwFingerprint
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "İşlem sırasında bir hata meydana geldi.");
      }

      const completedAction = activeModal;
      setSuccessMsg(data.message || "İşlem başarıyla tamamlandı.");
      
      setTimeout(() => {
        setActiveModal(null);
        if (onSuccess) {
          onSuccess(completedAction);
        }
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "İşlem başarısız.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={menuRef}>
      {/* Trigger Button */}
      {variant === "dots" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="p-1.5 rounded-lg text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 active:bg-amber-500/20 transition-colors cursor-pointer border border-amber-500/30 flex items-center gap-1 text-xs font-bold"
          title="Yönetici Moderasyon Menüsü (emirgan)"
        >
          <Shield size={14} className="text-amber-500" />
          <MoreVertical size={13} />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-bold shadow-md shadow-red-600/30 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <ShieldAlert size={15} />
          <span>Yönetici Moderasyon</span>
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1.5 w-60 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-200"
        >
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] font-bold text-amber-400">
            <span className="flex items-center gap-1">
              <Shield size={12} />
              <span>Yönetici: @{targetUsername}</span>
            </span>
            <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300 font-mono">
              ID: {targetUserId}
            </span>
          </div>

          {/* Option 1: Hesabı Sil */}
          <button
            type="button"
            onClick={() => openActionModal("delete")}
            className="w-full px-3 py-2.5 text-left text-xs font-semibold hover:bg-red-950/40 text-slate-200 hover:text-red-400 flex items-center gap-2.5 transition-colors cursor-pointer group"
          >
            <span className="w-6 h-6 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 flex items-center justify-center text-red-500">
              <Trash2 size={13} />
            </span>
            <div>
              <p className="font-bold">Hesabı Sil</p>
              <p className="text-[10px] text-slate-400">Tüm verileri ve kayıtları temizler</p>
            </div>
          </button>

          {/* Option 2: Hesabı Kalıcı Banla */}
          <button
            type="button"
            onClick={() => openActionModal("ban-account")}
            className="w-full px-3 py-2.5 text-left text-xs font-semibold hover:bg-amber-950/40 text-slate-200 hover:text-amber-400 flex items-center gap-2.5 transition-colors cursor-pointer group"
          >
            <span className="w-6 h-6 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center text-amber-500">
              <Ban size={13} />
            </span>
            <div>
              <p className="font-bold">Hesabı Kalıcı Banla</p>
              <p className="text-[10px] text-slate-400">Giriş yapmasını engeller, oturumu kapatır</p>
            </div>
          </button>

          {/* Option 3: Cihazı Kalıcı Banla (Hardware Ban) */}
          <button
            type="button"
            onClick={() => openActionModal("ban-device")}
            className="w-full px-3 py-2.5 text-left text-xs font-semibold hover:bg-rose-950/60 text-slate-200 hover:text-rose-400 flex items-center gap-2.5 transition-colors cursor-pointer group border-t border-slate-800/80 mt-1 pt-2"
          >
            <span className="w-6 h-6 rounded-lg bg-rose-500/20 group-hover:bg-rose-500/30 flex items-center justify-center text-rose-400">
              <Cpu size={13} />
            </span>
            <div>
              <p className="font-bold text-rose-400">Cihazı Kalıcı Banla</p>
              <p className="text-[10px] text-slate-400">Hardware & Fingerprint Kilidi</p>
            </div>
          </button>
        </div>
      )}

      {/* Confirmation & Execution Modal */}
      {activeModal && (
        <div 
          className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 text-slate-200 animate-in fade-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            
            {/* Close Button */}
            <button
              onClick={() => setActiveModal(null)}
              disabled={isLoading}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Modal Icon and Title */}
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                activeModal === "delete" 
                  ? "bg-red-500/20 text-red-500 border border-red-500/30" 
                  : activeModal === "ban-device"
                  ? "bg-rose-600/20 text-rose-400 border border-rose-500/30"
                  : "bg-amber-500/20 text-amber-500 border border-amber-500/30"
              }`}>
                {activeModal === "delete" ? (
                  <Trash2 size={24} />
                ) : activeModal === "ban-device" ? (
                  <Cpu size={24} />
                ) : (
                  <Ban size={24} />
                )}
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  {activeModal === "delete" && "Hesabı Tamamen Sil"}
                  {activeModal === "ban-account" && "Hesabı Kalıcı Olarak Banla"}
                  {activeModal === "ban-device" && "Kalıcı Cihaz Banı (Hardware Ban)"}
                </h3>
                <p className="text-xs text-amber-400 font-medium">
                  Yönetici Yetkisi: emirgan • Hedef: @{targetUsername}
                </p>
              </div>
            </div>

            {/* Warning Descriptions */}
            <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800">
              {activeModal === "delete" && (
                <>
                  <p>
                    <strong className="text-white">"{targetUsername}"</strong> adlı kullanıcının hesabı, tüm gönderileri, yorumları, mesajları ve arkadaşlıkları veritabanından kalıcı olarak silinecektir.
                  </p>
                  <p className="text-red-400 font-semibold flex items-center gap-1">
                    <AlertTriangle size={13} className="shrink-0" />
                    Bu işlem geri alınamaz ve kullanıcının oturumu derhal düşürülür.
                  </p>
                </>
              )}

              {activeModal === "ban-account" && (
                <>
                  <p>
                    <strong className="text-white">"{targetUsername}"</strong> hesabının durumu askıya alınacak, tüm aktif tokenları geçersiz kılınacak ve siteden derhal uzaklaştırılacaktır.
                  </p>
                  <p className="text-amber-400 font-semibold flex items-center gap-1">
                    <ShieldAlert size={13} className="shrink-0" />
                    Kullanıcı bu hesapla tekrar giriş yapamayacaktır.
                  </p>
                </>
              )}

              {activeModal === "ban-device" && (
                <>
                  <p>
                    <strong className="text-white">"{targetUsername}"</strong> kullanıcısının fiziksel cihaz parmak izi (GPU/Audio/Hardware Fingerprint) kalıcı olarak kara listeye alınacaktır.
                  </p>
                  <p className="text-rose-400 font-bold flex items-center gap-1">
                    <Cpu size={14} className="shrink-0" />
                    IP adresi kullanılmaz; kullanıcı yeni hesap açsa, modemi resetlese, çerezlerini silse veya gizli sekmeye geçse dahi bu cihazdan asla siteye erişemez.
                  </p>
                </>
              )}
            </div>

            {/* Optional Reason Input */}
            {activeModal !== "delete" && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Yaptırım Gerekçesi (Opsiyonel):
                </label>
                <input
                  type="text"
                  placeholder="Kural ihlali, uygunsuz davranış, spam..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            )}

            {/* Error & Success Messages */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <Check size={14} className="shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={isLoading}
                className={`flex-1 py-2.5 px-4 rounded-xl text-white text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeModal === "delete"
                    ? "bg-red-600 hover:bg-red-700 shadow-red-600/30"
                    : activeModal === "ban-device"
                    ? "bg-rose-700 hover:bg-rose-800 shadow-rose-700/30"
                    : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/30"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>İşleniyor...</span>
                  </>
                ) : (
                  <>
                    {activeModal === "delete" && <Trash2 size={14} />}
                    {activeModal === "ban-account" && <Ban size={14} />}
                    {activeModal === "ban-device" && <Cpu size={14} />}
                    <span>Onayla ve Uygula</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
