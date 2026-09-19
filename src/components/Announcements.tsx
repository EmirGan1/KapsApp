import React, { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import DOMPurify from "dompurify";
import { 
  Megaphone, Plus, Trash2, CheckCircle2, Clock, 
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, 
  Type, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, 
  Palette, Sparkles, AlertCircle, Eye, RefreshCw, Send, ShieldAlert, X
} from "lucide-react";

export interface AnnouncementItem {
  id: number;
  title: string;
  content: string;
  author_id: number;
  author_username: string;
  created_at: string;
}

interface AnnouncementsProps {
  socket: Socket | null;
  username: string;
  currentUserId: number;
  onAnnouncementsRead?: (latestId: number) => void;
}

const COLOR_PRESETS = [
  { name: "Varsayılan", color: "inherit" },
  { name: "Mavi", color: "#2563eb" },
  { name: "Zümrüt Yeşili", color: "#059669" },
  { name: "Kırmızı / Uyarı", color: "#dc2626" },
  { name: "Kehribar / Sarı", color: "#d97706" },
  { name: "Mor", color: "#7c3aed" },
  { name: "Pembe", color: "#db2777" },
  { name: "Koyu Gri", color: "#334155" }
];

export default function Announcements({
  socket,
  username,
  currentUserId,
  onAnnouncementsRead
}: AnnouncementsProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Form states for 'emirgan'
  const [title, setTitle] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [activeColor, setActiveColor] = useState("#2563eb");
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [formError, setFormError] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const isEmirgan = username.trim().toLowerCase() === "emirgan";

  // Load announcements
  const loadAnnouncements = () => {
    if (!socket) return;
    setIsLoading(true);
    socket.emit("get_announcements", (res: any) => {
      setIsLoading(false);
      if (res?.announcements && Array.isArray(res.announcements)) {
        const sorted = [...res.announcements].sort((a, b) => b.id - a.id);
        setAnnouncements(sorted);
        if (sorted.length > 0 && onAnnouncementsRead) {
          onAnnouncementsRead(sorted[0].id);
        }
      }
    });
  };

  useEffect(() => {
    loadAnnouncements();

    if (!socket) return;

    const handleNewAnnouncement = (newAnn: AnnouncementItem) => {
      setAnnouncements((prev) => {
        const exists = prev.some((a) => a.id === newAnn.id);
        if (exists) return prev;
        const updated = [newAnn, ...prev];
        if (onAnnouncementsRead) {
          onAnnouncementsRead(newAnn.id);
        }
        return updated;
      });
    };

    const handleAnnouncementDeleted = ({ id }: { id: number }) => {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    };

    socket.on("new_announcement", handleNewAnnouncement);
    socket.on("announcement_deleted", handleAnnouncementDeleted);

    return () => {
      socket.off("new_announcement", handleNewAnnouncement);
      socket.off("announcement_deleted", handleAnnouncementDeleted);
    };
  }, [socket]);

  // Execute formatting command in contenteditable
  const formatDoc = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
    }
  };

  // Set template
  const applyTemplate = (type: "maintenance" | "feature" | "rules") => {
    let tTitle = "";
    let tHtml = "";

    if (type === "maintenance") {
      tTitle = "🛠️ Sistem Bakım ve Güncelleme Bilgilendirmesi";
      tHtml = `<h2><span style="color: #d97706;"><strong>Planlı Sistem Güncellemesi</strong></span></h2><p>Değerli üyelerimiz, sistem altyapımızda daha iyi bir kullanıcı deneyimi sağlamak adına kısa süreli bir optimizasyon çalışması gerçekleştirilecektir.</p><ul><li><strong>Tarih:</strong> Bu gece 03:00 - 04:00</li><li><strong>Kapsam:</strong> Sunucu ve canlı bağlantı hızlandırmaları</li></ul><p><span style="color: #059669;"><em>Çalışma süresince kesintisiz hizmet için teşekkür ederiz.</em></span></p>`;
    } else if (type === "feature") {
      tTitle = "🎉 Yeni Özellikler Yayında!";
      tHtml = `<h2><span style="color: #2563eb;"><strong>Platformumuza Yeni Özellikler Eklendi</strong></span></h2><p>Topluluğumuz için geliştirdiğimiz en yeni fonksiyonlar artık aktif:</p><ul><li><span style="color: #059669;"><strong>Canlı Harita & Konum Paylaşımı:</strong></span> Arkadaşlarınızı haritada görün.</li><li><span style="color: #7c3aed;"><strong>Duyuru & Bilgilendirme Sistemi:</strong></span> Önemli bildirimleri anında yakalayın.</li></ul><p>Keyifli vakitler dileriz!</p>`;
    } else if (type === "rules") {
      tTitle = "⚠️ Topluluk Kuralları ve Güvenlik Hatırlatması";
      tHtml = `<h2><span style="color: #dc2626;"><strong>Önemli Topluluk Kuralları</strong></span></h2><p>Platformumuzda tüm üyelerimizin huzurlu ve güvenli vakit geçirmesi için aşağıdaki kurallara riayet edilmesi zorunludur:</p><ol><li>Diğer kullanıcılara saygılı ve nezaketli davranınız.</li><li>Yanıltıcı veya uygunsuz paylaşımlarda bulunmayınız.</li><li>Kural ihlallerinde 5651 sayılı kanun uyarınca hesaplar askıya alınabilir.</li></ol>`;
    }

    setTitle(tTitle);
    setEditorHtml(tHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = tHtml;
    }
  };

  // Publish announcement
  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const cleanContent = (editorRef.current?.innerHTML || editorHtml || "").trim();
    if (!cleanContent || cleanContent === "<p><br></p>" || cleanContent === "<div><br></div>") {
      setFormError("Lütfen duyuru içeriğini doldurunuz.");
      return;
    }

    if (!title.trim()) {
      setFormError("Lütfen bir duyuru başlığı giriniz.");
      return;
    }

    if (!socket) {
      setFormError("Sunucu bağlantısı bulunamadı.");
      return;
    }

    setIsPublishing(true);
    socket.emit("create_announcement", {
      title: title.trim(),
      content: cleanContent
    }, (res: any) => {
      setIsPublishing(false);
      if (res?.error) {
        setFormError(res.error);
      } else {
        setTitle("");
        setEditorHtml("");
        if (editorRef.current) {
          editorRef.current.innerHTML = "";
        }
        setShowEditor(false);
        setPreviewMode(false);
        loadAnnouncements();
      }
    });
  };

  // Delete announcement (admin only)
  const handleDelete = (id: number) => {
    if (!window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
    if (socket) {
      socket.emit("delete_announcement", { id });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden select-text">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Megaphone size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Duyurular
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                {announcements.length}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Platform yöneticisi tarafından yayınlanan resmi bildirimler ve güncellemeler
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAnnouncements}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Yenile"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          </button>

          {isEmirgan && (
            <button
              onClick={() => setShowEditor(!showEditor)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {showEditor ? <X size={16} /> : <Plus size={16} />}
              <span>{showEditor ? "Kapat" : "Yeni Duyuru Gönder"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* 'emirgan' Special Rich Text Editor Panel */}
        {isEmirgan && showEditor && (
          <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/40 dark:border-blue-500/30 rounded-3xl p-5 shadow-xl shadow-blue-500/5 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Yönetici Duyuru Editörü (Zengin Metin & HTML)
                </h3>
              </div>

              {/* Quick Templates */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">Şablonlar:</span>
                <button
                  type="button"
                  onClick={() => applyTemplate("maintenance")}
                  className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[11px] font-medium hover:bg-amber-100 transition-colors"
                >
                  Bakım
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate("feature")}
                  className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-medium hover:bg-blue-100 transition-colors"
                >
                  Yenilik
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate("rules")}
                  className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-[11px] font-medium hover:bg-red-100 transition-colors"
                >
                  Kurallar
                </button>
              </div>
            </div>

            <form onSubmit={handlePublish} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Duyuru Başlığı
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Önemli Sistem Güncellemesi ve Yenilikler"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-colors"
                />
              </div>

              {/* Rich Text Editor Toolbar */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex flex-wrap items-center gap-1 text-slate-700 dark:text-slate-300">
                  {/* Text Size & Heading */}
                  <button
                    type="button"
                    onClick={() => formatDoc("formatBlock", "<h1>")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Büyük Başlık (H1)"
                  >
                    <Heading1 size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("formatBlock", "<h2>")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Alt Başlık (H2)"
                  >
                    <Heading2 size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("formatBlock", "<p>")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Normal Paragraf"
                  >
                    <Type size={17} />
                  </button>

                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                  {/* Formatting */}
                  <button
                    type="button"
                    onClick={() => formatDoc("bold")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-bold"
                    title="Kalın (Bold)"
                  >
                    <Bold size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("italic")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors italic"
                    title="İtalik (Italic)"
                  >
                    <Italic size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("underline")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors underline"
                    title="Altı Çizili"
                  >
                    <Underline size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("strikeThrough")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Üstü Çizili"
                  >
                    <Strikethrough size={17} />
                  </button>

                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                  {/* Text Color Picker Toolbar */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColorMenu(!showColorMenu)}
                      className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs font-semibold"
                      title="Yazı Rengi"
                    >
                      <Palette size={17} style={{ color: activeColor }} />
                      <span className="w-3 h-3 rounded-full border border-slate-400" style={{ backgroundColor: activeColor }}></span>
                    </button>

                    {showColorMenu && (
                      <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 shadow-xl grid grid-cols-4 gap-2 w-48 animate-in fade-in">
                        {COLOR_PRESETS.map((cp) => (
                          <button
                            key={cp.color}
                            type="button"
                            onClick={() => {
                              setActiveColor(cp.color);
                              formatDoc("foreColor", cp.color);
                              setShowColorMenu(false);
                            }}
                            className="w-8 h-8 rounded-xl flex items-center justify-center border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform cursor-pointer"
                            style={{ backgroundColor: cp.color === "inherit" ? "#94a3b8" : cp.color }}
                            title={cp.name}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                  {/* Alignment */}
                  <button
                    type="button"
                    onClick={() => formatDoc("justifyLeft")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Sola Hizala"
                  >
                    <AlignLeft size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("justifyCenter")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Ortala"
                  >
                    <AlignCenter size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("justifyRight")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Sağa Hizala"
                  >
                    <AlignRight size={17} />
                  </button>

                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                  {/* Lists */}
                  <button
                    type="button"
                    onClick={() => formatDoc("insertUnorderedList")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Madde İşaretli Liste"
                  >
                    <List size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDoc("insertOrderedList")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Numaralı Liste"
                  >
                    <ListOrdered size={17} />
                  </button>

                  <div className="flex-1"></div>

                  {/* Preview Toggle */}
                  <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      previewMode 
                        ? "bg-blue-600 text-white" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Eye size={14} />
                    <span>{previewMode ? "Düzenle" : "Önizle"}</span>
                  </button>
                </div>

                {/* Content Area */}
                {previewMode ? (
                  <div className="p-5 min-h-[160px] max-h-[300px] overflow-y-auto bg-slate-50 dark:bg-slate-950/50 prose prose-sm dark:prose-invert max-w-none text-slate-900 dark:text-white">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(editorRef.current?.innerHTML || editorHtml || "<em>İçerik boş.</em>")
                      }}
                    />
                  </div>
                ) : (
                  <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleEditorInput}
                    data-placeholder="Duyuru metnini buraya yazınız... (Renk, kalınlık ve başlık araçlarını kullanabilirsiniz)"
                    className="p-5 min-h-[160px] max-h-[300px] overflow-y-auto focus:outline-none text-slate-900 dark:text-white text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:cursor-text"
                  />
                )}
              </div>

              {formError && (
                <div className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-900/60 flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Send size={15} />
                  <span>{isPublishing ? "Yayınlanıyor..." : "Duyuruyu Canlı Yayınla"}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Announcements List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs">Duyurular yükleniyor...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-4">
              <Megaphone size={28} />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base mb-1">
              Henüz Duyuru Bulunmuyor
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Yöneticiler tarafından paylaşılan duyurular ve sistem güncellemeleri burada listelenecektir.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((ann, idx) => {
              const formattedDate = new Date(ann.created_at).toLocaleString("tr-TR", {
                dateStyle: "medium",
                timeStyle: "short"
              });

              return (
                <div
                  key={ann.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
                >
                  {/* Top Accent Line for the newest announcement */}
                  {idx === 0 && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500"></div>
                  )}

                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {ann.author_username?.[0]?.toUpperCase() || "E"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {ann.author_username}
                          </span>
                          <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-1">
                            <ShieldAlert size={11} /> Yönetici
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <Clock size={12} />
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Admin Delete Action */}
                    {isEmirgan && (
                      <button
                        onClick={() => handleDelete(ann.id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Duyuruyu Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Announcement Title */}
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-3">
                    {ann.title}
                  </h2>

                  {/* Rich HTML Content */}
                  <div
                    className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(ann.content)
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
