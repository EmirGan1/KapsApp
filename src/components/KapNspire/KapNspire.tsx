import React, { useState, useEffect, useRef } from "react";
import { 
  Calculator, Layers, BookOpen, Monitor, Smartphone, 
  BatteryMedium, CornerDownLeft, RotateCcw,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Hash, FunctionSquare, Triangle, Type, X, Delete
} from "lucide-react";
import { useNspireEngine, exprToLatex } from "../../utils/useNspireEngine";
import KaTeXView from "./KaTeXView";
import NspireGraph from "./NspireGraph";
import NspireMatrix from "./NspireMatrix";

type MobileKeypadTab = "num" | "fn" | "trig" | "alpha";

export default function KapNspire() {
  const [viewMode, setViewMode] = useState<"handheld" | "workspace">("handheld");
  const [activeTab, setActiveTab] = useState<"calc" | "graph" | "matrix" | "help">("calc");
  const [ctrlActive, setCtrlActive] = useState<boolean>(false);
  const [mobileKeypadTab, setMobileKeypadTab] = useState<MobileKeypadTab>("num");
  const [showMenuPopup, setShowMenuPopup] = useState<boolean>(false);

  const {
    input,
    setInput,
    angleMode,
    setAngleMode,
    history,
    calculate,
    historyUp,
    historyDown,
    appendInput,
    backspace,
    clearAll,
    clearHistory,
    variablesScope,
  } = useNspireEngine();

  const historyEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll calculation history
  useEffect(() => {
    if (activeTab === "calc") {
      historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [history, input, activeTab]);

  // Physical Keyboard Input Listener (Desktop / External Keyboards)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Allow native typing inside text inputs and textareas (like in graphing or matrix tools)
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        calculate();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearAll();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        historyUp();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        historyDown();
      } else if (/^[0-9a-zA-Z+\-*/^().,!=|:_ ]$/.test(e.key)) {
        e.preventDefault();
        appendInput(e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [calculate, backspace, clearAll, historyUp, historyDown, appendInput]);

  // Handle hardware button clicks with ctrl modifier support
  const handleKeyClick = (baseKey: string, ctrlKey?: string, isAction?: () => void) => {
    if (isAction) {
      isAction();
      setCtrlActive(false);
      return;
    }

    if (ctrlActive && ctrlKey) {
      appendInput(ctrlKey);
      setCtrlActive(false);
    } else {
      appendInput(baseKey);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full max-w-full bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Application Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black shadow-md shadow-blue-500/20 shrink-0">
            <Calculator size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-xs sm:text-sm font-black text-white tracking-wide">Kap-Nspire™ CX II-T</h1>
              <span className="px-1.5 py-0.2 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded text-[9px] sm:text-[10px] font-bold">
                CAS Edition
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Bilimsel Grafik & Bilgisayarlı Cebir Sistemi (Computer Algebra System)
            </p>
          </div>
        </div>

        {/* Mode Selector (Handheld vs Workspace) */}
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="flex bg-slate-800 p-0.5 sm:p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setViewMode("handheld")}
              className={`px-2 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === "handheld" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone size={13} /> <span className="hidden xs:inline">El Terminali</span>
            </button>
            <button
              onClick={() => setViewMode("workspace")}
              className={`px-2 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === "workspace" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <Monitor size={13} /> <span className="hidden xs:inline">Çalışma Alanı</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Screen Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-1 sm:p-3 md:p-4 overflow-hidden relative">
        {viewMode === "handheld" ? (
          /* =========================================================
             1. HANDHELD MODE (Mobil/Tablet Responsive TI-Nspire)
             ========================================================= */
          <div className="w-full max-w-[540px] h-full flex flex-col bg-slate-900 rounded-2xl sm:rounded-[36px] border sm:border-4 border-slate-800 shadow-2xl overflow-hidden p-2 sm:p-3.5 relative">
            {/* Top Glossy Bezel & Brand Logo (Desktop/Tablet) */}
            <div className="hidden sm:flex items-center justify-between px-3 py-0.5 text-slate-400 text-xs shrink-0">
              <span className="font-extrabold tracking-widest text-[10px] text-slate-300">TEXAS INSTRUMENTS</span>
              <span className="font-bold text-[10px] text-cyan-400">TI-Nspire™ CX II-T CAS</span>
            </div>

            {/* 1.1 Color LCD Screen */}
            <div className="w-full flex-1 min-h-[160px] sm:min-h-[220px] max-h-[46%] sm:max-h-[50%] bg-white text-slate-900 rounded-xl sm:rounded-2xl border-2 sm:border-4 border-slate-950 shadow-inner flex flex-col overflow-hidden relative shrink-0">
              {/* Screen Top Status Bar */}
              <div className="h-5 sm:h-6 bg-slate-800 text-slate-200 px-2 sm:px-2.5 flex items-center justify-between text-[10px] sm:text-[11px] font-mono select-none shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-bold text-cyan-300">★ Doc 1.1</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-amber-300 font-semibold">{activeTab.toUpperCase()}</span>
                  {/* Variables pill */}
                  {Object.keys(variablesScope).length > 0 && (
                    <span className="hidden xs:inline-block px-1 bg-slate-700 text-blue-300 rounded text-[9px]">
                      {Object.keys(variablesScope).map((k) => `${k}=${variablesScope[k]}`).join(", ")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAngleMode(angleMode === "RAD" ? "DEG" : "RAD")}
                    className="px-1.5 py-0.2 bg-slate-700 hover:bg-slate-600 rounded text-[9px] sm:text-[10px] font-bold text-emerald-300 cursor-pointer"
                    title="Açı Modunu Değiştir (Radyan / Derece)"
                  >
                    {angleMode}
                  </button>
                  <span className="text-[9px] sm:text-[10px] text-blue-300 font-bold">CAS</span>
                  <span className="flex items-center text-emerald-400 text-[9px] sm:text-[10px] gap-0.5">
                    <BatteryMedium size={12} /> 100%
                  </span>
                </div>
              </div>

              {/* Screen App Tab Bar */}
              <div className="flex bg-slate-100 border-b border-slate-200 text-[11px] sm:text-xs font-semibold shrink-0">
                <button
                  onClick={() => setActiveTab("calc")}
                  className={`flex-1 py-1 text-center transition-all cursor-pointer ${
                    activeTab === "calc" ? "bg-white text-blue-600 border-b-2 border-blue-600 shadow-xs font-bold" : "text-slate-500 hover:bg-slate-200/60"
                  }`}
                >
                  1: Hesapla
                </button>
                <button
                  onClick={() => setActiveTab("graph")}
                  className={`flex-1 py-1 text-center transition-all cursor-pointer ${
                    activeTab === "graph" ? "bg-white text-blue-600 border-b-2 border-blue-600 shadow-xs font-bold" : "text-slate-500 hover:bg-slate-200/60"
                  }`}
                >
                  2: Grafik
                </button>
                <button
                  onClick={() => setActiveTab("matrix")}
                  className={`flex-1 py-1 text-center transition-all cursor-pointer ${
                    activeTab === "matrix" ? "bg-white text-blue-600 border-b-2 border-blue-600 shadow-xs font-bold" : "text-slate-500 hover:bg-slate-200/60"
                  }`}
                >
                  3: Matris
                </button>
                <button
                  onClick={() => setActiveTab("help")}
                  className={`flex-1 py-1 text-center transition-all cursor-pointer ${
                    activeTab === "help" ? "bg-white text-blue-600 border-b-2 border-blue-600 shadow-xs font-bold" : "text-slate-500 hover:bg-slate-200/60"
                  }`}
                >
                  4: Kılavuz
                </button>
              </div>

              {/* Screen Body Content */}
              <div className="flex-1 overflow-hidden relative">
                {activeTab === "calc" && (
                  <div className="h-full flex flex-col justify-between bg-slate-50 p-2 font-mono overflow-y-auto">
                    {/* Calculation History Stack */}
                    <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                      {history.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center p-2">
                          <Calculator size={20} className="mb-1 text-slate-300" />
                          <span className="font-semibold">TI-Nspire Scratchpad Hazır</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">İfade yazın ve [enter] tuşuna basın</span>
                        </div>
                      )}
                      {history.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white p-1.5 sm:p-2 rounded-lg border border-slate-200 shadow-2xs space-y-0.5"
                        >
                          <div className="text-[11px] sm:text-xs text-slate-700 flex items-center justify-between">
                            <span className="text-slate-400 text-[9px]">▶</span>
                            <div className="text-right overflow-x-auto">
                              <KaTeXView math={item.latexInput} />
                            </div>
                          </div>
                          <div
                            className={`text-xs sm:text-sm font-bold flex items-center justify-end ${
                              item.isError ? "text-red-500" : "text-blue-700"
                            }`}
                          >
                            <div className="overflow-x-auto text-right">
                              <KaTeXView math={item.latexResult} />
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={historyEndRef} />
                    </div>

                    {/* Active Input Line (readOnly prevents native OS keyboard from blocking the screen) */}
                    <div className="pt-1.5 border-t border-slate-200 shrink-0">
                      <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-blue-300 shadow-inner">
                        <span className="text-blue-600 font-bold text-xs">f(x) ▶</span>
                        <div className="flex-1 text-xs font-mono text-slate-900 overflow-x-auto whitespace-nowrap">
                          {input ? (
                            <KaTeXView math={exprToLatex(input)} />
                          ) : (
                            <span className="text-slate-400 text-xs">İfade girin (örn: x^2, sin(30), 5-&gt;x)...</span>
                          )}
                        </div>
                        {input && (
                          <span className="w-1.5 h-3.5 bg-blue-600 animate-pulse rounded-xs inline-block" />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "graph" && <NspireGraph />}
                {activeTab === "matrix" && <NspireMatrix />}
                {activeTab === "help" && (
                  <div className="h-full p-2.5 text-xs overflow-y-auto bg-slate-50 text-slate-700 space-y-2">
                    <h3 className="font-bold text-slate-900 flex items-center gap-1">
                      <BookOpen size={13} className="text-blue-600" /> TI-Nspire CAS Komut Rehberi
                    </h3>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      <li><b>Değişken Atama:</b> <code className="bg-slate-200 px-1 rounded">5 -&gt; x</code> veya <code className="bg-slate-200 px-1 rounded">x := 5</code></li>
                      <li><b>Cebirsel İfadeler:</b> <code className="bg-slate-200 px-1 rounded">x^2 + 2x</code> (x tanımlıysa hesaplar, değilse sembolik basar)</li>
                      <li><b>Trigonometri:</b> <code className="bg-slate-200 px-1 rounded">sin(30)</code> (DEG modunda 0.5), <code className="bg-slate-200 px-1 rounded">cos(pi/3)</code></li>
                      <li><b>Türev & İntegral:</b> <code className="bg-slate-200 px-1 rounded">deriv(sin(x), x, 0)</code>, <code className="bg-slate-200 px-1 rounded">integrate(x^2, x, 0, 3)</code></li>
                      <li><b>Kombinasyon:</b> <code className="bg-slate-200 px-1 rounded">nCr(10, 3)</code> | <b>Permütasyon:</b> <code className="bg-slate-200 px-1 rounded">nPr(10, 3)</code></li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* 1.2 Interactive Keypad Area */}
            <div className="flex-1 flex flex-col justify-between pt-1.5 sm:pt-2 overflow-hidden">
              {/* Mobile Keypad Category Tabs (Visible on Mobile / Small screens) */}
              <div className="flex md:hidden bg-slate-950 p-1 rounded-xl border border-slate-800 mb-1 shrink-0 gap-1 text-[11px] font-bold">
                <button
                  onClick={() => setMobileKeypadTab("num")}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    mobileKeypadTab === "num" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Hash size={13} /> 123
                </button>
                <button
                  onClick={() => setMobileKeypadTab("fn")}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    mobileKeypadTab === "fn" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FunctionSquare size={13} /> f(x)
                </button>
                <button
                  onClick={() => setMobileKeypadTab("trig")}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    mobileKeypadTab === "trig" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Triangle size={13} /> Trig/Kalk
                </button>
                <button
                  onClick={() => setMobileKeypadTab("alpha")}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    mobileKeypadTab === "alpha" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Type size={13} /> a-z
                </button>
              </div>

              {/* Top Quick Actions Row: [menu], [esc], [ctrl], [clear], [del], [enter] */}
              <div className="flex items-center justify-between gap-1.5 px-0.5 mb-1 shrink-0">
                <button
                  onClick={() => setShowMenuPopup(!showMenuPopup)}
                  className="flex-1 h-8 sm:h-9 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-lg text-[10px] sm:text-xs font-bold border border-slate-700 shadow touch-manipulation cursor-pointer"
                >
                  menu
                </button>
                <button
                  onClick={() => setCtrlActive(!ctrlActive)}
                  className={`flex-1 h-8 sm:h-9 rounded-lg text-[10px] sm:text-xs font-black border transition-all active:scale-95 touch-manipulation cursor-pointer ${
                    ctrlActive
                      ? "bg-cyan-500 text-slate-950 border-cyan-300 shadow-md ring-2 ring-cyan-400"
                      : "bg-slate-800 text-cyan-400 border-cyan-900/50 hover:bg-slate-700"
                  }`}
                >
                  ctrl
                </button>
                <button
                  onClick={historyUp}
                  className="w-8 sm:w-9 h-8 sm:h-9 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-lg flex items-center justify-center border border-slate-700 shadow touch-manipulation cursor-pointer"
                  title="Önceki İşlem (Yukarı)"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={historyDown}
                  className="w-8 sm:w-9 h-8 sm:h-9 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-lg flex items-center justify-center border border-slate-700 shadow touch-manipulation cursor-pointer"
                  title="Sonraki İşlem (Aşağı)"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={backspace}
                  className="flex-1 h-8 sm:h-9 bg-slate-800 hover:bg-slate-700 active:scale-95 text-red-400 rounded-lg text-[10px] sm:text-xs font-bold border border-slate-700 shadow flex items-center justify-center gap-1 touch-manipulation cursor-pointer"
                >
                  <Delete size={14} /> del
                </button>
                <button
                  onClick={() => clearAll()}
                  className="flex-1 h-8 sm:h-9 bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-400 rounded-lg text-[10px] sm:text-xs font-bold border border-slate-700 shadow touch-manipulation cursor-pointer"
                >
                  clear
                </button>
              </div>

              {/* Dynamic Responsive Keypad Body */}
              <div className="flex-1 flex flex-col justify-between overflow-y-auto">
                {/* 1. NUMERIC & MAIN OPERATORS (Default on Desktop or Mobile 'num' Tab) */}
                {(mobileKeypadTab === "num" || window.innerWidth >= 768) && (
                  <div className="space-y-1">
                    {/* Quick Math Shortcuts Row */}
                    <div className="grid grid-cols-6 gap-1 text-xs">
                      <button
                        onClick={() => handleKeyClick("x")}
                        className="h-8 sm:h-9 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-mono font-bold touch-manipulation cursor-pointer"
                      >
                        x
                      </button>
                      <button
                        onClick={() => handleKeyClick("y")}
                        className="h-8 sm:h-9 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-mono font-bold touch-manipulation cursor-pointer"
                      >
                        y
                      </button>
                      <button
                        onClick={() => handleKeyClick("^2", "sqrt(")}
                        className={`h-8 sm:h-9 rounded-lg font-mono font-bold touch-manipulation cursor-pointer transition-colors active:scale-95 ${
                          ctrlActive ? "bg-cyan-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
                        }`}
                      >
                        {ctrlActive ? "√" : "x²"}
                      </button>
                      <button
                        onClick={() => handleKeyClick("^")}
                        className="h-8 sm:h-9 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-mono font-bold touch-manipulation cursor-pointer"
                      >
                        ^
                      </button>
                      <button
                        onClick={() => handleKeyClick("e^", "ln(")}
                        className={`h-8 sm:h-9 rounded-lg font-mono font-bold touch-manipulation cursor-pointer transition-colors active:scale-95 ${
                          ctrlActive ? "bg-cyan-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
                        }`}
                      >
                        {ctrlActive ? "ln" : "eˣ"}
                      </button>
                      <button
                        onClick={() => handleKeyClick("10^", "log10(")}
                        className={`h-8 sm:h-9 rounded-lg font-mono font-bold touch-manipulation cursor-pointer transition-colors active:scale-95 ${
                          ctrlActive ? "bg-cyan-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
                        }`}
                      >
                        {ctrlActive ? "log" : "10ˣ"}
                      </button>
                    </div>

                    {/* Numeric 0-9 & Basic Arithmetic */}
                    <div className="grid grid-cols-5 gap-1 text-xs">
                      {/* Row 1 */}
                      <button onClick={() => handleKeyClick("7")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-bold text-sm shadow touch-manipulation cursor-pointer">7</button>
                      <button onClick={() => handleKeyClick("8")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-bold text-sm shadow touch-manipulation cursor-pointer">8</button>
                      <button onClick={() => handleKeyClick("9")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-bold text-sm shadow touch-manipulation cursor-pointer">9</button>
                      <button onClick={() => handleKeyClick("(")} className="h-9 sm:h-10 bg-slate-850 hover:bg-slate-750 active:scale-95 text-slate-300 rounded-lg font-bold touch-manipulation cursor-pointer">(</button>
                      <button onClick={() => handleKeyClick(")")} className="h-9 sm:h-10 bg-slate-850 hover:bg-slate-750 active:scale-95 text-slate-300 rounded-lg font-bold touch-manipulation cursor-pointer">)</button>

                      {/* Row 2 */}
                      <button onClick={() => handleKeyClick("4")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-bold text-sm shadow touch-manipulation cursor-pointer">4</button>
                      <button onClick={() => handleKeyClick("5")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-bold text-sm shadow touch-manipulation cursor-pointer">5</button>
                      <button onClick={() => handleKeyClick("6")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-bold text-sm shadow touch-manipulation cursor-pointer">6</button>
                      <button onClick={() => handleKeyClick("*")} className="h-9 sm:h-10 bg-blue-900/50 hover:bg-blue-800 active:scale-95 text-blue-200 rounded-lg font-bold text-base touch-manipulation cursor-pointer">×</button>
                      <button onClick={() => handleKeyClick("/")} className="h-9 sm:h-10 bg-blue-900/50 hover:bg-blue-800 active:scale-95 text-blue-200 rounded-lg font-bold text-base touch-manipulation cursor-pointer">÷</button>

                      {/* Row 3 */}
                      <button onClick={() => handleKeyClick("1")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-bold text-sm shadow touch-manipulation cursor-pointer">1</button>
                      <button onClick={() => handleKeyClick("2")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-bold text-sm shadow touch-manipulation cursor-pointer">2</button>
                      <button onClick={() => handleKeyClick("3")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-bold text-sm shadow touch-manipulation cursor-pointer">3</button>
                      <button onClick={() => handleKeyClick("+")} className="h-9 sm:h-10 bg-blue-900/50 hover:bg-blue-800 active:scale-95 text-blue-200 rounded-lg font-bold text-base touch-manipulation cursor-pointer">+</button>
                      <button onClick={() => handleKeyClick("-")} className="h-9 sm:h-10 bg-blue-900/50 hover:bg-blue-800 active:scale-95 text-blue-200 rounded-lg font-bold text-base touch-manipulation cursor-pointer">−</button>

                      {/* Row 4 */}
                      <button onClick={() => handleKeyClick("0")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-bold text-sm shadow touch-manipulation cursor-pointer">0</button>
                      <button onClick={() => handleKeyClick(".")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg font-bold text-sm shadow touch-manipulation cursor-pointer">.</button>
                      <button onClick={() => handleKeyClick("ans")} className="h-9 sm:h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-cyan-300 rounded-lg font-bold text-xs touch-manipulation cursor-pointer">ans</button>
                      <button
                        onClick={() => calculate()}
                        className="col-span-2 h-9 sm:h-10 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg font-bold text-xs sm:text-sm shadow-md shadow-blue-500/30 flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer"
                      >
                        <CornerDownLeft size={16} /> enter
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. FUNCTIONS & ALGEBRA TAB (Mobile 'fn') */}
                {mobileKeypadTab === "fn" && window.innerWidth < 768 && (
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                    <button onClick={() => handleKeyClick(" -> ")} className="h-10 bg-slate-800 text-cyan-300 rounded-lg">sto (→)</button>
                    <button onClick={() => handleKeyClick(" := ")} className="h-10 bg-slate-800 text-cyan-300 rounded-lg">:= (Ata)</button>
                    <button onClick={() => handleKeyClick("sqrt(")} className="h-10 bg-slate-800 text-white rounded-lg">√(x)</button>
                    <button onClick={() => handleKeyClick("abs(")} className="h-10 bg-slate-800 text-white rounded-lg">|x|</button>
                    <button onClick={() => handleKeyClick("log10(")} className="h-10 bg-slate-800 text-white rounded-lg">log₁₀(x)</button>
                    <button onClick={() => handleKeyClick("log(")} className="h-10 bg-slate-800 text-white rounded-lg">ln(x)</button>
                    <button onClick={() => handleKeyClick("nCr(")} className="h-10 bg-slate-800 text-amber-300 rounded-lg">nCr</button>
                    <button onClick={() => handleKeyClick("nPr(")} className="h-10 bg-slate-800 text-amber-300 rounded-lg">nPr</button>
                    <button onClick={() => handleKeyClick("!")} className="h-10 bg-slate-800 text-white rounded-lg">n!</button>
                    <button onClick={() => handleKeyClick("mean([")} className="h-10 bg-slate-800 text-slate-300 rounded-lg">Ortalama</button>
                    <button onClick={() => handleKeyClick("median([")} className="h-10 bg-slate-800 text-slate-300 rounded-lg">Medyan</button>
                    <button onClick={() => handleKeyClick("std([")} className="h-10 bg-slate-800 text-slate-300 rounded-lg">Std Sapma</button>
                  </div>
                )}

                {/* 3. TRIG & CALCULUS TAB (Mobile 'trig') */}
                {mobileKeypadTab === "trig" && window.innerWidth < 768 && (
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                    <button onClick={() => handleKeyClick("sin(")} className="h-10 bg-slate-800 text-white rounded-lg">sin</button>
                    <button onClick={() => handleKeyClick("cos(")} className="h-10 bg-slate-800 text-white rounded-lg">cos</button>
                    <button onClick={() => handleKeyClick("tan(")} className="h-10 bg-slate-800 text-white rounded-lg">tan</button>
                    <button onClick={() => handleKeyClick("asin(")} className="h-10 bg-slate-800 text-cyan-300 rounded-lg">arcsin</button>
                    <button onClick={() => handleKeyClick("acos(")} className="h-10 bg-slate-800 text-cyan-300 rounded-lg">arccos</button>
                    <button onClick={() => handleKeyClick("atan(")} className="h-10 bg-slate-800 text-cyan-300 rounded-lg">arctan</button>
                    <button onClick={() => handleKeyClick("deriv(")} className="h-10 bg-blue-900/60 text-cyan-300 rounded-lg font-bold">d/dx (Türev)</button>
                    <button onClick={() => handleKeyClick("integrate(")} className="h-10 bg-blue-900/60 text-cyan-300 rounded-lg font-bold">∫ (İntegral)</button>
                    <button onClick={() => handleKeyClick("sum(")} className="h-10 bg-blue-900/60 text-cyan-300 rounded-lg font-bold">Σ (Toplam)</button>
                    <button onClick={() => handleKeyClick("pi")} className="h-10 bg-slate-800 text-amber-300 rounded-lg font-bold">π</button>
                    <button onClick={() => handleKeyClick("theta")} className="h-10 bg-slate-800 text-amber-300 rounded-lg font-bold">θ</button>
                    <button onClick={() => handleKeyClick("i")} className="h-10 bg-slate-800 text-emerald-300 rounded-lg font-bold">i (Karmaşık)</button>
                  </div>
                )}

                {/* 4. ALPHA / HARF TAB (Mobile 'alpha') */}
                {mobileKeypadTab === "alpha" && window.innerWidth < 768 && (
                  <div className="grid grid-cols-7 gap-1 text-xs font-mono">
                    {["a", "b", "c", "d", "e", "f", "g",
                      "h", "i", "j", "k", "l", "m", "n",
                      "o", "p", "q", "r", "s", "t", "u",
                      "v", "w", "x", "y", "z", "=", ":", ",", " ", "->"].map((c) => (
                      <button
                        key={c}
                        onClick={() => handleKeyClick(c)}
                        className="h-9 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold"
                      >
                        {c === " " ? "spc" : c}
                      </button>
                    ))}
                  </div>
                )}

                {/* Desktop QWERTY bottom mini keyboard */}
                <div className="hidden md:block px-1 mt-1 pt-1 border-t border-slate-800">
                  <div className="grid grid-cols-10 gap-0.5 text-[9px] font-mono">
                    {["q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
                      "a", "s", "d", "f", "g", "h", "j", "k", "l", ",",
                      "z", "x", "c", "v", "b", "n", "m", "=", " ", "->"].map((char) => (
                      <button
                        key={char}
                        onClick={() => handleKeyClick(char)}
                        className="h-5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded border border-slate-850 flex items-center justify-center cursor-pointer"
                      >
                        {char === " " ? "spc" : char}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Menu Popup */}
            {showMenuPopup && (
              <div className="absolute inset-x-4 top-12 bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl p-3 z-30 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-bold text-blue-400">TI-Nspire Menü Fonksiyonları</span>
                  <button onClick={() => setShowMenuPopup(false)} className="text-slate-400 hover:text-white"><X size={15} /></button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => { appendInput("deriv("); setShowMenuPopup(false); }} className="p-2 bg-slate-800 hover:bg-slate-700 text-left rounded text-[11px]">1: Kalkülüs &gt; d/dx()</button>
                  <button onClick={() => { appendInput("integrate("); setShowMenuPopup(false); }} className="p-2 bg-slate-800 hover:bg-slate-700 text-left rounded text-[11px]">2: Kalkülüs &gt; ∫()</button>
                  <button onClick={() => { appendInput("sum("); setShowMenuPopup(false); }} className="p-2 bg-slate-800 hover:bg-slate-700 text-left rounded text-[11px]">3: Kalkülüs &gt; Σ()</button>
                  <button onClick={() => { appendInput("nCr("); setShowMenuPopup(false); }} className="p-2 bg-slate-800 hover:bg-slate-700 text-left rounded text-[11px]">4: İstatistik &gt; nCr()</button>
                  <button onClick={() => { appendInput("mean(["); setShowMenuPopup(false); }} className="p-2 bg-slate-800 hover:bg-slate-700 text-left rounded text-[11px]">5: İstatistik &gt; Ortalama</button>
                  <button onClick={() => { appendInput(" -> "); setShowMenuPopup(false); }} className="p-2 bg-slate-800 hover:bg-slate-700 text-left rounded text-[11px]">6: Değişken &gt; sto (→)</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* =========================================================
             2. WORKSPACE / COMPUTER MODE (Genişletilmiş Çalışma Alanı)
             ========================================================= */
          <div className="w-full h-full max-h-full flex flex-col md:flex-row gap-3 sm:gap-4 bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-800 p-2 sm:p-4 shadow-xl overflow-hidden">
            {/* Left Big Workspace View */}
            <div className="flex-1 flex flex-col bg-white rounded-xl sm:rounded-2xl border-2 border-slate-700 shadow-inner overflow-hidden">
              {/* Workspace App Nav Tabs */}
              <div className="flex bg-slate-800 text-slate-200 px-3 sm:px-4 py-2 justify-between items-center text-xs shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2 font-bold overflow-x-auto">
                  <button
                    onClick={() => setActiveTab("calc")}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
                      activeTab === "calc" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    1: Hesapla (CAS)
                  </button>
                  <button
                    onClick={() => setActiveTab("graph")}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
                      activeTab === "graph" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    2: Grafik Çizici
                  </button>
                  <button
                    onClick={() => setActiveTab("matrix")}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
                      activeTab === "matrix" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    3: Matris & Vektörler
                  </button>
                  <button
                    onClick={() => setActiveTab("help")}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
                      activeTab === "help" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    4: Kılavuz
                  </button>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setAngleMode(angleMode === "RAD" ? "DEG" : "RAD")}
                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-emerald-300"
                  >
                    {angleMode}
                  </button>
                  <span className="text-blue-400 font-bold hidden sm:inline">TI-Nspire CAS</span>
                </div>
              </div>

              {/* Workspace Content Display */}
              <div className="flex-1 overflow-hidden relative">
                {activeTab === "calc" && (
                  <div className="h-full flex flex-col justify-between bg-slate-50 p-3 sm:p-4 font-mono overflow-y-auto">
                    <div className="flex-1 space-y-2 sm:space-y-3 overflow-y-auto pr-1">
                      {history.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1"
                        >
                          <div className="text-xs text-slate-700 flex items-center justify-between">
                            <span className="text-slate-400 text-xs font-bold">In ▶</span>
                            <div className="text-right overflow-x-auto">
                              <KaTeXView math={item.latexInput} />
                            </div>
                          </div>
                          <div
                            className={`text-sm sm:text-base font-bold flex items-center justify-end ${
                              item.isError ? "text-red-500" : "text-blue-700"
                            }`}
                          >
                            <div className="overflow-x-auto text-right">
                              <KaTeXView math={item.latexResult} />
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={historyEndRef} />
                    </div>

                    {/* Big Workspace Input Line */}
                    <div className="pt-2 sm:pt-3 border-t border-slate-200 shrink-0">
                      <div className="flex items-center gap-2 sm:gap-3 bg-white p-2 sm:p-3 rounded-xl border border-blue-400 shadow-inner">
                        <span className="text-blue-600 font-bold text-xs sm:text-sm">f(x) ▶</span>
                        <input
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") calculate();
                          }}
                          placeholder="Matematiksel ifade girin (örn: x^2 + 2x, sin(30), 5 -> x)..."
                          className="flex-1 text-xs sm:text-sm font-mono text-slate-900 bg-transparent focus:outline-none"
                        />
                        <button
                          onClick={() => calculate()}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                        >
                          <CornerDownLeft size={14} /> Hesapla
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "graph" && <NspireGraph />}
                {activeTab === "matrix" && <NspireMatrix />}
                {activeTab === "help" && (
                  <div className="h-full p-4 sm:p-6 text-xs sm:text-sm overflow-y-auto bg-slate-50 text-slate-800 space-y-3">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                      <BookOpen className="text-blue-600" /> Kap-Nspire CAS II Kılavuzu & Fonksiyon Rehberi
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                        <h4 className="font-bold text-blue-600">Değişkenler & Cebir</h4>
                        <p>• Atama: <code>5 -&gt; x</code> veya <code>x := 5</code></p>
                        <p>• Sembolik: <code>x^2 + 2x</code></p>
                        <p>• Türev: <code>deriv(x^3 + 2x, x, 1)</code></p>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                        <h4 className="font-bold text-emerald-600">Trigonometri & Logaritma</h4>
                        <p>• Trig: <code>sin(30)</code> (DEG modunda 0.5)</p>
                        <p>• Logaritma: <code>log(100)</code>, <code>ln(e^4)</code></p>
                        <p>• Karekök: <code>sqrt(144)</code>, <code>2^10</code></p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Compact Virtual Keypad in Workspace Mode */}
            <div className="w-full md:w-80 bg-slate-950 p-3 sm:p-4 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-400">Sanal Tuş Takımı</span>
                <button
                  onClick={() => clearAll()}
                  className="px-2 py-0.5 bg-red-950/60 hover:bg-red-900 text-red-400 rounded text-[11px] font-semibold cursor-pointer"
                >
                  Temizle
                </button>
              </div>

              {/* Quick Math functions */}
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                <button onClick={() => appendInput("deriv(")} className="p-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg font-bold cursor-pointer">d/dx</button>
                <button onClick={() => appendInput("integrate(")} className="p-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg font-bold cursor-pointer">∫</button>
                <button onClick={() => appendInput("sqrt(")} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold cursor-pointer">√</button>
                <button onClick={() => appendInput("^")} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold cursor-pointer">xʸ</button>
                <button onClick={() => appendInput("sin(")} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold cursor-pointer">sin</button>
                <button onClick={() => appendInput("cos(")} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold cursor-pointer">cos</button>
                <button onClick={() => appendInput("tan(")} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold cursor-pointer">tan</button>
                <button onClick={() => appendInput("pi")} className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-bold cursor-pointer">π</button>
              </div>

              {/* Number pad */}
              <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                <button onClick={() => appendInput("7")} className="p-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-lg cursor-pointer">7</button>
                <button onClick={() => appendInput("8")} className="p-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-lg cursor-pointer">8</button>
                <button onClick={() => appendInput("9")} className="p-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-lg cursor-pointer">9</button>
                <button onClick={() => appendInput("/")} className="p-2.5 bg-blue-900/60 hover:bg-blue-800 text-blue-300 rounded-lg cursor-pointer">÷</button>
                <button onClick={() => appendInput("4")} className="p-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-lg cursor-pointer">4</button>
                <button onClick={() => appendInput("5")} className="p-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-lg cursor-pointer">5</button>
                <button onClick={() => appendInput("6")} className="p-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-lg cursor-pointer">6</button>
                <button onClick={() => appendInput("*")} className="p-2.5 bg-blue-900/60 hover:bg-blue-800 text-blue-300 rounded-lg cursor-pointer">×</button>
                <button onClick={() => appendInput("1")} className="p-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-lg cursor-pointer">1</button>
                <button onClick={() => appendInput("2")} className="p-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-lg cursor-pointer">2</button>
                <button onClick={() => appendInput("3")} className="p-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-lg cursor-pointer">3</button>
                <button onClick={() => appendInput("-")} className="p-2.5 bg-blue-900/60 hover:bg-blue-800 text-blue-300 rounded-lg cursor-pointer">−</button>
                <button onClick={() => appendInput("0")} className="p-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-lg cursor-pointer">0</button>
                <button onClick={() => appendInput(".")} className="p-2.5 bg-slate-850 hover:bg-slate-750 text-white rounded-lg cursor-pointer">.</button>
                <button onClick={backspace} className="p-2.5 bg-slate-800 hover:bg-slate-750 text-red-400 rounded-lg cursor-pointer">DEL</button>
                <button onClick={() => appendInput("+")} className="p-2.5 bg-blue-900/60 hover:bg-blue-800 text-blue-300 rounded-lg cursor-pointer">+</button>
              </div>

              <button
                onClick={() => calculate()}
                className="w-full py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                <CornerDownLeft size={15} /> Hesapla (Enter)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
