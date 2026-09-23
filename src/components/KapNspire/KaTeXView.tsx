import React, { useMemo } from "react";
import katex from "katex";

interface KaTeXViewProps {
  math: string;
  block?: boolean;
  className?: string;
}

export default function KaTeXView({ math, block = false, className = "" }: KaTeXViewProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: block,
        throwOnError: false,
        output: "htmlAndMathml",
      });
    } catch (e) {
      return `<span class="text-red-400 font-mono text-xs">${math}</span>`;
    }
  }, [math, block]);

  return (
    <span
      className={`inline-block ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
