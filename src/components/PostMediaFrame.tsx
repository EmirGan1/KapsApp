import React, { useState } from "react";
import { Maximize2, Film, AlertCircle } from "lucide-react";

interface PostMediaFrameProps {
  src: string;
  mediaType?: "image" | "video" | "voice" | "file";
  alt?: string;
  onClick?: () => void;
  className?: string;
  containerClassName?: string;
  showExpandButton?: boolean;
}

export default function PostMediaFrame({
  src,
  mediaType = "image",
  alt = "Gönderi medyası",
  onClick,
  className = "",
  containerClassName = "",
  showExpandButton = true,
}: PostMediaFrameProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const isVideo =
    mediaType === "video" ||
    /\.(mp4|webm|mov|mkv|avi)(\?.*)?$/i.test(src);

  if (hasError) {
    return (
      <div className="w-full h-64 bg-slate-900/90 rounded-2xl flex flex-col items-center justify-center text-slate-400 border border-slate-800 p-4">
        <AlertCircle size={32} className="text-red-400 mb-2" />
        <span className="text-xs font-medium">Medya yüklenemedi</span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative w-full h-[320px] sm:h-[400px] max-h-[420px] bg-neutral-950/95 dark:bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-neutral-800/80 shadow-inner group/media select-none cursor-pointer transition-all duration-200 ${containerClassName}`}
    >
      {/* 1. Modern Blur Backdrop: Creates an aesthetic ambient glow that fills pillarbox/letterbox gaps without stretching */}
      {isVideo ? (
        <video
          src={src}
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-125 pointer-events-none"
        />
      ) : (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-125 pointer-events-none transition-transform duration-500 group-hover/media:scale-130"
        />
      )}

      {/* Subtle dark vignette overlay */}
      <div className="absolute inset-0 bg-black/25 pointer-events-none" />

      {/* 2. Main Foreground Media: NEVER cropped (object-contain), strictly fits within the frame with exact aspect ratio */}
      {isVideo ? (
        <div className="relative z-10 w-full h-full flex items-center justify-center p-1">
          <video
            src={src}
            autoPlay
            muted
            loop
            playsInline
            className={`max-h-full max-w-full w-auto h-auto object-contain rounded-xl shadow-lg pointer-events-none ${className}`}
            onLoadedData={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
        </div>
      ) : (
        <div className="relative z-10 w-full h-full flex items-center justify-center p-1">
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={`max-h-full max-w-full w-auto h-auto object-contain rounded-xl shadow-lg transition-transform duration-300 group-hover/media:scale-[1.01] ${className}`}
          />
        </div>
      )}

      {/* 3. Expand / Fullscreen Floating Trigger */}
      {showExpandButton && (
        <div
          className="absolute top-3 right-3 z-20 bg-black/60 hover:bg-black/90 text-white px-3 py-1.5 rounded-full opacity-0 group-hover/media:opacity-100 transition-all duration-200 backdrop-blur-md flex items-center gap-1.5 shadow-lg scale-95 group-hover/media:scale-100"
          title="Büyüt ve Tam Ekranda Gör"
        >
          {isVideo ? (
            <>
              <Film size={14} className="text-cyan-400" />
              <span className="text-[11px] font-semibold">Sesli & Tam Ekran</span>
            </>
          ) : (
            <>
              <Maximize2 size={14} className="text-blue-400" />
              <span className="text-[11px] font-semibold">Büyüt</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
